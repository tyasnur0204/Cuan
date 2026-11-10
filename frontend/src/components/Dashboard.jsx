import { useCallback, useEffect, useState } from 'react';
import api from '../services/api';

const formatCurrency = (value) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(value ?? 0);
};

const Dashboard = () => {
  const [summary, setSummary] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get('/dashboard/summary');
      const summaryData = response.data;
      setSummary(summaryData);

      const period = summaryData?.period;
      const [txRes, accountsRes] = await Promise.all([
        api.get('/transactions', {
          params: period
            ? { month: period.month, year: period.year }
            : undefined,
        }),
        api.get('/accounts'),
      ]);
      setTransactions(txRes.data ?? []);
      setAccounts(accountsRes.data ?? []);
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          err.message ||
          'Gagal mengambil data ringkasan dashboard'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3 text-sm font-medium text-navy/70 animate-pulse">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald" />
          <span>Memuat data keuangan...</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, idx) => (
            <div
              key={idx}
              className="bg-white rounded-lg shadow-sm p-6 animate-pulse h-28"
            />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg shadow-sm p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="font-semibold text-red-800">
            Gagal Memuat Data Keuangan
          </p>
          <p className="text-sm text-red-700 mt-1">Error: {error}</p>
        </div>
        <button
          type="button"
          onClick={fetchSummary}
          className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors shrink-0 self-start sm:self-auto"
        >
          Coba Lagi
        </button>
      </div>
    );
  }

  const budgetLimit = summary?.total_budget_limit ?? 0;
  const expenses = summary?.current_month_expenses ?? 0;
  const budgetUsagePct =
    budgetLimit > 0
      ? Math.min(100, Math.round((expenses / budgetLimit) * 100))
      : 0;

  const businessAccountIds = new Set(
    accounts.filter((acc) => acc.is_business_account).map((acc) => acc.id)
  );
  const businessTransactions = transactions.filter(
    (tx) => tx.is_business || businessAccountIds.has(tx.account_id)
  );
  const businessIncome = businessTransactions
    .filter((tx) => tx.type === 'Income')
    .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
  const businessExpenses = businessTransactions
    .filter((tx) => tx.type === 'Expense')
    .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
  const businessProfit = businessIncome - businessExpenses;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-navy">Dashboard Keuangan</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Ringkasan kondisi finansial bulan berjalan
          </p>
        </div>
        {summary?.period && (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-white text-navy shadow-sm border border-gray-100 self-start sm:self-auto">
            Periode {summary.period.month}/{summary.period.year}
          </span>
        )}
      </div>

      {/* 4 Card Ringkasan Utama */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-emerald text-white rounded-lg shadow-sm p-6">
          <p className="text-sm font-medium text-white/80">Total Aset</p>
          <p className="text-xl xl:text-2xl font-bold mt-2 tracking-tight">
            {formatCurrency(summary?.total_assets)}
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-100">
          <p className="text-sm font-medium text-gray-500">Saldo Kas</p>
          <p className="text-xl xl:text-2xl font-bold text-navy mt-2 tracking-tight">
            {formatCurrency(summary?.cash_balance)}
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-100">
          <p className="text-sm font-medium text-gray-500">
            Pemasukan Bulan Ini
          </p>
          <p className="text-xl xl:text-2xl font-bold text-emerald mt-2 tracking-tight">
            {formatCurrency(summary?.current_month_income)}
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-100">
          <p className="text-sm font-medium text-gray-500">
            Pengeluaran Bulan Ini
          </p>
          <p className="text-xl xl:text-2xl font-bold text-navy mt-2 tracking-tight">
            {formatCurrency(summary?.current_month_expenses)}
          </p>
        </div>
      </div>

      {/* Grid Informasi Anggaran */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-navy">
              Status Budget Bulan Ini
            </h2>
            <span className="text-xs font-medium text-emerald bg-emerald/10 px-2.5 py-1 rounded-full">
              {budgetUsagePct}% Terpakai
            </span>
          </div>
          <div className="w-full bg-bg-light rounded-full h-2.5 overflow-hidden">
            <div
              className="bg-emerald h-2.5 rounded-full transition-all duration-300"
              style={{ width: `${budgetUsagePct}%` }}
            />
          </div>
          <div className="grid grid-cols-2 gap-4 mt-5 pt-4 border-t border-gray-100">
            <div>
              <p className="text-xs text-gray-500">Total Batas Budget</p>
              <p className="text-base font-semibold text-navy mt-1">
                {formatCurrency(summary?.total_budget_limit)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Sisa Budget</p>
              <p className="text-base font-semibold text-emerald mt-1">
                {formatCurrency(summary?.remaining_budget)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-100 flex flex-col justify-between">
          <div>
            <h2 className="text-base font-semibold text-navy mb-2">
              Ikhtisar Keuangan
            </h2>
            <p className="text-sm text-gray-500">
              Pantau keseimbangan antara pengeluaran bulanan dan target anggaran
              Anda untuk menjaga kesehatan arus kas.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4 mt-5 pt-4 border-t border-gray-100">
            <div>
              <p className="text-xs text-gray-500">Total Aset Tercatat</p>
              <p className="text-base font-semibold text-navy mt-1">
                {formatCurrency(summary?.total_assets)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Pengeluaran Berjalan</p>
              <p className="text-base font-semibold text-navy mt-1">
                {formatCurrency(summary?.current_month_expenses)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Card Khusus Mode Bisnis */}
      <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-100">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-navy">
              Laba/Rugi Usaha Bulan Ini
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Perhitungan khusus mutasi akun bisnis dan transaksi bertanda
              PhoBo/Proyek
            </p>
          </div>
          <span
            className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium self-start sm:self-auto ${
              businessProfit >= 0
                ? 'bg-emerald/10 text-emerald'
                : 'bg-red-100 text-red-700'
            }`}
          >
            {businessProfit >= 0 ? 'Laba Bersih' : 'Rugi Operasional'}
          </span>
        </div>

        <p
          className={`text-2xl font-bold mt-4 tracking-tight ${
            businessProfit >= 0 ? 'text-emerald' : 'text-red-600'
          }`}
        >
          {formatCurrency(businessProfit)}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-5 pt-4 border-t border-gray-100">
          <div>
            <p className="text-xs text-gray-500">Pemasukan Usaha</p>
            <p className="text-base font-semibold text-emerald mt-1">
              {formatCurrency(businessIncome)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Pengeluaran Usaha</p>
            <p className="text-base font-semibold text-navy mt-1">
              {formatCurrency(businessExpenses)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Jumlah Mutasi Bisnis</p>
            <p className="text-base font-semibold text-navy mt-1">
              {businessTransactions.length} Transaksi
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
