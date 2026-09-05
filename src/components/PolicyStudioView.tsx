import React, { useState, useEffect } from 'react';
import {
  Settings,
  ShieldCheck,
  Save,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sliders,
  DollarSign,
  Clock,
  UserCheck,
} from 'lucide-react';
import { PolicyConfig, DEFAULT_POLICY_CONFIG } from '../server/policy/policyEngine.ts';
import { fetchJson } from '../lib/api.ts';

export const PolicyStudioView: React.FC = () => {
  const [config, setConfig] = useState<PolicyConfig>(DEFAULT_POLICY_CONFIG);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Test Simulator State
  const [simAmount, setSimAmount] = useState(6500);
  const [simRetries, setSimRetries] = useState(1);
  const [simCooldown, setSimCooldown] = useState(35);
  const [simOptOut, setSimOptOut] = useState(false);

  useEffect(() => {
    fetchJson<{ policy?: PolicyConfig }>('/api/settings')
      .then((data) => {
        if (data.policy) {
          setConfig(data.policy);
        }
      })
      .catch((err) => console.error('Settings fetch error:', err))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      await fetchJson('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ policy: config }),
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  // Run real-time simulation against configured policy
  const isRetriesExceeded = simRetries >= config.maxRetriesPerPayment;
  const isAmountExceeded = simAmount > config.maxAutomatedRecoveryAmount;
  const isApprovalNeeded = simAmount > config.requireApprovalAbove;
  const isCooldownViolated = simCooldown < config.minRetryCooldownMinutes;

  const simViolations: string[] = [];
  if (simOptOut) simViolations.push('Customer Opted-Out');
  if (isRetriesExceeded) simViolations.push(`Max Recovery Attempts Exceeded (${simRetries}/${config.maxRetriesPerPayment})`);
  if (isAmountExceeded) simViolations.push(`Exceeds Max Ceiling (₹${simAmount} > ₹${config.maxAutomatedRecoveryAmount})`);
  if (isCooldownViolated) simViolations.push(`Cooldown Active (${simCooldown}m < ${config.minRetryCooldownMinutes}m)`);

  const simPassed = simViolations.length === 0 && !isApprovalNeeded;

  return (
    <div className="space-y-6">
      {/* Studio Header */}
      <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              Deterministic Policy Studio & Guardrails
            </h2>
            <span className="px-2 py-0.5 text-[10px] font-bold font-mono uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full">
              Hard Boundaries
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Configure strict financial, frequency, and approval limits that govern all autonomous AI recovery operations.
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={isSaving}
          className="px-4 py-2 text-xs font-bold rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 flex items-center gap-1.5 shadow-md shadow-emerald-500/20 transition-all cursor-pointer disabled:opacity-50 font-sans"
        >
          <Save className="w-3.5 h-3.5" />
          {isSaving ? 'Saving...' : saveSuccess ? 'Saved!' : 'Save Policy Changes'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Policy Configuration Controls */}
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <Sliders className="w-4 h-4 text-cyan-400" />
            Safety Threshold Parameters
          </h3>

          <div className="space-y-4">
            {/* Require Approval Above */}
            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-200">
                  Human Approval Threshold (₹)
                </label>
                <span className="text-xs font-mono font-bold text-amber-400">
                  ₹{config.requireApprovalAbove.toLocaleString('en-IN')}
                </span>
              </div>
              <input
                type="range"
                min={1000}
                max={25000}
                step={500}
                value={config.requireApprovalAbove}
                onChange={(e) => setConfig({ ...config, requireApprovalAbove: Number(e.target.value) })}
                className="w-full accent-amber-500 cursor-pointer"
              />
              <span className="text-[11px] text-slate-400 block mt-1">
                Transactions above this amount require manual operator sign-off.
              </span>
            </div>

            {/* Max Automated Recovery Amount */}
            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-200">
                  Max Automated Recovery Ceiling (₹)
                </label>
                <span className="text-xs font-mono font-bold text-emerald-400">
                  ₹{config.maxAutomatedRecoveryAmount.toLocaleString('en-IN')}
                </span>
              </div>
              <input
                type="range"
                min={2000}
                max={50000}
                step={1000}
                value={config.maxAutomatedRecoveryAmount}
                onChange={(e) => setConfig({ ...config, maxAutomatedRecoveryAmount: Number(e.target.value) })}
                className="w-full accent-emerald-500 cursor-pointer"
              />
              <span className="text-[11px] text-slate-400 block mt-1">
                Hard ceiling for autonomous execution under all circumstances.
              </span>
            </div>

            {/* Max Automated Recovery Attempts Per Payment */}
            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-200">
                  Max Automated Recovery Attempts
                </label>
                <span className="text-xs font-mono font-bold text-cyan-400">
                  {config.maxRetriesPerPayment} attempts
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={4}
                step={1}
                value={config.maxRetriesPerPayment}
                onChange={(e) => setConfig({ ...config, maxRetriesPerPayment: Number(e.target.value) })}
                className="w-full accent-cyan-500 cursor-pointer"
              />
              <span className="text-[11px] text-slate-400 block mt-1">
                Prevents gateway rate-limiting and customer friction.
              </span>
            </div>

            {/* Cooldown Minutes */}
            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-200">
                  Minimum Retry Cooldown (Minutes)
                </label>
                <span className="text-xs font-mono font-bold text-indigo-400">
                  {config.minRetryCooldownMinutes} mins
                </span>
              </div>
              <input
                type="range"
                min={10}
                max={120}
                step={5}
                value={config.minRetryCooldownMinutes}
                onChange={(e) => setConfig({ ...config, minRetryCooldownMinutes: Number(e.target.value) })}
                className="w-full accent-indigo-500 cursor-pointer"
              />
              <span className="text-[11px] text-slate-400 block mt-1">
                Minimum interval required between subsequent payment attempts.
              </span>
            </div>
          </div>
        </div>

        {/* Live Policy Test Simulator */}
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4 flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2 mb-3">
              <Clock className="w-4 h-4 text-emerald-400" />
              Live Interactive Policy Gate Simulator
            </h3>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Simulated Transaction Amount (₹)</label>
                <input
                  type="number"
                  value={simAmount}
                  onChange={(e) => setSimAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Recovery Attempts Used</label>
                  <input
                    type="number"
                    value={simRetries}
                    onChange={(e) => setSimRetries(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Minutes Since Last Attempt</label>
                  <input
                    type="number"
                    value={simCooldown}
                    onChange={(e) => setSimCooldown(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white font-mono"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="optout"
                  checked={simOptOut}
                  onChange={(e) => setSimOptOut(e.target.checked)}
                  className="rounded bg-slate-950 border-slate-800 text-emerald-500 cursor-pointer"
                />
                <label htmlFor="optout" className="text-xs text-slate-300 cursor-pointer">
                  Simulate customer marked as Opted-Out
                </label>
              </div>
            </div>
          </div>

          {/* Simulator Outcome Card */}
          <div
            className={`p-4 rounded-2xl border text-xs space-y-2 ${
              simPassed
                ? 'bg-emerald-950/20 border-emerald-500/30'
                : isApprovalNeeded && simViolations.length === 0
                ? 'bg-amber-950/20 border-amber-500/30'
                : 'bg-rose-950/20 border-rose-500/30'
            }`}
          >
            <div className="flex items-center justify-between font-bold">
              <span className="flex items-center gap-1.5">
                {simPassed ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : isApprovalNeeded && simViolations.length === 0 ? (
                  <UserCheck className="w-4 h-4 text-amber-400" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                )}
                Decision:{' '}
                {simPassed
                  ? 'ALLOWED (AUTO-EXECUTE)'
                  : isApprovalNeeded && simViolations.length === 0
                  ? 'APPROVAL REQUIRED'
                  : 'HARD BLOCKED'}
              </span>
            </div>

            {simViolations.length > 0 && (
              <div className="text-rose-300 font-mono text-[11px] space-y-0.5">
                {simViolations.map((v, i) => (
                  <div key={i}>• {v}</div>
                ))}
              </div>
            )}

            {isApprovalNeeded && simViolations.length === 0 && (
              <p className="text-amber-300 text-xs">
                Transaction value (₹{simAmount.toLocaleString('en-IN')}) exceeds the ₹
                {config.requireApprovalAbove.toLocaleString('en-IN')} approval threshold. Operator review mandated.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
