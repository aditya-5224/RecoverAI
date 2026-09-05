/**
 * RecoverAI Stateful Agent Orchestrator
 * Structured state graph with deterministic rule fallback and Gemini AI reasoning.
 */

import { GoogleGenAI, Type } from '@google/genai';
import { db } from '../db/database.ts';
import { policyEngine } from '../policy/policyEngine.ts';
import {
  AIDiagnosis,
  FailureClassification,
  RecoveryActionType,
  RecoveryCase,
  RecoveryCaseStatus,
  RiskSource,
} from '../../types/index.ts';
import { buildCaseAnalysisPrompt, DIAGNOSIS_AND_STRATEGY_SYSTEM_PROMPT } from './prompts.ts';

// Lazy client initialization to avoid startup crashes if key is pending
let genAIClient: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI | null {
  if (!genAIClient && process.env.GEMINI_API_KEY) {
    try {
      genAIClient = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });
    } catch (e) {
      console.warn('Failed to initialize GoogleGenAI client:', e);
    }
  }
  return genAIClient;
}

export interface AgentWorkflowState {
  caseId: string;
  correlationId: string;
  recoveryCase?: RecoveryCase;
  customerContext?: any;
  paymentHistory?: any[];
  diagnosis?: AIDiagnosis;
  policyResult?: any;
  approvalRequired: boolean;
  finalStatus: RecoveryCaseStatus;
  executionLogs: string[];
}

export class RecoveryAgent {
  /**
   * Deterministic Classifier (Fast, zero-hallucination baseline)
   */
  classifyDeterministically(
    source: RiskSource,
    failureCode?: string,
    failureReason?: string,
    retryCount: number = 0
  ): {
    classification: FailureClassification;
    suggestedAction: RecoveryActionType;
    heuristicConfidence: number;
    reason: string;
  } {
    if (source === RiskSource.CHECKOUT_ABANDONMENT) {
      return {
        classification: FailureClassification.CUSTOMER_ACTION_REQUIRED,
        suggestedAction: RecoveryActionType.SEND_PAYMENT_REMINDER,
        heuristicConfidence: 0.92,
        reason: 'Customer initiated checkout order but dropped before OTP/authorization submission.',
      };
    }

    const code = (failureCode || '').toUpperCase();
    const reason = (failureReason || '').toLowerCase();

    if (
      code === 'GATEWAY_ERROR' ||
      code === 'BAD_REQUEST_ERROR' ||
      reason.includes('timeout') ||
      reason.includes('latency') ||
      reason.includes('switch') ||
      reason.includes('npci') ||
      reason.includes('temporary')
    ) {
      if (retryCount >= 2) {
        return {
          classification: FailureClassification.NON_RETRYABLE,
          suggestedAction: RecoveryActionType.STOP_RECOVERY,
          heuristicConfidence: 0.98,
          reason: 'Transient gateway error, but maximum allowed retries (2) have already been exhausted.',
        };
      }
      return {
        classification: FailureClassification.TEMPORARY_PROVIDER_FAILURE,
        suggestedAction: RecoveryActionType.RETRY_PAYMENT,
        heuristicConfidence: 0.95,
        reason: 'Transient bank switch/PSP latency detected with retry capacity remaining.',
      };
    }

    if (
      code === 'CARD_EXPIRED' ||
      code === 'DO_NOT_HONOR' ||
      reason.includes('expired') ||
      reason.includes('blocked') ||
      reason.includes('invalid card')
    ) {
      return {
        classification: FailureClassification.NON_RETRYABLE,
        suggestedAction: RecoveryActionType.STOP_RECOVERY,
        heuristicConfidence: 0.99,
        reason: 'Permanent card or account decline code issued by bank; further retries will cause fees.',
      };
    }

    if (code === 'AUTHENTICATION_FAILED' || reason.includes('3ds') || reason.includes('otp')) {
      return {
        classification: FailureClassification.CUSTOMER_ACTION_REQUIRED,
        suggestedAction: RecoveryActionType.GENERATE_RECOVERY_LINK,
        heuristicConfidence: 0.9,
        reason: 'Customer authentication challenge dropped; recovery link with alternate methods recommended.',
      };
    }

    return {
      classification: FailureClassification.UNKNOWN,
      suggestedAction: RecoveryActionType.ESCALATE_HUMAN,
      heuristicConfidence: 0.75,
      reason: 'Ambiguous failure metadata requires diagnostic model reasoning or human review.',
    };
  }

