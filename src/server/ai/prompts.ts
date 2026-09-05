/**
 * RecoverAI Structured Prompts
 */

export const DIAGNOSIS_AND_STRATEGY_SYSTEM_PROMPT = `
You are the Diagnostic and Recovery Engine for RecoverAI, an autonomous fintech revenue recovery platform.
Your responsibility is to analyze payment failures and checkout drop-offs, determine the precise root cause, evaluate historical evidence, and recommend a bounded, compliant recovery intervention.

CRITICAL RULES:
1. You only recommend actions from the approved enum:
   - RETRY_PAYMENT (for transient provider/network failures)
   - SEND_PAYMENT_REMINDER (for checkout abandonment within safe contact limits)
   - GENERATE_RECOVERY_LINK (for high-value or alternate payment method collection)
   - REQUEST_CUSTOMER_ACTION (for customer-correctable card/3DS errors)
   - ESCALATE_HUMAN (for complex enterprise or high-risk disputes)
   - STOP_RECOVERY (for permanent declines, expired cards, or retry limits reached)
2. You MUST return ONLY a strictly valid JSON object matching the requested schema.
3. You must provide concrete evidence points derived from customer history and payment metadata.
4. Do NOT attempt to execute or bypass policy rules. Deterministic policy gates will independently verify all recommendations.
`;

export function buildCaseAnalysisPrompt(caseContext: {
  caseId: string;
  source: string;
  amount: number;
  paymentMethod?: string;
  failureReason?: string;
  failureCode?: string;
  retryCount: number;
  contactAttempts: number;
  customerName: string;
  customerSegment: string;
  customerLtv: number;
  customerSuccessCount: number;
  customerFailureCount: number;
  recentMethodAnomaly?: string;
}): string {
  return `
Analyze this recovery case and return structured JSON diagnosis and recommendation:

CASE CONTEXT:
- Case ID: ${caseContext.caseId}
- Source: ${caseContext.source}
- Amount: INR ${caseContext.amount}
- Payment Method: ${caseContext.paymentMethod || 'Unknown'}
- Reported Gateway Error: ${caseContext.failureReason || 'None / Checkout drop-off'}
- Error Code: ${caseContext.failureCode || 'N/A'}
- Prior Retries Used: ${caseContext.retryCount}
- Contact Attempts: ${caseContext.contactAttempts}

CUSTOMER PROFILE:
- Name: ${caseContext.customerName}
- Segment: ${caseContext.customerSegment}
- Lifetime Value: INR ${caseContext.customerLtv}
- Past Successful Transactions: ${caseContext.customerSuccessCount}
- Past Failed Transactions: ${caseContext.customerFailureCount}
${caseContext.recentMethodAnomaly ? `- System Anomaly Observed: ${caseContext.recentMethodAnomaly}` : ''}

REQUIRED JSON OUTPUT SCHEMA:
{
  "diagnosis": "Short title of diagnosis (e.g., 'Transient UPI Gateway Latency Spike')",
  "rootCause": "Detailed explanation of why this payment or checkout failed",
  "classification": "RETRYABLE | NON_RETRYABLE | CUSTOMER_ACTION_REQUIRED | TEMPORARY_PROVIDER_FAILURE | UNKNOWN",
  "evidence": [
    "Specific observation 1",
    "Specific observation 2",
    "Specific observation 3"
  ],
  "recommendedAction": "RETRY_PAYMENT | SEND_PAYMENT_REMINDER | GENERATE_RECOVERY_LINK | REQUEST_CUSTOMER_ACTION | ESCALATE_HUMAN | STOP_RECOVERY",
  "reason": "Why this specific action is the optimal recovery intervention",
  "expectedOutcome": "e.g., Potential recovery of INR X upon retry",
  "riskAssessment": "e.g., Low friction risk with 1 retry limit",
  "modelConfidence": 0.94
}
`;
}
