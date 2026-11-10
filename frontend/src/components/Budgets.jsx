import { useEffect, useState } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
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
  const [formData, setFormData] = useState({
    user_id: '',
    category: '',
    limit_amount: '',
    month: now.getMonth() + 1,
    year: now.getFullYear(),
  });
  const [users, setUsers] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [loadingBudgets, setLoadingBudgets] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  const fetchBudgets = async () => {
    setLoadingBudgets(true);
    try {
      const response = await api.get('/budgets');
      setBudgets(response.data ?? []);
    } catch (err) {
      setErrorMessage(
        err.response?.data?.detail ||
          err.message ||
          'Gagal memuat daftar budget'
      );
    } finally {
      setLoadingBudgets(false);
    }
  };

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const usersRes = await api.get('/users');
        const userList = usersRes.data ?? [];
        setUsers(userList);
        if (userList.length > 0) {
          setFormData((prev) => ({
            ...prev,
            user_id: prev.user_id || userList[0].id,
          }));
        }
      } catch {
        // Biarkan input manual tetap bisa digunakan jika endpoint users belum tersedia
      }

      await fetchBudgets();
    };

    fetchInitialData();
  }, []);

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
      const payload = {
        user_id: formData.user_id,
        category: formData.category,
        limit_amount: Number(formData.limit_amount),
        month: Number(formData.month),
        year: Number(formData.year),
      };

      await api.post('/budgets', payload);
      setSuccessMessage(
        `Budget kategori "${formData.category}" untuk ${formData.month}/${formData.year} berhasil ditetapkan!`
      );
      setFormData((prev) => ({
        ...prev,
        category: '',
        limit_amount: '',
      }));
      await fetchBudgets();
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

  const totalBudget = budgets.reduce(
    (sum, item) => sum + Number(item.limit_amount || 0),
    0
  );

  const chartData = budgets.map((item) => ({
    name: item.category,
    value: Number(item.limit_amount || 0),
    month: item.month,
    year: item.year,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy">Anggaran (Budgeting)</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Alokasikan batas pengeluaran per kategori dan pantau porsinya
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Form Tambah Budget */}
        <div className="lg:col-span-5 bg-white shadow-sm rounded-lg border border-gray-100 p-6">
          <h2 className="text-base font-semibold text-navy mb-4">
            Tetapkan Budget Bulanan
          </h2>

          {successMessage && (
            <div className="mb-4 p-3 bg-emerald/10 text-emerald rounded-lg border border-emerald/20 text-sm">
              {successMessage}
            </div>
          )}

          {errorMessage && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg border border-red-200 text-sm">
              Error: {errorMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-navy mb-1">
                Pengguna
              </label>
              {users.length > 0 ? (
                <select
                  name="user_id"
                  value={formData.user_id}
                  onChange={handleChange}
                  required
                  className="w-full p-2.5 border border-gray-200 rounded-lg text-navy bg-white focus:outline-none focus:ring-2 focus:ring-emerald/30 focus:border-emerald"
                >
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.username} ({user.email})
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  name="user_id"
                  value={formData.user_id}
                  onChange={handleChange}
                  required
                  placeholder="Masukkan UUID user"
                  className="w-full p-2.5 border border-gray-200 rounded-lg text-navy focus:outline-none focus:ring-2 focus:ring-emerald/30 focus:border-emerald"
                />
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-navy mb-1">
                Kategori
              </label>
              <input
                type="text"
                name="category"
                value={formData.category}
                onChange={handleChange}
                required
                placeholder="Contoh: Makan, Transportasi"
                className="w-full p-2.5 border border-gray-200 rounded-lg text-navy focus:outline-none focus:ring-2 focus:ring-emerald/30 focus:border-emerald"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-navy mb-1">
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
                placeholder="0"
                className="w-full p-2.5 border border-gray-200 rounded-lg text-navy focus:outline-none focus:ring-2 focus:ring-emerald/30 focus:border-emerald"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-navy mb-1">
                  Bulan
                </label>
                <input
                  type="number"
                  name="month"
                  value={formData.month}
                  onChange={handleChange}
                  required
                  min="1"
                  max="12"
                  className="w-full p-2.5 border border-gray-200 rounded-lg text-navy focus:outline-none focus:ring-2 focus:ring-emerald/30 focus:border-emerald"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-navy mb-1">
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
                  className="w-full p-2.5 border border-gray-200 rounded-lg text-navy focus:outline-none focus:ring-2 focus:ring-emerald/30 focus:border-emerald"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 px-4 bg-emerald text-white font-medium rounded-lg hover:bg-emerald/90 transition-colors disabled:opacity-50"
            >
              {submitting ? 'Menyimpan...' : 'Simpan Budget'}
            </button>
          </form>
        </div>

        {/* Diagram Donat Alokasi Budget */}
        <div className="lg:col-span-7 bg-white shadow-sm rounded-lg border border-gray-100 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
            <div>
              <h2 className="text-base font-semibold text-navy">
                Distribusi Alokasi Budget per Kategori
              </h2>
              <p className="text-xs text-gray-500">
                Total teralokasi: {formatCurrency(totalBudget)}
              </p>
            </div>
            <span className="text-xs font-medium bg-bg-light text-navy px-2.5 py-1 rounded-full self-start sm:self-auto">
              {budgets.length} Kategori
            </span>
          </div>

          {loadingBudgets ? (
            <div className="h-[300px] flex items-center justify-center text-sm text-gray-500">
              Memuat grafik budget...
            </div>
          ) : chartData.length === 0 ? (
            <div className="h-[300px] flex items-center justify-center text-sm text-gray-500 bg-bg-light rounded-lg">
              Belum ada data budget untuk divisualisasikan.
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={chartData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={65}
                    outerRadius={105}
                    paddingAngle={3}
                  >
                    {chartData.map((entry, index) => (
                      <Cell
                        key={`cell-${entry.name}-${index}`}
                        fill={CHART_COLORS[index % CHART_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, name) => {
                      const pct =
                        totalBudget > 0
                          ? ((Number(value) / totalBudget) * 100).toFixed(1)
                          : 0;
                      return [`${formatCurrency(value)} (${pct}%)`, name];
                    }}
                    contentStyle={{
                      backgroundColor: '#FFFFFF',
                      borderColor: '#E5E7EB',
                      borderRadius: '0.5rem',
                      color: '#142C4B',
                    }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>

              <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
                {chartData.map((item, index) => {
                  const pct =
                    totalBudget > 0
                      ? ((item.value / totalBudget) * 100).toFixed(1)
                      : '0.0';
                  const color = CHART_COLORS[index % CHART_COLORS.length];
                  return (
                    <div
                      key={`${item.name}-${index}`}
                      className="flex items-center justify-between text-sm py-1.5"
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: color }}
                        />
                        <span className="font-medium text-navy">
                          {item.name}
                        </span>
                        <span className="text-xs text-gray-400">
                          ({item.month}/{item.year})
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-medium text-gray-500">
                          {pct}%
                        </span>
                        <span className="font-semibold text-navy">
                          {formatCurrency(item.value)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Budgets;
