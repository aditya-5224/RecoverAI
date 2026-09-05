import React from 'react';
import {
  TrendingUp,
  AlertOctagon,
  CheckCircle2,
  Percent,
  AlertTriangle,
  ArrowUpRight,
  ShieldCheck,
  Zap,
  Clock,
  Sparkles,
  ChevronRight,
  Layers,
  ArrowRight,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { DashboardMetrics, PaymentMethod } from '../types/index.ts';

interface DashboardViewProps {
  metrics: DashboardMetrics | null;
  loading: boolean;
  onNavigateToQueue: () => void;
  onOpenDemoScenario: (scenarioId: string) => void;
}

const COLORS = ['#10b981', '#f59e0b', '#3b82f6', '#ec4899', '#8b5cf6'];

export const DashboardView: React.FC<DashboardViewProps> = ({
  metrics,
  loading,
  onNavigateToQueue,
  onOpenDemoScenario,
}) => {
  if (loading || !metrics) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm text-slate-400 font-medium">Loading telemetry & revenue recovery metrics...</p>
        </div>
      </div>
    );
  }

  const upiDegraded = metrics.paymentMethodHealth.find(
    (m) => m.method === PaymentMethod.UPI && m.isDegraded
  );

  return (
    <div className="space-y-6">
      {/* Active Anomaly Banner */}
      {upiDegraded && (
        <div className="p-4 rounded-xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-slate-900 border border-amber-500/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400 mt-0.5">
              <AlertTriangle className="w-5 h-5 animate-bounce" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-amber-400">
                  REAL-TIME ANOMALY DETECTED: UPI Gateway Latency Spike
                </h3>
                <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-500/20 text-amber-300 rounded-md border border-amber-500/40 uppercase">
                  Elevated (18.6%)
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 max-w-3xl">
                UPI failure rate has elevated to 18.6% across NPCI switch nodes (2.4x above 7.2% baseline).
                3 high-confidence retryable cases are currently enqueued within policy cooldown limits.
              </p>
            </div>
          </div>
          <button
            onClick={() => onOpenDemoScenario('scenario_upi_degradation')}
            className="whitespace-nowrap px-3.5 py-2 text-xs font-bold rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center gap-1.5 shadow-md shadow-amber-500/20 transition-all cursor-pointer font-sans"
          >
            <Zap className="w-3.5 h-3.5 fill-slate-950" />
            Investigate & Auto-Recover
          </button>
        </div>
      )}

      {/* Core Financial Metrics KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {/* 1. Verified Recovered Revenue (Razorpay Webhook) */}
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-emerald-500/30 shadow-md relative overflow-hidden group hover:border-emerald-500/50 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">
              Verified Revenue
            </span>
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl font-extrabold text-emerald-400 tracking-tight font-mono">
              ₹{(metrics.verifiedRecoveredRevenue / 100000).toFixed(2)}L
            </div>
            <p className="text-[11px] text-emerald-300/80 mt-0.5 font-mono">
              ₹{metrics.verifiedRecoveredRevenue.toLocaleString('en-IN')}
            </p>
          </div>
          <div className="mt-2.5 pt-2 border-t border-emerald-500/20 flex items-center justify-between text-[10px] text-slate-400">
            <span>Razorpay Webhook</span>
            <span className="font-bold text-emerald-400">{metrics.razorpayCapturedCount ?? 0} settled</span>
          </div>
        </div>

        {/* 2. Demo Synthetic Revenue */}
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Synthetic Demo
            </span>
            <div className="p-1.5 rounded-lg bg-slate-800 text-slate-400 border border-slate-700">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl font-extrabold text-slate-300 tracking-tight font-mono">
              ₹{((metrics.demoSyntheticRecoveredRevenue || 0) / 100000).toFixed(2)}L
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5 font-mono">
              ₹{(metrics.demoSyntheticRecoveredRevenue || 0).toLocaleString('en-IN')}
            </p>
          </div>
          <div className="mt-2.5 pt-2 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-400">
            <span>Pre-seeded Baseline</span>
            <span className="font-bold text-slate-400">{metrics.demoSyntheticRecoveredCount || 1} seed</span>
          </div>
        </div>

        {/* 3. Gross Revenue at Risk */}
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Gross At Risk
            </span>
            <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <AlertOctagon className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl font-extrabold text-white tracking-tight font-mono">
              ₹{(metrics.grossRevenueAtRisk / 100000).toFixed(2)}L
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5 font-mono">
              ₹{metrics.grossRevenueAtRisk.toLocaleString('en-IN')}
            </p>
          </div>
          <div className="mt-2.5 pt-2 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-400">
            <span>Total Leakage</span>
            <span className="font-bold text-white">{metrics.activeCasesCount} cases</span>
          </div>
        </div>

        {/* 4. Eligible Recoverable Revenue */}
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Eligible Recoverable
            </span>
            <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Zap className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl font-extrabold text-white tracking-tight font-mono">
              ₹{(metrics.eligibleRecoverableRevenue / 100000).toFixed(2)}L
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5 font-mono">
              ₹{metrics.eligibleRecoverableRevenue.toLocaleString('en-IN')}
            </p>
          </div>
          <div className="mt-2.5 pt-2 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-400">
            <span>Policy Authorized</span>
            <span className="font-bold text-cyan-400">Active</span>
          </div>
        </div>

        {/* 5. Human Approval Pending */}
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Approval Pending
            </span>
            <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl font-extrabold text-amber-400 tracking-tight font-mono">
              {metrics.approvalPendingCount}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Cases &gt; ₹5,000 threshold
            </p>
          </div>
          <div className="mt-2.5 pt-2 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-400">
            <span>Operator Gate</span>
            <span className="font-bold text-amber-400">Human Sign-off</span>
          </div>
        </div>

        {/* 6. Recovery Rate & Efficacy */}
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Efficacy Rate
            </span>
            <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Percent className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl font-extrabold text-white tracking-tight font-mono">
              {metrics.recoveryRate}%
            </div>
            <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
              <div
                className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(metrics.recoveryRate, 100)}%` }}
              ></div>
            </div>
          </div>
          <div className="mt-2.5 pt-2 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-400">
            <span>Target Benchmark</span>
            <span className="font-bold text-slate-300">&gt; 60.0%</span>
          </div>
        </div>
      </div>

      {/* Synthetic Demo Baseline Banner */}
      {Boolean(metrics.demoSyntheticRecoveredRevenue && metrics.demoSyntheticRecoveredRevenue > 0) && (
        <div className="p-3.5 px-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-bold uppercase tracking-wider border border-slate-700">
              Demo Baseline
            </span>
            <span>
              Synthetic Demo Revenue: <strong className="text-slate-200 font-mono">₹{(metrics.demoSyntheticRecoveredRevenue || 0).toLocaleString('en-IN')}</strong> ({metrics.demoSyntheticRecoveredCount || 1} demo case)
            </span>
          </div>
          <span className="text-[11px] text-slate-500 font-mono">
            Excluded from live Razorpay recovery totals
          </span>
        </div>
      )}

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Hourly Failure & Recovery Trend (Area Chart) */}
        <div className="lg:col-span-2 p-5 rounded-2xl bg-slate-900/80 border border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                Hourly Failure Spike & Verified Recovery Trend (24h)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Real-time tracking of payment timeouts vs. recovered revenue across merchant checkout rails.
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-lg text-xs font-mono bg-slate-800 text-slate-300 border border-slate-700">
              Live Stream
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={metrics.hourlyFailureTrend}>
                <defs>
                  <linearGradient id="colorUpi" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorRecov" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="hour" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: '#f8fafc',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="upiFailures"
                  name="UPI Failures (count)"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorUpi)"
                />
                <Area
                  type="monotone"
                  dataKey="recoveredAmount"
                  name="Recovered Amount (₹)"
                  stroke="#10b981"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorRecov)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Revenue Leakage by Category */}
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-white mb-1">Leakage by Root-Cause Category</h3>
            <p className="text-xs text-slate-400 mb-4">
              Breakdown of captured revenue leak vectors.
            </p>

            <div className="space-y-3">
              {metrics.leakageByCategory.map((item, index) => (
                <div key={item.category} className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/50">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      ></span>
                      {item.category}
                    </span>
                    <span className="font-mono text-slate-300 font-bold">
                      ₹{item.amount.toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>{item.casesCount} cases</span>
                    <span className="font-medium text-emerald-400">{item.percentage}% of total</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={onNavigateToQueue}
            className="w-full mt-4 py-2 text-xs font-bold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
          >
            Inspect Recovery Queue <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Payment Method Health Grid */}
      <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Payment Rail Health & Telemetry Monitor
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Continuous gateway health monitoring across UPI, Credit/Debit cards, and Netbanking.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {metrics.paymentMethodHealth.map((method) => (
            <div
              key={method.method}
              className={`p-4 rounded-xl border transition-all ${
                method.isDegraded
                  ? 'bg-amber-950/20 border-amber-500/40 shadow-sm shadow-amber-500/10'
                  : 'bg-slate-800/40 border-slate-800'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-200">{method.name}</span>
                {method.isDegraded ? (
                  <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-500/20 text-amber-400 rounded-full border border-amber-500/40 flex items-center gap-1">
                    <AlertTriangle className="w-2.5 h-2.5" /> DEGRADED
                  </span>
                ) : (
                  <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-500/10 text-emerald-400 rounded-full border border-emerald-500/20 flex items-center gap-1">
                    <CheckCircle2 className="w-2.5 h-2.5" /> HEALTHY
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-700/40">
                <div>
                  <div className="text-[11px] text-slate-400">Success Rate</div>
                  <div
                    className={`text-base font-bold font-mono ${
                      method.isDegraded ? 'text-amber-400' : 'text-emerald-400'
                    }`}
                  >
                    {method.successRate}%
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-400">24h Failed Vol</div>
                  <div className="text-base font-bold font-mono text-slate-200">
                    ₹{(method.failedAmount24h / 1000).toFixed(1)}k
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* AI Diagnostic Summary Panel */}
      <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/40 border border-indigo-500/20 relative overflow-hidden">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white">
                Gemini AI Agent Diagnostic Briefing
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 font-semibold">
                Autonomous State Graph
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed">
              {metrics.aiInsights.summary}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4 pt-3 border-t border-slate-800">
              <div>
                <span className="text-[11px] text-slate-400 block">Primary Leak Vector</span>
                <span className="text-xs font-semibold text-slate-200">
                  {metrics.aiInsights.largestContributor}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-slate-400 block">Auto-Recovery Eligible</span>
                <span className="text-xs font-semibold text-emerald-400">
                  {metrics.aiInsights.eligibleForAutoRecoveryCount} cases (Policy Passed)
                </span>
              </div>
              <div>
                <span className="text-[11px] text-slate-400 block">Estimated Recoverable Value</span>
                <span className="text-xs font-semibold font-mono text-cyan-400">
                  ₹{metrics.aiInsights.estimatedRecoverableAmount.toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
