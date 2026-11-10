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
} from 'recharts';
import api from '../services/api';

const Portfolio = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchInflationCheck = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await api.get('/investments/inflation-check');
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

    fetchInflationCheck();
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6 text-sm text-navy/70">
        Memuat data portofolio...
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

  const assets = data?.assets ?? [];
  const inflationRate = data?.inflation_rate_pct ?? 3.2;
  const beatingCount = assets.filter((asset) => asset.beats_inflation).length;

  const chartData = assets.map((asset) => ({
    name: asset.asset_name,
    pertumbuhanAset: Number(asset.annual_return_rate_pct ?? 0),
    lajuInflasi: Number(asset.inflation_rate_pct ?? inflationRate),
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-navy">
            Portofolio & Cek Inflasi
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Komparasi return investasi terhadap asumsi inflasi tahunan
          </p>
        </div>
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-white text-navy shadow-sm border border-gray-100 self-start sm:self-auto">
          Asumsi Inflasi: {inflationRate}% / tahun
        </span>
      </div>

      {/* Ringkasan Teks Angka */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-emerald text-white rounded-lg shadow-sm p-5">
          <p className="text-sm font-medium text-white/80">Total Aset Dicek</p>
          <p className="text-2xl font-bold mt-1">
            {data?.total_assets_checked ?? assets.length} Aset
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-5 border border-gray-100">
          <p className="text-sm font-medium text-gray-500">
            Target Laju Inflasi
          </p>
          <p className="text-2xl font-bold text-navy mt-1">{inflationRate}%</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-5 border border-gray-100">
          <p className="text-sm font-medium text-gray-500">
            Kalahkan Inflasi
          </p>
          <p className="text-2xl font-bold text-emerald mt-1">
            {beatingCount} / {assets.length} Aset
          </p>
        </div>
      </div>

      {/* Grafik LineChart Pertumbuhan Aset vs Inflasi */}
      {assets.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-100">
          <h2 className="text-base font-semibold text-navy mb-1">
            Pertumbuhan Aset Investasi vs Laju Inflasi
          </h2>
          <p className="text-xs text-gray-500 mb-4">
            Perbandingan return tahunan masing-masing aset (%) terhadap tingkat
            inflasi
          </p>
          <ResponsiveContainer height={300} width="100%">
            <LineChart
              data={chartData}
              margin={{ top: 10, right: 20, left: 0, bottom: 5 }}
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
      )}

      {/* Tabel Detail Aset */}
      {assets.length === 0 ? (
        <div className="p-6 bg-white shadow-sm rounded-lg border border-gray-100 text-gray-500">
          Belum ada aset investasi yang tercatat.
        </div>
      ) : (
        <div className="overflow-x-auto bg-white shadow-sm rounded-lg border border-gray-100">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b bg-bg-light text-sm text-navy/80">
                <th className="p-4 font-semibold">Nama Aset</th>
                <th className="p-4 font-semibold">Kelas</th>
                <th className="p-4 font-semibold">Return Tahunan</th>
                <th className="p-4 font-semibold">
                  Return Riil (Setelah Inflasi)
                </th>
                <th className="p-4 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {assets.map((asset) => {
                const netReturn = asset.net_real_return_pct;
                return (
                  <tr
                    key={asset.asset_id}
                    className="border-b last:border-b-0 hover:bg-bg-light/50 transition-colors"
                  >
                    <td className="p-4 font-medium text-navy">
                      {asset.asset_name}
                    </td>
                    <td className="p-4 text-gray-600">{asset.asset_class}</td>
                    <td className="p-4 text-navy">
                      {asset.annual_return_rate_pct}%
                    </td>
                    <td
                      className={`p-4 font-semibold ${
                        netReturn > 0 ? 'text-emerald' : 'text-red-600'
                      }`}
                    >
                      {netReturn > 0 ? `+${netReturn}%` : `${netReturn}%`}
                    </td>
                    <td className="p-4">
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
