import React, { useState, useEffect } from 'react';
import {
  History,
  Search,
  Filter,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  FileCode,
  UserCheck,
  Zap,
  RefreshCw,
  Download,
  Copy,
  Check,
} from 'lucide-react';
import { AuditEvent } from '../types/index.ts';
import { fetchJson } from '../lib/api.ts';

export const AuditTrailView: React.FC = () => {
  const [logs, setLogs] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<AuditEvent | null>(null);
  const [copied, setCopied] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [actorFilter, setActorFilter] = useState('ALL');
  const [eventTypeFilter, setEventTypeFilter] = useState('ALL');

  const fetchAuditLogs = async () => {
    try {
      setLoading(true);
      const data = await fetchJson<AuditEvent[]>('/api/audit?limit=100');
      setLogs(data);
    } catch (err) {
      console.error('Audit logs fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditLogs();
  }, []);

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      log.correlationId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.caseId && log.caseId.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (log.decision && log.decision.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (log.reason && log.reason.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesActor = actorFilter === 'ALL' || log.actor === actorFilter;
    const matchesType = eventTypeFilter === 'ALL' || log.eventType === eventTypeFilter;

    return matchesSearch && matchesActor && matchesType;
  });

  const getActorBadge = (actor: string) => {
    switch (actor) {
      case 'AI_AGENT':
        return <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">AI_AGENT</span>;
      case 'POLICY_ENGINE':
        return <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">POLICY_ENGINE</span>;
      case 'HUMAN_OPERATOR':
        return <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">HUMAN_OPERATOR</span>;
      case 'RAZORPAY_WEBHOOK':
        return <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">RAZORPAY_WEBHOOK</span>;
      default:
        return <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-slate-800 text-slate-300">SYSTEM</span>;
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      {/* Search & Filter Header */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by Correlation ID, Case ID, Reason..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-all font-mono"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Actor Filter */}
          <select
            value={actorFilter}
            onChange={(e) => setActorFilter(e.target.value)}
            className="px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-slate-300 focus:outline-none focus:border-emerald-500 cursor-pointer"
          >
            <option value="ALL">All Actors</option>
            <option value="AI_AGENT">AI Agent</option>
            <option value="POLICY_ENGINE">Policy Engine</option>
            <option value="HUMAN_OPERATOR">Human Operator</option>
            <option value="RAZORPAY_WEBHOOK">Razorpay Webhook</option>
            <option value="SYSTEM_DETECTOR">System Detector</option>
          </select>

          {/* Event Type Filter */}
          <select
            value={eventTypeFilter}
            onChange={(e) => setEventTypeFilter(e.target.value)}
            className="px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-slate-300 focus:outline-none focus:border-emerald-500 cursor-pointer"
          >
            <option value="ALL">All Event Types</option>
            <option value="RISK_DETECTED">Risk Detected</option>
            <option value="AI_DIAGNOSIS_CREATED">AI Diagnosis</option>
            <option value="POLICY_CHECKED">Policy Checked</option>
            <option value="ACTION_APPROVED">Action Approved</option>
            <option value="ACTION_EXECUTED">Action Executed</option>
            <option value="PAYMENT_RECOVERED">Payment Recovered</option>
            <option value="RECOVERY_STOPPED">Recovery Stopped</option>
            <option value="WEBHOOK_RECEIVED">Webhook Received</option>
          </select>

          <button
            onClick={fetchAuditLogs}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Audit Feed & Detail Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Audit Event List */}
        <div className="lg:col-span-2 rounded-2xl bg-slate-900/80 border border-slate-800 overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <History className="w-4 h-4 text-emerald-400" />
              Audit Stream ({filteredLogs.length} Events)
            </h3>
            <span className="text-[11px] font-mono text-slate-500">Audit Trail Ledger</span>
          </div>

          <div className="divide-y divide-slate-800/60 max-h-[620px] overflow-y-auto">
            {filteredLogs.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">
                No audit events match your search criteria.
              </div>
            ) : (
              filteredLogs.map((log) => (
                <div
                  key={log.id}
                  onClick={() => setSelectedLog(log)}
                  className={`p-4 hover:bg-slate-800/40 transition-colors cursor-pointer text-xs space-y-1.5 ${
                    selectedLog?.id === log.id ? 'bg-slate-800/60 border-l-2 border-emerald-500' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-white">{log.eventType}</span>
                      {getActorBadge(log.actor)}
                    </div>
                    <span className="font-mono text-[11px] text-slate-400">
                      {new Date(log.createdAt).toLocaleTimeString()}
                    </span>
                  </div>

                  <p className="text-slate-300 font-medium">{log.decision || log.reason}</p>

                  <div className="flex items-center gap-4 text-[10px] text-slate-500 font-mono">
                    <span>Corr: {log.correlationId}</span>
                    {log.caseId && <span>Case: {log.caseId}</span>}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Selected Event JSON Inspector */}
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col h-[660px]">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <FileCode className="w-4 h-4 text-cyan-400" />
              Event Payload Inspector
            </h3>
            {selectedLog && (
              <button
                onClick={() => copyToClipboard(JSON.stringify(selectedLog, null, 2))}
                className="px-2 py-1 text-[10px] font-mono rounded bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center gap-1 cursor-pointer transition-all"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                {copied ? 'Copied' : 'Copy JSON'}
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto mt-3 p-3 rounded-xl bg-slate-950 border border-slate-800/80 font-mono text-[11px] text-emerald-400/90 leading-relaxed">
            {selectedLog ? (
              <pre className="whitespace-pre-wrap">{JSON.stringify(selectedLog, null, 2)}</pre>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-500 text-center text-xs">
                Select an audit event from the stream to inspect verification records, actor inputs, and policy evaluations.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
