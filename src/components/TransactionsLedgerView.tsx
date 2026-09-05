import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { fetchJson } from '../lib/api.ts';

export const TransactionsLedgerView: React.FC = () => {
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const data = await fetchJson<{ payments: any[] }>('/api/transactions');
      setPayments(data.payments || []);
    } catch (err) {
      console.error('Transactions fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, []);

  const filtered = payments.filter((p) => {
    return (
      p.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.razorpayPaymentId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.method.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by Payment ID, Customer, Method..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-all font-mono"
          />
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400 font-mono">
            {filtered.length} Transactions (PII Masked)
          </span>
          <button
            onClick={fetchTransactions}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="rounded-2xl bg-slate-900/80 border border-slate-800 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/60 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="py-3.5 px-4">Payment ID & Order</th>
                <th className="py-3.5 px-4">Customer</th>
                <th className="py-3.5 px-4">Method</th>
                <th className="py-3.5 px-4">Amount</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs font-mono">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 font-sans">
                    No transactions found.
                  </td>
                </tr>
              ) : (
                filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4">
                      <span className="font-bold text-slate-200">{p.razorpayPaymentId}</span>
                      <span className="text-[10px] text-slate-500 block font-sans">{p.orderId}</span>
                    </td>
                    <td className="py-3 px-4 font-sans">
                      <span className="font-semibold text-slate-200">{p.customerName}</span>
                      <span className="text-[10px] text-slate-500 block font-mono">{p.customerEmail}</span>
                    </td>
                    <td className="py-3 px-4 uppercase font-bold text-slate-300">{p.method}</td>
                    <td className="py-3 px-4 font-bold text-white">₹{p.amount.toLocaleString('en-IN')}</td>
                    <td className="py-3 px-4 font-sans">
                      {p.status === 'captured' ? (
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 inline-flex items-center gap-1">
                          <CheckCircle2 className="w-2.5 h-2.5" /> CAPTURED
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 inline-flex items-center gap-1">
                          <XCircle className="w-2.5 h-2.5" /> FAILED
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-400 text-[11px]">
                      {new Date(p.createdAt).toLocaleTimeString()}
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
