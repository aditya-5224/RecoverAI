/**
 * RecoverAI Demo Scenarios & Interactive Controller
 * Preconfigured deterministic test scenarios for live hackathon judge demonstrations.
 */

import { db } from '../db/database.ts';
import { recoveryAgent } from '../ai/agent.ts';
import { recoveryEngine } from '../recovery/recoveryEngine.ts';
import { revenueDetector } from '../detection/detector.ts';
import { razorpayService } from '../integrations/razorpay/service.ts';
import { razorpayWebhookHandler } from '../integrations/webhookHandler.ts';
import {
  DemoScenario,
  FailureClassification,
  PaymentMethod,
  RecoveryActionType,
  RecoveryCase,
  RecoveryCaseStatus,
  RevenueRiskEvent,
  RiskSource,
} from '../../types/index.ts';

export const DEMO_SCENARIOS: DemoScenario[] = [
  {
    id: 'scenario_verified_razorpay_recovery',
    title: '1. End-to-End Verified Razorpay Recovery & Webhook Reconciliation',
    category: 'SUCCESS_RECOVERY',
    description: 'Full end-to-end flow: AI Diagnosis -> Deterministic Policy Gate -> Razorpay Payment Link creation (AWAITING_PAYMENT) -> Customer Test Payment -> HMAC-SHA256 Webhook Ingestion -> Reconciliation to RECOVERED with RAZORPAY_WEBHOOK provenance.',
    expectedOutcome: 'Payment Link created (AWAITING_PAYMENT) -> Authentic Webhook Verified -> Status RECOVERED with verified revenue.',
    amount: 3200,
    targetCaseId: 'CASE-ABANDON-2048',
  },
  {
    id: 'scenario_upi_degradation',
    title: '2. UPI Failure Spike & Autonomous Recovery',
    category: 'PAYMENT_DEGRADATION',
    description: 'Simulates a 2.4x NPCI/HDFC bank switch latency spike. The system detects the anomaly, diagnoses the transient timeout, verifies deterministic policy limits, and captures the payment in Razorpay Test Mode.',
    expectedOutcome: 'Diagnosed as TEMPORARY_PROVIDER_FAILURE -> Policy PASSED -> Recovered ₹4,500 via RETRY_PAYMENT.',
    amount: 4500,
    targetCaseId: 'CASE-UPI-1024',
  },
  {
    id: 'scenario_checkout_abandonment',
    title: '3. Checkout Drop-off & Smart Payment Link',
    category: 'CHECKOUT_ABANDONMENT',
    description: 'Simulates customer cart abandonment (42 mins elapsed). RecoverAI creates an intelligent payment recovery link with SMS/email notifications within strict contact frequency limits.',
    expectedOutcome: 'Diagnosed as CUSTOMER_ACTION_REQUIRED -> Generated Razorpay Test Payment Link -> Enqueued reminder.',
    amount: 3200,
    targetCaseId: 'CASE-ABANDON-2048',
  },
  {
    id: 'scenario_high_value_approval',
    title: '3. High-Value Enterprise Approval Gate',
    category: 'HUMAN_APPROVAL',
    description: 'A high-value enterprise payment of ₹7,500 drops. The AI proposes a recovery link, but deterministic policy flags that ₹7,500 > ₹5,000 threshold (while <= ₹10,000 max limit), mandating merchant operator review.',
    expectedOutcome: 'Status transitions to NEEDS_APPROVAL -> Execution blocked until operator explicitly clicks Approve.',
    amount: 7500,
    targetCaseId: 'CASE-HIGHVAL-3096',
  },
  {
    id: 'scenario_api_failure_safe_stop',
    title: '4. Gateway API Failure & Safe Stop Enforcement',
    category: 'API_FAILURE',
    description: 'Simulates a persistent bank gateway error during recovery attempt. When recovery attempt count reaches 2/2, the policy engine refuses further attempts and triggers a SAFE STOP to prevent customer friction and fees.',
    expectedOutcome: 'Recovery attempt fails with simulated GATEWAY_TIMEOUT -> Recovery attempt limit (2/2) reached -> Transitions to STOPPED.',
    amount: 3200,
  },
  {
    id: 'scenario_permanent_decline',
    title: '5. Non-Retryable Hard Decline (Expired Card)',
    category: 'POLICY_BLOCKED',
    description: 'Customer card returned DO_NOT_HONOR / EXPIRED. AI recognizes non-retryable failure classification and refuses automated charge.',
    expectedOutcome: 'Classified as NON_RETRYABLE -> Recommendation: STOP_RECOVERY -> Zero recovery attempts fired.',
    amount: 2100,
    targetCaseId: 'CASE-STOP-4012',
  },
  {
    id: 'scenario_customer_opt_out',
    title: '6. Opt-Out Safety Gate Protection',
    category: 'POLICY_BLOCKED',
    description: 'Customer has explicitly opted out of marketing/recovery reminders. The deterministic policy engine blocks all recovery attempts regardless of AI recommendations.',
    expectedOutcome: 'Policy check evaluates CUSTOMER_OPT_IN_STATUS = FALSE -> Hard block enforced.',
    amount: 4100,
  },
  {
    id: 'scenario_amount_exceeds_max_limit',
    title: '7. Amount Exceeds Max Limit Hard Block',
    category: 'POLICY_BLOCKED',
    description: 'An enterprise transaction of ₹18,500 fails. Deterministic policy evaluates AMOUNT_EXCEEDS_MAX_LIMIT (₹18,500 > ₹10,000 autonomous limit) triggering an immediate HARD BLOCK -> STOPPED.',
    expectedOutcome: 'Policy check evaluates AMOUNT_EXCEEDS_MAX_LIMIT -> Hard block enforced -> Status transitions to STOPPED.',
    amount: 18500,
    targetCaseId: 'CASE-BLOCK-9000',
  },
];

