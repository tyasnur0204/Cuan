import { useEffect, useState } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import api from '../services/api';

const CHART_COLORS = [
  '#067F5B', // Emerald
  '#38BDF8', // Biru Muda
  '#EAB308', // Kuning Mustard
  '#F97316', // Oranye
  '#142C4B', // Navy
  '#10B981', // Hijau Mint
  '#8B5CF6', // Ungu
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

const SUGGESTED_CATEGORIES = [
  'Makan & Minum',
  'Transportasi',
  'Pendidikan',
  'Tabungan',
  'Investasi',
  'Hiburan',
];

const formatCurrency = (value) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(value ?? 0);
};

const Budgets = () => {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());

  const [formData, setFormData] = useState({
    category: '',
    limit_amount: '',
    month: now.getMonth() + 1,
    year: now.getFullYear(),
  });
  const [budgets, setBudgets] = useState([]);
  const [monthlyIncome, setMonthlyIncome] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  const fetchPeriodData = async (month = selectedMonth, year = selectedYear) => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const [budgetsRes, summaryRes] = await Promise.all([
        api.get('/budgets', { params: { month, year } }),
        api.get('/dashboard/summary', { params: { month, year } }),
      ]);
      setBudgets(budgetsRes.data ?? []);
      setMonthlyIncome(Number(summaryRes.data?.current_month_income ?? 0));
    } catch (err) {
      setErrorMessage(
        err.response?.data?.detail ||
          err.message ||
          'Gagal memuat data anggaran'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      month: selectedMonth,
      year: selectedYear,
    }));
    fetchPeriodData(selectedMonth, selectedYear);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMonth, selectedYear]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      let storedUserId;
      try {
        storedUserId = JSON.parse(localStorage.getItem('user') || 'null')?.id;
      } catch {
        storedUserId = undefined;
      }

      const targetMonth = Number(formData.month);
      const targetYear = Number(formData.year);

      const payload = {
        category: formData.category.trim(),
        limit_amount: Number(formData.limit_amount),
        month: targetMonth,
        year: targetYear,
      };
      if (storedUserId) {
        payload.user_id = storedUserId;
      }

      await api.post('/budgets', payload);
      setSuccessMessage(
        `Budget kategori "${payload.category}" untuk ${MONTH_OPTIONS[targetMonth - 1]?.label || targetMonth} ${targetYear} berhasil ditetapkan!`
      );
      setFormData((prev) => ({
        ...prev,
        category: '',
        limit_amount: '',
      }));

      if (targetMonth !== selectedMonth || targetYear !== selectedYear) {
        setSelectedMonth(targetMonth);
        setSelectedYear(targetYear);
      } else {
        await fetchPeriodData(selectedMonth, selectedYear);
      }
    } catch (err) {
      const detail = err.response?.data?.detail;
      const msg = Array.isArray(detail)
        ? detail.map((d) => `${d.loc?.join('.')}: ${d.msg}`).join(', ')
        : detail || err.message || 'Gagal menetapkan budget';
      setErrorMessage(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (budgetId, categoryName) => {
    if (!window.confirm(`Hapus budget kategori "${categoryName}"?`)) {
      return;
    }
    try {
      await api.delete(`/budgets/${budgetId}`);
      await fetchPeriodData(selectedMonth, selectedYear);
    } catch (err) {
      setErrorMessage(
        err.response?.data?.detail || err.message || 'Gagal menghapus budget'
      );
    }
  };

  const totalBudget = budgets.reduce(
    (sum, item) => sum + Number(item.limit_amount || 0),
    0
  );

  const denominator = monthlyIncome > 0 ? monthlyIncome : totalBudget;
  const remainingToAllocate = monthlyIncome - totalBudget;
  const allocatedPct =
    monthlyIncome > 0 ? Math.round((totalBudget / monthlyIncome) * 100) : 0;

  const baseChartData = budgets.map((item, idx) => ({
    id: item.id,
    name: item.category,
    value: Number(item.limit_amount || 0),
    color: CHART_COLORS[idx % CHART_COLORS.length],
    isRemainder: false,
  }));

  const donutData =
    monthlyIncome > totalBudget && totalBudget > 0
      ? [
          ...baseChartData,
          {
            id: 'unallocated',
            name: 'Belum Dialokasikan',
            value: monthlyIncome - totalBudget,
            color: '#E5E7EB',
            isRemainder: true,
          },
        ]
      : baseChartData;

  const selectedMonthName =
    MONTH_OPTIONS.find((m) => m.value === Number(selectedMonth))?.label || '';

  return (
    <div className="space-y-6">
      {/* Header & Period Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy">Budgeting</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Alokasikan seluruh pemasukan dengan prinsip zero-based budgeting
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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Form Tetapkan Budget */}
        <div className="lg:col-span-4 bg-white shadow-sm rounded-xl border border-gray-100 p-6">
          <h2 className="text-base font-semibold text-navy mb-4">
            Tetapkan Budget Bulanan
          </h2>

          {successMessage && (
            <div className="mb-4 p-3 bg-emerald/10 text-emerald rounded-lg border border-emerald/20 text-xs font-medium">
              {successMessage}
            </div>
          )}

          {errorMessage && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg border border-red-200 text-xs font-medium">
              Error: {errorMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-navy mb-1">
                Kategori
              </label>
              <input
                type="text"
                name="category"
                value={formData.category}
                onChange={handleChange}
                required
                placeholder="Contoh: Makan & Minum"
                className="w-full p-2.5 text-sm border border-gray-200 rounded-lg text-navy focus:outline-none focus:ring-2 focus:ring-emerald/30 focus:border-emerald"
              />
              <div className="flex flex-wrap gap-1.5 mt-2">
                {SUGGESTED_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() =>
                      setFormData((prev) => ({ ...prev, category: cat }))
                    }
                    className="text-[11px] px-2 py-0.5 rounded-full bg-bg-light text-navy/80 hover:bg-emerald/10 hover:text-emerald transition-colors"
                  >
                    + {cat}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-navy mb-1">
                Batas Budget (Rp)
              </label>
              <input
                type="number"
                name="limit_amount"
                value={formData.limit_amount}
                onChange={handleChange}
                required
                min="0"
                step="any"
                placeholder="1000000"
                className="w-full p-2.5 text-sm border border-gray-200 rounded-lg text-navy focus:outline-none focus:ring-2 focus:ring-emerald/30 focus:border-emerald"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-navy mb-1">
                  Bulan
                </label>
                <select
                  name="month"
                  value={formData.month}
                  onChange={handleChange}
                  required
                  className="w-full p-2.5 text-sm border border-gray-200 rounded-lg text-navy bg-white focus:outline-none focus:ring-2 focus:ring-emerald/30 focus:border-emerald"
                >
                  {MONTH_OPTIONS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-navy mb-1">
                  Tahun
                </label>
                <input
                  type="number"
                  name="year"
                  value={formData.year}
                  onChange={handleChange}
                  required
                  min="2000"
                  max="2100"
                  className="w-full p-2.5 text-sm border border-gray-200 rounded-lg text-navy focus:outline-none focus:ring-2 focus:ring-emerald/30 focus:border-emerald"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 px-4 bg-emerald text-white text-sm font-semibold rounded-lg hover:bg-emerald/90 transition-colors disabled:opacity-50"
            >
              {submitting ? 'Menyimpan...' : 'Simpan Budget'}
            </button>
          </form>
        </div>

        {/* Visualisasi Zero-Based Budgeting */}
        <div className="lg:col-span-8 bg-white shadow-sm rounded-xl border border-gray-100 p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-navy">
                Alokasi Anggaran — {selectedMonthName} {selectedYear}
              </h2>
              <p className="text-xs text-gray-500">
                Total teralokasi: {formatCurrency(totalBudget)} · Pemasukan bulan
                ini: {formatCurrency(monthlyIncome)}
              </p>
            </div>
            <span className="text-xs font-semibold bg-bg-light text-navy px-3 py-1 rounded-full self-start sm:self-auto">
              {budgets.length} Kategori
            </span>
          </div>

          {loading ? (
            <div className="h-[260px] flex items-center justify-center text-sm text-gray-500">
              Memuat grafik anggaran...
            </div>
          ) : budgets.length === 0 ? (
            <div className="h-[260px] flex flex-col items-center justify-center text-center bg-bg-light rounded-xl px-4">
              <p className="text-sm font-medium text-navy">
                Belum ada budget untuk {selectedMonthName} {selectedYear}.
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Tambahkan kategori anggaran di sebelah kiri untuk memulai
                zero-based budgeting.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
              {/* Donut Chart dengan Center Metric */}
              <div className="md:col-span-5 relative h-[250px]">
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={donutData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={70}
                      outerRadius={98}
                      paddingAngle={2}
                      stroke="none"
                    >
                      {donutData.map((entry) => (
                        <Cell key={entry.id} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value, name) => {
                        const pct =
                          denominator > 0
                            ? ((Number(value) / denominator) * 100).toFixed(1)
                            : 0;
                        return [`${formatCurrency(value)} (${pct}%)`, name];
                      }}
                      contentStyle={{
                        backgroundColor: '#FFFFFF',
                        borderColor: '#E5E7EB',
                        borderRadius: '0.5rem',
                        color: '#142C4B',
                        fontSize: '12px',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>

                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center px-6">
                  <span className="text-sm sm:text-base font-bold text-navy leading-tight">
                    {formatCurrency(
                      monthlyIncome > 0 ? monthlyIncome : totalBudget
                    )}
                  </span>
                  <span className="text-[11px] text-gray-500 mt-0.5">
                    {monthlyIncome > 0
                      ? 'Total Pemasukan'
                      : 'Total Dialokasikan'}
                  </span>
                </div>
              </div>

              {/* Daftar Kategori */}
              <div className="md:col-span-7 divide-y divide-gray-100">
                {baseChartData.map((item) => {
                  const pct =
                    denominator > 0
                      ? Math.round((item.value / denominator) * 100)
                      : 0;
                  return (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0 text-sm"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="font-medium text-navy truncate">
                          {item.name}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span className="font-semibold text-navy">
                          {formatCurrency(item.value)}
                        </span>
                        <span className="w-11 text-right text-xs font-semibold text-gray-500">
                          {pct}%
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDelete(item.id, item.name)}
                          className="text-xs text-gray-400 hover:text-red-600 transition-colors"
                          title="Hapus kategori budget"
                        >
                          Hapus
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Status Banner Zero-Based Budgeting */}
          {monthlyIncome > 0 ? (
            remainingToAllocate === 0 ? (
              <div className="p-3.5 rounded-lg bg-emerald/10 border border-emerald/20 text-emerald text-xs sm:text-sm font-semibold text-center">
                ✓ Anggaran Teralokasi 100% • Rp 0 tersisa
              </div>
            ) : remainingToAllocate > 0 ? (
              <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs sm:text-sm font-medium text-center">
                Anggaran Teralokasi {allocatedPct}% •{' '}
                {formatCurrency(remainingToAllocate)} belum dialokasikan dari
                pemasukan bulan ini
              </div>
            ) : (
              <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs sm:text-sm font-medium text-center">
                ⚠ Alokasi anggaran ({allocatedPct}%) melebihi pemasukan sebesar{' '}
                {formatCurrency(Math.abs(remainingToAllocate))}
              </div>
            )
          ) : (
            totalBudget > 0 && (
              <div className="p-3.5 rounded-lg bg-bg-light border border-gray-200 text-navy/80 text-xs sm:text-sm font-medium text-center">
                Total dialokasikan: {formatCurrency(totalBudget)} · Catat
                pemasukan pada {selectedMonthName} {selectedYear} untuk melihat
                status zero-based budgeting
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
};

export default Budgets;
