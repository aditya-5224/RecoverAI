/**
 * RecoverAI Execution & Reconciliation Engine
 * Executes approved bounded actions via Razorpay Test Mode with strict idempotency and audit trails.
 */

import { db } from '../db/database.ts';
import { razorpayService } from '../integrations/razorpay/service.ts';
import { policyEngine } from '../policy/policyEngine.ts';
import {
  PaymentMethod,
  RecoveryAction,
  RecoveryActionType,
  RecoveryCase,
  RecoveryCaseStatus,
} from '../../types/index.ts';

export class RecoveryEngine {
  /**
   * Execute an action on a recovery case
   */
  async executeCaseAction(params: {
    caseId: string;
    operatorActor?: 'AI_AGENT' | 'HUMAN_OPERATOR';
    forceApprove?: boolean;
    simulateOutcome?: 'SUCCESS' | 'FAILURE' | 'TIMEOUT' | 'API_ERROR';
  }): Promise<{
    case: RecoveryCase;
    action: RecoveryAction;
    message: string;
    recovered: boolean;
  }> {
    const { caseId, operatorActor = 'AI_AGENT', forceApprove = false, simulateOutcome } = params;
    const recoveryCase = db.getRecoveryCase(caseId);
    if (!recoveryCase) {
      throw new Error(`Recovery case ${caseId} does not exist.`);
    }

    // Protection: Never attempt recovery on an already-recovered case
    if (recoveryCase.status === RecoveryCaseStatus.RECOVERED) {
      return {
        case: recoveryCase,
        action: {
          id: `act_noop_${Date.now()}`,
          recoveryCaseId: caseId,
          actionType: RecoveryActionType.STOP_RECOVERY,
          proposedBy: 'POLICY_FALLBACK',
          policyResult: { allowed: false, reason: 'Already recovered', violations: ['ORDER_ALREADY_RECOVERED'], requiredApproval: false, policyVersion: '1.3.0', checkedRules: [] },
          approvalStatus: 'NOT_REQUIRED',
          executionStatus: 'SUCCESS',
          amount: 0,
          idempotencyKey: `rec_noop_${caseId}`,
        },
        message: 'Order has already been successfully recovered and captured.',
        recovered: true,
      };
    }

    // Protection: Concurrency Lock to prevent race conditions
    const lockAcquired = db.acquireExecutionLock(caseId);
    if (!lockAcquired) {
      throw new Error(`CONCURRENT_EXECUTION_IN_PROGRESS: Recovery execution for case ${caseId} is currently in-flight.`);
    }

    try {
      const customer = db.getCustomer(recoveryCase.customerId);
      const actionType = recoveryCase.recoveryStrategy || RecoveryActionType.RETRY_PAYMENT;
      const amount = recoveryCase.amountAtRisk;

    // 1. Policy & Approval Evaluation
    const policyResult = policyEngine.evaluate({
      actionType,
      amount,
      recoveryCase,
      customer,
      skipCooldownCheck: false,
    });

    if (policyResult.isHardBlocked || policyResult.violations.length > 0) {
      // Hard policy block - CANNOT be overridden by forceApprove or any operator
      const stopAction: RecoveryAction = {
        id: `act_${Date.now()}`,
        recoveryCaseId: caseId,
        actionType: RecoveryActionType.STOP_RECOVERY,
        proposedBy: operatorActor === 'HUMAN_OPERATOR' ? 'OPERATOR' : 'AI_AGENT',
        policyResult,
        approvalStatus: 'NOT_REQUIRED',
        executionStatus: 'BLOCKED',
        amount: 0,
        idempotencyKey: `rec_${caseId}_STOP_${Date.now()}`,
        failureReason: policyResult.reason,
      };
      db.saveRecoveryAction(stopAction);

      recoveryCase.status = RecoveryCaseStatus.STOPPED;
      recoveryCase.stopReason = policyResult.reason;
      recoveryCase.updatedAt = new Date().toISOString();
      db.saveRecoveryCase(recoveryCase);

      db.logAuditEvent({
        caseId,
        correlationId: `corr_${caseId}_block`,
        eventType: 'RECOVERY_STOPPED',
        actor: 'POLICY_ENGINE',
        input: { caseId, actionType, amount, forceApproveAttempted: forceApprove },
        decision: 'Enforced SAFE_STOP due to deterministic hard policy violation (Hard block cannot be bypassed)',
        reason: policyResult.reason,
        policyChecks: { violations: policyResult.violations },
        result: { finalStatus: 'STOPPED' },
      });

      return {
        case: recoveryCase,
        action: stopAction,
        message: `Execution blocked by hard policy: ${policyResult.reason}`,
        recovered: false,
      };
    }

    if (policyResult.requiredApproval && !forceApprove && recoveryCase.approvalStatus !== 'APPROVED') {
      // Must wait for human approval
      recoveryCase.status = RecoveryCaseStatus.NEEDS_APPROVAL;
      recoveryCase.approvalStatus = 'PENDING';
      recoveryCase.updatedAt = new Date().toISOString();
      db.saveRecoveryCase(recoveryCase);

      db.logAuditEvent({
        caseId,
        correlationId: `corr_${caseId}_appreq`,
        eventType: 'ACTION_APPROVAL_REQUIRED',
        actor: 'POLICY_ENGINE',
        input: { caseId, amount, actionType },
        decision: `Human manager approval required for transaction of ₹${amount.toLocaleString('en-IN')}`,
        reason: 'Value exceeds autonomous threshold (₹5,000)',
        result: { status: 'PENDING_APPROVAL' },
      });

      throw new Error(`ACTION_NEEDS_APPROVAL: Transaction value of ₹${amount.toLocaleString('en-IN')} requires explicit human approval before execution.`);
    }

    // 2. Idempotency Check
    const attemptNumber = recoveryCase.retryCount + 1;
    const idempotencyKey = `rec_${caseId}_${actionType}_${attemptNumber}`;
    const previousExecution = db.getIdempotency(idempotencyKey);

    if (previousExecution) {
      return {
        case: recoveryCase,
        action: previousExecution.result.action,
        message: 'Idempotency key matched. Returning previously verified result.',
        recovered: previousExecution.result.recovered,
      };
    }

    // 3. Execution via Razorpay Test Mode Service
    recoveryCase.status = RecoveryCaseStatus.EXECUTING;
    db.saveRecoveryCase(recoveryCase);

    const payment = recoveryCase.paymentId ? db.getPayment(recoveryCase.paymentId) : undefined;
    const method = payment?.method || PaymentMethod.UPI;

    let executionSuccess = false;
    let rzpReferenceId = '';
    let failureDetail = '';

    if (actionType === RecoveryActionType.STOP_RECOVERY) {
      executionSuccess = true;
      recoveryCase.status = RecoveryCaseStatus.STOPPED;
      recoveryCase.stopReason = 'Safe stop executed by operator or agent';
    } else if (simulateOutcome === 'TIMEOUT' || simulateOutcome === 'FAILURE') {
      // Controlled simulation outcome for testing safe stop and retry limits
      executionSuccess = false;
      failureDetail =
        simulateOutcome === 'TIMEOUT'
          ? 'GATEWAY_TIMEOUT: Issuer bank switch timed out (Simulated)'
          : 'PAYMENT_FAILED: Transaction declined by customer bank (Simulated)';
      recoveryCase.retryCount += 1;
      if (recoveryCase.retryCount >= 2) {
        recoveryCase.status = RecoveryCaseStatus.STOPPED;
        recoveryCase.stopReason = 'Retry limit (2/2) reached. Automated recovery halted.';
      }
    } else {
      // Official Razorpay Recovery Workflow: Generate authentic Payment Link (POST /v1/payment_links)
      try {
        const referenceId = `rec_${caseId}_${Date.now()}`;
        const linkRes = await razorpayService.createPaymentLink({
          amount: Math.round(amount * 100), // convert to paise
          currency: 'INR',
          reference_id: referenceId,
          description: `Recovery payment for Order ${recoveryCase.orderId || caseId}`,
          customer: {
            name: customer?.name || 'Customer',
            email: customer?.email || 'customer@example.com',
            contact: customer?.phone || '+919876543210',
          },
          notify: { sms: true, email: true },
        });

        rzpReferenceId = linkRes.id;
        recoveryCase.paymentLinkId = linkRes.id;
        recoveryCase.paymentLinkUrl = linkRes.short_url;
        recoveryCase.paymentLinkReferenceId = linkRes.reference_id;
        recoveryCase.paymentLinkCreatedAt = new Date().toISOString();
        recoveryCase.paymentLinkAdapter = linkRes.adapter;

        executionSuccess = true;
        recoveryCase.retryCount += 1;
        recoveryCase.contactAttempts += 1;
      } catch (err: any) {
        executionSuccess = false;
        failureDetail = err.message || 'Failed to generate Razorpay Payment Link';
        recoveryCase.retryCount += 1;
      }
    }

    recoveryCase.lastAttemptAt = new Date().toISOString();

    const recoveryAction: RecoveryAction = {
      id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      recoveryCaseId: caseId,
      actionType,
      proposedBy: operatorActor === 'HUMAN_OPERATOR' ? 'OPERATOR' : 'AI_AGENT',
      policyResult,
      approvalStatus: forceApprove || recoveryCase.approvalStatus === 'APPROVED' ? 'APPROVED' : 'NOT_REQUIRED',
      executionStatus: executionSuccess ? 'SUCCESS' : 'FAILED',
      amount,
      razorpayReferenceId: rzpReferenceId,
      executedAt: new Date().toISOString(),
      failureReason: executionSuccess ? undefined : failureDetail,
      idempotencyKey,
    };
    db.saveRecoveryAction(recoveryAction);

    // 4. Reconciliation & State Finalization
    if (executionSuccess && actionType !== RecoveryActionType.STOP_RECOVERY) {
      // Payment Link created successfully: transition to AWAITING_PAYMENT
      // Revenue is NOT recovered until verified payment_link.paid webhook event
      recoveryCase.status = RecoveryCaseStatus.AWAITING_PAYMENT;
      recoveryCase.amountRecovered = 0;
      recoveryCase.completedAt = undefined;

      db.logAuditEvent({
        caseId,
        correlationId: `corr_${caseId}_exec`,
        eventType: 'PAYMENT_LINK_CREATED',
        actor: operatorActor === 'HUMAN_OPERATOR' ? 'HUMAN_OPERATOR' : 'AI_AGENT',
        input: { actionType, amount, rzpReferenceId, shortUrl: recoveryCase.paymentLinkUrl },
        decision: `Successfully dispatched Payment Link Recovery in Razorpay Test Mode`,
        reason: 'Payment link generated and sent to customer; awaiting payment completion via webhook',
        result: { rzpReferenceId, status: 'AWAITING_PAYMENT', amountRecovered: 0 },
      });
    } else if (!executionSuccess) {
      const isLimitReached = recoveryCase.retryCount >= 2;
      recoveryCase.status = isLimitReached ? RecoveryCaseStatus.STOPPED : RecoveryCaseStatus.FAILED;
      if (isLimitReached) {
        recoveryCase.stopReason = `Retry limit (2/2) exhausted following error: ${failureDetail}`;
      }

      db.logAuditEvent({
        caseId,
        correlationId: `corr_${caseId}_fail`,
        eventType: isLimitReached ? 'RECOVERY_STOPPED' : 'ACTION_FAILED',
        actor: operatorActor === 'HUMAN_OPERATOR' ? 'HUMAN_OPERATOR' : 'AI_AGENT',
        input: { actionType, attemptNumber, failureDetail },
        decision: isLimitReached ? 'SAFE_STOP triggered: Retry limit exhausted' : `Execution failed: ${failureDetail}`,
        reason: failureDetail,
        result: { retryCount: recoveryCase.retryCount, status: recoveryCase.status },
      });
    }

    recoveryCase.updatedAt = new Date().toISOString();
    db.saveRecoveryCase(recoveryCase);

    const resultPayload = {
      case: recoveryCase,
      action: recoveryAction,
      message: executionSuccess
        ? `Successfully dispatched Payment Link Recovery for ₹${amount.toLocaleString('en-IN')} (Razorpay Link: ${rzpReferenceId}). Case status is now AWAITING_PAYMENT.`
        : `Execution attempt failed: ${failureDetail}`,
      recovered: false, // Revenue recovery only occurs upon verified payment_link.paid webhook!
    };

    // Store in idempotency ledger
    db.setIdempotency(idempotencyKey, resultPayload);
    return resultPayload;
    } finally {
      db.releaseExecutionLock(caseId);
    }
  }

