import { useEffect, useState } from 'react';
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  let displayName = 'Pengguna';
  try {
    const storedUser = JSON.parse(localStorage.getItem('user') || 'null');
    if (storedUser?.username) {
      displayName = storedUser.username;
    }
  } catch {
    // Fallback
  }

  const savedInflation =
    Number(localStorage.getItem('finmate_inflation_rate')) || 3.2;

  useEffect(() => {
    const fetchSummary = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await api.get('/dashboard/summary', {
          params: { inflation_rate: savedInflation },
        });
        setSummary(response.data);
      } catch (err) {
        setError(
          err.response?.data?.detail ||
            err.message ||
            'Gagal mengambil data ringkasan dashboard'
        );
      } finally {
        setLoading(false);
      }
    };

    fetchSummary();
  }, [savedInflation]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, idx) => (
            <div
              key={idx}
              className="bg-white rounded-lg shadow-sm p-6 animate-pulse h-28"
            />
          ))}
        </div>
        <div className="text-sm text-navy/70">Memuat data dashboard...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg shadow-sm p-6">
        Error: {error}
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
            Semoga hari ini produktif — berikut ringkasan keuangan Anda
          </p>
        </div>
        {summary?.period && (
          <span className="inline-flex items-center px-3.5 py-1.5 rounded-full text-xs font-semibold bg-white text-navy shadow-sm border border-gray-100 self-start sm:self-auto">
            {MONTH_NAMES[summary.period.month]} {summary.period.year}
          </span>
        )}
      </div>

      {/* 4 Card Ringkasan Utama */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-emerald text-white rounded-xl shadow-sm p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-white/80">
            Total Aset
          </p>
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

      {/* Baris Kedua: Pertumbuhan Bersih & Sisa Budget */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-navy">
              Pertumbuhan Bersih (Setelah Inflasi)
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              Rata-rata return portofolio investasi dikurangi asumsi inflasi
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
                vs inflasi {inflationRate}%/thn
              </span>
            </div>
          </div>
          <Link
            to="/portfolio"
            className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-emerald/10 text-emerald hover:bg-emerald/15 transition-colors shrink-0"
          >
            Cek Portofolio →
          </Link>
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
            <span>Batas: {formatCurrency(budgetLimit)}</span>
          </div>
        </div>
      </div>

      {/* Baris Ketiga: Arus Kas Bulanan + Transaksi Terbaru */}
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
                      <div
                        className={`w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                          isIncome
                            ? 'bg-emerald/10 text-emerald'
                            : isTransfer
                              ? 'bg-blue-50 text-blue-600'
                              : 'bg-red-50 text-red-600'
                        }`}
                      >
                        {isIncome ? '↓' : isTransfer ? '⇄' : '↑'}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-semibold text-navy truncate">
                            {tx.category}
                          </p>
                          {tx.is_business && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald/10 text-emerald font-medium">
                              Usaha
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 truncate">
                          {tx.account_name} · {tx.transaction_date}
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
    </div>
  );
};

export default Dashboard;
