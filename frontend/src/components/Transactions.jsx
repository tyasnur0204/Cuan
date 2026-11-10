import { useEffect, useRef, useState } from 'react';
import api from '../services/api';

const formatCurrency = (value) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(value ?? 0);
};

const getInitialFormState = () => ({
  amount: '',
  type: 'Expense',
  category: '',
  account_id: '',
  transaction_date: new Date().toISOString().split('T')[0],
  is_business: false,
});

const Transactions = () => {
  const [formData, setFormData] = useState(getInitialFormState);
  const [accounts, setAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const successTimerRef = useRef(null);

  const fetchAccountsAndTransactions = async () => {
    try {
      const [accountsRes, txRes] = await Promise.all([
        api.get('/accounts'),
        api.get('/transactions'),
      ]);
      setAccounts(accountsRes.data ?? []);
      setTransactions(txRes.data ?? []);
    } catch {
      // Tetap izinkan input manual jika data awal gagal diambil
    }
  };

  useEffect(() => {
    fetchAccountsAndTransactions();

    return () => {
      if (successTimerRef.current) {
        clearTimeout(successTimerRef.current);
      }
    };
  }, []);

  const handleChange = (e) => {
    const { name, type, value, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSuccessMessage('');
    setErrorMessage('');

    try {
      const payload = {
        amount: Number(formData.amount),
        type: formData.type,
        category: formData.category,
        account_id: formData.account_id,
        transaction_date: formData.transaction_date,
        is_business: formData.is_business,
      };

      await api.post('/transactions', payload);
      setFormData(getInitialFormState());
      setSuccessMessage('Transaksi berhasil dicatat!');

      if (successTimerRef.current) {
        clearTimeout(successTimerRef.current);
      }
      successTimerRef.current = setTimeout(() => {
        setSuccessMessage('');
      }, 3000);

      await fetchAccountsAndTransactions();
    } catch (err) {
      const detail = err.response?.data?.detail;
      const errorMsg = Array.isArray(detail)
        ? detail.map((d) => `${d.loc?.join('.')}: ${d.msg}`).join(', ')
        : detail || err.message || 'Gagal mencatat transaksi';
      setErrorMessage(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const accountMap = Object.fromEntries(
    accounts.map((acc) => [acc.id, acc.name])
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy">Transaksi</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Catat pemasukan dan pengeluaran serta pantau riwayat terbaru
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-5 space-y-4">
          {successMessage && (
            <div
              role="alert"
              className="p-4 bg-green-50 border border-green-200 text-green-800 rounded-lg shadow-sm text-sm font-medium"
            >
              {successMessage}
            </div>
          )}

          {errorMessage && (
            <div
              role="alert"
              className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg shadow-sm text-sm font-medium"
            >
              Error: {errorMessage}
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            className="space-y-4 p-6 bg-white shadow-sm rounded-lg border border-gray-100"
          >
            <h2 className="text-base font-semibold text-navy">
              Catat Transaksi Baru
            </h2>

            <div>
              <label className="block text-sm font-medium text-navy mb-1">
                Akun
              </label>
              {accounts.length > 0 ? (
                <select
                  name="account_id"
                  value={formData.account_id}
                  onChange={handleChange}
                  required
                  className="w-full p-2.5 border border-gray-200 rounded-lg text-navy bg-white focus:outline-none focus:ring-2 focus:ring-emerald/30 focus:border-emerald"
                >
                  <option value="">-- Pilih Akun --</option>
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({acc.type}
                      {acc.is_business_account ? ' · Usaha' : ''}) —{' '}
                      {formatCurrency(acc.balance)}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  name="account_id"
                  value={formData.account_id}
                  onChange={handleChange}
                  required
                  placeholder="Masukkan UUID akun"
                  className="w-full p-2.5 border border-gray-200 rounded-lg text-navy focus:outline-none focus:ring-2 focus:ring-emerald/30 focus:border-emerald"
                />
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-navy mb-1">
                Tipe
              </label>
              <select
                name="type"
                value={formData.type}
                onChange={handleChange}
                required
                className="w-full p-2.5 border border-gray-200 rounded-lg text-navy bg-white focus:outline-none focus:ring-2 focus:ring-emerald/30 focus:border-emerald"
              >
                <option value="Income">Income</option>
                <option value="Expense">Expense</option>
              </select>
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
                placeholder="Contoh: Makan, Freelance"
                className="w-full p-2.5 border border-gray-200 rounded-lg text-navy focus:outline-none focus:ring-2 focus:ring-emerald/30 focus:border-emerald"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-navy mb-1">
                Nominal
              </label>
              <input
                type="number"
                name="amount"
                value={formData.amount}
                onChange={handleChange}
                required
                min="0.01"
                step="any"
                placeholder="0"
                className="w-full p-2.5 border border-gray-200 rounded-lg text-navy focus:outline-none focus:ring-2 focus:ring-emerald/30 focus:border-emerald"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-navy mb-1">
                Tanggal
              </label>
              <input
                type="date"
                name="transaction_date"
                value={formData.transaction_date}
                onChange={handleChange}
                required
                className="w-full p-2.5 border border-gray-200 rounded-lg text-navy focus:outline-none focus:ring-2 focus:ring-emerald/30 focus:border-emerald"
              />
            </div>

            <div className="pt-1">
              <label className="flex items-center justify-between gap-3 cursor-pointer p-3 rounded-lg border border-gray-200 bg-bg-light/60 hover:bg-bg-light transition-colors">
                <span className="text-sm font-medium text-navy">
                  Tandai sebagai Transaksi Usaha (PhoBo/Proyek)
                </span>
                <div className="relative inline-flex items-center shrink-0">
                  <input
                    type="checkbox"
                    name="is_business"
                    checked={formData.is_business}
                    onChange={handleChange}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-300 rounded-full peer peer-focus:ring-2 peer-focus:ring-emerald/30 peer-checked:bg-emerald after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full peer-checked:after:border-white" />
                </div>
              </label>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className={`w-full py-2.5 px-4 bg-emerald text-white font-medium rounded-lg transition-colors ${
                isSubmitting
                  ? 'opacity-50 cursor-not-allowed'
                  : 'hover:bg-emerald/90'
              }`}
            >
              {isSubmitting ? 'Menyimpan...' : 'Simpan Transaksi'}
            </button>
          </form>
        </div>

        <div className="lg:col-span-7 bg-white shadow-sm rounded-lg border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-base font-semibold text-navy">
              Riwayat Transaksi Terbaru
            </h2>
            <span className="text-xs font-medium bg-bg-light text-navy px-2.5 py-1 rounded-full">
              {transactions.length} Transaksi
            </span>
          </div>

          {transactions.length === 0 ? (
            <div className="p-6 text-sm text-gray-500">
              Belum ada transaksi tercatat.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b bg-bg-light text-xs text-navy/80">
                    <th className="p-4 font-semibold">Tanggal</th>
                    <th className="p-4 font-semibold">Kategori</th>
                    <th className="p-4 font-semibold">Akun</th>
                    <th className="p-4 font-semibold text-right">Nominal</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => {
                    const isIncome = tx.type === 'Income';
                    return (
                      <tr
                        key={tx.id}
                        className="border-b last:border-b-0 text-sm hover:bg-bg-light/50"
                      >
                        <td className="p-4 text-gray-600">
                          {tx.transaction_date}
                        </td>
                        <td className="p-4 font-medium text-navy">
                          <div className="flex items-center gap-2">
                            <span>{tx.category}</span>
                            {tx.is_business && (
                              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald/10 text-emerald">
                                Usaha
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-4 text-gray-600">
                          {accountMap[tx.account_id] || tx.account_id}
                        </td>
                        <td
                          className={`p-4 font-semibold text-right ${
                            isIncome ? 'text-emerald' : 'text-red-600'
                          }`}
                        >
                          {isIncome ? '+' : '-'}
                          {formatCurrency(tx.amount)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Transactions;
