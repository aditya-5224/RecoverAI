import React, { useState } from 'react';
import {
  Search,
  Filter,
  ArrowUpDown,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldCheck,
  Zap,
  Play,
  UserCheck,
  XCircle,
  Sparkles,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import { RecoveryCase, RecoveryCaseStatus, RecoveryActionType } from '../types/index.ts';

interface EnrichedRecoveryCase extends RecoveryCase {
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  customerSegment?: string;
  paymentMethod?: string;
}

interface RecoveryQueueViewProps {
  cases: EnrichedRecoveryCase[];
  loading: boolean;
  onSelectCase: (caseId: string) => void;
  onRefresh: () => void;
}

export const RecoveryQueueView: React.FC<RecoveryQueueViewProps> = ({
  cases,
  loading,
  onSelectCase,
  onRefresh,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');

  const filteredCases = cases.filter((c) => {
    const matchesSearch =
      c.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.customerName && c.customerName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (c.recoveryStrategy && c.recoveryStrategy.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus = statusFilter === 'ALL' || c.status === statusFilter;
    const matchesPriority = priorityFilter === 'ALL' || c.priority === priorityFilter;

    return matchesSearch && matchesStatus && matchesPriority;
  });

  const getStatusBadge = (status: RecoveryCaseStatus) => {
    switch (status) {
      case RecoveryCaseStatus.RECOVERED:
        return (
          <span className="px-2.5 py-0.5 text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> RECOVERED
          </span>
        );
      case RecoveryCaseStatus.NEEDS_APPROVAL:
        return (
          <span className="px-2.5 py-0.5 text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-full flex items-center gap-1 animate-pulse">
            <UserCheck className="w-3 h-3" /> NEEDS APPROVAL
          </span>
        );
      case RecoveryCaseStatus.DIAGNOSED:
        return (
          <span className="px-2.5 py-0.5 text-xs font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded-full flex items-center gap-1">
            <Sparkles className="w-3 h-3" /> DIAGNOSED
          </span>
        );
      case RecoveryCaseStatus.STOPPED:
        return (
          <span className="px-2.5 py-0.5 text-xs font-bold bg-slate-800 text-slate-400 border border-slate-700 rounded-full flex items-center gap-1">
            <XCircle className="w-3 h-3" /> STOPPED
          </span>
        );
      case RecoveryCaseStatus.EXECUTING:
        return (
          <span className="px-2.5 py-0.5 text-xs font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded-full flex items-center gap-1">
            <RefreshCw className="w-3 h-3 animate-spin" /> EXECUTING
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 text-xs font-bold bg-slate-800 text-slate-300 border border-slate-700 rounded-full">
            {status}
          </span>
        );
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'CRITICAL':
        return <span className="px-2 py-0.5 text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded">CRITICAL</span>;
      case 'HIGH':
        return <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded">HIGH</span>;
      case 'MEDIUM':
        return <span className="px-2 py-0.5 text-[10px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded">MEDIUM</span>;
      default:
        return <span className="px-2 py-0.5 text-[10px] font-bold bg-slate-800 text-slate-400 rounded">LOW</span>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Controls Header */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by Case ID, Customer, Strategy..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-all font-mono"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 overflow-x-auto">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-slate-300 focus:outline-none focus:border-emerald-500 cursor-pointer"
          >
            <option value="ALL">All Statuses</option>
            <option value="DIAGNOSED">Diagnosed</option>
            <option value="NEEDS_APPROVAL">Needs Approval</option>
            <option value="RECOVERED">Recovered</option>
            <option value="STOPPED">Stopped</option>
          </select>

          {/* Priority Filter */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-slate-300 focus:outline-none focus:border-emerald-500 cursor-pointer"
          >
            <option value="ALL">All Priorities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>

          <button
            onClick={onRefresh}
            title="Refresh list"
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Cases Table */}
      <div className="rounded-2xl bg-slate-900/80 border border-slate-800 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/60 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="py-3.5 px-4">Case ID & Priority</th>
                <th className="py-3.5 px-4">Customer</th>
                <th className="py-3.5 px-4">Amount at Risk</th>
                <th className="py-3.5 px-4">Recommended Strategy</th>
                <th className="py-3.5 px-4">Policy & Gate</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs">
              {filteredCases.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    No recovery cases match the selected filters.
                  </td>
                </tr>
              ) : (
                filteredCases.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => onSelectCase(c.id)}
                    className="hover:bg-slate-800/40 transition-colors cursor-pointer group"
                  >
                    {/* Case ID & Priority */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-200">{c.id}</span>
                        {getPriorityBadge(c.priority)}
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono mt-0.5 block">
                        Score: {c.priorityScore}/100 • Recovery Attempts: {c.retryCount}/2
                      </span>
                    </td>

                    {/* Customer */}
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-200">{c.customerName || 'Customer'}</div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-1.5 font-mono">
                        <span className="px-1.5 py-0.2 rounded bg-slate-800 text-[10px] text-slate-300">
                          {c.customerSegment || 'RETAIL'}
                        </span>
                        <span>{c.paymentMethod?.toUpperCase() || 'UPI'}</span>
                      </div>
                    </td>

                    {/* Amount */}
                    <td className="py-3.5 px-4 font-mono">
                      <div className="font-bold text-white text-sm">
                        ₹{c.amountAtRisk.toLocaleString('en-IN')}
                      </div>
                      {c.amountRecovered > 0 && (
                        <div className="text-[11px] text-emerald-400 font-semibold">
                          ₹{c.amountRecovered.toLocaleString('en-IN')} recovered
                        </div>
                      )}
                    </td>

                    {/* Recommended Strategy */}
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5 text-amber-400" />
                        {c.recoveryStrategy?.replace(/_/g, ' ') || 'RECOVERY ATTEMPT'}
                      </div>
                      <span className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">
                        {c.diagnosis?.diagnosis || 'Deterministic analysis'}
                      </span>
                    </td>

                    {/* Policy Gate */}
                    <td className="py-3.5 px-4">
                      {c.policyResult?.allowed ? (
                        <span className="px-2 py-0.5 text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-md inline-flex items-center gap-1">
                          <ShieldCheck className="w-3 h-3" /> Policy Passed
                        </span>
                      ) : c.policyResult?.requiredApproval ? (
                        <span className="px-2 py-0.5 text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-md inline-flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> Approval Gate
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 text-[11px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-md inline-flex items-center gap-1">
                          <XCircle className="w-3 h-3" /> Policy Blocked
                        </span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4">{getStatusBadge(c.status)}</td>

                    {/* Action */}
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectCase(c.id);
                        }}
                        className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-emerald-500 hover:text-slate-950 text-slate-300 transition-all cursor-pointer inline-flex items-center gap-1 group-hover:border-emerald-500/40 border border-slate-700"
                      >
                        Investigate <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
