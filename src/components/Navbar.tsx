import React from 'react';
import {
  ShieldCheck,
  Zap,
  RotateCcw,
  Sparkles,
  AlertTriangle,
  Play,
  Settings,
  ListOrdered,
  Activity,
  BarChart3,
  History,
  FileSpreadsheet,
} from 'lucide-react';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenDemo: () => void;
  onResetDemo: () => void;
  isResetting: boolean;
  approvalCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  onOpenDemo,
  onResetDemo,
  isResetting,
  approvalCount,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-[#0f172a]/95 backdrop-blur border-b border-slate-800 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Tagline */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 via-teal-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-emerald-500/20 border border-emerald-400/30">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
                  RecoverAI
                </span>
                <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  TEST MODE
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium tracking-wide">
                Detect. Decide. Recover. • Track 03: AI Revenue Recovery
              </p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-900/60 p-1 rounded-xl border border-slate-800/80">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                activeTab === 'dashboard'
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              Dashboard
            </button>

            <button
              onClick={() => setActiveTab('queue')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all relative ${
                activeTab === 'queue'
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <ListOrdered className="w-3.5 h-3.5" />
              Recovery Queue
              {approvalCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-amber-500 text-slate-950 text-[10px] font-bold flex items-center justify-center">
                  {approvalCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('evaluation')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                activeTab === 'evaluation'
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              Evaluation (10K)
            </button>

            <button
              onClick={() => setActiveTab('audit')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                activeTab === 'audit'
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              Audit Ledger
            </button>

            <button
              onClick={() => setActiveTab('transactions')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                activeTab === 'transactions'
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Transactions
            </button>

            <button
              onClick={() => setActiveTab('policy')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                activeTab === 'policy'
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
              Policy Studio
            </button>
          </nav>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5">
            {/* Demo Scenario Launcher */}
            <button
              onClick={onOpenDemo}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 flex items-center gap-1.5 shadow-md shadow-amber-500/20 transition-all cursor-pointer font-sans"
            >
              <Play className="w-3.5 h-3.5 fill-slate-950" />
              Demo Scenarios
            </button>

            {/* Reset State Button */}
            <button
              onClick={onResetDemo}
              disabled={isResetting}
              title="Reset state to initial pristine demo dataset"
              className="p-2 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-all disabled:opacity-50 cursor-pointer"
            >
              <RotateCcw className={`w-4 h-4 ${isResetting ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