  /**
   * Run the full multi-stage agentic workflow for a recovery case
   */
  async runWorkflow(caseId: string, operatorActor: string = 'AI_AGENT'): Promise<AgentWorkflowState> {
    const correlationId = `corr_${caseId}_${Date.now()}`;
    const state: AgentWorkflowState = {
      caseId,
      correlationId,
      approvalRequired: false,
      finalStatus: RecoveryCaseStatus.INVESTIGATING,
      executionLogs: [],
    };

    state.executionLogs.push(`[1. load_case] Loading case ${caseId}`);
    const recoveryCase = db.getRecoveryCase(caseId);
    if (!recoveryCase) {
      throw new Error(`Recovery case ${caseId} not found in database.`);
    }
    state.recoveryCase = recoveryCase;

    // 2. inspect_customer
    state.executionLogs.push(`[2. inspect_customer] Fetching customer ${recoveryCase.customerId}`);
    const customer = db.getCustomer(recoveryCase.customerId);
    state.customerContext = customer;

    // 3. inspect_payment_history
    state.executionLogs.push(`[3. inspect_payment_history] Inspecting recent transactions`);
    const payment = recoveryCase.paymentId ? db.getPayment(recoveryCase.paymentId) : undefined;
    const riskEvent = db.getRiskEvent(recoveryCase.riskEventId);

    // 4. diagnose_failure (Deterministic + Gemini Reasoning)
    state.executionLogs.push(`[4. diagnose_failure] Running diagnostic analysis`);
    const deterministic = this.classifyDeterministically(
      riskEvent?.source || RiskSource.PAYMENT_FAILURE,
      payment?.failureCode,
      payment?.failureReason,
      recoveryCase.retryCount
    );

    let diagnosisResult: AIDiagnosis = {
      diagnosis: `${deterministic.classification.replace(/_/g, ' ')}`,
      rootCause: deterministic.reason,
      classification: deterministic.classification,
      evidence: [
        `Deterministic classification: ${deterministic.classification}`,
        `Retries used: ${recoveryCase.retryCount}/2`,
        `Customer tier: ${customer?.segment || 'RETAIL'} (LTV ₹${customer?.lifetimeValue || 0})`,
      ],
      recommendedAction: deterministic.suggestedAction,
      reason: deterministic.reason,
      expectedOutcome: `Potential recovery of ₹${recoveryCase.amountAtRisk.toLocaleString('en-IN')}`,
      riskAssessment: recoveryCase.amountAtRisk > 5000 ? 'High-value threshold check triggered' : 'Low risk bounded action',
      modelConfidence: 0.92,
      heuristicConfidence: deterministic.heuristicConfidence,
      aiSuggestedAmount: recoveryCase.amountAtRisk,
    };

    // Attempt Gemini AI LLM reasoning for richer diagnosis & root cause formulation
    const aiClient = getGenAI();
    if (aiClient) {
      try {
        const promptText = buildCaseAnalysisPrompt({
          caseId: recoveryCase.id,
          source: riskEvent?.source || 'PAYMENT_FAILURE',
          amount: recoveryCase.amountAtRisk,
          paymentMethod: payment?.method,
          failureReason: payment?.failureReason,
          failureCode: payment?.failureCode,
          retryCount: recoveryCase.retryCount,
          contactAttempts: recoveryCase.contactAttempts,
          customerName: customer?.name || 'Customer',
          customerSegment: customer?.segment || 'RETAIL',
          customerLtv: customer?.lifetimeValue || 0,
          customerSuccessCount: customer?.successfulPaymentsCount || 0,
          customerFailureCount: customer?.failedPaymentsCount || 0,
          recentMethodAnomaly: payment?.method === 'upi' ? 'UPI PSP gateway switch timeout spike (+2.4x)' : undefined,
        });

        const geminiPromise = aiClient.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: promptText,
          config: {
            systemInstruction: DIAGNOSIS_AND_STRATEGY_SYSTEM_PROMPT,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                diagnosis: { type: Type.STRING },
                rootCause: { type: Type.STRING },
                classification: { type: Type.STRING },
                evidence: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
                recommendedAction: { type: Type.STRING },
                reason: { type: Type.STRING },
                expectedOutcome: { type: Type.STRING },
                riskAssessment: { type: Type.STRING },
                modelConfidence: { type: Type.NUMBER },
              },
              required: [
                'diagnosis',
                'rootCause',
                'classification',
                'evidence',
                'recommendedAction',
                'reason',
                'expectedOutcome',
                'riskAssessment',
                'modelConfidence',
              ],
            },
          },
        });

        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('GEMINI_TIMEOUT: 2500ms limit reached')), 2500)
        );

        const response: any = await Promise.race([geminiPromise, timeoutPromise]);

        if (response.text) {
          const parsed = JSON.parse(response.text);
          // Validate and merge with deterministic constraints
          const validActions = Object.values(RecoveryActionType);
          const recAction = validActions.includes(parsed.recommendedAction as RecoveryActionType)
            ? (parsed.recommendedAction as RecoveryActionType)
            : deterministic.suggestedAction;

          diagnosisResult = {
            diagnosis: parsed.diagnosis || diagnosisResult.diagnosis,
            rootCause: parsed.rootCause || diagnosisResult.rootCause,
            classification: (parsed.classification as FailureClassification) || deterministic.classification,
            evidence: Array.isArray(parsed.evidence) && parsed.evidence.length > 0 ? parsed.evidence : diagnosisResult.evidence,
            recommendedAction: recAction,
            reason: parsed.reason || diagnosisResult.reason,
            expectedOutcome: parsed.expectedOutcome || diagnosisResult.expectedOutcome,
            riskAssessment: parsed.riskAssessment || diagnosisResult.riskAssessment,
            modelConfidence: Math.min(Math.max(parsed.modelConfidence || 0.9, 0.5), 0.99),
            heuristicConfidence: deterministic.heuristicConfidence,
            aiSuggestedAmount: recoveryCase.amountAtRisk,
          };
          state.executionLogs.push(`[4. diagnose_failure] Gemini AI diagnosis synthesized`);
        }
      } catch (geminiErr) {
        state.executionLogs.push(`[4. diagnose_failure] Gemini call failed (${geminiErr}); using deterministic fallback`);
      }
    } else {
      state.executionLogs.push(`[4. diagnose_failure] GEMINI_API_KEY not configured; using deterministic rules`);
    }

    state.diagnosis = diagnosisResult;

    // 5. policy_gate
    state.executionLogs.push(`[5. policy_gate] Evaluating recommendation against deterministic policy`);
    const policyResult = policyEngine.evaluate({
      actionType: diagnosisResult.recommendedAction,
      amount: recoveryCase.amountAtRisk,
      recoveryCase,
      customer,
      skipCooldownCheck: true, // initial analysis check
    });
    state.policyResult = policyResult;

    // 6. approval_gate
    state.executionLogs.push(`[6. approval_gate] Policy outcome: allowed=${policyResult.allowed}, requiresApproval=${policyResult.requiredApproval}`);
    let nextStatus: RecoveryCaseStatus = RecoveryCaseStatus.DIAGNOSED;

    if (diagnosisResult.recommendedAction === RecoveryActionType.STOP_RECOVERY) {
      nextStatus = RecoveryCaseStatus.STOPPED;
    } else if (policyResult.requiredApproval) {
      nextStatus = RecoveryCaseStatus.NEEDS_APPROVAL;
      state.approvalRequired = true;
    } else if (policyResult.allowed) {
      nextStatus = RecoveryCaseStatus.DIAGNOSED;
    } else {
      // Hard block (e.g. AMOUNT_EXCEEDS_MAX_LIMIT, MAX_RETRIES_EXCEEDED, CUSTOMER_OPTED_OUT)
      nextStatus = RecoveryCaseStatus.STOPPED;
      state.approvalRequired = false;
    }

    state.finalStatus = nextStatus;

    // Update database
    recoveryCase.status = nextStatus;
    recoveryCase.diagnosis = diagnosisResult;
    recoveryCase.recoveryStrategy = diagnosisResult.recommendedAction;
    recoveryCase.policyResult = policyResult;
    recoveryCase.approvalStatus = policyResult.requiredApproval ? 'PENDING' : 'NOT_REQUIRED';
    recoveryCase.updatedAt = new Date().toISOString();
    db.saveRecoveryCase(recoveryCase);

    // 7. write_audit
    db.logAuditEvent({
      caseId: recoveryCase.id,
      correlationId,
      eventType: 'AI_DIAGNOSIS_CREATED',
      actor: operatorActor === 'OPERATOR' ? 'HUMAN_OPERATOR' : 'AI_AGENT',
      input: { caseId: recoveryCase.id, amount: recoveryCase.amountAtRisk },
      decision: `Diagnosed as ${diagnosisResult.diagnosis}. Recommended action: ${diagnosisResult.recommendedAction}`,
      reason: diagnosisResult.reason,
      policyChecks: {
        allowed: policyResult.allowed,
        violations: policyResult.violations,
        requiredApproval: policyResult.requiredApproval,
      },
      result: { status: nextStatus, confidence: diagnosisResult.modelConfidence },
    });

    state.executionLogs.push(`[7. write_audit] Case state updated to ${nextStatus}`);
    return state;
  }
}

export const recoveryAgent = new RecoveryAgent();
