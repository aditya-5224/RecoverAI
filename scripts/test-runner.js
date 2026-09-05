/**
 * RecoverAI Automated Hostile Test Suite & Production Readiness Auditor
 * 20 Thorough Automated Verification Checks covering:
 * - Real Razorpay Test Mode Integration & Webhook Security
 * - Deterministic Policy Gates (₹3,500, ₹7,500, ₹10,000, ₹10,001, ₹18,500)
 * - Safe Stop, Cooldown, and Opt-Out enforcement
 * - Capture vs Failed Payment state protection
 * - Absence of fake endpoints
 * - AI Diagnostics, Concurrency Locks, Idempotency & 10,000-Record Synthetic Benchmark
 */

import { db } from '../src/server/db/database.ts';
import { policyEngine } from '../src/server/policy/policyEngine.ts';
import { recoveryAgent } from '../src/server/ai/agent.ts';
import { recoveryEngine } from '../src/server/recovery/recoveryEngine.ts';
import { revenueDetector } from '../src/server/detection/detector.ts';
import { evaluationBenchmark } from '../src/server/evaluation/benchmark.ts';
import { razorpayService } from '../src/server/integrations/razorpay/service.ts';
import { razorpayWebhookHandler } from '../src/server/integrations/webhookHandler.ts';
import { RecoveryActionType, RecoveryCaseStatus, RiskSource, PaymentMethod, FailureClassification } from '../src/types/index.ts';
import fs from 'fs';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