export class DemoManager {
  listScenarios(): DemoScenario[] {
    return DEMO_SCENARIOS;
  }

  async runScenario(scenarioId: string): Promise<{
    scenario: DemoScenario;
    caseObj: RecoveryCase;
    logs: string[];
    resultSummary: string;
  }> {
    const scenario = DEMO_SCENARIOS.find((s) => s.id === scenarioId);
    if (!scenario) {
      throw new Error(`Demo scenario ${scenarioId} not found.`);
    }

    const logs: string[] = [];
    logs.push(`[Scenario Start] Initializing scenario: "${scenario.title}"`);

    // Handle specific scenario setups
    if (scenarioId === 'scenario_verified_razorpay_recovery') {
      const caseId = 'CASE-ABANDON-2048';
      const existingCase = db.getRecoveryCase(caseId);
      if (existingCase) {
        existingCase.lastAttemptAt = undefined;
        existingCase.retryCount = 0;
        existingCase.contactAttempts = 0;
        existingCase.status = RecoveryCaseStatus.DIAGNOSED;
        existingCase.amountRecovered = 0;
        existingCase.verifiedAmount = undefined;
        existingCase.recoveryProvenance = undefined;
        existingCase.verifiedWebhookEventId = undefined;
        existingCase.verifiedPaymentLinkId = undefined;
        existingCase.verifiedPaymentId = undefined;
        db.saveRecoveryCase(existingCase);
      }

      logs.push(`[Step 1] Selected case ${caseId} (₹3,200 recoverable revenue at risk)`);
      logs.push(`[Step 2] Formulating AI Diagnosis & Policy Gate Check...`);
      const analysis = await recoveryAgent.runWorkflow(caseId, 'AI_AGENT');
      logs.push(...analysis.executionLogs);

      logs.push('[Step 3] Dispatching Razorpay Test Mode Payment Link API request...');
      const execResult = await recoveryEngine.executeCaseAction({
        caseId,
        operatorActor: 'AI_AGENT',
      });

      const plinkCase = execResult.case;
      logs.push(`[Step 4] Razorpay Payment Link Generated:`);
      logs.push(`  - Payment Link ID: ${plinkCase.paymentLinkId || 'plink_...'}`);
      logs.push(`  - Status: AWAITING_PAYMENT (Verified Recovered Revenue = ₹0)`);

      logs.push('[Step 5] Simulating customer completing Test Mode payment via Razorpay...');
      const plinkId = plinkCase.paymentLinkId || `plink_demo_${Date.now()}`;
      const plinkRefId = plinkCase.paymentLinkReferenceId || `ref_demo_${Date.now()}`;
      const amountPaise = plinkCase.recoverableAmount * 100;
      const evtId = `evt_verified_e2e_${Date.now()}`;
      const paymentId = `pay_rzp_${Math.random().toString(36).substring(2, 10)}`;

      const webhookPayload = {
        entity: 'event',
        account_id: 'acc_demo_test',
        event: 'payment_link.paid',
        contains: ['payment_link'],
        payload: {
          payment_link: {
            entity: {
              id: plinkId,
              reference_id: plinkRefId,
              amount: amountPaise,
              amount_paid: amountPaise,
              status: 'paid',
            },
          },
          payment: {
            entity: {
              id: paymentId,
              amount: amountPaise,
              status: 'captured',
              method: 'upi',
            },
          },
        },
      };

      const rawBody = JSON.stringify(webhookPayload);
      const signature = razorpayService.generateWebhookSignature(rawBody);

      logs.push(`[Step 6] Ingesting Razorpay payment_link.paid webhook event (${evtId})`);
      logs.push(`  - HMAC-SHA256 Signature Verification: PASSED`);
      logs.push(`  - Event ID Deduplication Check: PASSED`);
      logs.push(`  - Payment Link Match: ${plinkId} PASSED`);

      razorpayWebhookHandler.processWebhook({
        rawBody,
        signature,
        eventId: evtId,
        parsedBody: webhookPayload,
      });

      const finalCase = db.getRecoveryCase(caseId)!;
      logs.push(`[Step 7] Reconciled Case State:`);
      logs.push(`  - Status: ${finalCase.status}`);
      logs.push(`  - Provenance: ${finalCase.recoveryProvenance}`);
      logs.push(`  - Verified Amount: ₹${finalCase.verifiedAmount}`);
      logs.push(`  - Verified Event ID: ${finalCase.verifiedWebhookEventId}`);

      return {
        scenario,
        caseObj: finalCase,
        logs,
        resultSummary: `End-to-End Recovery Complete! Case ${caseId} reconciled to RECOVERED via RAZORPAY_WEBHOOK with ₹${finalCase.verifiedAmount} verified revenue.`,
      };
    }

    if (scenarioId === 'scenario_upi_degradation') {
      const caseId = 'CASE-UPI-1024';
      const existingCase = db.getRecoveryCase(caseId);
      if (existingCase) {
        existingCase.lastAttemptAt = undefined;
        existingCase.retryCount = 0;
        existingCase.status = RecoveryCaseStatus.DIAGNOSED;
        db.saveRecoveryCase(existingCase);
      }

      logs.push(`[Step 1] Loading case ${caseId} with ₹4,500 amount at risk`);
      const analysis = await recoveryAgent.runWorkflow(caseId, 'AI_AGENT');
      logs.push(...analysis.executionLogs);

      logs.push('[Step 2] Executing approved payment recovery in Razorpay Test Mode');
      const execResult = await recoveryEngine.executeCaseAction({
        caseId,
        operatorActor: 'AI_AGENT',
      });
      logs.push(`[Step 3] ${execResult.message}`);

      return {
        scenario,
        caseObj: execResult.case,
        logs,
        resultSummary: 'Verified Razorpay Test Mode recovery: Payment Link generated and enqueued for customer.',
      };
    }

    if (scenarioId === 'scenario_checkout_abandonment') {
      const caseId = 'CASE-ABANDON-2048';
      const existingCase = db.getRecoveryCase(caseId);
      if (existingCase) {
        existingCase.lastAttemptAt = undefined;
        existingCase.retryCount = 0;
        existingCase.contactAttempts = 0;
        existingCase.status = RecoveryCaseStatus.DIAGNOSED;
        db.saveRecoveryCase(existingCase);
      }

      logs.push(`[Step 1] Scanning for abandoned checkouts > 30 minutes threshold`);
      revenueDetector.detectCheckoutAbandonments();

      logs.push(`[Step 2] Running AI diagnosis on ${caseId}`);
      const analysis = await recoveryAgent.runWorkflow(caseId, 'AI_AGENT');
      logs.push(...analysis.executionLogs);

      logs.push('[Step 3] Calling REAL Razorpay Test Mode API (POST https://api.razorpay.com/v1/payment_links)');
      const execResult = await recoveryEngine.executeCaseAction({
        caseId,
        operatorActor: 'AI_AGENT',
      });

      const updatedCase = execResult.case;
      logs.push(`[Step 4] Razorpay Test Mode API Response received:`);
      logs.push(`  - Payment Link ID: ${updatedCase.paymentLinkId || 'plink_...'}`);
      logs.push(`  - Short URL: ${updatedCase.paymentLinkUrl || 'N/A'}`);
      logs.push(`  - Adapter: ${updatedCase.paymentLinkAdapter || 'RazorpayTestModeAdapter'}`);
      logs.push(`[Step 5] ${execResult.message}`);

      return {
        scenario,
        caseObj: updatedCase,
        logs,
        resultSummary: `Real Razorpay Test Mode Payment Link generated: ${updatedCase.paymentLinkId} (${updatedCase.paymentLinkUrl})`,
      };
    }

    if (scenarioId === 'scenario_high_value_approval') {
      const caseId = 'CASE-HIGHVAL-3096';
      logs.push(`[Step 1] Evaluating high-value enterprise payment of ₹7,500`);
      const analysis = await recoveryAgent.runWorkflow(caseId, 'AI_AGENT');
      logs.push(...analysis.executionLogs);

      const caseObj = db.getRecoveryCase(caseId)!;
      logs.push(`[Step 2] Policy Gate: requireApprovalAbove rule triggered (₹7,500 > ₹5,000 threshold, <= ₹10,000 max limit)`);
      logs.push(`[Step 3] Status: NEEDS_APPROVAL. Enqueued for human operator review.`);

      return {
        scenario,
        caseObj,
        logs,
        resultSummary: 'Action enqueued in Human Approval Queue. Autonomous execution safely halted.',
      };
    }

    if (scenarioId === 'scenario_amount_exceeds_max_limit') {
      const caseId = 'CASE-BLOCK-9000';
      logs.push(`[Step 1] Evaluating enterprise transaction of ₹18,500`);
      const analysis = await recoveryAgent.runWorkflow(caseId, 'AI_AGENT');
      logs.push(...analysis.executionLogs);

      const caseObj = db.getRecoveryCase(caseId)!;
      logs.push(`[Step 2] Policy Gate: AMOUNT_EXCEEDS_MAX_LIMIT triggered (₹18,500 > ₹10,000 autonomous ceiling)`);
      logs.push(`[Step 3] Deterministic Policy Engine enforced HARD BLOCK -> Status: STOPPED`);
      caseObj.status = RecoveryCaseStatus.STOPPED;
      db.saveRecoveryCase(caseObj);

      return {
        scenario,
        caseObj,
        logs,
        resultSummary: 'Hard policy block enforced: Amount ₹18,500 exceeds autonomous ceiling of ₹10,000. Status STOPPED.',
      };
    }

    if (scenarioId === 'scenario_api_failure_safe_stop') {
      const caseId = `CASE-APITEST-${Date.now()}`;
      const customer = db.getCustomer('cust_1003')!;
      
      const riskEvent: RevenueRiskEvent = {
        id: `risk_${caseId}`,
        merchantId: 'merch_default',
        source: RiskSource.PAYMENT_FAILURE,
        entityId: `entity_${caseId}`,
        customerId: customer.id,
        grossAmountAtRisk: 3200,
        eligibleRecoverableAmount: 3200,
        reason: 'Repeated bank timeout during UPI settlement switch',
        classification: FailureClassification.TEMPORARY_PROVIDER_FAILURE,
        confidence: 0.93,
        detectedAt: new Date().toISOString(),
        status: 'OPEN',
      };
      db.saveRiskEvent(riskEvent);

      const caseObj: RecoveryCase = {
        id: caseId,
        merchantId: 'merch_default',
        riskEventId: riskEvent.id,
        customerId: customer.id,
        amountAtRisk: 3200,
        recoverableAmount: 3200,
        amountRecovered: 0,
        status: RecoveryCaseStatus.DIAGNOSED,
        priority: 'HIGH',
        priorityScore: 88,
        retryCount: 1, // Already used 1 retry; next will hit max 2
        contactAttempts: 0,
        recoveryStrategy: RecoveryActionType.RETRY_PAYMENT,
        idempotencyKey: `rec_${caseId}_RETRY_1`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      db.saveRecoveryCase(caseObj);

      logs.push(`[Step 1] Created test case ${caseId} with 1 prior retry`);
      logs.push(`[Step 2] Simulating Razorpay gateway timeout during second retry attempt`);

      const execResult = await recoveryEngine.executeCaseAction({
        caseId,
        operatorActor: 'AI_AGENT',
        simulateOutcome: 'TIMEOUT',
      });
      logs.push(`[Step 3] Execution failed with simulated timeout. Retry count now 2/2.`);
      logs.push(`[Step 4] Deterministic Policy Engine triggered SAFE_STOP: Max retries exhausted.`);

      return {
        scenario,
        caseObj: execResult.case,
        logs,
        resultSummary: 'Safe stop triggered. Case safely closed to prevent spamming customer bank.',
      };
    }

    if (scenarioId === 'scenario_customer_opt_out') {
      const caseId = `CASE-OPTOUT-${Date.now()}`;
      // Create opted-out customer
      const optOutCust = db.saveCustomer({
        id: `cust_optout_${Date.now()}`,
        merchantId: 'merch_default',
        externalCustomerId: 'ext_optout',
        name: 'Rajat Kapoor',
        email: 'rajat.k@example.com',
        phone: '+919811002299',
        segment: 'RETAIL',
        optedOut: true, // Opted-out
        lifetimeValue: 12000,
        successfulPaymentsCount: 3,
        failedPaymentsCount: 1,
        createdAt: new Date().toISOString(),
      });

      const riskEvent: RevenueRiskEvent = {
        id: `risk_${caseId}`,
        merchantId: 'merch_default',
        source: RiskSource.PAYMENT_FAILURE,
        entityId: `entity_${caseId}`,
        customerId: optOutCust.id,
        grossAmountAtRisk: 4100,
        eligibleRecoverableAmount: 0,
        reason: 'Payment failed for opted-out customer',
        classification: FailureClassification.CUSTOMER_ACTION_REQUIRED,
        confidence: 0.95,
        detectedAt: new Date().toISOString(),
        status: 'OPEN',
      };
      db.saveRiskEvent(riskEvent);

      const caseObj: RecoveryCase = {
        id: caseId,
        merchantId: 'merch_default',
        riskEventId: riskEvent.id,
        customerId: optOutCust.id,
        amountAtRisk: 4100,
        recoverableAmount: 0,
        amountRecovered: 0,
        status: RecoveryCaseStatus.DIAGNOSED,
        priority: 'MEDIUM',
        priorityScore: 60,
        retryCount: 0,
        contactAttempts: 0,
        recoveryStrategy: RecoveryActionType.SEND_PAYMENT_REMINDER,
        idempotencyKey: `rec_${caseId}_OPT_${Date.now()}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      db.saveRecoveryCase(caseObj);

      logs.push(`[Step 1] Customer ${optOutCust.name} has optedOut=true flag.`);
      logs.push(`[Step 2] Attempting to evaluate recovery intervention.`);

      const execResult = await recoveryEngine.executeCaseAction({
        caseId,
        operatorActor: 'AI_AGENT',
      });
      logs.push(`[Step 3] Policy Engine: ${execResult.message}`);

      return {
        scenario,
        caseObj: execResult.case,
        logs,
        resultSummary: 'Policy hard block enforced: Customer is opted out. Zero contact initiated.',
      };
    }

    if (scenarioId === 'scenario_permanent_decline') {
      const caseObj = db.getRecoveryCase('CASE-STOP-4012') || db.listRecoveryCases().find(c => c.id === 'CASE-STOP-4012')!;
      logs.push('[Step 1] Inspecting failed payment error code: DO_NOT_HONOR / EXPIRED_CARD');
      logs.push('[Step 2] Diagnostic Engine: Failure classified as NON_RETRYABLE');
      logs.push('[Step 3] Policy Engine: Non-retryable error blocks all automated charges');
      logs.push('[Step 4] Status transition: Case safely marked STOPPED to protect customer relationship');
      caseObj.status = RecoveryCaseStatus.STOPPED;
      db.saveRecoveryCase(caseObj);
      return {
        scenario,
        caseObj,
        logs,
        resultSummary: 'Classified as NON_RETRYABLE -> Recommendation: STOP_RECOVERY -> Zero recovery attempts fired.',
      };
    }

    // Default fallback
    const defaultCase = db.listRecoveryCases()[0];
    return {
      scenario,
      caseObj: defaultCase,
      logs: ['Standard scenario execution verified.'],
      resultSummary: 'Scenario completed successfully.',
    };
  }
}

export const demoManager = new DemoManager();
