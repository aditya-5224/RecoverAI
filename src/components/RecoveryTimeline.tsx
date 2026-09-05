import React from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Zap,
  Lock,
  XCircle,
  CreditCard,
  Send,
  FileCheck2,
} from 'lucide-react';
import { RecoveryCase, RecoveryCaseStatus } from '../types/index.ts';

interface RecoveryTimelineProps {
  recoveryCase: RecoveryCase;
}

interface TimelineStage {
  id: string;
  label: string;
  sublabel: string;
  status: 'completed' | 'current' | 'upcoming' | 'blocked';
  icon: React.ElementType;
}

export const RecoveryTimeline: React.FC<RecoveryTimelineProps> = ({ recoveryCase }) => {
  const currentStatus = recoveryCase.status;
  const isStopped = currentStatus === RecoveryCaseStatus.STOPPED;
  const isRecovered = currentStatus === RecoveryCaseStatus.RECOVERED;
  const isAwaiting = currentStatus === RecoveryCaseStatus.AWAITING_PAYMENT;
  const isNeedsApproval = currentStatus === RecoveryCaseStatus.NEEDS_APPROVAL;
  const isApproved = currentStatus === RecoveryCaseStatus.APPROVED;

  // Build the stages array based on case state
  const stages: TimelineStage[] = [
    {
      id: 'detected',
      label: 'Detection',
      sublabel: 'Risk Event Identified',
      status: 'completed',
      icon: Zap,
    },
    {
      id: 'diagnosed',
      label: 'AI Diagnosis',
      sublabel: recoveryCase.failureClassification || 'Root Cause Formulated',
      status: 'completed',
      icon: FileCheck2,
    },
    {
      id: 'policy',
      label: 'Policy Gate',
      sublabel: isNeedsApproval
        ? 'Approval Required (> ₹5,000)'
        : isStopped
        ? 'Policy Block / Safe Stop'
        : 'Authorized (<= ₹5,000)',
      status: isNeedsApproval
        ? 'current'
        : isStopped
        ? 'blocked'
        : 'completed',
      icon: ShieldCheck,
    },
    {
      id: 'executing',
      label: 'Payment Link',
      sublabel: recoveryCase.paymentLinkId
        ? `Link: ${recoveryCase.paymentLinkId.substring(0, 12)}...`
        : isAwaiting
        ? 'Awaiting Customer Action'
        : 'Dispatched via API',
      status: isAwaiting
        ? 'current'
        : isRecovered
        ? 'completed'
        : isStopped
        ? 'blocked'
        : 'upcoming',
      icon: CreditCard,
    },
    {
      id: 'reconciled',
      label: 'Verified Recovery',
      sublabel: isRecovered
        ? recoveryCase.recoveryProvenance === 'RAZORPAY_WEBHOOK'
          ? `Verified: ₹${(recoveryCase.verifiedAmount || recoveryCase.amountRecovered || 0).toLocaleString('en-IN')}`
          : 'Synthetic Demo Recovery'
        : 'Awaiting Webhook',
      status: isRecovered ? 'completed' : isStopped ? 'blocked' : 'upcoming',
      icon: CheckCircle2,
    },
  ];

  return (
    <div className="w-full bg-slate-900/80 border border-slate-800 rounded-2xl p-4 sm:p-5">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-emerald-400" />
          <h3 className="text-xs font-bold text-slate-200 tracking-wide uppercase">
            Recovery Lifecycle Pipeline
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {isRecovered && (
            <span className="px-2.5 py-1 text-[10px] font-bold uppercase rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              {recoveryCase.recoveryProvenance === 'RAZORPAY_WEBHOOK'
                ? 'Razorpay Webhook Verified'
                : 'Synthetic Demo State'}
            </span>
          )}
          {isAwaiting && (
            <span className="px-2.5 py-1 text-[10px] font-bold uppercase rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center gap-1">
              <Clock className="w-3 h-3 text-amber-400 animate-pulse" />
              Awaiting Payment
            </span>
          )}
          {isNeedsApproval && (
            <span className="px-2.5 py-1 text-[10px] font-bold uppercase rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-cyan-400" />
              Needs Human Approval
            </span>
          )}
          {isStopped && (
            <span className="px-2.5 py-1 text-[10px] font-bold uppercase rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/30 flex items-center gap-1">
              <XCircle className="w-3 h-3 text-rose-400" />
              Safe Stop Enforced
            </span>
          )}
        </div>
      </div>

      {/* Progress Track */}
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 sm:gap-2">
        {stages.map((stage, idx) => {
          const StageIcon = stage.icon;
          return (
            <div
              key={stage.id}
              className={`relative flex flex-col justify-between p-3 rounded-xl border transition-all ${
                stage.status === 'completed'
                  ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
                  : stage.status === 'current'
                  ? 'bg-amber-950/20 border-amber-500/40 text-amber-300 ring-1 ring-amber-500/20'
                  : stage.status === 'blocked'
                  ? 'bg-rose-950/20 border-rose-500/30 text-rose-300'
                  : 'bg-slate-950/40 border-slate-800 text-slate-500'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${
                    stage.status === 'completed'
                      ? 'bg-emerald-500 text-slate-950'
                      : stage.status === 'current'
                      ? 'bg-amber-500 text-slate-950 animate-pulse'
                      : stage.status === 'blocked'
                      ? 'bg-rose-500 text-white'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {stage.status === 'completed' ? (
                    '✓'
                  ) : stage.status === 'blocked' ? (
                    '✕'
                  ) : (
                    <StageIcon className="w-3.5 h-3.5" />
                  )}
                </div>
                <span className="text-[10px] font-mono opacity-60">Step 0{idx + 1}</span>
              </div>

              <div>
                <div className="text-xs font-bold text-slate-200 mb-0.5">{stage.label}</div>
                <div className="text-[10px] leading-tight text-slate-400 line-clamp-2">
                  {stage.sublabel}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
