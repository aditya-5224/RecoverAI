# RecoverAI — Autonomous Revenue Recovery Platform
### *"Detect. Decide. Recover."*
**Track 03 — AI Revenue Recovery | Razorpay Buildathon**

RecoverAI is an enterprise-grade, full-stack autonomous revenue recovery platform designed for modern Indian payment stacks. It continuously monitors payment health, detects revenue leakage (such as transient bank switch timeouts and checkout abandonments), diagnoses root causes using generative AI, evaluates policy boundaries using deterministic safety gates, executes bounded interventions via Razorpay Test Mode APIs, and reconciles recovered revenue strictly through cryptographically verified webhooks.

---

## 📸 System Architecture & End-to-End Workflow

```
┌────────────────────────┐      ┌────────────────────────┐      ┌────────────────────────┐
│   DETECTION ENGINE     │ ───► │  AI DIAGNOSIS AGENT    │ ───► │ DETERMINISTIC POLICY   │
│  - UPI Latency Spikes  │      │ - Gemini 2.5 Engine    │      │ - Max Auto Limit: ₹10k │
│  - Checkout Drop-offs  │      │ - Grounded Reasoning   │      │ - Human Gate: > ₹5,000 │
│  - Bank Switch Errors  │      │ - Fallback Classifier  │      │ - Cooldown & Max Retries│
└────────────────────────┘      └────────────────────────┘      └────────────────────────┘
                                                                            │
                                                                            ▼
┌────────────────────────┐      ┌────────────────────────┐      ┌────────────────────────┐
│  VERIFIED RECOVERY     │ ◄─── │ HMAC-SHA256 WEBHOOK    │ ◄─── │   BOUNDED EXECUTION    │
│ - Provenance: RAZORPAY │      │ - Signature Check      │      │ - Razorpay PaymentLink │
│ - Provenance: SYNTHETIC│      │ - Deduplication Lock   │      │ - Status: AWAITING_PAY │
│ - Real-time Dashboard  │      │ - Event ID Logged      │      │ - Zero Unverified Recov│
└────────────────────────┘      └────────────────────────┘      └────────────────────────┘
```

### The 5-Stage Recovery Lifecycle:
1. **Detection**: The anomaly engine scans 24h transaction windows, identifying payment degradation spikes or abandoned checkouts exceeding 30 minutes.
2. **AI Diagnosis**: Gemini 2.5 analyzes failure metadata, error logs, and customer history to output structured root-cause classifications and confidence scores.
3. **Deterministic Policy Gate**: Pure TypeScript policy rules evaluate safety constraints (Max ₹10,000 limit, ₹5,000 human approval threshold, 30-min cooldown, opt-out check). Unbounded AI execution is strictly forbidden.
4. **Bounded Intervention**: Upon policy authorization, the system creates an authentic Razorpay Payment Link (`plink_*`). The recovery case enters `AWAITING_PAYMENT` with `amountRecovered = 0`.
5. **Webhook Reconciliation**: Revenue is marked `RECOVERED` **only** upon receiving a valid, HMAC-SHA256 verified `payment_link.paid` webhook event. Synthetic seed data is strictly isolated as `SYNTHETIC_DEMO`.

---

## 📁 Repository Directory Structure

