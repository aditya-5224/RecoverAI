/**
 * RecoverAI - Core Domain Models & Schemas
 */

export enum FailureClassification {
  RETRYABLE = 'RETRYABLE',
  NON_RETRYABLE = 'NON_RETRYABLE',
  CUSTOMER_ACTION_REQUIRED = 'CUSTOMER_ACTION_REQUIRED',
  TEMPORARY_PROVIDER_FAILURE = 'TEMPORARY_PROVIDER_FAILURE',
  UNKNOWN = 'UNKNOWN',
}

export enum RecoveryActionType {
  PAYMENT_LINK_RECOVERY = 'PAYMENT_LINK_RECOVERY',
  CUSTOMER_RECHECKOUT = 'CUSTOMER_RECHECKOUT',
  RETRY_PAYMENT = 'PAYMENT_LINK_RECOVERY',
  SEND_PAYMENT_REMINDER = 'SEND_PAYMENT_REMINDER',
  GENERATE_RECOVERY_LINK = 'GENERATE_RECOVERY_LINK',
  REQUEST_CUSTOMER_ACTION = 'REQUEST_CUSTOMER_ACTION',
  ESCALATE_HUMAN = 'ESCALATE_HUMAN',
  STOP_RECOVERY = 'STOP_RECOVERY',
}

export enum RecoveryCaseStatus {
  DETECTED = 'DETECTED',
  INVESTIGATING = 'INVESTIGATING',
  DIAGNOSED = 'DIAGNOSED',
  NEEDS_APPROVAL = 'NEEDS_APPROVAL',
  APPROVED = 'APPROVED',
  EXECUTING = 'EXECUTING',
  AWAITING_PAYMENT = 'AWAITING_PAYMENT',
  RECOVERED = 'RECOVERED',
  FAILED = 'FAILED',
  STOPPED = 'STOPPED',
}

export type RecoveryProvenance = 'SYNTHETIC_DEMO' | 'RAZORPAY_WEBHOOK';

export enum PaymentMethod {
  UPI = 'upi',
  CARD = 'card',
  NETBANKING = 'netbanking',
  WALLET = 'wallet',
}

export enum RiskSource {
  PAYMENT_FAILURE = 'PAYMENT_FAILURE',
  CHECKOUT_ABANDONMENT = 'CHECKOUT_ABANDONMENT',
  SUBSCRIPTION_FAILURE = 'SUBSCRIPTION_FAILURE',
}

export interface Merchant {
  id: string;
  name: string;
  createdAt: string;
  settings: {
    currency: string;
    autoRecoveryEnabled: boolean;
    retryCooldownMinutes: number;
    requireApprovalAbove: number;
    maxRetriesPerPayment: number;
    maxAutomatedRecoveryAmount: number;
  };
}

export interface Customer {
  id: string;
  merchantId: string;
  externalCustomerId: string;
  name: string;
  email: string;
  phone: string;
  segment: 'ENTERPRISE' | 'GROWTH' | 'RETAIL' | 'VIP';
  optedOut: boolean;
  lifetimeValue: number;
  successfulPaymentsCount: number;
  failedPaymentsCount: number;
  createdAt: string;
}

export interface Order {
  id: string;
  merchantId: string;
  customerId: string;
  razorpayOrderId: string;
  amount: number; // in INR
  currency: string;
  status: 'created' | 'attempted' | 'paid' | 'abandoned';
  createdAt: string;
  updatedAt: string;
}

export interface Payment {
  id: string;
  merchantId: string;
  orderId: string;
  customerId: string;
  razorpayPaymentId: string;
  amount: number;
  currency: string;
  method: PaymentMethod;
  status: 'created' | 'authorized' | 'captured' | 'failed';
  failureReason?: string;
  failureCode?: string;
  capturedAt?: string;
  createdAt: string;
}

export interface RevenueRiskEvent {
  id: string;
  merchantId: string;
  source: RiskSource;
  entityId: string; // paymentId or orderId
  customerId: string;
  grossAmountAtRisk: number;
  eligibleRecoverableAmount: number;
  reason: string;
  classification: FailureClassification;
  confidence: number;
  detectedAt: string;
  status: 'OPEN' | 'RESOLVED' | 'DISMISSED';
}

export interface PolicyCheckResult {
  allowed: boolean;
  reason: string;
  violations: string[];
  requiredApproval: boolean;
  decision?: 'ALLOWED' | 'NEEDS_APPROVAL' | 'HARD_BLOCK';
  isHardBlocked?: boolean;
  policyVersion: string;
  checkedRules: {
    rule: string;
    passed: boolean;
    details: string;
  }[];
}

export interface AIDiagnosis {
  diagnosis: string;
  rootCause: string;
  classification: FailureClassification;
  evidence: string[];
  recommendedAction: RecoveryActionType;
  reason: string;
  expectedOutcome: string;
  riskAssessment: string;
  modelConfidence: number;
  heuristicConfidence: number;
  aiSuggestedAmount?: number;
}

