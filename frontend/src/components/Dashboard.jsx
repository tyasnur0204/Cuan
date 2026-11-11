import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import api from '../services/api';
import CategoryIcon from './CategoryIcon';

const MONTH_NAMES = [
  '',
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

const formatCurrency = (value) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(value ?? 0);
};

const formatCompact = (value) => {
  const num = Number(value || 0);
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)} jt`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(0)} rb`;
  return `${num}`;
};

const Dashboard = () => {
  const [summary, setSummary] = useState(null);
  const [businessStats, setBusinessStats] = useState({
    income: 0,
    expense: 0,
    profit: 0,
    txCount: 0,
    accountCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  let displayName = 'Pengguna';
  let storedUserId;
  try {
    const storedUser = JSON.parse(localStorage.getItem('user') || 'null');
    if (storedUser?.username) {
      displayName = storedUser.username;
    }
    storedUserId = storedUser?.id;
  } catch {
    // Fallback
  }

  const savedInflation =
    Number(localStorage.getItem('finmate_inflation_rate')) || 3.2;

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const now = new Date();
      const [summaryRes, accountsRes, monthTxRes] = await Promise.all([
        api.get('/dashboard/summary', {
          params: { inflation_rate: savedInflation },
        }),
        api.get('/accounts', {
          params: storedUserId ? { user_id: storedUserId } : {},
        }),
        api.get('/transactions', {
          params: {
            month: now.getMonth() + 1,
            year: now.getFullYear(),
            limit: 500,
          },
        }),
      ]);

      setSummary(summaryRes.data);

      const accounts = accountsRes.data ?? [];
      const monthTxs = monthTxRes.data ?? [];
      const businessAccIds = new Set(
        accounts.filter((a) => a.is_business_account).map((a) => a.id)
      );

      let bizIncome = 0;
      let bizExpense = 0;
      let bizCount = 0;

      for (const tx of monthTxs) {
        const catLower = String(tx.category || '').toLowerCase();
        const isBiz =
          Boolean(tx.is_business) ||
          businessAccIds.has(tx.account_id) ||
          catLower.includes('usaha') ||
          catLower.includes('bisnis') ||
          catLower.includes('proyek');

        if (!isBiz) continue;
        bizCount += 1;
        const amt = Number(tx.amount || 0);
        if (tx.type === 'Income') bizIncome += amt;
        else if (tx.type === 'Expense') bizExpense += amt;
      }

      setBusinessStats({
        income: bizIncome,
        expense: bizExpense,
        profit: bizIncome - bizExpense,
        txCount: bizCount,
        accountCount: businessAccIds.size,
      });
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          err.message ||
          'Gagal mengambil data ringkasan dashboard'
      );
    } finally {
      setLoading(false);
    }
  }, [savedInflation, storedUserId]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 animate-pulse flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-emerald" />
          <span className="text-sm font-medium text-navy">
            Memuat data keuangan...
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[...Array(4)].map((_, idx) => (
            <div
              key={idx}
              className="bg-white rounded-xl shadow-sm p-6 animate-pulse h-28 border border-gray-100"
            />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl shadow-sm p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="font-semibold text-sm">Gagal Memuat Dashboard</p>
          <p className="text-xs mt-1">Error: {error}</p>
        </div>
        <button
          type="button"
          onClick={fetchSummary}
          className="px-4 py-2 bg-red-600 text-white text-xs font-semibold rounded-lg hover:bg-red-700 transition-colors self-start sm:self-auto"
        >
          Coba Lagi
        </button>
      </div>
    );
  }

  const budgetLimit = summary?.total_budget_limit ?? 0;
  const expenses = summary?.current_month_expenses ?? 0;
  const remainingBudget = summary?.remaining_budget ?? 0;
  const budgetUsagePct =
    budgetLimit > 0
      ? Math.min(100, Math.round((expenses / budgetLimit) * 100))
      : 0;
  const remainingPct =
    budgetLimit > 0
      ? Math.max(0, Math.round((remainingBudget / budgetLimit) * 100))
      : 0;

  const netRealGrowth = summary?.net_real_growth_pct ?? 0;
  const inflationRate = summary?.inflation_rate_pct ?? savedInflation;
  const cashflow = summary?.monthly_cashflow ?? [];
  const recentTxs = summary?.recent_transactions ?? [];

  return (
    <div className="space-y-6">
      {/* Greeting & Period */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-navy">
            Halo, {displayName}!
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Semoga hari ini produktif!
          </p>
        </div>
        {summary?.period && (
          <span className="inline-flex items-center px-3.5 py-1.5 rounded-full text-xs font-semibold bg-white text-navy shadow-sm border border-gray-100 self-start sm:self-auto">
            {MONTH_NAMES[summary.period.month]} {summary.period.year}
          </span>
        )}
      </div>

      {/* Baris 1: 4 Card Ringkasan Utama */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-gradient-to-br from-[#067F5B] to-[#056347] text-white rounded-xl shadow-sm p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wider text-white/80">
              Total Aset
            </p>
            <span className="text-[11px] font-semibold bg-white/20 px-2 py-0.5 rounded-full">
              {netRealGrowth >= 0 ? `↑ +${netRealGrowth}%` : `${netRealGrowth}%`}
            </span>
          </div>
          <p className="text-xl xl:text-2xl font-bold mt-2 tracking-tight">
            {formatCurrency(summary?.total_assets)}
          </p>
          <p className="text-xs text-white/75 mt-1">Seluruh akun aktif</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
          <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
            Saldo Kas
          </p>
          <p className="text-xl xl:text-2xl font-bold text-navy mt-2 tracking-tight">
            {formatCurrency(summary?.cash_balance)}
          </p>
          <p className="text-xs text-gray-500 mt-1">Tunai & rekening bank</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
          <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
            Pemasukan Bulan Ini
          </p>
          <p className="text-xl xl:text-2xl font-bold text-emerald mt-2 tracking-tight">
            {formatCurrency(summary?.current_month_income)}
          </p>
          <p className="text-xs text-gray-500 mt-1">Arus kas masuk</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
          <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
            Pengeluaran Bulan Ini
          </p>
          <p className="text-xl xl:text-2xl font-bold text-navy mt-2 tracking-tight">
            {formatCurrency(summary?.current_month_expenses)}
          </p>
          <p className="text-xs text-gray-500 mt-1">Arus kas keluar</p>
        </div>
      </div>

      {/* Baris 2: Pertumbuhan Bersih (Setelah Inflasi) & Sisa Budget Bulan Ini */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-navy">
              Pertumbuhan Bersih (Setelah Inflasi)
            </p>
            <div className="flex items-baseline gap-2.5 mt-3">
              <span
                className={`text-3xl font-bold tracking-tight ${
                  netRealGrowth >= 0 ? 'text-emerald' : 'text-red-600'
                }`}
              >
                {netRealGrowth >= 0 ? `+${netRealGrowth}%` : `${netRealGrowth}%`}
              </span>
              <span className="text-xs font-medium text-gray-500">
                vs Inflasi {inflationRate}%
              </span>
            </div>
            <Link
              to="/portfolio"
              className="inline-block mt-3 text-xs font-semibold text-emerald hover:underline"
            >
              Cek Portofolio →
            </Link>
          </div>

          {/* Mini Sparkline Visual matching FinMate PDF */}
          <div className="shrink-0 flex flex-col items-end gap-2">
            <svg
              viewBox="0 0 96 42"
              className="w-24 h-11 text-emerald"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M4 34 L26 24 L42 28 L66 13 L88 6"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M78 6 H88 V16"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="text-[11px] font-semibold text-emerald bg-emerald/10 px-2.5 py-0.5 rounded-full">
              {netRealGrowth >= 0 ? 'Melampaui Inflasi' : 'Perlu Rebalancing'}
            </span>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-navy">
              Sisa Budget Bulan Ini
            </h2>
            <span className="text-xs font-semibold text-emerald bg-emerald/10 px-2.5 py-1 rounded-full">
              {remainingPct}% tersisa ({budgetUsagePct}% terpakai)
            </span>
          </div>
          <p className="text-2xl font-bold text-navy mb-3">
            {formatCurrency(remainingBudget)}
          </p>
          <div className="w-full bg-bg-light rounded-full h-2.5 overflow-hidden">
            <div
              className={`h-2.5 rounded-full transition-all duration-300 ${
                budgetUsagePct >= 100 ? 'bg-red-500' : 'bg-emerald'
              }`}
              style={{ width: `${budgetUsagePct}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-500 mt-2">
            <span>Terpakai: {formatCurrency(expenses)}</span>
            <span>Total Anggaran: {formatCurrency(budgetLimit)}</span>
          </div>
        </div>
      </div>

      {/* Baris 3: Arus Kas Bulanan + Transaksi Terbaru */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-7 bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-navy">
                Arus Kas Bulanan
              </h2>
              <p className="text-xs text-gray-500">
                Perbandingan pemasukan & pengeluaran 6 bulan terakhir
              </p>
            </div>
            <Link
              to="/reports"
              className="text-xs font-semibold text-emerald hover:underline"
            >
              Lihat Laporan →
            </Link>
          </div>

          <ResponsiveContainer width="100%" height={260}>
            <BarChart
              data={cashflow}
              margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: '#142C4B', fontSize: 12 }}
                axisLine={{ stroke: '#D1D5DB' }}
              />
              <YAxis
                tickFormatter={formatCompact}
                tick={{ fill: '#142C4B', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                formatter={(value, name) => [formatCurrency(value), name]}
                contentStyle={{
                  backgroundColor: '#FFFFFF',
                  borderColor: '#E5E7EB',
                  borderRadius: '0.5rem',
                  color: '#142C4B',
                }}
              />
              <Legend />
              <Bar
                dataKey="income"
                name="Pemasukan"
                fill="#067F5B"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="expense"
                name="Pengeluaran"
                fill="#142C4B"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="lg:col-span-5 bg-white rounded-xl shadow-sm p-6 border border-gray-100 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-navy">
              Transaksi Terbaru
            </h2>
            <Link
              to="/transactions"
              className="text-xs font-semibold text-emerald hover:underline"
            >
              Lihat Semua →
            </Link>
          </div>

          {recentTxs.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-8 bg-bg-light rounded-lg">
              <p className="text-sm text-gray-500">Belum ada transaksi tercatat.</p>
              <Link
                to="/transactions"
                className="mt-2 text-xs font-semibold text-emerald hover:underline"
              >
                + Catat Transaksi Pertama
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 flex-1">
              {recentTxs.map((tx) => {
                const isIncome = tx.type === 'Income';
                const isTransfer = tx.type === 'Transfer';
                return (
                  <div
                    key={tx.id}
                    className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <CategoryIcon category={tx.category} type={tx.type} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-semibold text-navy truncate">
                            {tx.category}
                          </p>
                          {tx.is_business && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald/10 text-emerald font-semibold">
                              Usaha
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 truncate">
                          {tx.notes || tx.account_name} · {tx.transaction_date}
                        </p>
                      </div>
                    </div>

                    <span
                      className={`text-sm font-semibold shrink-0 ${
                        isIncome
                          ? 'text-emerald'
                          : isTransfer
                            ? 'text-navy'
                            : 'text-red-600'
                      }`}
                    >
                      {isIncome ? '+' : isTransfer ? '' : '-'}
                      {formatCurrency(tx.amount)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Baris 4: Mode Bisnis – Laba/Rugi Usaha Bulan Ini */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-navy">
                Laba/Rugi Usaha Bulan Ini
              </h2>
              <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald/10 text-emerald">
                Mode Bisnis · Usaha / Proyek
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Dihitung khusus dari mutasi akun bisnis ({businessStats.accountCount} akun) &
              transaksi berlabel usaha ({businessStats.txCount} transaksi bulan ini)
            </p>
          </div>
          <Link
            to="/transactions?new=1"
            className="text-xs font-semibold text-emerald hover:underline self-start sm:self-auto"
          >
            + Catat Transaksi Usaha →
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-bg-light">
            <p className="text-xs font-medium text-gray-500">Pemasukan Usaha</p>
            <p className="text-lg font-bold text-emerald mt-1">
              {formatCurrency(businessStats.income)}
            </p>
          </div>
          <div className="p-4 rounded-xl bg-bg-light">
            <p className="text-xs font-medium text-gray-500">Pengeluaran Usaha</p>
            <p className="text-lg font-bold text-navy mt-1">
              {formatCurrency(businessStats.expense)}
            </p>
          </div>
          <div className="p-4 rounded-xl bg-bg-light border border-emerald/20">
            <p className="text-xs font-medium text-gray-500">Laba/Rugi Bersih</p>
            <p
              className={`text-lg font-bold mt-1 ${
                businessStats.profit >= 0 ? 'text-emerald' : 'text-red-600'
              }`}
            >
              {businessStats.profit >= 0 ? '+' : ''}
              {formatCurrency(businessStats.profit)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