```
recover-ai/
├── .env.example                     # Environment variables template
├── metadata.json                    # Application metadata & capabilities
├── package.json                     # Node dependencies & npm scripts
├── server.ts                        # Express server entry point with Vite middleware
├── vite.config.ts                   # Vite bundler configuration
│
├── scripts/
│   └── test-runner.js               # Hostile Audit & Test Suite (29 automated tests)
│
├── src/
│   ├── main.tsx                     # React entry point
│   ├── App.tsx                      # App component with tab navigation
│   ├── index.css                    # Tailwind CSS v4 setup & dark enterprise styles
│   │
│   ├── types/
│   │   └── index.ts                 # Central TypeScript interfaces & domain enums
│   │
│   ├── lib/
│   │   ├── api.ts                   # REST API client wrapper
│   │   └── utils.ts                 # Formatting utilities (currency, dates)
│   │
│   ├── components/                  # React UI Components
│   │   ├── Navbar.tsx               # Top enterprise navbar with live status & reset
│   │   ├── DashboardView.tsx        # Command Center KPI metrics & failure trend charts
│   │   ├── RecoveryQueueView.tsx    # Active cases data table with status filtering
│   │   ├── CaseDetailsModal.tsx     # Deep-dive case inspector & Webhook simulator
│   │   ├── RecoveryTimeline.tsx     # 5-stage visual lifecycle progress indicator
│   │   ├── PolicyStudioView.tsx     # Interactive policy threshold configuration
│   │   ├── DemoCenterModal.tsx      # 1-Click judge demonstration control center
│   │   ├── EvaluationView.tsx       # 10,000-record benchmark evaluation metrics
│   │   ├── AuditTrailView.tsx       # Immutable audit ledger with JSON payload inspect
│   │   └── TransactionsLedgerView.tsx# Transaction history table with risk badges
│   │
│   └── server/                      # Full-Stack Backend Modules
│       ├── ai/
│       │   └── agent.ts             # Gemini AI Agent with structured diagnosis
│       ├── db/
│       │   └── database.ts          # In-memory + persistent database engine
│       ├── demo/
│       │   └── scenarios.ts         # Pre-configured demo scenarios controller
│       ├── detection/
│       │   └── detector.ts          # Anomaly detection algorithm for payment leakage
│       ├── evaluation/
│       │   └── evaluator.ts         # 10k synthetic benchmark evaluation suite
│       ├── integrations/
│       │   ├── webhookHandler.ts    # HMAC-SHA256 verified Razorpay webhook ingestion
│       │   └── razorpay/
│       │       └── service.ts       # Razorpay Test Mode REST API adapter
│       ├── policy/
│       │   └── engine.ts            # Deterministic Policy Gate & safety rule checker
│       └── recovery/
│           └── recoveryEngine.ts    # Orchestrator for recovery workflow state transitions
```

---

## 🛠️ Core Technical Implementation Details

### 1. Deterministic Policy Engine (`src/server/policy/engine.ts`)
The policy engine enforces strict safety controls before any automated action is executed:
- **Maximum Recovery Amount**: Hard limit of ₹10,000 per transaction. Any case exceeding ₹10,000 (e.g., ₹18,500) triggers an unbypassable `HARD_BLOCK` (`STOPPED`).
- **Human Approval Gate**: Any action between ₹5,000 and ₹10,000 (e.g., ₹7,500) requires explicit human operator sign-off (`NEEDS_APPROVAL`).
- **Cooldown & Retry Limits**: Maximum 2 recovery attempts per case, with a mandatory 30-minute cooldown period between attempts.
- **Opt-Out Check**: Customer opt-out preferences immediately halt recovery actions.

### 2. HMAC-SHA256 Webhook Ingestion (`src/server/integrations/webhookHandler.ts`)
- **Crypto Verification**: Computes `crypto.createHmac('sha256', secret)` over the raw request payload and verifies against `x-razorpay-signature` using timing-safe comparisons (`crypto.timingSafeEqual`).
- **Event Idempotency**: Stores processed `verifiedWebhookEventId`s in memory/db. Re-sent or duplicate webhook payloads are recognized, returning HTTP 200 without duplicating recovered revenue.
- **Strict Amount Reconciliation**: Validates that `payment.amount` is positive and numeric. Rejects zero/missing amounts without falling back to `amountAtRisk`.

### 3. Provenance & Revenue Accounting (`src/server/db/database.ts`)
The platform explicitly separates live, verified revenue from baseline synthetic demonstration data:
- `RAZORPAY_WEBHOOK`: Provenance assigned exclusively to cases recovered via verified Razorpay Webhooks.
- `SYNTHETIC_DEMO`: Provenance assigned to static seed cases (e.g., `CASE-RECOV-5080`). Seed cases are strictly excluded from `verifiedRecoveredRevenue`.

---

## 🧪 Automated Hostile Audit & Test Suite

The repository includes a comprehensive 29-point test suite (`scripts/test-runner.js`) validating security, policy enforcement, idempotency, and revenue accounting invariants.

Run the test suite anytime with:
```bash
npx tsx scripts/test-runner.js
```