export interface RecoveryCase {
  id: string;
  merchantId: string;
  riskEventId: string;
  customerId: string;
  orderId?: string;
  paymentId?: string;
  amountAtRisk: number;
  recoverableAmount: number;
  amountRecovered: number;
  status: RecoveryCaseStatus;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  priorityScore: number;
  retryCount: number;
  contactAttempts: number;
  lastAttemptAt?: string;
  recoveryStrategy?: RecoveryActionType;
  diagnosis?: AIDiagnosis;
  policyResult?: PolicyCheckResult;
  assignedTo?: string;
  approvalStatus?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'NOT_REQUIRED';
  approvedBy?: string;
  approvedAt?: string;
  stopReason?: string;
  paymentLinkId?: string;
  paymentLinkUrl?: string;
  paymentLinkReferenceId?: string;
  paymentLinkCreatedAt?: string;
  paymentLinkAdapter?: string;
  recoveryProvenance?: RecoveryProvenance;
  verifiedWebhookEventId?: string;
  verifiedPaymentLinkId?: string;
  verifiedPaymentId?: string;
  verifiedAmount?: number;
  idempotencyKey: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface RecoveryAction {
  id: string;
  recoveryCaseId: string;
  actionType: RecoveryActionType;
  proposedBy: 'AI_AGENT' | 'POLICY_FALLBACK' | 'OPERATOR';
  policyResult: PolicyCheckResult;
  approvalStatus: 'NOT_REQUIRED' | 'APPROVED' | 'REJECTED' | 'PENDING';
  executionStatus: 'PENDING' | 'SUCCESS' | 'FAILED' | 'BLOCKED';
  amount: number;
  razorpayReferenceId?: string;
  executedAt?: string;
  failureReason?: string;
  idempotencyKey: string;
}

export interface AuditEvent {
  id: string;
  caseId?: string;
  correlationId: string;
  eventType:
    | 'RISK_DETECTED'
    | 'AI_DIAGNOSIS_CREATED'
    | 'RECOVERY_RECOMMENDED'
    | 'POLICY_CHECKED'
    | 'ACTION_APPROVAL_REQUIRED'
    | 'ACTION_APPROVED'
    | 'ACTION_REJECTED'
    | 'ACTION_EXECUTED'
    | 'PAYMENT_LINK_CREATED'
    | 'RECOVERY_DISPATCHED'
    | 'ACTION_FAILED'
    | 'PAYMENT_RECOVERED'
    | 'RECOVERY_STOPPED'
    | 'WEBHOOK_RECEIVED'
    | 'DEMO_RESET';
  actor: 'SYSTEM_DETECTOR' | 'AI_AGENT' | 'POLICY_ENGINE' | 'HUMAN_OPERATOR' | 'RAZORPAY_WEBHOOK';
  input: Record<string, any>;
  decision?: string;
  reason?: string;
  policyChecks?: Record<string, any>;
  result?: Record<string, any>;
  createdAt: string;
}

export interface EvaluationRun {
  id: string;
  datasetName: string;
  totalRecords: number;
  trainRecords: number;
  heldOutRecords: number;
  detectedCases: number;
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
  trueNegatives: number;
  precision: number;
  recall: number;
  f1Score: number;
  totalRevenueAtRisk: number;
  totalRecoverableRevenue: number;
  totalRecoveredRevenue: number;
  recoveryRate: number;
  falsePositiveCost: number;
  averageRecoveryTimeSeconds: number;
  blockedUnsafeActions: number;
  humanEscalations: number;
  exceptionBreakdown: {
    category: string;
    count: number;
    description: string;
  }[];
  createdAt: string;
}

export interface DashboardMetrics {
  grossRevenueAtRisk: number;
  eligibleRecoverableRevenue: number;
  verifiedRecoveredRevenue: number;
  razorpayCapturedCount?: number;
  demoSyntheticRecoveredRevenue?: number;
  demoSyntheticRecoveredCount?: number;
  recoveryRate: number;
  activeCasesCount: number;
  approvalPendingCount: number;
  todayRecoveredCount: number;
  leakageByCategory: {
    category: string;
    amount: number;
    percentage: number;
    casesCount: number;
    trend: 'UP' | 'DOWN' | 'STABLE';
  }[];
  paymentMethodHealth: {
    method: PaymentMethod;
    name: string;
    successRate: number;
    failureRate: number;
    isDegraded: boolean;
    volume24h: number;
    failedAmount24h: number;
  }[];
  hourlyFailureTrend: {
    hour: string;
    upiFailures: number;
    cardFailures: number;
    netbankingFailures: number;
    recoveredAmount: number;
  }[];
  aiInsights: {
    summary: string;
    largestContributor: string;
    affectedCustomersCount: number;
    eligibleForAutoRecoveryCount: number;
    estimatedRecoverableAmount: number;
    recommendation: string;
  };
}

export interface DemoScenario {
  id: string;
  title: string;
  category: 'PAYMENT_DEGRADATION' | 'CHECKOUT_ABANDONMENT' | 'SUCCESS_RECOVERY' | 'API_FAILURE' | 'POLICY_BLOCKED' | 'HUMAN_APPROVAL';
  description: string;
  expectedOutcome: string;
  targetCaseId?: string;
  amount: number;
}
