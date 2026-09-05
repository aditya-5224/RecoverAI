import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar.tsx';
import { DashboardView } from './components/DashboardView.tsx';
import { RecoveryQueueView } from './components/RecoveryQueueView.tsx';
import { CaseDetailsModal } from './components/CaseDetailsModal.tsx';
import { EvaluationView } from './components/EvaluationView.tsx';
import { AuditTrailView } from './components/AuditTrailView.tsx';
import { DemoCenterModal } from './components/DemoCenterModal.tsx';
import { PolicyStudioView } from './components/PolicyStudioView.tsx';
import { TransactionsLedgerView } from './components/TransactionsLedgerView.tsx';
import { DashboardMetrics, RecoveryCase } from './types/index.ts';
import { fetchJson } from './lib/api.ts';

export function App() {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [cases, setCases] = useState<RecoveryCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState(false);

  // Modals
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false);

  const fetchAllData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [dJson, cJson] = await Promise.all([
        fetchJson<DashboardMetrics>('/api/dashboard'),
        fetchJson<RecoveryCase[]>('/api/recovery-cases'),
      ]);

      setMetrics(dJson);
      setCases(cJson);
    } catch (err: any) {
      console.warn('App data refresh notice:', err);
      setError(err?.message || 'Connecting to RecoverAI backend service...');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
    // Auto-refresh metrics every 30 seconds
    const interval = setInterval(fetchAllData, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleResetDemo = async () => {
    try {
      setIsResetting(true);
      await fetchJson('/api/demo/reset', { method: 'POST' });
      await fetchAllData();
    } catch (err) {
      console.error(err);
    } finally {
      setIsResetting(false);
    }
  };

  const handleOpenDemoScenario = (scenarioId: string) => {
    setIsDemoModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex flex-col selection:bg-emerald-500 selection:text-slate-950">
      {/* Top Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenDemo={() => setIsDemoModalOpen(true)}
        onResetDemo={handleResetDemo}
        isResetting={isResetting}
        approvalCount={metrics?.approvalPendingCount || 0}
      />

      {/* Main Viewport Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'dashboard' && (
          <DashboardView
            metrics={metrics}
            loading={loading}
            onNavigateToQueue={() => setActiveTab('queue')}
            onOpenDemoScenario={handleOpenDemoScenario}
          />
        )}

        {activeTab === 'queue' && (
          <RecoveryQueueView
            cases={cases}
            loading={loading}
            onSelectCase={(id) => setSelectedCaseId(id)}
            onRefresh={fetchAllData}
          />
        )}

        {activeTab === 'evaluation' && <EvaluationView />}

        {activeTab === 'audit' && <AuditTrailView />}

        {activeTab === 'transactions' && <TransactionsLedgerView />}

        {activeTab === 'policy' && <PolicyStudioView />}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950/60 py-4 text-center text-xs text-slate-500 font-mono">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>RecoverAI • Track 03: AI Revenue Recovery (Razorpay Test Mode)</span>
          <span className="text-emerald-400/80">Deterministic Safety First: 0 Unbounded LLM Financial Actions</span>
        </div>
      </footer>

      {/* Case Details Drawer / Modal */}
      {selectedCaseId && (
        <CaseDetailsModal
          caseId={selectedCaseId}
          onClose={() => setSelectedCaseId(null)}
          onCaseUpdated={fetchAllData}
        />
      )}

      {/* Demo Control Center Modal */}
      <DemoCenterModal
        isOpen={isDemoModalOpen}
        onClose={() => setIsDemoModalOpen(false)}
        onOpenCase={(caseId) => setSelectedCaseId(caseId)}
        onScenarioCompleted={fetchAllData}
      />
    </div>
  );
}
export default App;