### Verified Test Suite Invariants (29/29 Passing):
1. **Razorpay Credentials**: Active `rzp_test_*` credentials confirmed.
2. **Real API Integration**: Generates authentic `plink_*` IDs via HTTPS calls to Razorpay.
3. **URL Authenticity**: Returns genuine `https://rzp.io/i/*` payment link URLs.
4. **No Fabricated Endpoints**: Verified absence of fake local API routes.
5. **State Gating**: Failed payment IDs are rejected from capture endpoints.
6. **Capture Contract**: Authorized payments are captured in compliance with Razorpay API contracts.
7. **HMAC Timing-Safe Check**: Rejects forged signatures and accepts valid HMAC hashes.
8. **Client Bundle Security**: Zero API secrets exposed to the frontend bundle.
9. **Autonomous Case A (₹3,500)**: Allowed without human intervention.
10. **Approval Gate Case B (₹7,500)**: Correctly flagged as `NEEDS_APPROVAL`.
11. **Boundary Gate Case C (₹10,000)**: Requires human operator approval.
12. **Hard Block Case D & E (₹18,500)**: Enforces `HARD_BLOCK` (`STOPPED`).
13. **Max Retries Gate**: 2 recovery attempts limit enforced.
14. **Cooldown Gate**: 30-minute cooldown period enforced.
15. **Opt-Out Protection**: Customer opt-out status stops recovery.
16. **Checkout Abandonment Detector**: Detects dropped sessions (>30 min).
17. **AI Diagnosis Grounding**: Validates structured diagnosis output.
18. **Concurrency Control**: Execution lock prevents simultaneous duplicate runs.
19. **Dispatched State**: Payment link creation transitions to `AWAITING_PAYMENT`.
20. **Reconciliation Transition**: Webhook transitions case to `RECOVERED` with verified amount.
21. **Force Approve Limits**: `forceApprove` satisfies human approval but cannot override `HARD_BLOCK`.
22. **10k Benchmark Evaluation**: Achieves Precision 91.5%, Recall 95.6%, F1 93.5%.
23. **Missing/Zero Amount Invariant**: Zero-amount webhooks rejected with HTTP 422.
24. **Synthetic Provenance**: Seed case `CASE-RECOV-5080` isolated as `SYNTHETIC_DEMO`.
25. **Provenances Mathematical Separation**: Verified revenue counts strictly `RAZORPAY_WEBHOOK`.
26. **Forged HMAC Rejection**: Invalid HMAC signature rejected with HTTP 400.
27. **Duplicate Webhook Idempotency**: Re-sent webhooks produce 0 revenue delta.
28. **Creation State Invariant**: Payment link creation retains `amountRecovered = 0`.
29. **Demo Reset System**: `POST /api/demo/reset` clears live webhooks and resets state.

---

## ⚡ API Endpoint Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/dashboard` | Returns financial metrics, leakage trends, and AI insights |
| `GET` | `/api/recovery-cases` | List all recovery cases with status and priority |
| `GET` | `/api/recovery-cases/:id` | Fetch specific case details and full audit log |
| `POST` | `/api/recovery-cases/:id/execute` | Trigger AI diagnosis, policy check, and payment link creation |
| `POST` | `/api/recovery-cases/:id/approve` | Human operator approval for cases in `NEEDS_APPROVAL` |
| `POST` | `/api/webhooks/razorpay` | Cryptographically verified Razorpay Webhook ingestion route |
| `POST` | `/api/demo/run` | Execute a pre-configured demo scenario |
| `POST` | `/api/demo/simulate-webhook` | Trigger test webhook reconciliation for an awaiting case |
| `POST` | `/api/demo/reset` | Reset database and live locks to clean demo state |
| `GET` | `/api/evaluation/run` | Run the 10,000-record benchmark evaluation |

---

## 🚀 Running the Project Locally

### 1. Prerequisites
- Node.js 20+
- npm or bun

### 2. Environment Setup
Create a `.env` file in the project root:
```env
GEMINI_API_KEY=your_gemini_api_key_here
RAZORPAY_ENV=test
RAZORPAY_KEY_ID=rzp_test_your_key_id
RAZORPAY_KEY_SECRET=your_key_secret
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret
```

### 3. Installation & Startup
```bash
# Install dependencies
npm install

# Build the applet & backend
npm run build

# Start the dev server on port 3000
npm run dev
```

### 4. Open in Browser
Navigate to `http://localhost:3000` to interact with the RecoverAI Command Center.
