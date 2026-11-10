import { useEffect, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import api from '../services/api';

const CATEGORY_COLORS = [
  '#F97316',
  '#38BDF8',
  '#EAB308',
  '#10B981',
  '#067F5B',
  '#142C4B',
  '#8B5CF6',
];

const MONTH_OPTIONS = [
  { value: 1, label: 'Januari' },
  { value: 2, label: 'Februari' },
  { value: 3, label: 'Maret' },
  { value: 4, label: 'April' },
  { value: 5, label: 'Mei' },
  { value: 6, label: 'Juni' },
  { value: 7, label: 'Juli' },
  { value: 8, label: 'Agustus' },
  { value: 9, label: 'September' },
  { value: 10, label: 'Oktober' },
  { value: 11, label: 'November' },
  { value: 12, label: 'Desember' },
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

const Reports = () => {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [activeTab, setActiveTab] = useState('ringkasan');
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchReport = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.get('/reports/summary', {
          params: { month: selectedMonth, year: selectedYear },
        });
        setReport(res.data);
      } catch (err) {
        setError(
          err.response?.data?.detail ||
            err.message ||
            'Gagal memuat laporan keuangan'
        );
      } finally {
        setLoading(false);
      }
    };

    fetchReport();
  }, [selectedMonth, selectedYear]);

  const totalIncome = report?.total_income ?? 0;
  const totalExpenses = report?.total_expenses ?? 0;
  const netSavings = report?.net_savings ?? 0;
  const expenseCategories = report?.expense_by_category ?? [];
  const incomeCategories = report?.income_by_category ?? [];
  const monthlyComparison = report?.monthly_comparison ?? [];

  const activeCategoryList =
    activeTab === 'pemasukan' ? incomeCategories : expenseCategories;
  const activeCategoryTotal =
    activeTab === 'pemasukan' ? totalIncome : totalExpenses;

  const selectedMonthName =
    MONTH_OPTIONS.find((m) => m.value === Number(selectedMonth))?.label || '';

  return (
    <div className="space-y-6">
      {/* Header & Period Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy">Laporan Keuangan</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Analisis pemasukan, pengeluaran per kategori, dan arus kas 6 bulan
            terakhir
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="px-3 py-2 text-sm font-medium border border-gray-200 rounded-lg bg-white text-navy focus:outline-none focus:ring-2 focus:ring-emerald/30"
          >
            {MONTH_OPTIONS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>

          <input
            type="number"
            min="2000"
            max="2100"
            value={selectedYear}
            onChange={(e) =>
              setSelectedYear(Number(e.target.value) || now.getFullYear())
            }
            className="w-24 px-3 py-2 text-sm font-medium border border-gray-200 rounded-lg bg-white text-navy focus:outline-none focus:ring-2 focus:ring-emerald/30"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 pb-3">
        {[
          { key: 'ringkasan', label: 'Ringkasan' },
          { key: 'pengeluaran', label: 'Pengeluaran' },
          { key: 'pemasukan', label: 'Pemasukan' },
          { key: 'perbandingan', label: 'Perbandingan' },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              activeTab === tab.key
                ? 'bg-emerald text-white'
                : 'bg-white text-navy border border-gray-200 hover:bg-bg-light'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
          Error: {error}
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-xl shadow-sm p-8 text-center text-sm text-gray-500">
          Memuat data laporan {selectedMonthName} {selectedYear}...
        </div>
      ) : (
        <>
          {/* 3 KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
              <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
                Total Pemasukan
              </p>
              <p className="text-2xl font-bold text-emerald mt-2">
                {formatCurrency(totalIncome)}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {selectedMonthName} {selectedYear}
              </p>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
              <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
                Total Pengeluaran
              </p>
              <p className="text-2xl font-bold text-navy mt-2">
                {formatCurrency(totalExpenses)}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {expenseCategories.length} kategori pengeluaran
              </p>
            </div>

            <div
              className={`rounded-xl shadow-sm p-5 ${
                netSavings >= 0
                  ? 'bg-emerald text-white'
                  : 'bg-red-600 text-white'
              }`}
            >
              <p className="text-xs font-medium uppercase tracking-wider text-white/80">
                {netSavings >= 0 ? 'Surplus / Tabungan Bersih' : 'Defisit Bersih'}
              </p>
              <p className="text-2xl font-bold mt-2">
                {formatCurrency(netSavings)}
              </p>
              <p className="text-xs text-white/75 mt-1">
                Selisih pemasukan & pengeluaran
              </p>
            </div>
          </div>

          {/* Konten Sesuai Tab */}
          {activeTab === 'ringkasan' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Donut Pengeluaran per Kategori */}
              <div className="lg:col-span-5 bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                <h2 className="text-base font-semibold text-navy mb-1">
                  Pengeluaran per Kategori
                </h2>
                <p className="text-xs text-gray-500 mb-4">
                  Distribusi pengeluaran pada {selectedMonthName} {selectedYear}
                </p>

                {expenseCategories.length === 0 ? (
                  <div className="h-[240px] flex items-center justify-center bg-bg-light rounded-lg text-xs text-gray-500">
                    Belum ada pengeluaran tercatat di periode ini.
                  </div>
                ) : (
                  <>
                    <div className="relative h-[220px]">
                      <ResponsiveContainer width="100%" height={220}>
                        <PieChart>
                          <Pie
                            data={expenseCategories}
                            dataKey="amount"
                            nameKey="category"
                            cx="50%"
                            cy="50%"
                            innerRadius={62}
                            outerRadius={88}
                            paddingAngle={3}
                          >
                            {expenseCategories.map((entry, idx) => (
                              <Cell
                                key={entry.category}
                                fill={
                                  CATEGORY_COLORS[idx % CATEGORY_COLORS.length]
                                }
                              />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(val, name) => [
                              formatCurrency(val),
                              name,
                            ]}
                            contentStyle={{
                              backgroundColor: '#FFFFFF',
                              borderColor: '#E5E7EB',
                              borderRadius: '0.5rem',
                              fontSize: '12px',
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                        <span className="text-sm font-bold text-navy">
                          {formatCurrency(totalExpenses)}
                        </span>
                        <span className="text-[11px] text-gray-400">
                          Pengeluaran
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
                      {expenseCategories.map((item, idx) => (
                        <div
                          key={item.category}
                          className="flex items-center justify-between text-xs"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{
                                backgroundColor:
                                  CATEGORY_COLORS[idx % CATEGORY_COLORS.length],
                              }}
                            />
                            <span className="font-medium text-navy truncate">
                              {item.category}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className="text-gray-500">
                              {formatCurrency(item.amount)}
                            </span>
                            <span className="font-semibold text-navy w-10 text-right">
                              {item.percentage}%
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* BarChart Pemasukan vs Pengeluaran */}
              <div className="lg:col-span-7 bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                <h2 className="text-base font-semibold text-navy mb-1">
                  Pemasukan vs Pengeluaran
                </h2>
                <p className="text-xs text-gray-500 mb-4">
                  Tren arus kas 6 bulan terakhir hingga {selectedMonthName}{' '}
                  {selectedYear}
                </p>

                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={monthlyComparison}
                    margin={{ top: 10, right: 10, left: -10, bottom: 5 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#E5E7EB"
                      vertical={false}
                    />
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
                      formatter={(val, name) => [formatCurrency(val), name]}
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
            </div>
          )}

          {(activeTab === 'pengeluaran' || activeTab === 'pemasukan') && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-5 bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                <h2 className="text-base font-semibold text-navy mb-4">
                  {activeTab === 'pemasukan'
                    ? 'Pemasukan per Kategori'
                    : 'Pengeluaran per Kategori'}
                </h2>
                {activeCategoryList.length === 0 ? (
                  <div className="h-[240px] flex items-center justify-center bg-bg-light rounded-lg text-xs text-gray-500">
                    Belum ada data di periode ini.
                  </div>
                ) : (
                  <div className="relative h-[240px]">
                    <ResponsiveContainer width="100%" height={240}>
                      <PieChart>
                        <Pie
                          data={activeCategoryList}
                          dataKey="amount"
                          nameKey="category"
                          cx="50%"
                          cy="50%"
                          innerRadius={66}
                          outerRadius={94}
                          paddingAngle={3}
                        >
                          {activeCategoryList.map((entry, idx) => (
                            <Cell
                              key={entry.category}
                              fill={
                                CATEGORY_COLORS[idx % CATEGORY_COLORS.length]
                              }
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(val, name) => [formatCurrency(val), name]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                      <span className="text-sm font-bold text-navy">
                        {formatCurrency(activeCategoryTotal)}
                      </span>
                      <span className="text-[11px] text-gray-400">Total</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="lg:col-span-7 bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                <h2 className="text-base font-semibold text-navy mb-4">
                  Rincian Kategori ({selectedMonthName} {selectedYear})
                </h2>
                {activeCategoryList.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    Belum ada transaksi pada tab ini.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {activeCategoryList.map((item, idx) => {
                      const color =
                        CATEGORY_COLORS[idx % CATEGORY_COLORS.length];
                      return (
                        <div key={item.category} className="space-y-1.5">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium text-navy">
                              {item.category}
                            </span>
                            <div className="flex items-center gap-3">
                              <span className="font-semibold text-navy">
                                {formatCurrency(item.amount)}
                              </span>
                              <span className="text-xs font-semibold text-gray-500 w-10 text-right">
                                {item.percentage}%
                              </span>
                            </div>
                          </div>
                          <div className="w-full bg-bg-light h-2 rounded-full overflow-hidden">
                            <div
                              className="h-2 rounded-full"
                              style={{
                                width: `${item.percentage}%`,
                                backgroundColor: color,
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'perbandingan' && (
            <div className="space-y-6">
              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                <h2 className="text-base font-semibold text-navy mb-4">
                  Perbandingan Arus Kas 6 Bulan Terakhir
                </h2>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={monthlyComparison}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#E5E7EB"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="label"
                      tick={{ fill: '#142C4B', fontSize: 12 }}
                    />
                    <YAxis
                      tickFormatter={formatCompact}
                      tick={{ fill: '#142C4B', fontSize: 11 }}
                    />
                    <Tooltip
                      formatter={(val, name) => [formatCurrency(val), name]}
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

              <div className="overflow-x-auto bg-white rounded-xl shadow-sm border border-gray-100">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b bg-bg-light text-xs text-navy/80">
                      <th className="p-4 font-semibold">Periode</th>
                      <th className="p-4 font-semibold text-right">
                        Pemasukan
                      </th>
                      <th className="p-4 font-semibold text-right">
                        Pengeluaran
                      </th>
                      <th className="p-4 font-semibold text-right">
                        Surplus / Defisit
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyComparison.map((row) => {
                      const diff = row.income - row.expense;
                      return (
                        <tr
                          key={`${row.year}-${row.month}`}
                          className="border-b last:border-b-0 text-sm hover:bg-bg-light/50"
                        >
                          <td className="p-4 font-medium text-navy">
                            {row.label} {row.year}
                          </td>
                          <td className="p-4 text-right font-semibold text-emerald">
                            {formatCurrency(row.income)}
                          </td>
                          <td className="p-4 text-right text-navy">
                            {formatCurrency(row.expense)}
                          </td>
                          <td
                            className={`p-4 text-right font-semibold ${
                              diff >= 0 ? 'text-emerald' : 'text-red-600'
                            }`}
                          >
                            {diff >= 0 ? '+' : ''}
                            {formatCurrency(diff)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Reports;
