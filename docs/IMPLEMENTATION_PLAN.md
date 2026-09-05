# RecoverAI Implementation Plan & Milestones

---

## Phase Breakdown

### Milestone 1: Core System Architecture & Schema (Completed)
- [x] Architecture Blueprint (`docs/ARCHITECTURE.md`)
- [x] API Contracts & Data Dictionaries
- [x] Database Schema Design (10 Core Entities)
- [x] Environment & Configuration Specifications

### Milestone 2: Relational Data Layer & Migrations
- [ ] In-Memory / SQLite persistent store with foreign keys and indexes
- [ ] Tables: `merchants`, `customers`, `orders`, `payments`, `subscriptions`, `revenue_risk_events`, `recovery_cases`, `recovery_actions`, `audit_events`, `evaluation_runs`
- [ ] Data migration runner and seeding engine

### Milestone 3: Razorpay Test Mode Service Layer
- [ ] Official Razorpay API Client with authentication headers & Test Mode validation
- [ ] Orders API wrapper (`createOrder`, `fetchOrder`)
- [ ] Payments API wrapper (`fetchPayment`, `capturePayment`, `retryPayment`)
- [ ] Payment Links & Customer Invoicing wrapper
- [ ] Webhook signature verification (`crypto.createHmac('sha256', secret)`)
- [ ] Controlled simulation mode for reproducible failure/success scenarios

### Milestone 4: Detection & Revenue Risk Engine
- [ ] Real-time payment failure classifier (RETRYABLE, NON_RETRYABLE, CUSTOMER_ACTION_REQUIRED, TEMPORARY_PROVIDER_FAILURE, UNKNOWN)
- [ ] Checkout abandonment detector (`order.created` + time > threshold without capture)
- [ ] Anomaly detector for method-level degradation (e.g., UPI spike from 7.2% to 18.6%)
- [ ] Exact Revenue Formulas: Gross Revenue at Risk vs Eligible Recoverable Revenue vs Verified Recovered Revenue

### Milestone 5: Deterministic Policy Engine & Safety Gates
- [ ] `MAX_RETRIES_PER_PAYMENT` (Default: 2)
- [ ] `MAX_AUTOMATED_RECOVERY_AMOUNT` (Default: ₹10,000)
- [ ] `MAX_DAILY_RECOVERY_AMOUNT` (Default: ₹100,000)
- [ ] `MIN_RETRY_COOLDOWN_MINUTES` (Default: 30 mins)
- [ ] `REQUIRE_APPROVAL_ABOVE` (Default: ₹5,000)
- [ ] `MAX_CUSTOMER_CONTACT_ATTEMPTS` (Default: 2)
- [ ] Stop condition validator (already paid, opt-out, cooldown violation, retry limit reached)

### Milestone 6: AI Agent Workflow (Stateful Graph Engine)
- [ ] Structured Prompts (`diagnosis_prompt`, `strategy_prompt`, `explanation_prompt`)
- [ ] JSON response validation with robust schema parsing
- [ ] Multi-stage workflow: `load_case` -> `inspect_customer` -> `inspect_payment_history` -> `diagnose_failure` -> `calculate_recovery_opportunity` -> `generate_strategy` -> `policy_gate` -> `approval_gate` -> `execute_action` -> `verify_result` -> `calculate_recovered_amount` -> `write_audit`
- [ ] Graceful fallback to deterministic logic when LLM is unavailable or outputs invalid JSON

### Milestone 7: Synthetic Evaluation Pipeline (10,000 Records)
- [ ] Realistic generator with ground-truth labels across 5 failure categories, 4 payment methods, 3 customer tiers
- [ ] 80% Dev / 20% Held-Out evaluation partition
- [ ] Automated benchmark metric calculation: Precision, Recall, Recovery Rate, False Positive Cost, Mean Recovery Latency, Exception Taxonomy

### Milestone 8: Full-Stack REST API & Express Server
- [ ] `/api/dashboard` (Live KPI metrics, leakage charts, anomaly alerts)
- [ ] `/api/revenue-risk` (Risk events & active degradation radars)
- [ ] `/api/recovery-cases` & `/api/recovery-cases/:id` (Queue, inspection, filtering)
- [ ] `/api/recovery-cases/:id/analyze` (AI diagnosis trigger)
- [ ] `/api/recovery-cases/:id/approve` & `/api/recovery-cases/:id/reject` (Human approval gate)
- [ ] `/api/recovery-cases/:id/execute` (Bounded recovery execution)
- [ ] `/api/recovery-cases/:id/stop` (Safe stop)
- [ ] `/api/audit/:case_id` (Structured audit events)
- [ ] `/api/evaluation/latest` & `/api/evaluation/run` (Benchmark runner)
- [ ] `/api/demo/scenarios` & `/api/demo/run` & `/api/demo/reset` (1-Click demo controller)
- [ ] `/api/webhooks/razorpay` (Webhook ingestion & verification)

### Milestone 9: Frontend UI & Visualization
- [ ] High-density fintech operational UI
- [ ] Real-time stats & dynamic Recharts graphs
- [ ] Step-by-step visual audit timeline with color-coded gates
- [ ] Interactive AI Case Drawer with Evidence & Reasoning breakdown
- [ ] Demo scenario selector with live simulation feedback

### Milestone 10: Testing, Verification & Quality Gate
- [ ] End-to-end integration tests (Detection -> AI -> Policy -> Approval -> Execution -> Audit)
- [ ] Adversarial test cases (Bypassing limits, duplicate webhooks, malformed AI responses)
- [ ] Self-audit checklist validation
