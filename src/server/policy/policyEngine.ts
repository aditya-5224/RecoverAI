/**
 * RecoverAI Deterministic Policy Engine & Safety Gate
 * Evaluates monetary, frequency, and safety constraints prior to any external execution.
 */

import {
  Customer,
  PolicyCheckResult,
  RecoveryActionType,
  RecoveryCase,
} from '../../types/index.ts';

export interface PolicyConfig {
  maxRetriesPerPayment: number;
  maxAutomatedRecoveryAmount: number;
  maxDailyRecoveryAmount: number;
  minRetryCooldownMinutes: number;
  requireApprovalAbove: number;
  maxCustomerContactAttempts: number;
}

export const DEFAULT_POLICY_CONFIG: PolicyConfig = {
  maxRetriesPerPayment: 2,
  maxAutomatedRecoveryAmount: 10000,
  maxDailyRecoveryAmount: 100000,
  minRetryCooldownMinutes: 30,
  requireApprovalAbove: 5000,
  maxCustomerContactAttempts: 2,
};

export class PolicyEngine {
  private config: PolicyConfig;
  private policyVersion = '1.3.0-deterministic';

  constructor(customConfig?: Partial<PolicyConfig>) {
    this.config = { ...DEFAULT_POLICY_CONFIG, ...customConfig };
  }

  updateConfig(newConfig: Partial<PolicyConfig>) {
    this.config = { ...this.config, ...newConfig };
  }

  getConfig(): PolicyConfig {
    return { ...this.config };
  }

