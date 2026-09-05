import React, { useState, useEffect } from 'react';
import {
  X,
  ShieldCheck,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Clock,
  UserCheck,
  XCircle,
  Sparkles,
  Play,
  RotateCcw,
  Activity,
  History,
  FileText,
  Lock,
  ArrowRight,
  CreditCard,
  Send,
  ExternalLink,
  Copy,
} from 'lucide-react';
import {
  RecoveryCase,
  RecoveryCaseStatus,
  RecoveryActionType,
  AuditEvent,
  Customer,
} from '../types/index.ts';
import { fetchJson } from '../lib/api.ts';
import { RecoveryTimeline } from './RecoveryTimeline.tsx';

interface CaseDetailsModalProps {
  caseId: string | null;
  onClose: () => void;
  onCaseUpdated: () => void;
}

export const CaseDetailsModal: React.FC<CaseDetailsModalProps> = ({
  caseId,
  onClose,
  onCaseUpdated,
}) => {
  const [data, setData] = useState<{
    case: RecoveryCase;
    customer?: Customer;
    order?: any;
    payment?: any;
    riskEvent?: any;
    actions?: any[];
    auditLogs?: AuditEvent[];
    policyConfig?: any;
  } | null>(null);

  const [loading, setLoading] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const fetchCaseDetails = async () => {
    if (!caseId) return;
    try {
      setLoading(true);
      const json = await fetchJson<any>(`/api/recovery-cases/${caseId}`);
      setData(json);
    } catch (err: any) {
      console.error('Case details fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCaseDetails();
  }, [caseId]);

  if (!caseId) return null;

  const handleAnalyzeAI = async () => {
    try {
      setIsAnalyzing(true);
      setActionMessage(null);
      await fetchJson(`/api/recovery-cases/${caseId}/analyze`, { method: 'POST' });
      await fetchCaseDetails();
      onCaseUpdated();
      setActionMessage({ text: 'AI Diagnosis formulated and evaluated by Policy Engine.', type: 'success' });
    } catch (err: any) {
      setActionMessage({ text: err.message || 'Analysis failed', type: 'error' });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleApprove = async () => {
    try {
      setIsExecuting(true);
      setActionMessage(null);
      await fetchJson(`/api/recovery-cases/${caseId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operatorName: 'Merchant Operator' }),
      });
      await fetchCaseDetails();
      onCaseUpdated();
      setActionMessage({ text: 'Action successfully approved by Operator.', type: 'success' });
    } catch (err: any) {
      setActionMessage({ text: err.message, type: 'error' });
    } finally {
      setIsExecuting(false);
    }
  };

  const handleReject = async () => {
    try {
      setIsExecuting(true);
      setActionMessage(null);
      await fetchJson(`/api/recovery-cases/${caseId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operatorName: 'Merchant Operator', reason: 'Declined by operator review' }),
      });
      await fetchCaseDetails();
      onCaseUpdated();
      setActionMessage({ text: 'Action rejected. Safe stop applied.', type: 'success' });
    } catch (err: any) {
      setActionMessage({ text: err.message, type: 'error' });
    } finally {
      setIsExecuting(false);
    }
  };

  const handleExecute = async (forceApprove: boolean = false) => {
    try {
      setIsExecuting(true);
      setActionMessage(null);
      const json = await fetchJson<any>(`/api/recovery-cases/${caseId}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actor: 'HUMAN', forceApprove }),
      });
      await fetchCaseDetails();
      onCaseUpdated();
      setActionMessage({
        text: json.message || 'Execution completed in Razorpay Test Mode.',
        type: json.recovered ? 'success' : 'error',
      });
    } catch (err: any) {
      setActionMessage({ text: err.message, type: 'error' });
    } finally {
      setIsExecuting(false);
    }
  };

  const handleStop = async () => {
    try {
      setIsExecuting(true);
      setActionMessage(null);
      await fetchJson(`/api/recovery-cases/${caseId}/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Manual safe stop triggered in case drawer' }),
      });
      await fetchCaseDetails();
      onCaseUpdated();
      setActionMessage({ text: 'Safe stop enforced.', type: 'success' });
    } catch (err: any) {
      setActionMessage({ text: err.message, type: 'error' });
    } finally {
      setIsExecuting(false);
    }
  };

  const handleSimulateWebhook = async () => {
    try {
      setIsExecuting(true);
      setActionMessage(null);
      const res = await fetchJson<any>('/api/demo/simulate-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseId }),
      });
      await fetchCaseDetails();
      onCaseUpdated();
      setActionMessage({
        text: `Razorpay payment_link.paid webhook ingested & HMAC verified! Verified revenue recorded: ₹${res.recoveredAmount}.`,
        type: 'success',
      });
    } catch (err: any) {
      setActionMessage({ text: err.message || 'Webhook simulation failed', type: 'error' });
    } finally {
      setIsExecuting(false);
    }
  };

  const c = data?.case;
  const cust = data?.customer;
  const pay = data?.payment;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex justify-end">
      <div className="w-full max-w-3xl bg-[#0f172a] border-l border-slate-800 h-full flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-lg font-bold font-mono text-white">{caseId}</h2>
              <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                {c?.status || 'LOADING'}
              </span>
              <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                {c?.priority} PRIORITY
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 font-mono">
              Customer: {cust?.name || 'Customer'} • Amount: ₹{c?.amountAtRisk.toLocaleString('en-IN')} • Idempotency: {c?.idempotencyKey}
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Scroll Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {actionMessage && (
            <div
              className={`p-3.5 rounded-xl text-xs font-medium border flex items-center gap-2 ${
                actionMessage.type === 'success'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
              }`}
            >
              {actionMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
              {actionMessage.text}
            </div>
          )}

          {loading || !c ? (
            <div className="py-16 text-center text-slate-400">Loading case file...</div>
          ) : (
            <>
              {/* Recovery Lifecycle Pipeline Stage Visualizer */}
              <RecoveryTimeline recoveryCase={c} />

              {/* Verified Recovery Proof Panel (if status === RECOVERED) */}
              {c.status === RecoveryCaseStatus.RECOVERED && (
                <div
                  className={`p-5 rounded-2xl border space-y-3 ${
                    c.recoveryProvenance === 'RAZORPAY_WEBHOOK'
                      ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200'
                      : 'bg-slate-900 border-slate-800 text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-2 text-emerald-400">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      {c.recoveryProvenance === 'RAZORPAY_WEBHOOK'
                        ? 'Verified Razorpay Recovery Proof'
                        : 'Synthetic Demo Recovery Baseline'}
                    </span>
                    <span
                      className={`px-2.5 py-0.5 text-[10px] font-bold rounded-full font-mono ${
                        c.recoveryProvenance === 'RAZORPAY_WEBHOOK'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}
                    >
                      PROVENANCE: {c.recoveryProvenance || 'SYNTHETIC_DEMO'}
                    </span>
                  </div>

                  {c.recoveryProvenance === 'RAZORPAY_WEBHOOK' ? (
                    <div className="space-y-2 text-xs font-mono">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                        <div className="p-2.5 rounded-xl bg-slate-950/60 border border-emerald-500/20">
                          <span className="text-[10px] text-slate-400 block">Verified Recovered Amount</span>
                          <span className="text-sm font-bold text-emerald-400">
                            ₹{(c.verifiedAmount || c.amountRecovered || 0).toLocaleString('en-IN')}
                          </span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-slate-950/60 border border-emerald-500/20">
                          <span className="text-[10px] text-slate-400 block">Webhook Event ID</span>
                          <span className="text-xs font-bold text-slate-200 truncate block">
                            {c.verifiedWebhookEventId || 'evt_verified'}
                          </span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-slate-950/60 border border-emerald-500/20">
                          <span className="text-[10px] text-slate-400 block">Matched Payment Link ID</span>
                          <span className="text-xs font-bold text-slate-200 truncate block">
                            {c.verifiedPaymentLinkId || c.paymentLinkId || 'plink_...'}
                          </span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-slate-950/60 border border-emerald-500/20">
                          <span className="text-[10px] text-slate-400 block">Razorpay Payment ID</span>
                          <span className="text-xs font-bold text-slate-200 truncate block">
                            {c.verifiedPaymentId || 'pay_razorpay'}
                          </span>
                        </div>
                      </div>
                      <div className="p-2.5 rounded-xl bg-emerald-900/20 border border-emerald-500/30 text-[11px] font-sans text-emerald-300 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                        <span>
                          HMAC-SHA256 signature verified • Event deduplication passed • Revenue reflected in Verified Recovered Revenue dashboard metric.
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-400 space-y-1 font-sans">
                      <p className="font-semibold text-slate-300">
                        Synthetic Demo Historical Record (CASE-RECOV-5080)
                      </p>
                      <p className="text-[11px]">
                        This item belongs to the pristine initial demo dataset. It is reported separately under <strong className="text-slate-200">Demo Synthetic Revenue</strong> and is strictly excluded from live Razorpay verified recovery totals.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Payment Link Action & Webhook Simulator Card (if AWAITING_PAYMENT) */}
              {c.status === RecoveryCaseStatus.AWAITING_PAYMENT && c.paymentLinkId && (
                <div className="p-5 rounded-2xl bg-amber-950/20 border border-amber-500/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-amber-400 animate-pulse" />
                      Active Payment Link — Awaiting Customer Action
                    </span>
                    <span className="px-2 py-0.5 text-[10px] font-bold font-mono rounded bg-amber-500/20 text-amber-300">
                      Amount: ₹{c.recoverableAmount.toLocaleString('en-IN')}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2 text-xs">
                    <div className="flex items-center justify-between font-mono">
                      <span className="text-slate-400">Razorpay Link ID:</span>
                      <span className="font-bold text-white">{c.paymentLinkId}</span>
                    </div>
                    {c.paymentLinkUrl && (
                      <div className="flex items-center justify-between font-mono">
                        <span className="text-slate-400">Payment URL:</span>
                        <a
                          href={c.paymentLinkUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-cyan-400 underline hover:text-cyan-300 flex items-center gap-1"
                        >
                          {c.paymentLinkUrl.substring(0, 32)}... <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    )}
                  </div>

                  <div className="pt-2 border-t border-amber-500/20 flex items-center justify-between gap-3">
                    <p className="text-[11px] text-amber-200/80 font-sans">
                      Click below to simulate customer completing payment in Razorpay Test Mode and dispatching the authentic HMAC-signed webhook.
                    </p>
                    <button
                      onClick={handleSimulateWebhook}
                      disabled={isExecuting}
                      className="px-4 py-2 text-xs font-bold rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 flex items-center gap-1.5 shadow-md shadow-emerald-500/20 transition-all cursor-pointer whitespace-nowrap disabled:opacity-50"
                    >
                      <Send className={`w-3.5 h-3.5 ${isExecuting ? 'animate-spin' : ''}`} />
                      Simulate Test Payment Webhook
                    </button>
                  </div>
                </div>
              )}

              {/* 1. Problem Formulation Card */}
              <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-rose-400" />
                    Problem Formulation & Failure Context
                  </h3>
                  <span className="text-xs font-mono font-bold text-rose-400">
                    Gross at Risk: ₹{c.amountAtRisk.toLocaleString('en-IN')}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-1">
                  <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
                    <span className="text-[11px] text-slate-500 block">Payment Method</span>
                    <span className="font-semibold text-slate-200 uppercase">{pay?.method || 'UPI'}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
                    <span className="text-[11px] text-slate-500 block">Error Code</span>
                    <span className="font-mono font-bold text-slate-200">{pay?.failureCode || 'GATEWAY_ERROR'}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
                    <span className="text-[11px] text-slate-500 block">Customer Segment</span>
                    <span className="font-semibold text-cyan-400">{cust?.segment || 'RETAIL'}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
                    <span className="text-[11px] text-slate-500 block">Recovery Attempts</span>
                    <span className="font-mono font-bold text-amber-400">{c.retryCount}/2 Allowed</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs text-slate-300">
                  <span className="font-bold text-slate-400 block mb-1">Gateway Error Detail:</span>
                  {pay?.failureReason || 'Order dropped during checkout without payment capture.'}
                </div>

                {c.paymentLinkId && (
                  <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                        <CreditCard className="w-3.5 h-3.5" />
                        Official Razorpay Test Mode Payment Link
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                        {c.paymentLinkAdapter || 'RazorpayTestModeAdapter'}
                      </span>
                    </div>
                    <div className="text-xs space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 font-medium">Link ID:</span>
                        <span className="font-mono text-white font-bold">{c.paymentLinkId}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 font-medium">Short URL:</span>
                        <a
                          href={c.paymentLinkUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-cyan-400 underline hover:text-cyan-300 break-all"
                        >
                          {c.paymentLinkUrl}
                        </a>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 2. AI Diagnostics & Evidence Panel */}
              <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-indigo-950/30 border border-indigo-500/20 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    Gemini AI Diagnostic Reasoning
                  </h3>
                  <button
                    onClick={handleAnalyzeAI}
                    disabled={isAnalyzing}
                    className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-indigo-500 hover:bg-indigo-400 text-slate-950 flex items-center gap-1 transition-all cursor-pointer disabled:opacity-50"
                  >
                    <Sparkles className={`w-3 h-3 ${isAnalyzing ? 'animate-spin' : ''}`} />
                    {isAnalyzing ? 'Analyzing...' : 'Re-Run AI Diagnosis'}
                  </button>
                </div>

                {c.diagnosis ? (
                  <div className="space-y-3">
                    <div className="p-3 rounded-xl bg-slate-950/60 border border-indigo-500/20">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-bold text-white text-sm">{c.diagnosis.diagnosis}</span>
                        <div className="flex items-center gap-2 font-mono text-[11px]">
                          <span className="text-indigo-300">Model Conf: {Math.round(c.diagnosis.modelConfidence * 100)}%</span>
                          <span className="text-emerald-400">Heuristic Conf: {Math.round(c.diagnosis.heuristicConfidence * 100)}%</span>
                        </div>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed">{c.diagnosis.rootCause}</p>
                    </div>

                    {/* Evidence Points */}
                    <div>
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                        Synthesized Evidence Points:
                      </span>
                      <ul className="space-y-1.5">
                        {c.diagnosis.evidence?.map((ev, i) => (
                          <li key={i} className="text-xs text-slate-300 flex items-start gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 flex-shrink-0"></span>
                            <span>{ev}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-xs">
                      <span className="font-bold text-indigo-300 block mb-0.5">Recommended Action:</span>
                      <span className="font-mono font-bold text-emerald-400 uppercase">
                        {c.diagnosis.recommendedAction}
                      </span>
                      <p className="text-slate-300 mt-1">{c.diagnosis.reason}</p>
                    </div>
                  </div>
                ) : (
                  <div className="py-6 text-center text-xs text-slate-400">
                    No diagnosis generated yet. Click "Re-Run AI Diagnosis" to execute the diagnostic state graph.
                  </div>
                )}
              </div>

              {/* 3. Deterministic Policy Safety Gate */}
              <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    Deterministic Policy Engine Gate
                  </h3>
                  <span className="text-[11px] font-mono text-slate-500">
                    v{c.policyResult?.policyVersion || '1.3.0-deterministic'}
                  </span>
                </div>

                <div className="space-y-2">
                  {c.policyResult?.checkedRules.map((rule, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2">
                        {rule.passed ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                        )}
                        <div>
                          <span className="font-mono font-bold text-slate-200">{rule.rule}</span>
                          <span className="text-[11px] text-slate-400 block">{rule.details}</span>
                        </div>
                      </div>
                      <span
                        className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                          rule.passed
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}
                      >
                        {rule.passed ? 'PASSED' : 'FLAGGED'}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300">
                  <span className="font-bold text-slate-400 block mb-0.5">Policy Outcome:</span>
                  <p>{c.policyResult?.reason || 'Evaluation pending.'}</p>
                </div>
              </div>

              {/* 4. Case Audit Trail */}
              <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5 text-cyan-400" />
                  Audit Trail for Case {caseId}
                </h3>

                <div className="space-y-2">
                  {data?.auditLogs && data.auditLogs.length > 0 ? (
                    data.auditLogs.map((log) => (
                      <div
                        key={log.id}
                        className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-emerald-400">{log.eventType}</span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {new Date(log.createdAt).toLocaleTimeString()}
                          </span>
                        </div>
                        <p className="text-slate-300">{log.decision || log.reason}</p>
                        <div className="flex items-center gap-3 text-[10px] text-slate-500 font-mono pt-1">
                          <span>Actor: {log.actor}</span>
                          <span>Corr ID: {log.correlationId}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-xs text-slate-500 py-3 text-center">No audit logs recorded yet.</div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer Actions Gate */}
        {c && (
          <div className="p-5 border-t border-slate-800 bg-slate-900/90 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                onClick={handleStop}
                disabled={isExecuting || c.status === RecoveryCaseStatus.STOPPED || c.status === RecoveryCaseStatus.RECOVERED}
                className="px-3 py-2 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all cursor-pointer disabled:opacity-40"
              >
                Safe Stop
              </button>
            </div>

            <div className="flex items-center gap-2">
              {c.status === RecoveryCaseStatus.NEEDS_APPROVAL ? (
                <>
                  <button
                    onClick={handleReject}
                    disabled={isExecuting}
                    className="px-3.5 py-2 text-xs font-bold rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 border border-rose-500/30 transition-all cursor-pointer"
                  >
                    Reject Proposal
                  </button>
                  <button
                    onClick={handleApprove}
                    disabled={isExecuting}
                    className="px-4 py-2 text-xs font-bold rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center gap-1.5 shadow-md shadow-amber-500/20 transition-all cursor-pointer"
                  >
                    <UserCheck className="w-3.5 h-3.5" /> Approve Action
                  </button>
                </>
              ) : c.status === RecoveryCaseStatus.RECOVERED ? (
                <span className="px-4 py-2 text-xs font-bold rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> Revenue Reconciled & Captured
                </span>
              ) : c.status === RecoveryCaseStatus.AWAITING_PAYMENT ? (
                <button
                  onClick={handleSimulateWebhook}
                  disabled={isExecuting}
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 flex items-center gap-1.5 shadow-md shadow-emerald-500/20 transition-all cursor-pointer disabled:opacity-40"
                >
                  <Send className={`w-3.5 h-3.5 ${isExecuting ? 'animate-spin' : ''}`} />
                  Simulate Webhook Payment
                </button>
              ) : c.status === RecoveryCaseStatus.STOPPED ? (
                <span className="px-4 py-2 text-xs font-bold rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/30 flex items-center gap-1.5">
                  <XCircle className="w-4 h-4 text-rose-400" /> Hard Stop / Policy Blocked
                </span>
              ) : (
                <button
                  onClick={() => handleExecute(false)}
                  disabled={isExecuting}
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 flex items-center gap-1.5 shadow-md shadow-emerald-500/20 transition-all cursor-pointer disabled:opacity-40"
                >
                  <Play className="w-3.5 h-3.5 fill-slate-950" /> Execute in Razorpay Test Mode
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
