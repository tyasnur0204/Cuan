import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../services/api';

const MONTH_OPTIONS = [
  { value: '', label: 'Semua Bulan' },
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

const getInitialFormState = () => ({
  amount: '',
  type: 'Expense',
  category: '',
  account_id: '',
  destination_account_id: '',
  transaction_date: new Date().toISOString().split('T')[0],
  notes: '',
  is_business: false,
});

const PAGE_SIZE = 8;

const Transactions = () => {
  const [searchParams] = useSearchParams();
  const now = new Date();
  const [formData, setFormData] = useState(getInitialFormState);
  const [accounts, setAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Filters
  const [activeTab, setActiveTab] = useState('ALL');
  const [filterMonth, setFilterMonth] = useState('');
  const [filterYear, setFilterYear] = useState(String(now.getFullYear()));
  const [filterCategory, setFilterCategory] = useState('');
  const [filterAccount, setFilterAccount] = useState('');
  const [searchText, setSearchText] = useState(searchParams.get('search') || '');
  const [currentPage, setCurrentPage] = useState(1);

  const amountInputRef = useRef(null);
  const successTimerRef = useRef(null);

  useEffect(() => {
    const q = searchParams.get('search') || '';
    setSearchText(q);
    if (searchParams.get('new') === '1' && amountInputRef.current) {
      amountInputRef.current.focus();
    }
  }, [searchParams]);

  const fetchAccounts = async () => {
    try {
      const storedUser = JSON.parse(localStorage.getItem('user') || 'null');
      const res = await api.get('/accounts', {
        params: storedUser?.id ? { user_id: storedUser.id } : {},
      });
      const accs = res.data ?? [];
      setAccounts(accs);
      if (accs.length > 0) {
        setFormData((prev) => ({
          ...prev,
          account_id: prev.account_id || accs[0].id,
        }));
      }
    } catch {
      // Fallback
    }
  };

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const params = { limit: 500 };
      if (activeTab !== 'ALL') params.type = activeTab;
      if (filterMonth) params.month = Number(filterMonth);
      if (filterYear) params.year = Number(filterYear);
      if (filterCategory) params.category = filterCategory;
      if (filterAccount) params.account_id = filterAccount;
      if (searchText.trim()) params.search = searchText.trim();

      const res = await api.get('/transactions', { params });
      setTransactions(res.data ?? []);
      setCurrentPage(1);
    } catch (err) {
      setErrorMessage(
        err.response?.data?.detail || err.message || 'Gagal memuat transaksi'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
    return () => {
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
    };
  }, []);

  useEffect(() => {
    fetchTransactions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, filterMonth, filterYear, filterCategory, filterAccount, searchText]);

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
        notes: formData.notes.trim() || null,
        is_business: formData.is_business,
      };
      if (formData.type === 'Transfer' && formData.destination_account_id) {
        payload.destination_account_id = formData.destination_account_id;
      }

      await api.post('/transactions', payload);
      setFormData((prev) => ({
        ...getInitialFormState(),
        account_id: prev.account_id,
      }));
      setSuccessMessage('Transaksi berhasil dicatat!');

      if (successTimerRef.current) clearTimeout(successTimerRef.current);
      successTimerRef.current = setTimeout(() => setSuccessMessage(''), 3000);

      await Promise.all([fetchAccounts(), fetchTransactions()]);
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

  const handleDelete = async (txId) => {
    if (!window.confirm('Hapus transaksi ini? Saldo akun akan disesuaikan kembali.')) {
      return;
    }
    try {
      await api.delete(`/transactions/${txId}`);
      await Promise.all([fetchAccounts(), fetchTransactions()]);
    } catch (err) {
      setErrorMessage(
        err.response?.data?.detail || err.message || 'Gagal menghapus transaksi'
      );
    }
  };

  const accountMap = Object.fromEntries(accounts.map((acc) => [acc.id, acc.name]));
  const uniqueCategories = [...new Set(transactions.map((t) => t.category))];

  const totalPages = Math.max(1, Math.ceil(transactions.length / PAGE_SIZE));
  const paginatedTxs = transactions.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy">Transaksi</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Catat arus kas harian, usaha PhoBo, dan transfer antar akun
          </p>
        </div>

        <button
          type="button"
          onClick={() => amountInputRef.current?.focus()}
          className="px-4 py-2.5 bg-emerald text-white text-sm font-semibold rounded-lg hover:bg-emerald/90 transition-colors self-start sm:self-auto"
        >
          + Tambah Transaksi
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 pb-3">
        {[
          { key: 'ALL', label: 'Semua' },
          { key: 'Income', label: 'Pemasukan' },
          { key: 'Expense', label: 'Pengeluaran' },
          { key: 'Transfer', label: 'Transfer' },
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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Form Tambah Transaksi */}
        <div className="lg:col-span-4 space-y-4">
          {successMessage && (
            <div
              role="alert"
              className="p-3.5 bg-emerald/10 border border-emerald/20 text-emerald rounded-lg text-sm font-medium"
            >
              {successMessage}
            </div>
          )}

          {errorMessage && (
            <div
              role="alert"
              className="p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm font-medium"
            >
              Error: {errorMessage}
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            className="space-y-4 p-5 bg-white shadow-sm rounded-xl border border-gray-100"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-navy">
                Tambah Transaksi
              </h2>
              {accounts.length === 0 && (
                <Link
                  to="/settings"
                  className="text-xs font-semibold text-emerald hover:underline"
                >
                  + Buat Akun
                </Link>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-navy mb-1">
                Tipe Transaksi
              </label>
              <select
                name="type"
                value={formData.type}
                onChange={handleChange}
                required
                className="w-full p-2.5 text-sm border border-gray-200 rounded-lg text-navy bg-white focus:outline-none focus:ring-2 focus:ring-emerald/30 focus:border-emerald"
              >
                <option value="Expense">Pengeluaran (Expense)</option>
                <option value="Income">Pemasukan (Income)</option>
                <option value="Transfer">Transfer</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-navy mb-1">
                Akun Sumber
              </label>
              {accounts.length > 0 ? (
                <select
                  name="account_id"
                  value={formData.account_id}
                  onChange={handleChange}
                  required
                  className="w-full p-2.5 text-sm border border-gray-200 rounded-lg text-navy bg-white focus:outline-none focus:ring-2 focus:ring-emerald/30 focus:border-emerald"
                >
                  <option value="">-- Pilih Akun --</option>
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({acc.type}) — {formatCurrency(acc.balance)}
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
                  placeholder="Buat akun dulu di Pengaturan atau isi UUID"
                  className="w-full p-2.5 text-sm border border-gray-200 rounded-lg text-navy focus:outline-none focus:ring-2 focus:ring-emerald/30 focus:border-emerald"
                />
              )}
            </div>

            {formData.type === 'Transfer' && accounts.length > 1 && (
              <div>
                <label className="block text-xs font-medium text-navy mb-1">
                  Akun Tujuan (Opsional)
                </label>
                <select
                  name="destination_account_id"
                  value={formData.destination_account_id}
                  onChange={handleChange}
                  className="w-full p-2.5 text-sm border border-gray-200 rounded-lg text-navy bg-white focus:outline-none focus:ring-2 focus:ring-emerald/30 focus:border-emerald"
                >
                  <option value="">-- Pilih Akun Tujuan --</option>
                  {accounts
                    .filter((a) => a.id !== formData.account_id)
                    .map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} ({acc.type})
                      </option>
                    ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-navy mb-1">
                Nominal (Rp)
              </label>
              <input
                ref={amountInputRef}
                type="number"
                name="amount"
                value={formData.amount}
                onChange={handleChange}
                required
                min="0.01"
                step="any"
                placeholder="100000"
                className="w-full p-2.5 text-sm border border-gray-200 rounded-lg text-navy focus:outline-none focus:ring-2 focus:ring-emerald/30 focus:border-emerald"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
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
                  placeholder="Makan, Freelance"
                  className="w-full p-2.5 text-sm border border-gray-200 rounded-lg text-navy focus:outline-none focus:ring-2 focus:ring-emerald/30 focus:border-emerald"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-navy mb-1">
                  Tanggal
                </label>
                <input
                  type="date"
                  name="transaction_date"
                  value={formData.transaction_date}
                  onChange={handleChange}
                  required
                  className="w-full p-2.5 text-sm border border-gray-200 rounded-lg text-navy focus:outline-none focus:ring-2 focus:ring-emerald/30 focus:border-emerald"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-navy mb-1">
                Catatan (Opsional)
              </label>
              <input
                type="text"
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                placeholder="Keterangan singkat..."
                className="w-full p-2.5 text-sm border border-gray-200 rounded-lg text-navy focus:outline-none focus:ring-2 focus:ring-emerald/30 focus:border-emerald"
              />
            </div>

            <label className="flex items-center justify-between gap-3 cursor-pointer p-3 rounded-lg border border-gray-200 bg-bg-light/60 hover:bg-bg-light transition-colors">
              <span className="text-xs font-medium text-navy">
                Transaksi Usaha (PhoBo / Proyek)
              </span>
              <div className="relative inline-flex items-center shrink-0">
                <input
                  type="checkbox"
                  name="is_business"
                  checked={formData.is_business}
                  onChange={handleChange}
                  className="sr-only peer"
                />
                <div className="w-10 h-5 bg-gray-300 rounded-full peer peer-checked:bg-emerald after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-5" />
              </div>
            </label>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 px-4 bg-emerald text-white text-sm font-semibold rounded-lg hover:bg-emerald/90 transition-colors disabled:opacity-50"
            >
              {isSubmitting ? 'Menyimpan...' : 'Simpan Transaksi'}
            </button>
          </form>
        </div>

        {/* Filter Bar & Tabel Riwayat Transaksi */}
        <div className="lg:col-span-8 bg-white shadow-sm rounded-xl border border-gray-100 overflow-hidden">
          <div className="p-4 border-b border-gray-100 grid grid-cols-2 sm:grid-cols-4 gap-3 bg-gray-50/60">
            <select
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
              className="p-2 text-xs border border-gray-200 rounded-lg bg-white text-navy"
            >
              {MONTH_OPTIONS.map((m) => (
                <option key={m.label} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>

            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="p-2 text-xs border border-gray-200 rounded-lg bg-white text-navy"
            >
              <option value="">Semua Kategori</option>
              {uniqueCategories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>

            <select
              value={filterAccount}
              onChange={(e) => setFilterAccount(e.target.value)}
              className="p-2 text-xs border border-gray-200 rounded-lg bg-white text-navy"
            >
              <option value="">Semua Akun</option>
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name}
                </option>
              ))}
            </select>

            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Cari..."
              className="p-2 text-xs border border-gray-200 rounded-lg bg-white text-navy"
            />
          </div>

          {loading ? (
            <div className="p-8 text-center text-sm text-gray-500">
              Memuat riwayat transaksi...
            </div>
          ) : transactions.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-500">
              Belum ada transaksi yang sesuai filter.
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b bg-bg-light text-xs text-navy/80">
                      <th className="p-3.5 font-semibold">Tanggal</th>
                      <th className="p-3.5 font-semibold">Kategori</th>
                      <th className="p-3.5 font-semibold">Keterangan</th>
                      <th className="p-3.5 font-semibold">Akun</th>
                      <th className="p-3.5 font-semibold text-right">Jumlah</th>
                      <th className="p-3.5 font-semibold text-center">Tipe</th>
                      <th className="p-3.5 font-semibold text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedTxs.map((tx) => {
                      const isIncome = tx.type === 'Income';
                      const isTransfer = tx.type === 'Transfer';
                      return (
                        <tr
                          key={tx.id}
                          className="border-b last:border-b-0 text-sm hover:bg-bg-light/50"
                        >
                          <td className="p-3.5 text-gray-600 whitespace-nowrap text-xs">
                            {tx.transaction_date}
                          </td>
                          <td className="p-3.5 font-medium text-navy">
                            <div className="flex items-center gap-1.5">
                              <span>{tx.category}</span>
                              {tx.is_business && (
                                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald/10 text-emerald">
                                  Usaha
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-3.5 text-xs text-gray-500 max-w-[160px] truncate">
                            {tx.notes || '—'}
                          </td>
                          <td className="p-3.5 text-xs text-gray-600">
                            {accountMap[tx.account_id] || '-'}
                          </td>
                          <td
                            className={`p-3.5 font-semibold text-right whitespace-nowrap ${
                              isIncome
                                ? 'text-emerald'
                                : isTransfer
                                  ? 'text-navy'
                                  : 'text-red-600'
                            }`}
                          >
                            {isIncome ? '+' : isTransfer ? '' : '-'}
                            {formatCurrency(tx.amount)}
                          </td>
                          <td className="p-3.5 text-center">
                            <span
                              className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${
                                isIncome
                                  ? 'bg-emerald/10 text-emerald'
                                  : isTransfer
                                    ? 'bg-blue-50 text-blue-700'
                                    : 'bg-red-50 text-red-700'
                              }`}
                            >
                              {tx.type}
                            </span>
                          </td>
                          <td className="p-3.5 text-center">
                            <button
                              type="button"
                              onClick={() => handleDelete(tx.id)}
                              title="Hapus transaksi"
                              className="text-xs text-gray-400 hover:text-red-600 transition-colors px-1.5 py-1"
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

              {totalPages > 1 && (
                <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                  <span>
                    Menampilkan {(currentPage - 1) * PAGE_SIZE + 1}–
                    {Math.min(currentPage * PAGE_SIZE, transactions.length)} dari{' '}
                    {transactions.length}
                  </span>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                      (page) => (
                        <button
                          key={page}
                          type="button"
                          onClick={() => setCurrentPage(page)}
                          className={`w-7 h-7 rounded-md font-semibold ${
                            currentPage === page
                              ? 'bg-emerald text-white'
                              : 'bg-bg-light text-navy hover:bg-gray-200'
                          }`}
                        >
                          {page}
                        </button>
                      )
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Transactions;