  /**
   * Evaluates if a recommended action is permissible under deterministic policies.
   */
  evaluate(params: {
    actionType: RecoveryActionType;
    amount: number;
    recoveryCase: RecoveryCase;
    customer?: Customer;
    dailyRecoveredAmount?: number;
    skipCooldownCheck?: boolean;
  }): PolicyCheckResult {
    const { actionType, amount, recoveryCase, customer, dailyRecoveredAmount = 0 } = params;
    const violations: string[] = [];
    const checkedRules: PolicyCheckResult['checkedRules'] = [];

    // 1. Opt-out Safety Check
    if (customer?.optedOut) {
      violations.push('CUSTOMER_OPTED_OUT: Customer has explicitly unsubscribed from recovery workflows.');
      checkedRules.push({
        rule: 'CUSTOMER_OPT_IN_STATUS',
        passed: false,
        details: 'Customer profile marked as opted-out.',
      });
    } else {
      checkedRules.push({
        rule: 'CUSTOMER_OPT_IN_STATUS',
        passed: true,
        details: 'Customer is active and eligible for recovery contact.',
      });
    }

    // 2. Stop Action check
    if (actionType === RecoveryActionType.STOP_RECOVERY) {
      return {
        allowed: true,
        reason: 'Stop action is inherently compliant and safe.',
        violations: [],
        requiredApproval: false,
        policyVersion: this.policyVersion,
        checkedRules: [
          { rule: 'SAFE_STOP_RULE', passed: true, details: 'Safe stop approved by policy.' },
        ],
      };
    }

    // 3. Retry Count Boundary Check
    if (actionType === RecoveryActionType.RETRY_PAYMENT) {
      const isRetryExceeded = recoveryCase.retryCount >= this.config.maxRetriesPerPayment;
      if (isRetryExceeded) {
        violations.push(
          `MAX_RETRIES_EXCEEDED: Payment has already used ${recoveryCase.retryCount}/${this.config.maxRetriesPerPayment} allowed retries.`
        );
      }
      checkedRules.push({
        rule: 'MAX_RETRIES_PER_PAYMENT',
        passed: !isRetryExceeded,
        details: `${recoveryCase.retryCount}/${this.config.maxRetriesPerPayment} retries used.`,
      });
    }

    // 4. Contact Attempts Boundary Check
    if (
      actionType === RecoveryActionType.SEND_PAYMENT_REMINDER ||
      actionType === RecoveryActionType.REQUEST_CUSTOMER_ACTION
    ) {
      const isContactExceeded = recoveryCase.contactAttempts >= this.config.maxCustomerContactAttempts;
      if (isContactExceeded) {
        violations.push(
          `MAX_CONTACT_EXCEEDED: Reached maximum ${this.config.maxCustomerContactAttempts} outreach attempts to prevent customer spam.`
        );
      }
      checkedRules.push({
        rule: 'MAX_CUSTOMER_CONTACT_ATTEMPTS',
        passed: !isContactExceeded,
        details: `${recoveryCase.contactAttempts}/${this.config.maxCustomerContactAttempts} contact attempts used.`,
      });
    }

    // 5. Cooldown Interval Check
    if (recoveryCase.lastAttemptAt && !params.skipCooldownCheck) {
      const lastAttemptMs = new Date(recoveryCase.lastAttemptAt).getTime();
      const elapsedMinutes = (Date.now() - lastAttemptMs) / (1000 * 60);
      const isCooldownViolated = elapsedMinutes < this.config.minRetryCooldownMinutes;

      if (isCooldownViolated) {
        const remainingMinutes = Math.ceil(this.config.minRetryCooldownMinutes - elapsedMinutes);
        violations.push(
          `COOLDOWN_ACTIVE: Minimum cooldown is ${this.config.minRetryCooldownMinutes}m (${remainingMinutes}m remaining).`
        );
      }
      checkedRules.push({
        rule: 'MIN_RETRY_COOLDOWN_MINUTES',
        passed: !isCooldownViolated,
        details: `${Math.floor(elapsedMinutes)}m elapsed vs ${this.config.minRetryCooldownMinutes}m required.`,
      });
    } else {
      checkedRules.push({
        rule: 'MIN_RETRY_COOLDOWN_MINUTES',
        passed: true,
        details: 'Initial attempt or cooldown verified.',
      });
    }

    // 6. Absolute Maximum Automated Recovery Amount
    const isAmountExceeded = amount > this.config.maxAutomatedRecoveryAmount;
    if (isAmountExceeded) {
      violations.push(
        `AMOUNT_EXCEEDS_MAX_LIMIT: ₹${amount.toLocaleString('en-IN')} exceeds maximum autonomous ceiling of ₹${this.config.maxAutomatedRecoveryAmount.toLocaleString('en-IN')}.`
      );
    }
    checkedRules.push({
      rule: 'MAX_AUTOMATED_RECOVERY_AMOUNT',
      passed: !isAmountExceeded,
      details: `₹${amount.toLocaleString('en-IN')} <= ₹${this.config.maxAutomatedRecoveryAmount.toLocaleString('en-IN')}`,
    });

    // 7. Daily Merchant Cap
    const isDailyCapExceeded = dailyRecoveredAmount + amount > this.config.maxDailyRecoveryAmount;
    if (isDailyCapExceeded) {
      violations.push(
        `DAILY_CAP_EXCEEDED: Merchant daily limit ₹${this.config.maxDailyRecoveryAmount.toLocaleString('en-IN')} reached.`
      );
    }
    checkedRules.push({
      rule: 'MAX_DAILY_RECOVERY_AMOUNT',
      passed: !isDailyCapExceeded,
      details: `Daily recovered ₹${dailyRecoveredAmount} + ₹${amount} vs limit ₹${this.config.maxDailyRecoveryAmount}`,
    });

    // 8. Human Approval Threshold
    const requiresApproval = amount > this.config.requireApprovalAbove;
    checkedRules.push({
      rule: 'REQUIRE_APPROVAL_ABOVE',
      passed: !requiresApproval,
      details: requiresApproval
        ? `₹${amount.toLocaleString('en-IN')} exceeds ₹${this.config.requireApprovalAbove.toLocaleString('en-IN')} threshold; operator sign-off required.`
        : `₹${amount.toLocaleString('en-IN')} is within automated execution threshold.`,
    });

    // Final Decision Compilation
    const isHardBlocked = violations.length > 0;
    const allowed = !isHardBlocked && !requiresApproval;
    const decision: 'ALLOWED' | 'NEEDS_APPROVAL' | 'HARD_BLOCK' = isHardBlocked
      ? 'HARD_BLOCK'
      : requiresApproval
      ? 'NEEDS_APPROVAL'
      : 'ALLOWED';

    let reason = 'Action is fully compliant with all deterministic safety policies.';
    if (isHardBlocked) {
      reason = `Blocked by policy: ${violations.join('; ')}`;
    } else if (requiresApproval) {
      reason = `Action is eligible but requires human operator approval because transaction value (₹${amount.toLocaleString('en-IN')}) exceeds the ₹${this.config.requireApprovalAbove.toLocaleString('en-IN')} threshold.`;
    }

    return {
      allowed,
      decision,
      isHardBlocked,
      reason,
      violations,
      requiredApproval: requiresApproval && !isHardBlocked,
      policyVersion: this.policyVersion,
      checkedRules,
    };
  }
}

export const policyEngine = new PolicyEngine();
