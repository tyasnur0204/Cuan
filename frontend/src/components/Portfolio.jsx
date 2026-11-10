import { useEffect, useState } from 'react';
import {
  LineChart,
  Line,
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

const ALLOC_COLORS = {
  RDPU: '#067F5B',
  SBN: '#38BDF8',
  Saham: '#142C4B',
};

const FALLBACK_COLORS = ['#067F5B', '#38BDF8', '#142C4B', '#EAB308'];

const formatCurrency = (value) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(value ?? 0);
};

const Portfolio = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [formData, setFormData] = useState({
    asset_name: '',
    asset_class: 'RDPU',
    invested_amount: '',
    annual_return_rate: '',
  });

  const savedInflation =
    Number(localStorage.getItem('finmate_inflation_rate')) || 3.2;

  const resolveUserId = async () => {
    try {
      const stored = JSON.parse(localStorage.getItem('user') || 'null');
      if (stored?.id) return stored.id;
    } catch {
      // Fallback below
    }
    try {
      const meRes = await api.get('/me');
      if (meRes.data?.id) {
        localStorage.setItem('user', JSON.stringify(meRes.data));
        return meRes.data.id;
      }
    } catch {
      // Ignore if unauthenticated
    }
    return undefined;
  };

  const fetchInflationCheck = async () => {
    setLoading(true);
    setError(null);
    try {
      const userId = await resolveUserId();
      const params = { inflation_rate: savedInflation };
      if (userId) params.user_id = userId;
      const response = await api.get('/investments/inflation-check', {
        params,
      });
      setData(response.data);
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          err.message ||
          'Gagal memuat data portofolio investasi'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInflationCheck();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedInflation]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleCreateAsset = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setSuccessMsg('');
    setError(null);

    try {
      await api.post('/investments', {
        asset_name: formData.asset_name.trim(),
        asset_class: formData.asset_class,
        invested_amount: Number(formData.invested_amount || 0),
        annual_return_rate: Number(formData.annual_return_rate),
      });
      setSuccessMsg(`Aset "${formData.asset_name.trim()}" berhasil ditambahkan!`);
      setFormData({
        asset_name: '',
        asset_class: 'RDPU',
        invested_amount: '',
        annual_return_rate: '',
      });
      setShowForm(false);
      await fetchInflationCheck();
    } catch (err) {
      const detail = err.response?.data?.detail;
      const msg = Array.isArray(detail)
        ? detail.map((d) => `${d.loc?.join('.')}: ${d.msg}`).join(', ')
        : detail || err.message || 'Gagal menambah aset investasi';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteAsset = async (assetId, assetName) => {
    if (!window.confirm(`Hapus aset "${assetName}" dari portofolio?`)) {
      return;
    }
    try {
      await api.delete(`/investments/${assetId}`);
      await fetchInflationCheck();
    } catch (err) {
      setError(
        err.response?.data?.detail || err.message || 'Gagal menghapus aset'
      );
    }
  };

  if (loading && !data) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6 text-sm text-navy/70">
        Memuat data portofolio...
      </div>
    );
  }

  const assets = data?.assets ?? [];
  const inflationRate = data?.inflation_rate_pct ?? savedInflation;
  const totalInvestedValue = data?.total_invested_value ?? 0;
  const allocationByClass = data?.allocation_by_class ?? [];
  const beatingCount = assets.filter((asset) => asset.beats_inflation).length;

  // Hitung rata-rata return riil tertimbang nilai investasi (atau rata-rata sederhana)
  const totalWeightedAmount = assets.reduce(
    (sum, a) => sum + Number(a.invested_amount || 0),
    0
  );
  const netRealPortfolioPct =
    assets.length === 0
      ? 0
      : totalWeightedAmount > 0
        ? assets.reduce(
            (sum, a) =>
              sum +
              Number(a.net_real_return_pct || 0) *
                Number(a.invested_amount || 0),
            0
          ) / totalWeightedAmount
        : assets.reduce((sum, a) => sum + Number(a.net_real_return_pct || 0), 0) /
          assets.length;
  const formattedNetReal = Number(netRealPortfolioPct.toFixed(1));

  const chartData = assets.map((asset) => ({
    name: asset.asset_name,
    pertumbuhanAset: Number(asset.annual_return_rate_pct ?? 0),
    lajuInflasi: Number(asset.inflation_rate_pct ?? inflationRate),
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy">Portofolio Investasi</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Komparasi return investasi terhadap asumsi inflasi tahunan
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto">
          <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium bg-white text-navy shadow-sm border border-gray-100">
            Asumsi Inflasi: {inflationRate}% / thn
          </span>
          <button
            type="button"
            onClick={() => setShowForm((prev) => !prev)}
            className="px-4 py-2 bg-emerald text-white text-sm font-semibold rounded-lg hover:bg-emerald/90 transition-colors"
          >
            {showForm ? 'Tutup Form' : '+ Tambah Aset'}
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="p-3.5 bg-emerald/10 border border-emerald/20 text-emerald rounded-lg text-sm font-medium">
          {successMsg}
        </div>
      )}

      {error && (
        <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm font-medium">
          Error: {error}
        </div>
      )}

      {/* Form Tambah Aset */}
      {showForm && (
        <form
          onSubmit={handleCreateAsset}
          className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 space-y-4"
        >
          <h2 className="text-base font-semibold text-navy">
            Tambah Aset Investasi Baru
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-navy mb-1">
                Nama Aset
              </label>
              <input
                type="text"
                name="asset_name"
                value={formData.asset_name}
                onChange={handleChange}
                required
                placeholder="Contoh: Bibit RDPU / ORI025 / BBCA"
                className="w-full p-2.5 text-sm border border-gray-200 rounded-lg text-navy focus:outline-none focus:ring-2 focus:ring-emerald/30 focus:border-emerald"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-navy mb-1">
                Kelas Aset
              </label>
              <select
                name="asset_class"
                value={formData.asset_class}
                onChange={handleChange}
                className="w-full p-2.5 text-sm border border-gray-200 rounded-lg text-navy bg-white focus:outline-none focus:ring-2 focus:ring-emerald/30 focus:border-emerald"
              >
                <option value="RDPU">RDPU (Pasar Uang)</option>
                <option value="SBN">SBN (Obligasi Negara)</option>
                <option value="Saham">Saham</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-navy mb-1">
                Nilai Investasi (Rp)
              </label>
              <input
                type="number"
                name="invested_amount"
                value={formData.invested_amount}
                onChange={handleChange}
                required
                min="0"
                step="any"
                placeholder="2500000"
                className="w-full p-2.5 text-sm border border-gray-200 rounded-lg text-navy focus:outline-none focus:ring-2 focus:ring-emerald/30 focus:border-emerald"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-navy mb-1">
                Return Tahunan (%)
              </label>
              <input
                type="number"
                name="annual_return_rate"
                value={formData.annual_return_rate}
                onChange={handleChange}
                required
                step="any"
                placeholder="6.8"
                className="w-full p-2.5 text-sm border border-gray-200 rounded-lg text-navy focus:outline-none focus:ring-2 focus:ring-emerald/30 focus:border-emerald"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 text-sm font-medium text-navy bg-bg-light rounded-lg hover:bg-gray-200 transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 text-sm font-semibold text-white bg-emerald rounded-lg hover:bg-emerald/90 transition-colors disabled:opacity-50"
            >
              {submitting ? 'Menyimpan...' : 'Simpan Aset'}
            </button>
          </div>
        </form>
      )}

      {/* 3 Card Ringkasan */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="bg-emerald text-white rounded-xl shadow-sm p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-white/80">
            Total Nilai Investasi
          </p>
          <p className="text-2xl font-bold mt-2 tracking-tight">
            {formatCurrency(totalInvestedValue)}
          </p>
          <p className="text-xs text-white/75 mt-1">
            {data?.total_assets_checked ?? assets.length} aset tercatat
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
          <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
            Keuntungan (Setelah Inflasi)
          </p>
          <p
            className={`text-2xl font-bold mt-2 tracking-tight ${
              formattedNetReal >= 0 ? 'text-emerald' : 'text-red-600'
            }`}
          >
            {formattedNetReal > 0
              ? `+${formattedNetReal}%`
              : `${formattedNetReal}%`}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            vs asumsi inflasi {inflationRate}% / thn
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
          <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
            Aset Kalahkan Inflasi
          </p>
          <p className="text-2xl font-bold text-navy mt-2 tracking-tight">
            {beatingCount} / {assets.length} Aset
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Return tahunan di atas {inflationRate}%
          </p>
        </div>
      </div>

      {/* Grafik LineChart & Alokasi Aset */}
      {assets.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <h2 className="text-base font-semibold text-navy mb-1">
              Investasi vs Inflasi
            </h2>
            <p className="text-xs text-gray-500 mb-4">
              Perbandingan return tahunan masing-masing aset (%) terhadap laju
              inflasi
            </p>
            <ResponsiveContainer height={270} width="100%">
              <LineChart
                data={chartData}
                margin={{ top: 10, right: 20, left: -10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis
                  dataKey="name"
                  tick={{ fill: '#142C4B', fontSize: 12 }}
                  axisLine={{ stroke: '#D1D5DB' }}
                />
                <YAxis
                  unit="%"
                  tick={{ fill: '#142C4B', fontSize: 12 }}
                  axisLine={{ stroke: '#D1D5DB' }}
                />
                <Tooltip
                  formatter={(value, name) => [`${value}%`, name]}
                  contentStyle={{
                    backgroundColor: '#FFFFFF',
                    borderColor: '#E5E7EB',
                    borderRadius: '0.5rem',
                    color: '#142C4B',
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="pertumbuhanAset"
                  name="Pertumbuhan Aset (%)"
                  stroke="#067F5B"
                  strokeWidth={3}
                  dot={{ r: 5, fill: '#067F5B' }}
                  activeDot={{ r: 7 }}
                />
                <Line
                  type="monotone"
                  dataKey="lajuInflasi"
                  name="Laju Inflasi (%)"
                  stroke="#E57373"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={{ r: 4, fill: '#E57373' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="lg:col-span-4 bg-white rounded-xl shadow-sm p-6 border border-gray-100 flex flex-col">
            <h2 className="text-base font-semibold text-navy mb-1">
              Alokasi Aset
            </h2>
            <p className="text-xs text-gray-500 mb-2">
              Komposisi kelas aset portofolio
            </p>

            {allocationByClass.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={190}>
                  <PieChart>
                    <Pie
                      data={allocationByClass}
                      dataKey="percentage"
                      nameKey="asset_class"
                      cx="50%"
                      cy="50%"
                      innerRadius={48}
                      outerRadius={76}
                      paddingAngle={3}
                    >
                      {allocationByClass.map((entry, idx) => (
                        <Cell
                          key={entry.asset_class}
                          fill={
                            ALLOC_COLORS[entry.asset_class] ||
                            FALLBACK_COLORS[idx % FALLBACK_COLORS.length]
                          }
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val, name) => [`${val}%`, name]}
                      contentStyle={{
                        backgroundColor: '#FFFFFF',
                        borderColor: '#E5E7EB',
                        borderRadius: '0.5rem',
                        fontSize: '12px',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>

                <div className="space-y-2 mt-2 pt-3 border-t border-gray-100">
                  {allocationByClass.map((item, idx) => {
                    const color =
                      ALLOC_COLORS[item.asset_class] ||
                      FALLBACK_COLORS[idx % FALLBACK_COLORS.length];
                    return (
                      <div
                        key={item.asset_class}
                        className="flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: color }}
                          />
                          <span className="font-semibold text-navy">
                            {item.asset_class}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {item.amount > 0 && (
                            <span className="text-gray-500">
                              {formatCurrency(item.amount)}
                            </span>
                          )}
                          <span className="font-bold text-navy">
                            {item.percentage}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-xs text-gray-400">
                Belum ada alokasi aset.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tabel Detail Aset */}
      {assets.length === 0 ? (
        <div className="p-8 bg-white shadow-sm rounded-xl border border-gray-100 text-center space-y-2">
          <p className="text-sm font-medium text-navy">
            Belum ada aset investasi yang tercatat.
          </p>
          <p className="text-xs text-gray-500">
            Klik tombol "+ Tambah Aset" untuk mulai memantau return riil
            terhadap inflasi.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto bg-white shadow-sm rounded-xl border border-gray-100">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b bg-bg-light text-xs text-navy/80">
                <th className="p-4 font-semibold">Nama Aset</th>
                <th className="p-4 font-semibold">Kelas</th>
                <th className="p-4 font-semibold text-right">
                  Nilai Investasi
                </th>
                <th className="p-4 font-semibold text-right">Return Tahunan</th>
                <th className="p-4 font-semibold text-right">
                  Return Riil (Setelah Inflasi)
                </th>
                <th className="p-4 font-semibold text-center">Status</th>
                <th className="p-4 font-semibold text-center">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {assets.map((asset) => {
                const netReturn = asset.net_real_return_pct;
                return (
                  <tr
                    key={asset.asset_id}
                    className="border-b last:border-b-0 text-sm hover:bg-bg-light/50 transition-colors"
                  >
                    <td className="p-4 font-medium text-navy">
                      {asset.asset_name}
                    </td>
                    <td className="p-4">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-bg-light text-navy">
                        {asset.asset_class}
                      </span>
                    </td>
                    <td className="p-4 text-right font-medium text-navy">
                      {formatCurrency(asset.invested_amount)}
                    </td>
                    <td className="p-4 text-right text-navy">
                      {asset.annual_return_rate_pct}%
                    </td>
                    <td
                      className={`p-4 text-right font-semibold ${
                        netReturn > 0 ? 'text-emerald' : 'text-red-600'
                      }`}
                    >
                      {netReturn > 0 ? `+${netReturn}%` : `${netReturn}%`}
                    </td>
                    <td className="p-4 text-center">
                      <span
                        className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                          asset.beats_inflation
                            ? 'bg-emerald/10 text-emerald'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {asset.beats_inflation
                          ? 'Kalahkan Inflasi'
                          : 'Di Bawah Inflasi'}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <button
                        type="button"
                        onClick={() =>
                          handleDeleteAsset(asset.asset_id, asset.asset_name)
                        }
                        className="text-xs text-gray-400 hover:text-red-600 transition-colors"
                      >
                        Hapus
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Portfolio;
