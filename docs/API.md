# RecoverAI REST API Reference

Base URL: `/api`

### Standard Error Schema
```json
{
  "error": {
    "code": "POLICY_BLOCKED",
    "message": "Automated recovery amount exceeds configured limit.",
    "correlation_id": "corr_f9a8b7c6d5e4"
  }
}
```

---

## 1. Dashboard & Analytics
- `GET /api/dashboard`: Summary KPI metrics (revenueAtRisk, recoverableRevenue, recoveredRevenue, recoveryRate, activeCasesCount), 24h leakage by category, and degradation radar alerts.
- `GET /api/revenue-risk`: Detailed list of detected risk events and payment method health status.

## 2. Recovery Cases
- `GET /api/recovery-cases`: Filtered list of recovery cases with priority score, status, customer summary, and policy checks.
- `GET /api/recovery-cases/:id`: Detailed case file including customer history, diagnostic evidence, policy report, and audit events.
- `POST /api/recovery-cases/:id/analyze`: Invokes the AI diagnostic workflow (with deterministic classification and Gemini reasoning fallback).
- `POST /api/recovery-cases/:id/approve`: Operator approves a high-value or escalated recovery action.
- `POST /api/recovery-cases/:id/reject`: Operator rejects recovery proposal.
- `POST /api/recovery-cases/:id/execute`: Executes approved action via Razorpay Test Mode or bounded simulation.
- `POST /api/recovery-cases/:id/stop`: Manually triggers a safe stop on the recovery case.

## 3. Audit Ledger
- `GET /api/audit`: Global audit trail of all actions and security checks.
- `GET /api/audit/:case_id`: Chronological audit trail for a specific recovery case.

## 4. Evaluation Engine
- `GET /api/evaluation/latest`: Returns latest 10,000-transaction evaluation metrics (Precision, Recall, Recovery Rate, False Positive Cost, Exception breakdown).
- `POST /api/evaluation/run`: Re-runs the full held-out evaluation suite.

## 5. Demo Control Center
- `GET /api/demo/scenarios`: Returns available pre-configured test scenarios.
- `POST /api/demo/run`: Executes a selected scenario (e.g., `payment_degradation`, `checkout_abandonment`, `api_failure`, `policy_blocked`, `human_approval`).
- `POST /api/demo/reset`: One-click factory reset restoring clean seed data and demo state.

## 6. Webhooks
- `POST /api/webhooks/razorpay`: Razorpay webhook endpoint with HMAC SHA-256 signature verification and idempotency protection.
