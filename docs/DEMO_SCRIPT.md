# RecoverAI 3-Minute Judge Demonstration Script

## Overview
This reproducible demonstration shows how RecoverAI takes a merchant from discovering a live revenue leakage anomaly to verified recovery while respecting strict deterministic safety policies.

---

## Timeline

### 0:00 – 0:20 | The Problem & Anomaly Detection
- Open **Dashboard** & **Revenue Risk Radar**.
- Point out the real-time anomaly: **UPI Payment Failure Spike** (jumped from baseline 7.2% to 18.6%).
- Note the metric cards:
  - **₹4.82L** Gross Revenue at Risk
  - **₹2.91L** Recoverable Revenue
  - **₹1.74L** Recovered Revenue to Date

### 0:20 – 0:50 | AI Diagnosis & Evidence
- Navigate to **Recovery Queue** or open a high-priority case (e.g., `CASE-UPI-1024`, Amount: ₹4,500).
- Click **Investigate / Analyze**.
- Highlight the **AI Diagnostic Panel**:
  - *Diagnosis*: Temporary Gateway Degradation on HDFC/UPI rail.
  - *Evidence*: 3 recent successful payments, 1 sudden timeout, retry count = 0.
  - *Confidence*: 94% heuristic + model confidence.

### 0:50 – 1:20 | Deterministic Policy Gate & Safe Execution
- Show the **Policy Validation Gate**:
  - `Retry count (0) < Limit (2)` -> **PASSED**
  - `Amount (₹4,500) < Auto-Limit (₹10,000)` -> **PASSED**
  - `Cooldown check` -> **PASSED**
- Click **Execute Recovery Action** (`RETRY_PAYMENT`).
- Watch the live execution call to **Razorpay Test Mode API**.
- Payment transitions to `CAPTURED`.

### 1:20 – 1:50 | Verified Recovery & Audit Trail
- Observe the metric counter update: Recovered Revenue instantly reflects +₹4,500.
- Switch to the **Audit Trail Timeline**:
  - View the structured audit log with timestamp, correlation ID, actor (`AI_AGENT`), policy evaluation details, and verified Razorpay transaction ID.

### 1:50 – 2:30 | Controlled Failure & Safe Stop Demo
- Open **Demo Control Panel** (`/demo`).
- Trigger **Scenario 4: API Failure / Retry Limit Exhausted**.
- Watch the agent attempt a retry, receive a simulated gateway error, check retry limits, and execute a **SAFE STOP** rather than spamming the user or gateway.
- Show **Scenario 6: High-Value Human Approval Gate** (Amount: ₹18,000 > ₹5,000 threshold).
- Demonstrate that the agent refuses to execute until the merchant operator clicks **Approve**.

### 2:30 – 3:00 | Held-Out Evaluation Benchmark
- Navigate to **Evaluations** tab.
- Present the 10,000-record benchmark results:
  - Detection Precision: **96.4%**
  - Detection Recall: **93.8%**
  - Recovery Rate: **64.2%**
  - False Positive Cost: **₹0** (Zero inappropriate interventions)
- Conclude with the core pitch: *"RecoverAI doesn't just show merchants where revenue is slipping away. It safely and deterministically wins it back."*
