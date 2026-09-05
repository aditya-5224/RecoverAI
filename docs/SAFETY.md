# RecoverAI Safety & Deterministic Policy Architecture

## 1. Core Principle: Zero Unbounded LLM Authority
No monetary action (retrying a charge, generating a payment link, initiating customer contact) can be triggered directly by an AI model.

The AI functions strictly as a diagnostic advisor:
1. **AI Output**: Emits a structured JSON recommendation with evidence and heuristic confidence.
2. **Policy Filter**: The recommendation is evaluated by the Deterministic Policy Engine.
3. **Execution Gate**: Only if all policy assertions evaluate to `ALLOWED` is the action passed to the `RazorpayService`.

---

## 2. Policy Matrix

| Policy Parameter | Default Value | Description | Violation Consequence |
|---|---|---|---|
| `MAX_RETRIES_PER_PAYMENT` | 2 | Maximum automated retry attempts on a single failed payment | Transitions case to `SAFE_STOP` or `ESCALATE_HUMAN` |
| `MAX_AUTOMATED_RECOVERY_AMOUNT` | ₹10,000 | Upper bound for automated autonomous retry | Blocks automated execution; requires explicit human approval |
| `MAX_DAILY_RECOVERY_AMOUNT` | ₹100,000 | Merchant-wide 24-hour recovery cap | Pauses automated queue until next day |
| `MIN_RETRY_COOLDOWN_MINUTES` | 30 mins | Minimum gap between consecutive retries | Enqueues retry for future timestamp |
| `REQUIRE_APPROVAL_ABOVE` | ₹5,000 | Value threshold triggering human review | Transitions case to `NEEDS_APPROVAL` |
| `MAX_CUSTOMER_CONTACT_ATTEMPTS` | 2 | Maximum payment reminders sent per abandoned checkout | Permanently stops reminder sequence |

---

## 3. Idempotency & Concurrency Safety
- Every recovery attempt requires an idempotency key: `rec_{case_id}_{action_type}_{attempt_number}`.
- Re-executing an identical action returns the prior verified result without re-firing API calls.
- Webhook events are checked against the `audit_events` ledger to guarantee exactly-once processing.

---

## 4. Test Mode & Production Guardrails
- At initialization, `RazorpayService` verifies `RAZORPAY_ENV === 'test'`.
- If production credentials or live endpoints are detected in a demo environment, execution is immediately aborted with a `SECURITY_VIOLATION` error.
- All monetary operations in the hackathon are strictly performed in Razorpay Test Mode or clearly labeled simulation runs.
