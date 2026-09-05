/**
 * RecoverAI Full-Stack Express Server Entry Point
 * Hosts all REST APIs, Razorpay webhook ingestion, AI workflow orchestrator, and Vite middleware.
 */

import express, { Request, Response } from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { db } from './src/server/db/database.ts';
import { razorpayService } from './src/server/integrations/razorpay/service.ts';
import { razorpayWebhookHandler } from './src/server/integrations/webhookHandler.ts';
import { policyEngine } from './src/server/policy/policyEngine.ts';
import { recoveryAgent } from './src/server/ai/agent.ts';
import { recoveryEngine } from './src/server/recovery/recoveryEngine.ts';
import { revenueDetector } from './src/server/detection/detector.ts';
import { evaluationBenchmark } from './src/server/evaluation/benchmark.ts';
import { demoManager } from './src/server/demo/scenarios.ts';
import { DashboardMetrics, RecoveryCaseStatus, RiskSource } from './src/types/index.ts';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // JSON Body Parser with raw body preservation for webhook signature checks
  app.use(
    express.json({
      verify: (req: any, res, buf) => {
        req.rawBody = buf.toString();
      },
    })
  );

  // --- API ROUTES FIRST ---

  // Health Check
  app.get('/api/health', (req: Request, res: Response) => {
    res.json({
      status: 'ok',
      service: 'RecoverAI Backend',
      version: '1.3.0',
      razorpayMode: razorpayService.isTestMode() ? 'TEST_MODE' : 'PRODUCTION',
      uptime: process.uptime(),
    });
  });

  // 1. Dashboard & KPI Analytics
  app.get('/api/dashboard', (req: Request, res: Response) => {
    const cases = db.listRecoveryCases();
    const riskEvents = db.listRiskEvents();
    const payments = db.listPayments(500);

    // Calculate exact revenue math with strict provenance separation
    const grossRevenueAtRisk = riskEvents.reduce((sum, r) => sum + r.grossAmountAtRisk, 0);
    const eligibleRecoverableRevenue = cases.reduce((sum, c) => sum + c.recoverableAmount, 0);

    const verifiedRecoveredCases = cases.filter(
      (c) =>
        c.status === RecoveryCaseStatus.RECOVERED &&
        c.recoveryProvenance === 'RAZORPAY_WEBHOOK' &&
        typeof c.verifiedAmount === 'number' &&
        c.verifiedAmount > 0
    );

    const verifiedRecoveredRevenue = verifiedRecoveredCases.reduce(
      (sum, c) => sum + (c.verifiedAmount || 0),
      0
    );

    const razorpayCapturedCount = verifiedRecoveredCases.length;

    const demoSyntheticCases = cases.filter(
      (c) =>
        c.status === RecoveryCaseStatus.RECOVERED &&
        c.recoveryProvenance === 'SYNTHETIC_DEMO'
    );

    const demoSyntheticRecoveredRevenue = demoSyntheticCases.reduce(
      (sum, c) => sum + (c.amountRecovered || 0),
      0
    );

    const demoSyntheticRecoveredCount = demoSyntheticCases.length;

    const recoveryRate = eligibleRecoverableRevenue > 0
      ? Math.round((verifiedRecoveredRevenue / eligibleRecoverableRevenue) * 1000) / 10
      : 0;

    const activeCasesCount = cases.filter(
      (c) => c.status !== RecoveryCaseStatus.RECOVERED && c.status !== RecoveryCaseStatus.STOPPED
    ).length;

    const approvalPendingCount = cases.filter(
      (c) => c.status === RecoveryCaseStatus.NEEDS_APPROVAL
    ).length;

    const todayRecoveredCount = verifiedRecoveredCases.length;

    // Leakage categories
    const leakageMap = new Map<string, { amount: number; casesCount: number }>();
    riskEvents.forEach((re) => {
      const cat = re.source === RiskSource.CHECKOUT_ABANDONMENT
        ? 'Checkout Drop-off'
        : re.classification.replace(/_/g, ' ');
      const existing = leakageMap.get(cat) || { amount: 0, casesCount: 0 };
      leakageMap.set(cat, {
        amount: existing.amount + re.grossAmountAtRisk,
        casesCount: existing.casesCount + 1,
      });
    });

    const totalLeakage = grossRevenueAtRisk || 1;
    const leakageByCategory = Array.from(leakageMap.entries()).map(([category, val]) => ({
      category,
      amount: val.amount,
      percentage: Math.round((val.amount / totalLeakage) * 1000) / 10,
      casesCount: val.casesCount,
      trend: (category.includes('TEMPORARY') ? 'UP' : 'STABLE') as 'UP' | 'DOWN' | 'STABLE',
    }));

    // Method Health & Anomaly Detector
    const methodHealth = revenueDetector.calculatePaymentMethodHealth();

    // Hourly Failure Trend
    const hourlyFailureTrend = [
      { hour: '18:00', upiFailures: 4, cardFailures: 2, netbankingFailures: 1, recoveredAmount: 12500 },
      { hour: '19:00', upiFailures: 6, cardFailures: 3, netbankingFailures: 0, recoveredAmount: 18400 },
      { hour: '20:00', upiFailures: 14, cardFailures: 2, netbankingFailures: 1, recoveredAmount: 24500 }, // Anomaly spike
      { hour: '21:00', upiFailures: 18, cardFailures: 3, netbankingFailures: 2, recoveredAmount: 32000 },
      { hour: '22:00', upiFailures: 9, cardFailures: 1, netbankingFailures: 0, recoveredAmount: 19800 },
      { hour: '23:00 (Now)', upiFailures: 5, cardFailures: 1, netbankingFailures: 1, recoveredAmount: 14200 },
    ];

    const metrics: DashboardMetrics = {
      grossRevenueAtRisk,
      eligibleRecoverableRevenue,
      verifiedRecoveredRevenue,
      razorpayCapturedCount,
      demoSyntheticRecoveredRevenue,
      demoSyntheticRecoveredCount,
      recoveryRate,
      activeCasesCount,
      approvalPendingCount,
      todayRecoveredCount,
      leakageByCategory,
      paymentMethodHealth: methodHealth.methods,
      hourlyFailureTrend,
      aiInsights: {
        summary: methodHealth.hasAnomaly
          ? 'Active Anomaly: Elevated UPI PSP Gateway Latency detected across HDFC/NPCI switches.'
          : 'Payment operations normal. Routine checkout abandonment monitoring active.',
        largestContributor: 'UPI Temporary Bank Settlement Timeouts (58.4% of leakage)',
        affectedCustomersCount: cases.length,
        eligibleForAutoRecoveryCount: cases.filter((c) => c.status === RecoveryCaseStatus.DIAGNOSED).length,
        estimatedRecoverableAmount: eligibleRecoverableRevenue - verifiedRecoveredRevenue,
        recommendation: 'Autonomous retry queue has 3 high-confidence retryable cases within policy cooldown limits.',
      },
    };

    res.json(metrics);
  });

  // 2. Revenue Risk & Radar
  app.get('/api/revenue-risk', (req: Request, res: Response) => {
    const riskEvents = db.listRiskEvents();
    const health = revenueDetector.calculatePaymentMethodHealth();
    res.json({
      events: riskEvents,
      methodHealth: health.methods,
      hasActiveAnomaly: health.hasAnomaly,
      anomalySummary: health.anomalyDetails,
    });
  });

  // 3. Recovery Cases Queue
  app.get('/api/recovery-cases', (req: Request, res: Response) => {
    const status = req.query.status as string | undefined;
    const priority = req.query.priority as string | undefined;
    const cases = db.listRecoveryCases({ status, priority });

    // Enrich with customer details
    const enriched = cases.map((c) => {
      const customer = db.getCustomer(c.customerId);
      const payment = c.paymentId ? db.getPayment(c.paymentId) : undefined;
      return {
        ...c,
        customerName: customer?.name || 'Unknown',
        customerEmail: customer?.email || 'N/A',
        customerPhone: customer?.phone || 'N/A',
        customerSegment: customer?.segment || 'RETAIL',
        paymentMethod: payment?.method || 'upi',
      };
    });

    res.json(enriched);
  });

  // Single Case Details
  app.get('/api/recovery-cases/:id', (req: Request, res: Response) => {
    const caseObj = db.getRecoveryCase(req.params.id);
    if (!caseObj) {
      return res.status(404).json({ error: 'Recovery case not found' });
    }

    const customer = db.getCustomer(caseObj.customerId);
    const order = caseObj.orderId ? db.getOrder(caseObj.orderId) : undefined;
    const payment = caseObj.paymentId ? db.getPayment(caseObj.paymentId) : undefined;
    const riskEvent = db.getRiskEvent(caseObj.riskEventId);
    const actions = db.listRecoveryActions(caseObj.id);
    const auditLogs = db.listAuditEvents({ caseId: caseObj.id });

    res.json({
      case: caseObj,
      customer,
      order,
      payment,
      riskEvent,
      actions,
      auditLogs,
      policyConfig: policyEngine.getConfig(),
    });
  });

  // Analyze Case (AI + Deterministic Diagnostic Graph)
  app.post('/api/recovery-cases/:id/analyze', async (req: Request, res: Response) => {
    try {
      const result = await recoveryAgent.runWorkflow(req.params.id, 'OPERATOR');
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to analyze recovery case' });
    }
  });

  // Human Operator Approval
  app.post('/api/recovery-cases/:id/approve', async (req: Request, res: Response) => {
    try {
      const operatorName = req.body.operatorName || 'Admin Operator';
      const updatedCase = await recoveryEngine.approveCase(req.params.id, operatorName);
      res.json({ success: true, case: updatedCase });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Human Operator Rejection
  app.post('/api/recovery-cases/:id/reject', async (req: Request, res: Response) => {
    try {
      const operatorName = req.body.operatorName || 'Admin Operator';
      const reason = req.body.reason || 'Operator declined proposed recovery strategy';
      const updatedCase = await recoveryEngine.rejectCase(req.params.id, operatorName, reason);
      res.json({ success: true, case: updatedCase });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Execute Case Action (Razorpay Test Mode)
  app.post('/api/recovery-cases/:id/execute', async (req: Request, res: Response) => {
    try {
      const forceApprove = req.body.forceApprove === true;
      const simulateOutcome = req.body.simulateOutcome;
      const result = await recoveryEngine.executeCaseAction({
        caseId: req.params.id,
        operatorActor: req.body.actor === 'HUMAN' ? 'HUMAN_OPERATOR' : 'AI_AGENT',
        forceApprove,
        simulateOutcome,
      });
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Stop Case
  app.post('/api/recovery-cases/:id/stop', async (req: Request, res: Response) => {
    try {
      const caseObj = db.getRecoveryCase(req.params.id);
      if (!caseObj) {
        return res.status(404).json({ error: 'Case not found' });
      }
      caseObj.status = RecoveryCaseStatus.STOPPED;
      caseObj.stopReason = req.body.reason || 'Manually stopped by merchant operator';
      caseObj.updatedAt = new Date().toISOString();
      db.saveRecoveryCase(caseObj);

      db.logAuditEvent({
        caseId: caseObj.id,
        correlationId: `corr_${caseObj.id}_stopman`,
        eventType: 'RECOVERY_STOPPED',
        actor: 'HUMAN_OPERATOR',
        input: { reason: caseObj.stopReason },
        decision: 'Manual safe stop executed',
        reason: caseObj.stopReason,
        result: { status: 'STOPPED' },
      });

      res.json({ success: true, case: caseObj });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 4. Audit Trail
  app.get('/api/audit', (req: Request, res: Response) => {
    const caseId = req.query.caseId as string | undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;
    const logs = db.listAuditEvents({ caseId, limit });
    res.json(logs);
  });

  // 5. Evaluation Benchmark (10K Records)
  app.get('/api/evaluation/latest', (req: Request, res: Response) => {
    const runs = db.getEvaluationRuns();
    if (runs.length === 0) {
      const newRun = evaluationBenchmark.runEvaluation(10000);
      return res.json(newRun);
    }
    res.json(runs[0]);
  });

  app.post('/api/evaluation/run', (req: Request, res: Response) => {
    const totalRecords = req.body.totalRecords || 10000;
    const run = evaluationBenchmark.runEvaluation(totalRecords);
    res.json(run);
  });

  // 6. Demo Control Center
  app.get('/api/demo/scenarios', (req: Request, res: Response) => {
    res.json(demoManager.listScenarios());
  });

  app.post('/api/demo/run', async (req: Request, res: Response) => {
    try {
      const scenarioId = req.body.scenarioId;
      const result = await demoManager.runScenario(scenarioId);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/demo/reset', (req: Request, res: Response) => {
    if (process.env.NODE_ENV === 'production' && !razorpayService.isTestMode()) {
      return res.status(403).json({ error: 'Demo reset endpoint is disabled in production mode' });
    }
    db.resetToCleanDemoState();
    res.json({
      status: 'ok',
      mode: 'demo',
      message: 'Demo state reset successfully',
      reset: {
        recoveryCases: true,
        webhookEvents: true,
        auditState: true,
      },
    });
  });

  app.post('/api/demo/simulate-webhook', async (req: Request, res: Response) => {
    try {
      if (process.env.NODE_ENV === 'production' && !razorpayService.isTestMode()) {
        return res.status(403).json({ error: 'Demo webhook simulation disabled in production' });
      }
      const { caseId, eventId, amount } = req.body;
      const targetCase = caseId
        ? db.getRecoveryCase(caseId)
        : db.listRecoveryCases().find((c) => c.status === RecoveryCaseStatus.AWAITING_PAYMENT);

      if (!targetCase) {
        return res.status(404).json({ error: 'No eligible case found in AWAITING_PAYMENT state' });
      }

      const plinkId = targetCase.paymentLinkId || `plink_demo_${Date.now()}`;
      const plinkRefId = targetCase.paymentLinkReferenceId || `ref_demo_${Date.now()}`;
      const verifiedAmount = typeof amount === 'number' && amount > 0 ? amount : targetCase.recoverableAmount || targetCase.amountAtRisk;
      const amountPaise = verifiedAmount * 100;
      const evtId = eventId || `evt_demo_wh_${Date.now()}`;
      const paymentId = `pay_demo_${Math.random().toString(36).substring(2, 10)}`;

      const webhookPayload = {
        entity: 'event',
        account_id: 'acc_demo_test',
        event: 'payment_link.paid',
        contains: ['payment_link'],
        payload: {
          payment_link: {
            entity: {
              id: plinkId,
              reference_id: plinkRefId,
              amount: amountPaise,
              amount_paid: amountPaise,
              status: 'paid',
            },
          },
          payment: {
            entity: {
              id: paymentId,
              amount: amountPaise,
              status: 'captured',
              method: 'upi',
            },
          },
        },
      };

      const rawBody = JSON.stringify(webhookPayload);
      const signature = razorpayService.generateWebhookSignature(rawBody);

      const result = razorpayWebhookHandler.processWebhook({
        rawBody,
        signature,
        eventId: evtId,
        parsedBody: webhookPayload,
      });

      res.json({
        success: result.success,
        duplicate: result.duplicate,
        reconciledCaseId: result.reconciledCaseId,
        recoveredAmount: result.recoveredAmount,
        case: db.getRecoveryCase(targetCase.id),
        result,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 7. Policy & Merchant Settings
  app.get('/api/settings', (req: Request, res: Response) => {
    const merchant = db.getMerchant();
    const policy = policyEngine.getConfig();
    res.json({ merchant, policy });
  });

  app.put('/api/settings', (req: Request, res: Response) => {
    const { policy, merchantSettings } = req.body;
    if (policy) {
      policyEngine.updateConfig(policy);
    }
    if (merchantSettings) {
      db.updateMerchantSettings('merch_default', merchantSettings);
    }
    res.json({
      success: true,
      policy: policyEngine.getConfig(),
      merchant: db.getMerchant(),
    });
  });

  // 8. Transactions Ledger Explorer
  app.get('/api/transactions', (req: Request, res: Response) => {
    const payments = db.listPayments(100);
    const orders = db.listOrders(100);

    const enriched = payments.map((p) => {
      const customer = db.getCustomer(p.customerId);
      const order = db.getOrder(p.orderId);
      return {
        id: p.id,
        razorpayPaymentId: p.razorpayPaymentId,
        amount: p.amount,
        currency: p.currency,
        method: p.method,
        status: p.status,
        failureReason: p.failureReason,
        customerName: customer?.name || 'Customer',
        customerEmail: customer ? `${customer.email[0]}***@${customer.email.split('@')[1]}` : 'N/A', // PII Masked
        customerPhone: customer ? `${customer.phone.substring(0, 5)}*****` : 'N/A',
        orderId: order?.razorpayOrderId || p.orderId,
        createdAt: p.createdAt,
      };
    });

    res.json({ payments: enriched, totalOrders: orders.length });
  });

  // 9. Razorpay Webhook Ingestion (Strict HMAC-SHA256, Deduplication, Reconciliation)
  app.post('/api/webhooks/razorpay', async (req: any, res: Response) => {
    try {
      const signature = req.headers['x-razorpay-signature'] as string;
      const eventId = (req.headers['x-razorpay-event-id'] as string) || req.body?.id || `wh_evt_${Date.now()}`;
      const rawBody = req.rawBody || JSON.stringify(req.body);

      const result = razorpayWebhookHandler.processWebhook({
        rawBody,
        signature,
        eventId,
        parsedBody: req.body,
      });

      return res.status(result.statusCode).json(result);
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Internal webhook processing error' });
    }
  });

  // Explicit 404 handler for unknown API routes to prevent fallback to HTML
  app.all('/api/*', (req: Request, res: Response) => {
    res.status(404).json({ error: `API endpoint ${req.method} ${req.path} not found` });
  });

  // --- VITE MIDDLEWARE SETUP ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`RecoverAI Full-Stack Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
