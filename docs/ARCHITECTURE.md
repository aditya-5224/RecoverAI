# RecoverAI Architecture Specification
**Razorpay Buildathon — Track 03: AI Revenue Recovery**
*Tagline: "Detect. Decide. Recover."*

---

## 1. System Overview

RecoverAI is an autonomous, deterministic-gated AI revenue recovery engine built for high-volume merchants. It bridges the critical gap between revenue leak detection (payment failures, checkout abandonments) and verified monetary recovery through Razorpay Test Mode APIs.

### Core Architectural Principle
**The LLM recommends. Deterministic policy code decides. The execution layer executes only approved actions.**
No monetary action is ever executed solely because an LLM suggested it.

```text
┌────────────────────────────────────────────────────────────────────────┐
│                              OBSERVE                                   │
│  - Real-time Webhooks (payment.failed, order.paid)                     │
│  - Anomaly Detector (e.g. UPI degradation, gateway drop-offs)           │
│  - Checkout Abandonment Poller (Orders without capture > threshold)    │
└───────────────────────────────────┬────────────────────────────────────┘
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                              DETECT                                    │
│  - Failure Classification (RETRYABLE, NON_RETRYABLE, etc.)             │
│  - Revenue Risk Calculation (Gross at Risk vs Recoverable Revenue)     │
│  - Recovery Case Generation with UUID & Idempotency Key                │
└───────────────────────────────────┬────────────────────────────────────┘
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                            DIAGNOSE                                    │
│  - Customer & Transaction History Inspection                          │
│  - Gemini AI Root-Cause Reasoning with structured JSON schema           │
│  - Heuristic Confidence + AI Confidence verification                   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                       SELECT RECOVERY STRATEGY                         │
│  - RETRY_PAYMENT                                                       │
│  - SEND_PAYMENT_REMINDER                                               │
│  - GENERATE_RECOVERY_LINK                                              │
│  - REQUEST_CUSTOMER_ACTION                                             │
│  - ESCALATE_HUMAN                                                      │
│  - STOP_RECOVERY                                                       │
└───────────────────────────────────┬────────────────────────────────────┘
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        POLICY & SAFETY GATE                            │
│  - Deterministic Rule Engine (Max retries, cooldown, daily limits)     │
│  - Amount Threshold Check (> ₹5,000 requires human approval)           │
│  - Stop Conditions & Opt-Out Enforcement                              │
└──────────────────┬─────────────────────────────────┬───────────────────┘
                   │ Allowed & Auto-Approved         │ Blocked / Needs Approval
                   ▼                                 ▼
┌──────────────────────────────────────┐  ┌──────────────────────────────┐
│          EXECUTE RECOVERY            │  │     HUMAN APPROVAL GATE      │
│  - Razorpay Test Mode API (Service)  │  │  - Merchant operator review  │
│  - Bounded retry & backoff           │  │  - Explicit approve/reject   │
└──────────────────┬───────────────────┘  └──────────────┬───────────────┘
                   │                                     │ Approved
                   └──────────────────┬──────────────────┘
                                      ▼
┌────────────────────────────────────────────────────────────────────────┐
│                          VERIFY & RECONCILE                            │
│  - Payment status confirmation from Razorpay API / Webhook             │
│  - Verified Recovered Revenue calculation                              │
│  - Immutable Audit Event Recording (Correlation ID, actor, timestamp)  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Frontend Architecture
- **Framework**: React 19 + TypeScript + Vite
- **Styling**: Tailwind CSS v4 + Plus Jakarta Sans + JetBrains Mono
- **Visuals**: Recharts (Revenue Leakage Breakdown, Hourly Spike Anomaly, Precision-Recall Curve, Evaluation Matrix)
- **State Management**: Reactive data fetching with polling & real-time webhook updates
- **Views**:
  1. **Executive Dashboard**: Top metrics (Gross At Risk, Recoverable, Recovered, Recovery Rate, Active Cases), Leakage by Category, Anomaly Radar.
  2. **Revenue Risk Radar**: Real-time breakdown of payment degradation anomalies and drop-offs.
  3. **Recovery Queue**: Actionable cases with Priority Scoring, AI Confidence, Policy Status, and Human Review modals.
  4. **AI Case View**: Comprehensive investigation drawer (Problem, Diagnosis, Evidence, Recommendation, Policy Rules, Audit Trail).
  5. **Transactions Explorer**: Full ledger of captured, failed, and recovered transactions with PII masking.
  6. **Evaluation Benchmark**: 10,000-record held-out benchmark results (Precision, Recall, Recovery Rate, False Positive Cost, Exception breakdown).
  7. **Audit Trail Timeline**: Step-by-step structured audit events with correlation IDs.
  8. **Demo Control Center**: 1-Click interactive scenario runner (Payment degradation, Checkout drop-off, API timeout, Safe stop, Human approval).
  9. **Settings & Policy Studio**: Live configuration of retry limits, cooldowns, and approval thresholds.

---

## 3. Backend Architecture
- **Server**: Express + Node.js with TypeScript and robust REST routing.
- **AI Agent Engine**: Stateful graph workflow with deterministic fallback logic and Gemini API (`@google/genai`) structured outputs.
- **Razorpay Service Layer**: Encapsulated `RazorpayService` interacting with Razorpay Orders, Payments, Payment Links, Subscriptions, and Webhooks in strict Test Mode.
- **Policy Engine**: Pure deterministic logic evaluating 6 standard safety vectors.
- **Data Engine**: Relational in-memory and durable SQLite database with migration capabilities, indexing, and seed generators.
- **Evaluation Pipeline**: Generates and evaluates 10,000 synthetic records with ground truth across 80% train / 20% held-out test splits.

---

## 4. Security & Safety Model
- **No Direct LLM Execution**: The AI outputs structured JSON suggestions. The Policy Engine independently verifies all constraints before any call to Razorpay.
- **PII Masking**: Customer emails (`j***@example.com`) and phones (`+91 98*** **210`) are masked on all UI and API responses.
- **Idempotency**: All executions are keyed by `recovery_case_id:action_type:attempt_number` to prevent duplicate recovery actions.
- **Webhook Signature Validation**: HMAC SHA256 validation against `RAZORPAY_WEBHOOK_SECRET`.
- **Environment Isolation**: Refuses to run if live production keys are supplied in test mode (`RAZORPAY_ENV=test`).