  /**
   * Human Approval Gate: Approve action
   */
  async approveCase(caseId: string, operatorName: string = 'Merchant Admin'): Promise<RecoveryCase> {
    const recoveryCase = db.getRecoveryCase(caseId);
    if (!recoveryCase) {
      throw new Error(`Case ${caseId} not found.`);
    }

    recoveryCase.approvalStatus = 'APPROVED';
    recoveryCase.approvedBy = operatorName;
    recoveryCase.approvedAt = new Date().toISOString();
    recoveryCase.status = RecoveryCaseStatus.APPROVED;
    recoveryCase.updatedAt = new Date().toISOString();
    db.saveRecoveryCase(recoveryCase);

    db.logAuditEvent({
      caseId,
      correlationId: `corr_${caseId}_appr`,
      eventType: 'ACTION_APPROVED',
      actor: 'HUMAN_OPERATOR',
      input: { caseId, approvedBy: operatorName, amount: recoveryCase.amountAtRisk },
      decision: `Approved recovery action (${recoveryCase.recoveryStrategy || 'RETRY_PAYMENT'}) for ₹${recoveryCase.amountAtRisk.toLocaleString('en-IN')}`,
      reason: 'Human manager reviewed case diagnostic evidence and signed off',
      result: { status: 'APPROVED' },
    });

    return recoveryCase;
  }

  /**
   * Human Approval Gate: Reject action
   */
  async rejectCase(caseId: string, operatorName: string = 'Merchant Admin', reason: string = 'Operator declined'): Promise<RecoveryCase> {
    const recoveryCase = db.getRecoveryCase(caseId);
    if (!recoveryCase) {
      throw new Error(`Case ${caseId} not found.`);
    }

    recoveryCase.approvalStatus = 'REJECTED';
    recoveryCase.status = RecoveryCaseStatus.STOPPED;
    recoveryCase.stopReason = `Rejected by ${operatorName}: ${reason}`;
    recoveryCase.updatedAt = new Date().toISOString();
    db.saveRecoveryCase(recoveryCase);

    db.logAuditEvent({
      caseId,
      correlationId: `corr_${caseId}_rej`,
      eventType: 'ACTION_REJECTED',
      actor: 'HUMAN_OPERATOR',
      input: { caseId, rejectedBy: operatorName, reason },
      decision: 'Recovery proposal rejected by operator. Case safely stopped.',
      reason,
      result: { status: 'STOPPED' },
    });

    return recoveryCase;
  }
}

export const recoveryEngine = new RecoveryEngine();
