import React, { useState, useEffect } from 'react';
import {
  X,
  Play,
  Zap,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Terminal,
  ArrowRight,
  ExternalLink,
  Send,
} from 'lucide-react';
import { DemoScenario, RecoveryCase, RecoveryCaseStatus } from '../types/index.ts';
import { fetchJson } from '../lib/api.ts';

interface DemoCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenCase: (caseId: string) => void;
  onScenarioCompleted: () => void;
}

export const DemoCenterModal: React.FC<DemoCenterModalProps> = ({
  isOpen,
  onClose,
  onOpenCase,
  onScenarioCompleted,
}) => {
  const [scenarios, setScenarios] = useState<DemoScenario[]>([]);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const [activeLogs, setActiveLogs] = useState<string[]>([]);
  const [resultSummary, setResultSummary] = useState<string | null>(null);
  const [lastExecutedCase, setLastExecutedCase] = useState<RecoveryCase | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchJson<DemoScenario[]>('/api/demo/scenarios')
        .then((data) => setScenarios(data))
        .catch((err) => console.error('Demo scenarios fetch error:', err));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleRunScenario = async (scenarioId: string) => {
    try {
      setRunningId(scenarioId);
      setActiveLogs([`[Demo Engine] Initializing scenario execution: ${scenarioId}...`]);
      setResultSummary(null);
      setLastExecutedCase(null);

      const data = await fetchJson<any>('/api/demo/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenarioId }),
      });

      setActiveLogs(data.logs || []);
      setResultSummary(data.resultSummary || 'Scenario completed.');
      setLastExecutedCase(data.caseObj || null);
      onScenarioCompleted();
    } catch (err: any) {
      setActiveLogs((prev) => [...prev, `[Error] ${err.message}`]);
    } finally {
      setRunningId(null);
    }
  };

  const handleResetDemoState = async () => {
    try {
      setIsResetting(true);
      setActiveLogs(['[Demo Engine] Resetting state to pristine baseline...']);
      const res = await fetchJson<any>('/api/demo/reset', { method: 'POST' });
      setActiveLogs([
        `[Demo Engine] State reset complete!`,
        `  - Mode: ${res.mode}`,
        `  - Status: ${res.status}`,
        `  - Message: ${res.message}`,
        `  - Cleared active locks & processed webhook IDs`,
      ]);
      setResultSummary('Database and state restored to clean demo state.');
      setLastExecutedCase(null);
      onScenarioCompleted();
    } catch (err: any) {
      setActiveLogs((prev) => [...prev, `[Error Resetting] ${err.message}`]);
    } finally {
      setIsResetting(false);
    }
  };

  const handleSimulateWebhookForLastCase = async () => {
    if (!lastExecutedCase) return;
    try {
      setRunningId('sim_wh');
      setActiveLogs((prev) => [...prev, `[Webhook Engine] Dispatching authentic HMAC payment_link.paid webhook for ${lastExecutedCase.id}...`]);
      const res = await fetchJson<any>('/api/demo/simulate-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseId: lastExecutedCase.id }),
      });

      setActiveLogs((prev) => [
        ...prev,
        `[Webhook Engine] HMAC Signature Verified: PASSED`,
        `[Webhook Engine] Event ID Deduplication: PASSED`,
        `[Webhook Engine] Case ${res.reconciledCaseId} reconciled to RECOVERED!`,
        `[Webhook Engine] Verified Revenue Recorded: ₹${res.recoveredAmount}`,
      ]);
      setResultSummary(`Payment link paid & verified! Recovered revenue ₹${res.recoveredAmount} recorded with RAZORPAY_WEBHOOK provenance.`);
      setLastExecutedCase(res.case);
      onScenarioCompleted();
    } catch (err: any) {
      setActiveLogs((prev) => [...prev, `[Error Webhook] ${err.message}`]);
    } finally {
      setRunningId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-4xl bg-[#0f172a] border border-slate-800 rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Play className="w-5 h-5 fill-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">
                  RecoverAI 1-Click Interactive Demo Control Center
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Judge Mode
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Trigger reproducible end-to-end recovery, policy safety blocks, and human approval scenarios.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleResetDemoState}
              disabled={isResetting || runningId !== null}
              title="Reset state to initial pristine demo dataset"
              className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-40"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${isResetting ? 'animate-spin' : ''}`} />
              Reset Demo
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Scenario Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {scenarios.map((sc) => (
              <div
                key={sc.id}
                className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800/80 hover:border-slate-700 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold font-mono text-amber-400">
                      ₹{sc.amount.toLocaleString('en-IN')}
                    </span>
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-slate-800 text-slate-300">
                      {sc.category}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-white mb-1">{sc.title}</h3>
                  <p className="text-xs text-slate-400 leading-relaxed mb-2">
                    {sc.description}
                  </p>
                  {sc.expectedOutcome && (
                    <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800 text-[11px] text-emerald-400 font-mono mb-3">
                      <strong>Expected:</strong> {sc.expectedOutcome}
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                  <span className="text-[10px] text-slate-500 font-mono line-clamp-1">
                    {sc.targetCaseId || 'Dynamic Test'}
                  </span>
                  <button
                    onClick={() => handleRunScenario(sc.id)}
                    disabled={runningId !== null}
                    className="px-3.5 py-1.5 text-xs font-bold rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 flex items-center gap-1.5 shadow-md shadow-emerald-500/20 transition-all cursor-pointer disabled:opacity-40"
                  >
                    <Play className={`w-3.5 h-3.5 fill-slate-950 ${runningId === sc.id ? 'animate-spin' : ''}`} />
                    {runningId === sc.id ? 'Executing...' : 'Run Scenario'}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Terminal Logs & Results Console */}
          {(activeLogs.length > 0 || resultSummary) && (
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3 font-mono">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-xs font-bold text-slate-400 flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-emerald-400" />
                  Live Execution Telemetry
                </span>
                <div className="flex items-center gap-3">
                  {lastExecutedCase?.status === RecoveryCaseStatus.AWAITING_PAYMENT && (
                    <button
                      onClick={handleSimulateWebhookForLastCase}
                      disabled={runningId !== null}
                      className="text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20 cursor-pointer"
                    >
                      <Send className="w-3 h-3 text-amber-400" />
                      Simulate Webhook Payment
                    </button>
                  )}
                  {lastExecutedCase && (
                    <button
                      onClick={() => {
                        onClose();
                        onOpenCase(lastExecutedCase.id);
                      }}
                      className="text-xs text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      Open Case File ({lastExecutedCase.id}) <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <div className="text-xs space-y-1 text-slate-300 max-h-48 overflow-y-auto">
                {activeLogs.map((log, idx) => (
                  <div key={idx} className="leading-relaxed">
                    <span className="text-slate-500 mr-2">&gt;</span>
                    {log}
                  </div>
                ))}
              </div>

              {resultSummary && (
                <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/30 text-xs font-sans text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span>{resultSummary}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