async function runTests() {
  console.log('\n================================================================');
  console.log('--- RUNNING RECOVERAI HOSTILE AUDIT & TEST SUITE (23 TESTS) ---');
  console.log('================================================================\n');

  // --- SECTION 1: REAL RAZORPAY TEST MODE & PAYMENT LINK VERIFICATION ---
  console.log('[SECTION 1: Real Razorpay Test Mode & Webhook Security]');

  // Test 1: Razorpay Test Mode credentials detection
  const hasCreds = razorpayService.hasRealCredentials();
  const isTest = razorpayService.isTestMode();
  assert(hasCreds && isTest, '1. Razorpay Test Mode credentials (rzp_test_*) detected and active');

  // Test 2: REAL HTTP Request to https://api.razorpay.com/v1/payment_links
  let realLink = null;
  try {
    realLink = await razorpayService.createPaymentLink({
      amount: 240000, // ₹2,400 in paise
      currency: 'INR',
      reference_id: `rec_test_${Date.now()}`,
      description: 'Audit Test Payment Link for RecoverAI',
      customer: {
        name: 'Test Customer',
        email: 'test@example.com',
        contact: '+919876543210',
      },
      notify: { sms: false, email: false },
    });
  } catch (err) {
    console.error('Payment link creation error:', err);
  }
  assert(
    realLink !== null &&
    typeof realLink.id === 'string' &&
    realLink.id.startsWith('plink_') &&
    realLink.isSimulated === false &&
    realLink.adapter.includes('RazorpayTestModeAdapter'),
    '2. Payment Link creation performed REAL HTTP request returning authentic plink_* ID from Razorpay'
  );

  // Test 3: Authentic Razorpay short_url
  assert(
    realLink !== null &&
    typeof realLink.short_url === 'string' &&
    realLink.short_url.startsWith('https://rzp.io/'),
    '3. Authenticated short_url returned directly by Razorpay API (rzp.io domain, not local text)'
  );

  // Test 4: Verification of No Fabricated /v1/payments/recovery Endpoint
  const hasFakeRecoveryEndpoint = typeof razorpayService.executePaymentRecovery !== 'undefined';
  assert(!hasFakeRecoveryEndpoint, '4. No fabricated /v1/payments/recovery endpoint exists in Razorpay service');

  // Test 5: Strict Payment State Rule: Failed payments cannot be sent to /capture
  let failedPaymentCaptureBlocked = false;
  try {
    await razorpayService.captureAuthorizedPayment('pay_sample_failed', 1000, 'INR', 'failed');
  } catch (err) {
    if (err.message.includes('INVALID_PAYMENT_STATE')) {
      failedPaymentCaptureBlocked = true;
    }
  }
  assert(failedPaymentCaptureBlocked, '5. Strict payment state gate: FAILED payment IDs rejected from /capture');

  // Test 6: Authorized Payment Capture Gate Validated
  let authorizedCaptureValid = false;
  try {
    // Testing authorized capture method signature with simulation adapter to ensure capture contract is sound
    const simCapture = await razorpayService.captureAuthorizedPayment('pay_auth_test_123', 1000, 'INR', 'authorized', { forceSimulation: true });
    authorizedCaptureValid = simCapture.status === 'captured' && simCapture.captured === true;
  } catch (err) {
    console.error(err);
  }
  assert(authorizedCaptureValid, '6. AUTHORIZED payment capture validated according to Razorpay API contract');

  // Test 7: HMAC-SHA256 Webhook Signature Verification & Deduplication
  const validBody = JSON.stringify({ event: 'payment_link.paid', entity: 'event' });
  const validSig = razorpayService.generateWebhookSignature(validBody);
  const sigValid = razorpayService.verifyWebhookSignature(validBody, validSig);
  const forgedSigRejected = !razorpayService.verifyWebhookSignature(validBody, 'forged_tampered_sig');
  assert(sigValid && forgedSigRejected, '7. Webhook HMAC-SHA256 timing-safe verification accepts valid & rejects forged');

  // Test 8: Frontend Security Audit: No Secrets Exposed to Client
  let secretsExposed = false;
  const srcFiles = fs.readdirSync('./src', { recursive: true });
  for (const f of srcFiles) {
    const filePath = `./src/${f}`;
    if (fs.statSync(filePath).isFile() && (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) && !filePath.includes('server')) {
      const content = fs.readFileSync(filePath, 'utf8');
      if (content.includes('RAZORPAY_KEY_SECRET') || content.includes('rzp_test_sec')) {
        secretsExposed = true;
        break;
      }
    }
  }
  assert(!secretsExposed, '8. Frontend security audit: Zero Razorpay secrets or credentials exposed to client bundle');

  // --- SECTION 2: DETERMINISTIC POLICY ENGINE (5 EXACT VALUE CASES) ---
  console.log('\n[SECTION 2: Deterministic Policy Engine & Safety Gates]');

  const baseMockCase = {
    id: 'CASE-POLICY-TEST',
    merchantId: 'merch_default',
    riskEventId: 'risk_pol_1',
    customerId: 'cust_1001',
    amountAtRisk: 3500,
    recoverableAmount: 3500,
    amountRecovered: 0,
    status: RecoveryCaseStatus.DIAGNOSED,
    priority: 'HIGH',
    priorityScore: 85,
    retryCount: 0,
    contactAttempts: 0,
    idempotencyKey: 'test_pol_key',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Test 9: Exact Case A: ₹3,500 -> AUTONOMOUS / allowed
  const evalCaseA = policyEngine.evaluate({
    actionType: RecoveryActionType.PAYMENT_LINK_RECOVERY,
    amount: 3500,
    recoveryCase: baseMockCase,
  });
  assert(
    evalCaseA.allowed === true && evalCaseA.requiredApproval === false,
    '9. Case A (₹3,500): AUTONOMOUS / allowed without human intervention'
  );

  // Test 10: Exact Case B: ₹7,500 -> NEEDS_APPROVAL
  const evalCaseB = policyEngine.evaluate({
    actionType: RecoveryActionType.PAYMENT_LINK_RECOVERY,
    amount: 7500,
    recoveryCase: baseMockCase,
  });
  assert(
    evalCaseB.allowed === false && evalCaseB.requiredApproval === true,
    '10. Case B (₹7,500): NEEDS_APPROVAL (> ₹5,000 threshold, <= ₹10,000 max)'
  );

  // Test 11: Exact Case C: ₹10,000 -> NEEDS_APPROVAL (At autonomous boundary)
  const evalCaseC = policyEngine.evaluate({
    actionType: RecoveryActionType.PAYMENT_LINK_RECOVERY,
    amount: 10000,
    recoveryCase: baseMockCase,
  });
  assert(
    evalCaseC.allowed === false && evalCaseC.requiredApproval === true,
    '11. Case C (₹10,000): NEEDS_APPROVAL (At boundary, requiring human sign-off)'
  );

  // Test 12: Exact Case D & E: ₹10,001 & ₹18,500 -> HARD_BLOCK
  const evalCaseD = policyEngine.evaluate({
    actionType: RecoveryActionType.PAYMENT_LINK_RECOVERY,
    amount: 10001,
    recoveryCase: baseMockCase,
  });
  const evalCaseE = policyEngine.evaluate({
    actionType: RecoveryActionType.PAYMENT_LINK_RECOVERY,
    amount: 18500,
    recoveryCase: baseMockCase,
  });
  const hardBlockPassed =
    evalCaseD.allowed === false &&
    evalCaseD.requiredApproval === false &&
    evalCaseD.violations.some((v) => v.includes('AMOUNT_EXCEEDS_MAX_LIMIT')) &&
    evalCaseE.allowed === false &&
    evalCaseE.requiredApproval === false &&
    evalCaseE.violations.some((v) => v.includes('AMOUNT_EXCEEDS_MAX_LIMIT'));
  assert(hardBlockPassed, '12. Case D (₹10,001) & Case E (₹18,500): HARD_BLOCK strictly enforced');

  // Test 13: Max Retries (2/2) Exhausted
  const exhaustedCase = { ...baseMockCase, retryCount: 2 };
  const evalMaxRetry = policyEngine.evaluate({
    actionType: RecoveryActionType.PAYMENT_LINK_RECOVERY,
    amount: 2000,
    recoveryCase: exhaustedCase,
  });
  assert(
    evalMaxRetry.allowed === false && evalMaxRetry.violations.some((v) => v.includes('MAX_RETRIES_EXCEEDED')),
    '13. 2 recovery attempts already performed -> blocked from further attempts'
  );

  // Test 14: 30-Minute Cooldown Gate
  const recentRetryCase = {
    ...baseMockCase,
    retryCount: 1,
    lastAttemptAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5m ago
  };
  const evalCooldown = policyEngine.evaluate({
    actionType: RecoveryActionType.PAYMENT_LINK_RECOVERY,
    amount: 2000,
    recoveryCase: recentRetryCase,
  });
  assert(
    evalCooldown.allowed === false && evalCooldown.violations.some((v) => v.includes('COOLDOWN_ACTIVE')),
    '14. Attempt after <30 minutes (5m elapsed) -> blocked by cooldown gate'
  );

  // Test 15: Customer Opt-Out Safety Gate
  const optedOutCustomer = {
    id: 'cust_optout_test',
    merchantId: 'merch_default',
    externalCustomerId: 'ext_opt',
    name: 'Opted Out User',
    email: 'optout@example.com',
    phone: '+919800000000',
    segment: 'RETAIL',
    optedOut: true,
    lifetimeValue: 5000,
    successfulPaymentsCount: 1,
    failedPaymentsCount: 1,
    createdAt: new Date().toISOString(),
  };
  db.saveCustomer(optedOutCustomer);
  const evalOptOut = policyEngine.evaluate({
    actionType: RecoveryActionType.SEND_PAYMENT_REMINDER,
    amount: 2000,
    recoveryCase: baseMockCase,
    customer: optedOutCustomer,
  });
  assert(
    evalOptOut.allowed === false && evalOptOut.violations.some((v) => v.includes('CUSTOMER_OPTED_OUT')),
    '15. Customer opt-out status -> blocked from automated recovery'
  );

  // --- SECTION 3: REVENUE DETECTION, AI REASONING & EXECUTION ---
  console.log('\n[SECTION 3: Detection, AI Reasoning, Concurrency & Idempotency]');

  // Test 16: Checkout Abandonment Detector
  const abandonments = revenueDetector.detectCheckoutAbandonments();
  assert(Array.isArray(abandonments) && abandonments.length > 0, '16. Checkout abandonment detector identifies dropped sessions > 30m');

  // Test 17: AI Diagnostic Engine Stateful Workflow
  const aiResult = await recoveryAgent.runWorkflow('CASE-UPI-1024', 'AI_AGENT');
  assert(
    aiResult.diagnosis !== undefined &&
    (aiResult.diagnosis.modelConfidence >= 0.5 || aiResult.diagnosis.heuristicConfidence >= 0.5) &&
    aiResult.policyResult !== undefined,
    '17. AI agent generates structured diagnosis with grounded confidence and policy gate'
  );

  // Test 18: Concurrency Execution Lock
  const lockAcquired = db.acquireExecutionLock('CASE-LOCK-TEST');
  const secondLockBlocked = !db.acquireExecutionLock('CASE-LOCK-TEST');
  db.releaseExecutionLock('CASE-LOCK-TEST');
  assert(lockAcquired && secondLockBlocked, '18. Concurrency execution lock protects against simultaneous duplicate execution');

  // Test 19: Recovery Execution with Real Payment Link Integration -> Awaiting Payment State
  const execCase = db.getRecoveryCase('CASE-ABANDON-2048');
  if (execCase) {
    execCase.lastAttemptAt = undefined;
    execCase.retryCount = 0;
    execCase.contactAttempts = 0;
    execCase.status = RecoveryCaseStatus.DIAGNOSED;
    execCase.amountRecovered = 0;
    execCase.completedAt = undefined;
    db.saveRecoveryCase(execCase);
  }
  const execResult = await recoveryEngine.executeCaseAction({
    caseId: 'CASE-ABANDON-2048',
    operatorActor: 'AI_AGENT',
    forceApprove: true,
  });
  const execSuccess =
    execResult.case.status === RecoveryCaseStatus.AWAITING_PAYMENT &&
    execResult.case.paymentLinkId !== undefined &&
    execResult.case.paymentLinkId.startsWith('plink_') &&
    execResult.case.paymentLinkUrl !== undefined &&
    execResult.case.amountRecovered === 0 &&
    execResult.case.completedAt === undefined;
  assert(execSuccess, '19. Recovery execution dispatches Razorpay Payment Link and enters awaiting-payment state');

  // Test 20: Real Webhook State Transition & Deduplication
  const whCaseId = 'CASE-WEBHOOK-RECON-AUDIT';
  const whCase = {
    id: whCaseId,
    merchantId: 'merch_default',
    riskEventId: 'risk_wh_1',
    customerId: 'cust_wh_1',
    orderId: 'order_wh_1',
    amountAtRisk: 3200,
    recoverableAmount: 3200,
    amountRecovered: 0,
    status: RecoveryCaseStatus.AWAITING_PAYMENT,
    priority: 'HIGH',
    priorityScore: 90,
    retryCount: 1,
    contactAttempts: 1,
    paymentLinkId: 'plink_audit_recon_888',
    paymentLinkUrl: 'https://rzp.io/i/test_audit_recon_888',
    paymentLinkReferenceId: 'ref_wh_recon_888',
    idempotencyKey: 'wh_recon_test_key',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  db.saveRecoveryCase(whCase);

  const webhookPayload = {
    entity: 'event',
    account_id: 'acc_test_audit',
    event: 'payment_link.paid',
    contains: ['payment_link', 'payment'],
    payload: {
      payment_link: {
        entity: {
          id: 'plink_audit_recon_888',
          reference_id: 'ref_wh_recon_888',
          amount: 320000,
          amount_paid: 320000,
          status: 'paid',
        },
      },
      payment: {
        entity: {
          id: 'pay_audit_recon_999',
          amount: 320000,
          currency: 'INR',
          status: 'captured',
          method: 'upi',
        },
      },
    },
  };

  const rawWebhookBody = JSON.stringify(webhookPayload);
  const correctHmacSig = razorpayService.generateWebhookSignature(rawWebhookBody);
  const eventId = `evt_audit_recon_${Date.now()}`;

  // Process valid webhook event through real webhook reconciliation service
  const reconResult1 = razorpayWebhookHandler.processWebhook({
    rawBody: rawWebhookBody,
    signature: correctHmacSig,
    eventId,
    parsedBody: webhookPayload,
  });

  const reconciledCase1 = db.getRecoveryCase(whCaseId);
  const webhookTransitionValid =
    reconResult1.success === true &&
    reconResult1.verified === true &&
    reconciledCase1.status === RecoveryCaseStatus.RECOVERED &&
    reconciledCase1.amountRecovered === 3200 &&
    reconciledCase1.completedAt !== undefined;

  // Process duplicate webhook event (same event ID) to verify deduplication
  const reconResult2 = razorpayWebhookHandler.processWebhook({
    rawBody: rawWebhookBody,
    signature: correctHmacSig,
    eventId,
    parsedBody: webhookPayload,
  });

  const reconciledCase2 = db.getRecoveryCase(whCaseId);
  const deduplicationValid =
    reconResult2.duplicate === true &&
    reconciledCase2.amountRecovered === 3200; // Did NOT double-count!

  assert(
    webhookTransitionValid && deduplicationValid,
    '20. Real webhook payment_link.paid transitions case to RECOVERED with verified amount, and duplicate event is safely ignored'
  );

  // Test 21: forceApprove respects Hard Safety Policies (Cannot bypass HARD_BLOCK)
  const eval7500 = policyEngine.evaluate({
    actionType: RecoveryActionType.PAYMENT_LINK_RECOVERY,
    amount: 7500,
    recoveryCase: baseMockCase,
  });
  const case7500NeedsApproval = eval7500.decision === 'NEEDS_APPROVAL' && eval7500.isHardBlocked === false;

  const case18500 = {
    ...baseMockCase,
    id: 'CASE-HARD-BLOCK-18500',
    amountAtRisk: 18500,
    recoverableAmount: 18500,
    status: RecoveryCaseStatus.DIAGNOSED,
    retryCount: 0,
    lastAttemptAt: undefined,
  };
  db.saveRecoveryCase(case18500);
  const execResult18500 = await recoveryEngine.executeCaseAction({
    caseId: 'CASE-HARD-BLOCK-18500',
    operatorActor: 'AI_AGENT',
    forceApprove: true,
  });
  const hardBlock18500Enforced =
    execResult18500.case.status === RecoveryCaseStatus.STOPPED &&
    execResult18500.case.amountRecovered === 0 &&
    execResult18500.recovered === false;

  const optOutCase = {
    ...baseMockCase,
    id: 'CASE-OPTOUT-BLOCKED',
    customerId: 'cust_optout_test',
    status: RecoveryCaseStatus.DIAGNOSED,
    retryCount: 0,
    lastAttemptAt: undefined,
  };
  db.saveRecoveryCase(optOutCase);
  const execResultOptOut = await recoveryEngine.executeCaseAction({
    caseId: 'CASE-OPTOUT-BLOCKED',
    operatorActor: 'AI_AGENT',
    forceApprove: true,
  });
  const optOutEnforced =
    execResultOptOut.case.status === RecoveryCaseStatus.STOPPED &&
    execResultOptOut.recovered === false;

  const maxRetryCase = {
    ...baseMockCase,
    id: 'CASE-MAXRETRY-BLOCKED',
    status: RecoveryCaseStatus.DIAGNOSED,
    retryCount: 2,
    lastAttemptAt: undefined,
  };
  db.saveRecoveryCase(maxRetryCase);
  const execResultMaxRetry = await recoveryEngine.executeCaseAction({
    caseId: 'CASE-MAXRETRY-BLOCKED',
    operatorActor: 'AI_AGENT',
    forceApprove: true,
  });
  const maxRetryEnforced =
    execResultMaxRetry.case.status === RecoveryCaseStatus.STOPPED &&
    execResultMaxRetry.recovered === false;

  assert(
    case7500NeedsApproval && hardBlock18500Enforced && optOutEnforced && maxRetryEnforced,
    '21. forceApprove satisfies only human approval: HARD_BLOCK (₹18,500, Opt-Out, Max Retries) strictly enforced'
  );

  // Test 22: 10,000-Record Synthetic Benchmark Evaluation
  const evalRun = evaluationBenchmark.runEvaluation(10000, 42);
  const evalPass =
    evalRun.totalRecords === 10000 &&
    evalRun.heldOutRecords === 2000 &&
    evalRun.precision > 0.8 &&
    evalRun.recall > 0.8;
  assert(
    evalPass,
    `22. 10,000-record synthetic benchmark evaluated (Precision: ${(evalRun.precision * 100).toFixed(1)}%, Recall: ${(evalRun.recall * 100).toFixed(1)}%, F1: ${(evalRun.f1Score * 100).toFixed(1)}%)`
  );

  // Test 23: Strict Amount Verification (Missing/Zero/Invalid amount cannot recover revenue)
  const zeroAmtCaseId = 'CASE-ZERO-AMT-AUDIT';
  const zeroAmtCase = {
    id: zeroAmtCaseId,
    merchantId: 'merch_default',
    riskEventId: 'risk_zero_1',
    customerId: 'cust_zero_1',
    orderId: 'order_zero_1',
    amountAtRisk: 5400,
    recoverableAmount: 5400,
    amountRecovered: 0,
    status: RecoveryCaseStatus.AWAITING_PAYMENT,
    priority: 'HIGH',
    priorityScore: 90,
    retryCount: 1,
    contactAttempts: 1,
    paymentLinkId: 'plink_zero_amt_test',
    paymentLinkUrl: 'https://rzp.io/i/zero_amt_test',
    paymentLinkReferenceId: 'ref_zero_amt_test',
    idempotencyKey: 'zero_amt_test_key',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  db.saveRecoveryCase(zeroAmtCase);

  // 1. Missing / Zero Amount Payload
  const zeroAmountPayload = {
    entity: 'event',
    account_id: 'acc_test_audit',
    event: 'payment_link.paid',
    contains: ['payment_link'],
    payload: {
      payment_link: {
        entity: {
          id: 'plink_zero_amt_test',
          reference_id: 'ref_zero_amt_test',
          amount: 0,
          amount_paid: 0,
          status: 'paid',
        },
      },
    },
  };
  const zeroRawBody = JSON.stringify(zeroAmountPayload);
  const zeroHmacSig = razorpayService.generateWebhookSignature(zeroRawBody);
  const zeroEventId = `evt_zero_amt_${Date.now()}`;

  const zeroReconResult = razorpayWebhookHandler.processWebhook({
    rawBody: zeroRawBody,
    signature: zeroHmacSig,
    eventId: zeroEventId,
    parsedBody: zeroAmountPayload,
  });

  const postZeroCase = db.getRecoveryCase(zeroAmtCaseId);
  const zeroRejected =
    zeroReconResult.statusCode === 422 &&
    zeroReconResult.success === false &&
    postZeroCase.status === RecoveryCaseStatus.AWAITING_PAYMENT &&
    postZeroCase.amountRecovered === 0 &&
    postZeroCase.completedAt === undefined;

  // 2. Missing Amount Fields Entirely
  const missingAmtPayload = {
    entity: 'event',
    account_id: 'acc_test_audit',
    event: 'payment_link.paid',
    contains: ['payment_link'],
    payload: {
      payment_link: {
        entity: {
          id: 'plink_zero_amt_test',
          reference_id: 'ref_zero_amt_test',
          status: 'paid',
        },
      },
    },
  };
  const missingRawBody = JSON.stringify(missingAmtPayload);
  const missingHmacSig = razorpayService.generateWebhookSignature(missingRawBody);
  const missingEventId = `evt_missing_amt_${Date.now()}`;

  const missingReconResult = razorpayWebhookHandler.processWebhook({
    rawBody: missingRawBody,
    signature: missingHmacSig,
    eventId: missingEventId,
    parsedBody: missingAmtPayload,
  });

  const postMissingCase = db.getRecoveryCase(zeroAmtCaseId);
  const missingRejected =
    missingReconResult.statusCode === 422 &&
    missingReconResult.success === false &&
    postMissingCase.status === RecoveryCaseStatus.AWAITING_PAYMENT &&
    postMissingCase.amountRecovered === 0 &&
    postMissingCase.completedAt === undefined;

  assert(
    zeroRejected && missingRejected,
    '23. Invariant: payment_link.paid webhook with missing/zero amount is rejected and NEVER marks revenue recovered'
  );

  // TEST 24 (TEST A): Synthetic recovery excluded from verified revenue metrics
  const c5080 = db.getRecoveryCase('CASE-RECOV-5080');
  const allCasesNow = db.listRecoveryCases();
  const verifiedCasesA = allCasesNow.filter(
    (c) =>
      c.status === RecoveryCaseStatus.RECOVERED &&
      c.recoveryProvenance === 'RAZORPAY_WEBHOOK' &&
      typeof c.verifiedAmount === 'number' &&
      c.verifiedAmount > 0
  );
  const demoCasesA = allCasesNow.filter(
    (c) => c.status === RecoveryCaseStatus.RECOVERED && c.recoveryProvenance === 'SYNTHETIC_DEMO'
  );
  const demoRevA = demoCasesA.reduce((sum, c) => sum + (c.amountRecovered || 0), 0);

  const testAValid =
    c5080.status === RecoveryCaseStatus.RECOVERED &&
    c5080.amountRecovered === 6800 &&
    c5080.recoveryProvenance === 'SYNTHETIC_DEMO' &&
    demoRevA >= 6800 &&
    !verifiedCasesA.some((c) => c.id === 'CASE-RECOV-5080');

  assert(
    testAValid,
    '24. Provenance Test A: Synthetic seed recovery CASE-RECOV-5080 has SYNTHETIC_DEMO provenance and is excluded from verified Razorpay revenue'
  );

  // TEST 25 (TEST B & TEST C): Real webhook recovery recorded with RAZORPAY_WEBHOOK provenance & accounting separation
  const testBCaseId = `CASE-TEST-PROV-B-${Date.now()}`;
  const testBCase = {
    ...baseMockCase,
    id: testBCaseId,
    amountAtRisk: 5400,
    recoverableAmount: 5400,
    amountRecovered: 0,
    status: RecoveryCaseStatus.AWAITING_PAYMENT,
    paymentLinkId: `plink_prov_b_${Date.now()}`,
    paymentLinkReferenceId: `ref_prov_b_${Date.now()}`,
  };
  db.saveRecoveryCase(testBCase);

  const testBWebhook = {
    entity: 'event',
    account_id: 'acc_test_audit',
    event: 'payment_link.paid',
    contains: ['payment_link'],
    payload: {
      payment_link: {
        entity: {
          id: testBCase.paymentLinkId,
          reference_id: testBCase.paymentLinkReferenceId,
          amount: 540000,
          amount_paid: 540000,
          status: 'paid',
        },
      },
    },
  };
  const testBRaw = JSON.stringify(testBWebhook);
  const testBSig = razorpayService.generateWebhookSignature(testBRaw);
  const testBEventId = `evt_prov_b_${Date.now()}`;

  const testBResult = razorpayWebhookHandler.processWebhook({
    rawBody: testBRaw,
    signature: testBSig,
    eventId: testBEventId,
    parsedBody: testBWebhook,
  });

  const postTestBCase = db.getRecoveryCase(testBCaseId);
  const testBValid =
    testBResult.success === true &&
    postTestBCase.status === RecoveryCaseStatus.RECOVERED &&
    postTestBCase.recoveryProvenance === 'RAZORPAY_WEBHOOK' &&
    postTestBCase.verifiedWebhookEventId === testBEventId &&
    postTestBCase.verifiedPaymentLinkId === testBCase.paymentLinkId &&
    postTestBCase.verifiedAmount === 5400 &&
    postTestBCase.amountRecovered === 5400;

  const allCasesPostB = db.listRecoveryCases();
  const verifiedCasesPostB = allCasesPostB.filter(
    (c) =>
      c.status === RecoveryCaseStatus.RECOVERED &&
      c.recoveryProvenance === 'RAZORPAY_WEBHOOK' &&
      typeof c.verifiedAmount === 'number' &&
      c.verifiedAmount > 0
  );
  const verifiedRevPostB = verifiedCasesPostB.reduce((sum, c) => sum + (c.verifiedAmount || 0), 0);
  const demoCasesPostB = allCasesPostB.filter(
    (c) => c.status === RecoveryCaseStatus.RECOVERED && c.recoveryProvenance === 'SYNTHETIC_DEMO'
  );
  const demoRevPostB = demoCasesPostB.reduce((sum, c) => sum + (c.amountRecovered || 0), 0);

  const testCValid =
    verifiedCasesPostB.length >= 2 &&
    verifiedRevPostB >= 8600 &&
    demoRevPostB === 6800;

  assert(
    testBValid && testCValid,
    '25. Provenance Test B & C: Real webhook sets RAZORPAY_WEBHOOK provenance and maintains strict mathematical separation from synthetic revenue'
  );

  // TEST 26 (TEST E): Invalid signature cannot create provenance or transition state
  const testECaseId = `CASE-TEST-PROV-E-${Date.now()}`;
  const testECase = {
    ...baseMockCase,
    id: testECaseId,
    amountAtRisk: 4200,
    recoverableAmount: 4200,
    amountRecovered: 0,
    status: RecoveryCaseStatus.AWAITING_PAYMENT,
    paymentLinkId: `plink_prov_e_${Date.now()}`,
    paymentLinkReferenceId: `ref_prov_e_${Date.now()}`,
  };
  db.saveRecoveryCase(testECase);

  const testEResult = razorpayWebhookHandler.processWebhook({
    rawBody: testBRaw,
    signature: 'invalid_forged_hmac_signature',
    eventId: `evt_forged_${Date.now()}`,
    parsedBody: testBWebhook,
  });

  const postECase = db.getRecoveryCase(testECaseId);
  const testEValid =
    testEResult.statusCode === 400 &&
    testEResult.success === false &&
    postECase.status === RecoveryCaseStatus.AWAITING_PAYMENT &&
    postECase.recoveryProvenance !== 'RAZORPAY_WEBHOOK' &&
    postECase.verifiedAmount === undefined;

  assert(
    testEValid,
    '26. Provenance Test E: Invalid HMAC signature is rejected and cannot create RAZORPAY_WEBHOOK provenance'
  );

  // TEST 27 (TEST F): Duplicate webhook cannot mutate accounting or duplicate revenue
  const testFResult = razorpayWebhookHandler.processWebhook({
    rawBody: testBRaw,
    signature: testBSig,
    eventId: testBEventId,
    parsedBody: testBWebhook,
  });

  const postFCase = db.getRecoveryCase(testBCaseId);
  const testFValid =
    testFResult.duplicate === true &&
    postFCase.verifiedAmount === 5400 &&
    postFCase.amountRecovered === 5400 &&
    postFCase.verifiedWebhookEventId === testBEventId;

  assert(
    testFValid,
    '27. Provenance Test F: Duplicate webhook event is ignored and does not duplicate revenue or mutate provenance'
  );

  // TEST 28 (TEST G): Payment link creation sets AWAITING_PAYMENT, not RECOVERED, and has no webhook provenance
  const testGPlink = await razorpayService.createPaymentLink({
    amount: 2500,
    currency: 'INR',
    description: 'Test G Link Creation',
    customer: { name: 'Test G', email: 'testg@example.com' },
  });
  const testGCaseId = `CASE-TEST-G-${Date.now()}`;
  const testGCase = {
    ...baseMockCase,
    id: testGCaseId,
    amountAtRisk: 2500,
    status: RecoveryCaseStatus.AWAITING_PAYMENT,
    amountRecovered: 0,
    paymentLinkId: testGPlink.id,
  };
  db.saveRecoveryCase(testGCase);

  const postGCase = db.getRecoveryCase(testGCaseId);
  const testGValid =
    testGPlink.id.startsWith('plink_') &&
    postGCase.status === RecoveryCaseStatus.AWAITING_PAYMENT &&
    postGCase.amountRecovered === 0 &&
    postGCase.verifiedAmount === undefined &&
    postGCase.recoveryProvenance !== 'RAZORPAY_WEBHOOK' &&
    postGCase.completedAt === undefined;

  assert(
    testGValid,
    '28. Provenance Test G: Payment link creation leaves case in AWAITING_PAYMENT with zero recovered amount and no webhook provenance'
  );

  // TEST 29 (Phase 1 Reset System): Demo reset restores clean state, clears live webhooks/locks, preserves synthetic provenance
  db.resetToCleanDemoState();
  const resetCases = db.listRecoveryCases();
  const resetRecov5080 = db.getRecoveryCase('CASE-RECOV-5080');

  const verifiedPostReset = resetCases.filter(
    (c) =>
      c.status === RecoveryCaseStatus.RECOVERED &&
      c.recoveryProvenance === 'RAZORPAY_WEBHOOK' &&
      typeof c.verifiedAmount === 'number' &&
      c.verifiedAmount > 0
  );
  const verifiedRevPostReset = verifiedPostReset.reduce((sum, c) => sum + (c.verifiedAmount || 0), 0);
  const syntheticCasesPostReset = resetCases.filter(
    (c) => c.status === RecoveryCaseStatus.RECOVERED && c.recoveryProvenance === 'SYNTHETIC_DEMO'
  );
  const syntheticRevPostReset = syntheticCasesPostReset.reduce((sum, c) => sum + (c.amountRecovered || 0), 0);

  const test29Valid =
    resetRecov5080 !== undefined &&
    resetRecov5080.status === RecoveryCaseStatus.RECOVERED &&
    resetRecov5080.recoveryProvenance === 'SYNTHETIC_DEMO' &&
    resetRecov5080.verifiedAmount === undefined &&
    verifiedPostReset.length === 0 &&
    verifiedRevPostReset === 0 &&
    syntheticRevPostReset === 6800 &&
    db.listAuditEvents().length > 0;

  assert(
    test29Valid,
    '29. Phase 1 Reset System: db.resetToCleanDemoState() clears live webhooks and locks, restores seed dataset, and guarantees verified revenue is exactly ₹0'
  );

  console.log(`\n================================================================`);
  console.log(`FINAL AUDIT RESULTS: ${passed} PASSED, ${failed} FAILED (${passed}/${passed + failed} Target)`);
  console.log(`================================================================\n`);

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
