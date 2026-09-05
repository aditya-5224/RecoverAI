# RecoverAI Evaluation & Benchmark Methodology
**Dataset Size**: 10,000 Transactions (Ground Truth Labeled)  
**Partition**: 80% Development / 20% Held-Out Test Set (2,000 records)

---

## 1. Metrics Definitions

### Detection Precision
$$\text{Precision} = \frac{\text{True Positives}}{\text{True Positives} + \text{False Positives}}$$
*Measures how accurately the system identifies genuine revenue leakages without flagging normal delays or non-recoverable drops.*

### Detection Recall
$$\text{Recall} = \frac{\text{True Positives}}{\text{True Positives} + \text{False Negatives}}$$
*Measures what fraction of actual revenue leakages were caught by RecoverAI.*

### Recovery Rate
$$\text{Recovery Rate} = \frac{\text{Verified Recovered Revenue}}{\text{Eligible Recoverable Revenue}}$$
*Measures financial efficacy exclusively against eligible, retryable opportunities (excluding expired, fraudulent, or hard-declined transactions).*

### False Positive Cost
$$\text{False Positive Cost} = \sum (\text{Inappropriate Interventions} \times \text{Customer Friction Cost Estimate})$$
*Measures the business cost of attempting recovery on non-recoverable or already resolved cases.*

---

## 2. Benchmark Composition
The 10,000-transaction synthetic benchmark includes:
- **Normal Successful Payments (65%)**: Control group.
- **Temporary Provider Failures (15%)**: Bank downtime, UPI timeout, network glitch (Eligible for automated retry).
- **Checkout Abandonments (10%)**: Order created without payment within threshold (Eligible for payment reminders).
- **Permanent Failures (6%)**: Invalid card details, expired credentials, account blocked (Non-retryable, customer action required or stop).
- **Fraud / High Risk Declines (4%)**: Blocked by policy or risk filters (Strictly unrecoverable).

---

## 3. Exception Taxonomy
RecoverAI classifies and exposes unhandled or stopped cases transparently:
1. `UNKNOWN_FAILURE_REASON`: Ambiguous gateway error code escalated for AI/human review.
2. `MISSING_CUSTOMER_CONTEXT`: Incomplete contact information preventing outbound recovery link.
3. `POLICY_BLOCKED`: Amount exceeds limits or cooldown period active.
4. `API_FAILURE`: Razorpay Test Mode simulated network or server timeout.
5. `HUMAN_APPROVAL_REQUIRED`: High-value transaction (> ₹5,000) awaiting merchant operator sign-off.
6. `CUSTOMER_OPTED_OUT`: Merchant customer explicitly requested no payment reminders.
