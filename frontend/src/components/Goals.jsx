import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../services/api';
import CategoryIcon from './CategoryIcon';

const GOAL_CATEGORIES = [
  'Barang Impian',
  'Elektronik',
  'Kendaraan',
  'Dana Darurat',
  'Liburan',
  'Pendidikan',
  'Rumah & Properti',
];

const ITEM_PRESETS = [
  { title: 'Laptop Kerja', category: 'Elektronik', target: '10000000' },
  { title: 'HP Baru', category: 'Elektronik', target: '5000000' },
  { title: 'Motor Baru', category: 'Kendaraan', target: '22000000' },
  { title: 'Dana Darurat', category: 'Dana Darurat', target: '15000000' },
  { title: 'Liburan Akhir Tahun', category: 'Liburan', target: '4000000' },
];

const QUICK_DEPOSIT_AMOUNTS = [
  { label: '+20 rb', value: 20000 },
  { label: '+50 rb', value: 50000 },
  { label: '+100 rb', value: 100000 },
  { label: '+250 rb', value: 250000 },
  { label: '+500 rb', value: 500000 },
  { label: '+1 jt', value: 1000000 },
];

const formatCurrency = (value) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(value ?? 0);
};

const todayLocalIso = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const getPacingHint = (targetDateStr, remaining) => {
  if (!targetDateStr || remaining <= 0) return null;
  const target = new Date(`${targetDateStr}T00:00:00`);
  const today = new Date(`${todayLocalIso()}T00:00:00`);
  const diffDays = Math.ceil((target - today) / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return 'Tenggat sudah lewat — tetap bisa diisi kapan saja';
  if (diffDays <= 14) {
    const perDay = Math.ceil(remaining / diffDays);
    return `${diffDays} hari lagi · ±${formatCurrency(perDay)}/hari`;
  }
  const weeks = Math.max(1, Math.ceil(diffDays / 7));
  const perWeek = Math.ceil(remaining / weeks);
  return `${diffDays} hari lagi · ±${formatCurrency(perWeek)}/minggu`;
};

const Goals = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [goals, setGoals] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterTab, setFilterTab] = useState('all');

  const [showCreateForm, setShowCreateForm] = useState(
    () => searchParams.get('new') === '1'
  );
  const [createForm, setCreateForm] = useState({
    title: '',
    category: 'Barang Impian',
    target_amount: '',
    initial_amount: '',
    account_id: '',
    target_date: '',
    notes: '',
  });
  const [creating, setCreating] = useState(false);

  // Top-up / Withdraw modal state
  const [txGoal, setTxGoal] = useState(null);
  const [txType, setTxType] = useState('deposit');
  const [txAmount, setTxAmount] = useState('');
  const [txDate, setTxDate] = useState(todayLocalIso);
  const [txAccountId, setTxAccountId] = useState('');
  const [txNotes, setTxNotes] = useState('');
  const [txSubmitting, setTxSubmitting] = useState(false);

  // History & Edit modals
  const [historyGoalId, setHistoryGoalId] = useState(null);
  const [editGoal, setEditGoal] = useState(null);
  const [editForm, setEditForm] = useState({
    title: '',
    category: 'Barang Impian',
    target_amount: '',
    target_date: '',
    notes: '',
  });
  const [editSubmitting, setEditSubmitting] = useState(false);

  const [successMessage, setSuccessMessage] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  const loadData = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      let storedUserId;
      try {
        storedUserId = JSON.parse(localStorage.getItem('user') || 'null')?.id;
      } catch {
        storedUserId = undefined;
      }

      const [goalsRes, accRes] = await Promise.all([
        api.get('/goals'),
        api.get('/accounts', {
          params: storedUserId ? { user_id: storedUserId } : {},
        }),
      ]);
      const list = goalsRes.data ?? [];
      setGoals(list);
      setAccounts(accRes.data ?? []);
      if (list.length === 0) {
        setShowCreateForm(true);
      }
    } catch (err) {
      setErrorMessage(
        err.response?.data?.detail ||
          err.message ||
          'Gagal memuat data target tabungan'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setShowCreateForm(true);
      const next = new URLSearchParams(searchParams);
      next.delete('new');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setCreating(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      const initAmt = Number(createForm.initial_amount || 0);
      const payload = {
        title: createForm.title.trim(),
        category: createForm.category.trim() || 'Barang Impian',
        target_amount: Number(createForm.target_amount),
        initial_amount: initAmt > 0 ? initAmt : 0,
        account_id:
          initAmt > 0 && createForm.account_id ? createForm.account_id : null,
        target_date: createForm.target_date || null,
        notes: createForm.notes.trim() || null,
      };

      const res = await api.post('/goals', payload);
      setSuccessMessage(
        `Target "${res.data?.title || payload.title}" berhasil dibuat! Anda bisa mengisi tabungannya kapan saja.`
      );
      setCreateForm({
        title: '',
        category: 'Barang Impian',
        target_amount: '',
        initial_amount: '',
        account_id: '',
        target_date: '',
        notes: '',
      });
      setShowCreateForm(false);
      await loadData();
    } catch (err) {
      const detail = err.response?.data?.detail;
      const msg = Array.isArray(detail)
        ? detail.map((d) => `${d.loc?.join('.')}: ${d.msg}`).join(', ')
        : detail || err.message || 'Gagal membuat target tabungan';
      setErrorMessage(msg);
    } finally {
      setCreating(false);
    }
  };

  const openContributeModal = (goal, mode = 'deposit') => {
    setTxGoal(goal);
    setTxType(mode);
    setTxAmount('');
    setTxDate(todayLocalIso());
    setTxAccountId('');
    setTxNotes('');
    setErrorMessage(null);
  };

  const handleContributeSubmit = async (e) => {
    e.preventDefault();
    if (!txGoal) return;
    setTxSubmitting(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      const amt = Number(txAmount);
      const res = await api.post(`/goals/${txGoal.id}/contribute`, {
        type: txType,
        amount: amt,
        contribution_date: txDate || todayLocalIso(),
        account_id: txAccountId || null,
        notes: txNotes.trim() || null,
      });

      const updated = res.data;
      setSuccessMessage(
        txType === 'deposit'
          ? `Berhasil menabung ${formatCurrency(amt)} ke "${txGoal.title}" (${updated?.progress_pct ?? 0}%)!`
          : `Berhasil menarik ${formatCurrency(amt)} dari "${txGoal.title}".`
      );
      setTxGoal(null);
      await loadData();
    } catch (err) {
      const detail = err.response?.data?.detail;
      const msg = Array.isArray(detail)
        ? detail.map((d) => `${d.loc?.join('.')}: ${d.msg}`).join(', ')
        : detail || err.message || 'Gagal memproses setoran tabungan';
      setErrorMessage(msg);
    } finally {
      setTxSubmitting(false);
    }
  };

  const handleTogglePurchased = async (goal) => {
    setSuccessMessage(null);
    setErrorMessage(null);
    try {
      const nextPurchased = !goal.is_purchased;
      await api.patch(`/goals/${goal.id}`, { is_purchased: nextPurchased });
      setSuccessMessage(
        nextPurchased
          ? `Selamat! Target "${goal.title}" ditandai sudah terwujud / dibeli.`
          : `Target "${goal.title}" diaktifkan kembali.`
      );
      await loadData();
    } catch (err) {
      setErrorMessage(
        err.response?.data?.detail || err.message || 'Gagal memperbarui status target'
      );
    }
  };

  const openEditModal = (goal) => {
    setEditGoal(goal);
    setEditForm({
      title: goal.title || '',
      category: goal.category || 'Barang Impian',
      target_amount: String(Number(goal.target_amount || 0)),
      target_date: goal.target_date || '',
      notes: goal.notes || '',
    });
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editGoal) return;
    setEditSubmitting(true);
    setSuccessMessage(null);
    setErrorMessage(null);
    try {
      await api.patch(`/goals/${editGoal.id}`, {
        title: editForm.title.trim(),
        category: editForm.category.trim() || 'Barang Impian',
        target_amount: Number(editForm.target_amount),
        target_date: editForm.target_date || null,
        clear_target_date: !editForm.target_date,
        notes: editForm.notes.trim(),
      });
      setSuccessMessage(`Target "${editForm.title.trim()}" berhasil diperbarui.`);
      setEditGoal(null);
      await loadData();
    } catch (err) {
      setErrorMessage(
        err.response?.data?.detail || err.message || 'Gagal memperbarui target'
      );
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleDeleteGoal = async (goal) => {
    if (
      !window.confirm(
        `Hapus target tabungan "${goal.title}"? Riwayat setoran untuk target ini juga akan dihapus.`
      )
    ) {
      return;
    }
    setSuccessMessage(null);
    setErrorMessage(null);
    try {
      await api.delete(`/goals/${goal.id}`);
      setSuccessMessage(`Target "${goal.title}" dihapus.`);
      await loadData();
    } catch (err) {
      setErrorMessage(
        err.response?.data?.detail || err.message || 'Gagal menghapus target'
      );
    }
  };

  const handleDeleteContribution = async (goalId, contributionId) => {
    if (
      !window.confirm(
        'Batalkan catatan setoran/penarikan ini? Saldo target dan akun terkait akan disesuaikan kembali.'
      )
    ) {
      return;
    }
    setErrorMessage(null);
    try {
      await api.delete(`/goals/${goalId}/contributions/${contributionId}`);
      setSuccessMessage('Catatan transaksi tabungan berhasil dibatalkan.');
      await loadData();
    } catch (err) {
      setErrorMessage(
        err.response?.data?.detail || err.message || 'Gagal membatalkan catatan'
      );
    }
  };

  const activeGoals = goals.filter((g) => !g.is_purchased);
  const achievedGoals = goals.filter((g) => g.is_achieved && !g.is_purchased);
  const purchasedGoals = goals.filter((g) => g.is_purchased);

  const totalSavedAll = activeGoals.reduce(
    (acc, g) => acc + Number(g.saved_amount || 0),
    0
  );
  const totalTargetAll = activeGoals.reduce(
    (acc, g) => acc + Number(g.target_amount || 0),
    0
  );
  const totalRemainingAll = Math.max(0, totalTargetAll - totalSavedAll);
  const overallPct =
    totalTargetAll > 0
      ? Math.min(100, Math.round((totalSavedAll / totalTargetAll) * 100))
      : 0;

  const filteredGoals = goals.filter((g) => {
    if (filterTab === 'active') return !g.is_purchased && !g.is_achieved;
    if (filterTab === 'achieved') return g.is_achieved && !g.is_purchased;
    if (filterTab === 'purchased') return g.is_purchased;
    return true;
  });

  const historyGoal = goals.find((g) => g.id === historyGoalId) || null;

  // Live preview calculations inside Top-Up Modal
  const txCurrentSaved = Number(txGoal?.saved_amount || 0);
  const txTargetAmt = Number(txGoal?.target_amount || 0);
  const txDelta = Number(txAmount || 0);
  const txPreviewSaved =
    txType === 'deposit'
      ? txCurrentSaved + (Number.isFinite(txDelta) && txDelta > 0 ? txDelta : 0)
      : Math.max(
          0,
          txCurrentSaved - (Number.isFinite(txDelta) && txDelta > 0 ? txDelta : 0)
        );
  const txPreviewPct =
    txTargetAmt > 0
      ? Math.min(100, Math.round((txPreviewSaved / txTargetAmt) * 100))
      : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy">Target Tabungan</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Sisihkan dana untuk membeli barang impian — isi bebas kapan pun
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowCreateForm((prev) => !prev)}
          className="px-4 py-2.5 bg-emerald text-white text-sm font-semibold rounded-lg hover:bg-emerald/90 transition-colors shadow-sm self-start sm:self-auto"
        >
          {showCreateForm ? 'Tutup Form' : '+ Buat Target Baru'}
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-[#067F5B] to-[#056347] text-white rounded-xl shadow-sm p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wider text-white/80">
              Total Tabungan Aktif
            </p>
            <span className="text-[11px] font-semibold bg-white/20 px-2 py-0.5 rounded-full">
              {overallPct}%
            </span>
          </div>
          <p className="text-xl sm:text-2xl font-bold mt-2 tracking-tight">
            {formatCurrency(totalSavedAll)}
          </p>
          <div className="w-full bg-white/20 rounded-full h-1.5 mt-3 overflow-hidden">
            <div
              className="h-1.5 bg-white rounded-full transition-all duration-300"
              style={{ width: `${overallPct}%` }}
            />
          </div>
          <p className="text-[11px] text-white/80 mt-2">
            dari total target {formatCurrency(totalTargetAll)}
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
          <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
            Status Target
          </p>
          <p className="text-xl sm:text-2xl font-bold text-navy mt-2">
            {activeGoals.length} Target Aktif
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {achievedGoals.length} siap dibeli · {purchasedGoals.length} selesai dibeli
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
          <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
            Kekurangan Target Aktif
          </p>
          <p className="text-xl sm:text-2xl font-bold text-emerald mt-2">
            {totalRemainingAll === 0 && activeGoals.length > 0
              ? 'Semua Tercapai!'
              : formatCurrency(totalRemainingAll)}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Bisa diisi sedikit demi sedikit kapanpun
          </p>
        </div>
      </div>

      {successMessage && (
        <div
          role="status"
          className="p-3.5 bg-green-50 text-green-800 rounded-xl border border-green-200 text-sm font-medium"
        >
          {successMessage}
        </div>
      )}

      {errorMessage && (
        <div
          role="alert"
          className="p-3.5 bg-red-50 text-red-700 rounded-xl border border-red-200 text-sm font-medium flex items-center justify-between gap-3"
        >
          <span>Error: {errorMessage}</span>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-xs font-semibold underline shrink-0"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Collapsible Create Form */}
      {showCreateForm && (
        <div className="bg-white shadow-sm rounded-xl border border-gray-100 p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-navy">
                Buat Target Tabungan Baru
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Tentukan barang atau tujuan tabungan. Nominal pengisian bebas kapan saja.
              </p>
            </div>
            {goals.length > 0 && (
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="text-xs font-medium text-gray-500 hover:text-navy"
              >
                Sembunyikan
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-gray-500 mr-1">Inspirasi cepat:</span>
            {ITEM_PRESETS.map((preset) => (
              <button
                key={preset.title}
                type="button"
                onClick={() =>
                  setCreateForm((prev) => ({
                    ...prev,
                    title: preset.title,
                    category: preset.category,
                    target_amount: preset.target,
                  }))
                }
                className="text-[11px] px-2.5 py-1 rounded-full bg-bg-light text-navy hover:bg-emerald/10 hover:text-emerald font-medium transition-colors"
              >
                + {preset.title}
              </button>
            ))}
          </div>

          <form onSubmit={handleCreateSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-navy mb-1">
                  Nama Target / Barang
                </label>
                <input
                  type="text"
                  required
                  value={createForm.title}
                  onChange={(e) =>
                    setCreateForm((p) => ({ ...p, title: e.target.value }))
                  }
                  placeholder="Contoh: Beli Laptop / HP Baru"
                  className="w-full p-2.5 text-sm border border-gray-200 rounded-lg text-navy focus:outline-none focus:ring-2 focus:ring-emerald/30 focus:border-emerald"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-navy mb-1">
                  Target Dana (Rp)
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  step="any"
                  value={createForm.target_amount}
                  onChange={(e) =>
                    setCreateForm((p) => ({ ...p, target_amount: e.target.value }))
                  }
                  placeholder="5000000"
                  className="w-full p-2.5 text-sm border border-gray-200 rounded-lg text-navy focus:outline-none focus:ring-2 focus:ring-emerald/30 focus:border-emerald"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-navy mb-1">
                  Kategori
                </label>
                <select
                  value={createForm.category}
                  onChange={(e) =>
                    setCreateForm((p) => ({ ...p, category: e.target.value }))
                  }
                  className="w-full p-2.5 text-sm border border-gray-200 rounded-lg text-navy bg-white focus:outline-none focus:ring-2 focus:ring-emerald/30 focus:border-emerald"
                >
                  {GOAL_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-navy mb-1">
                  Setoran Awal (Rp · Opsional)
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={createForm.initial_amount}
                  onChange={(e) =>
                    setCreateForm((p) => ({ ...p, initial_amount: e.target.value }))
                  }
                  placeholder="0 (boleh diisi nanti)"
                  className="w-full p-2.5 text-sm border border-gray-200 rounded-lg text-navy focus:outline-none focus:ring-2 focus:ring-emerald/30 focus:border-emerald"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-navy mb-1">
                  Target Tanggal (Opsional)
                </label>
                <input
                  type="date"
                  value={createForm.target_date}
                  onChange={(e) =>
                    setCreateForm((p) => ({ ...p, target_date: e.target.value }))
                  }
                  className="w-full p-2.5 text-sm border border-gray-200 rounded-lg text-navy focus:outline-none focus:ring-2 focus:ring-emerald/30 focus:border-emerald"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-navy mb-1">
                  Catatan / Spesifikasi (Opsional)
                </label>
                <input
                  type="text"
                  value={createForm.notes}
                  onChange={(e) =>
                    setCreateForm((p) => ({ ...p, notes: e.target.value }))
                  }
                  placeholder="Contoh: Warna hitam, toko resmi"
                  className="w-full p-2.5 text-sm border border-gray-200 rounded-lg text-navy focus:outline-none focus:ring-2 focus:ring-emerald/30 focus:border-emerald"
                />
              </div>
            </div>

            {Number(createForm.initial_amount || 0) > 0 && accounts.length > 0 && (
              <div className="p-3 rounded-lg bg-bg-light border border-gray-200/80">
                <label className="block text-xs font-medium text-navy mb-1">
                  Ambil Setoran Awal dari Akun? (Opsional)
                </label>
                <select
                  value={createForm.account_id}
                  onChange={(e) =>
                    setCreateForm((p) => ({ ...p, account_id: e.target.value }))
                  }
                  className="w-full sm:max-w-md p-2 text-sm border border-gray-200 rounded-lg bg-white text-navy"
                >
                  <option value="">
                    Catat ke tabungan saja (tanpa ubah saldo akun)
                  </option>
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({formatCurrency(acc.balance)})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={creating}
                className={`px-5 py-2.5 bg-emerald text-white text-sm font-semibold rounded-lg transition-colors ${
                  creating
                    ? 'opacity-50 cursor-not-allowed'
                    : 'hover:bg-emerald/90'
                }`}
              >
                {creating ? 'Menyimpan...' : 'Simpan Target Tabungan'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filter Tabs */}
      {goals.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {[
            { key: 'all', label: `Semua (${goals.length})` },
            {
              key: 'active',
              label: `Berjalan (${goals.filter((g) => !g.is_purchased && !g.is_achieved).length})`,
            },
            {
              key: 'achieved',
              label: `Tercapai (${achievedGoals.length})`,
            },
            {
              key: 'purchased',
              label: `Sudah Dibeli (${purchasedGoals.length})`,
            },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setFilterTab(tab.key)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                filterTab === tab.key
                  ? 'bg-navy text-white'
                  : 'bg-white text-gray-600 border border-gray-200 hover:text-navy'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Goal Cards */}
      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {[...Array(2)].map((_, idx) => (
            <div
              key={idx}
              className="bg-white rounded-xl border border-gray-100 p-6 h-52 animate-pulse"
            />
          ))}
        </div>
      ) : filteredGoals.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-10 text-center space-y-2">
          <p className="text-base font-semibold text-navy">
            {goals.length === 0
              ? 'Belum Ada Target Tabungan'
              : 'Tidak ada target pada filter ini'}
          </p>
          <p className="text-xs text-gray-500 max-w-md mx-auto">
            {goals.length === 0
              ? 'Buat target barang yang ingin kamu beli — lalu isi tabungan sedikit demi sedikit kapan pun ada rezeki.'
              : 'Pilih tab Semua atau buat target tabungan baru.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {filteredGoals.map((goal) => {
            const saved = Number(goal.saved_amount || 0);
            const target = Number(goal.target_amount || 0);
            const remaining = Math.max(0, target - saved);
            const pct = Number(goal.progress_pct || 0);
            const pacingHint =
              !goal.is_purchased && !goal.is_achieved
                ? getPacingHint(goal.target_date, remaining)
                : null;
            const latestContrib = goal.contributions?.[0];

            return (
              <div
                key={goal.id}
                className={`bg-white rounded-xl shadow-sm border p-5 sm:p-6 flex flex-col justify-between gap-4 ${
                  goal.is_purchased
                    ? 'border-gray-200 opacity-90'
                    : goal.is_achieved
                      ? 'border-emerald/40 ring-1 ring-emerald/15'
                      : 'border-gray-100'
                }`}
              >
                <div className="space-y-4">
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <CategoryIcon category={goal.category} size="md" />
                      <div className="min-w-0">
                        <h3 className="text-base font-bold text-navy truncate">
                          {goal.title}
                        </h3>
                        <p className="text-xs text-gray-500 truncate">
                          {goal.category}
                          {goal.target_date ? ` · Target: ${goal.target_date}` : ' · Fleksibel'}
                        </p>
                      </div>
                    </div>

                    <span
                      className={`text-[11px] font-bold px-2.5 py-1 rounded-full shrink-0 ${
                        goal.is_purchased
                          ? 'bg-navy/10 text-navy'
                          : goal.is_achieved
                            ? 'bg-emerald/15 text-emerald'
                            : 'bg-bg-light text-navy'
                      }`}
                    >
                      {goal.is_purchased
                        ? 'Sudah Dibeli ✓'
                        : goal.is_achieved
                          ? 'Tercapai! 🎉'
                          : `${pct}%`}
                    </span>
                  </div>

                  {/* Progress & Amounts */}
                  <div className="space-y-2">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-lg font-bold text-emerald">
                        {formatCurrency(saved)}
                      </span>
                      <span className="text-xs text-gray-500">
                        dari {formatCurrency(target)}
                      </span>
                    </div>

                    <div className="w-full bg-bg-light rounded-full h-3 overflow-hidden">
                      <div
                        className={`h-3 rounded-full transition-all duration-300 ${
                          goal.is_purchased ? 'bg-navy' : 'bg-emerald'
                        }`}
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-gray-600">
                        {remaining === 0
                          ? saved > target
                            ? `Lebih ${formatCurrency(saved - target)}`
                            : 'Dana sudah mencukupi target!'
                          : `Kurang ${formatCurrency(remaining)}`}
                      </span>
                      {pacingHint && (
                        <span className="text-[11px] text-emerald font-medium">
                          {pacingHint}
                        </span>
                      )}
                    </div>
                  </div>

                  {goal.notes && (
                    <p className="text-xs text-gray-600 bg-bg-light rounded-lg px-3 py-2">
                      {goal.notes}
                    </p>
                  )}

                  {latestContrib && (
                    <p className="text-[11px] text-gray-400">
                      Terakhir{' '}
                      {latestContrib.type === 'withdraw' ? 'tarik' : 'nabung'}{' '}
                      {formatCurrency(latestContrib.amount)} pada{' '}
                      {latestContrib.contribution_date}
                      {latestContrib.account_name
                        ? ` (${latestContrib.account_name})`
                        : ''}
                    </p>
                  )}
                </div>

                {/* Action Bar */}
                <div className="pt-3 border-t border-gray-100 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openContributeModal(goal, 'deposit')}
                    className="flex-1 min-w-[140px] py-2 px-3 rounded-lg bg-emerald text-white text-xs font-bold hover:bg-emerald/90 transition-colors shadow-sm"
                  >
                    + Isi Tabungan
                  </button>

                  {saved > 0 && (
                    <button
                      type="button"
                      onClick={() => openContributeModal(goal, 'withdraw')}
                      className="py-2 px-3 rounded-lg bg-bg-light text-navy text-xs font-semibold hover:bg-gray-200/70 transition-colors"
                    >
                      Tarik
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setHistoryGoalId(goal.id)}
                    className="py-2 px-3 rounded-lg bg-bg-light text-navy text-xs font-semibold hover:bg-gray-200/70 transition-colors"
                  >
                    Riwayat ({goal.contributions?.length || 0})
                  </button>

                  {(goal.is_achieved || goal.is_purchased) && (
                    <button
                      type="button"
                      onClick={() => handleTogglePurchased(goal)}
                      className="py-2 px-3 rounded-lg bg-emerald/10 text-emerald text-xs font-semibold hover:bg-emerald/20 transition-colors"
                    >
                      {goal.is_purchased ? 'Aktifkan Lagi' : 'Tandai Dibeli'}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => openEditModal(goal)}
                    className="py-2 px-2.5 rounded-lg text-xs font-medium text-gray-500 hover:text-navy hover:bg-bg-light transition-colors"
                  >
                    Edit
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDeleteGoal(goal)}
                    className="py-2 px-2.5 rounded-lg text-xs font-medium text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                  >
                    Hapus
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Isi Tabungan / Tarik Dana */}
      {txGoal && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-navy/50 backdrop-blur-sm p-0 sm:p-4"
          onClick={() => setTxGoal(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-xl border border-gray-100 p-5 sm:p-6 space-y-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-navy">
                  {txType === 'deposit' ? 'Isi Tabungan' : 'Tarik Tabungan'} —{' '}
                  {txGoal.title}
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Saldo sekarang: {formatCurrency(txCurrentSaved)} dari{' '}
                  {formatCurrency(txTargetAmt)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setTxGoal(null)}
                className="text-gray-400 hover:text-navy p-1"
                aria-label="Tutup modal"
              >
                ✕
              </button>
            </div>

            {/* Switch Setor vs Tarik */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-bg-light rounded-xl">
              <button
                type="button"
                onClick={() => setTxType('deposit')}
                className={`py-2 text-xs font-semibold rounded-lg transition-all ${
                  txType === 'deposit'
                    ? 'bg-emerald text-white shadow-sm'
                    : 'text-gray-500 hover:text-navy'
                }`}
              >
                + Setor Nabung
              </button>
              <button
                type="button"
                onClick={() => setTxType('withdraw')}
                disabled={txCurrentSaved <= 0}
                className={`py-2 text-xs font-semibold rounded-lg transition-all ${
                  txType === 'withdraw'
                    ? 'bg-navy text-white shadow-sm'
                    : 'text-gray-500 hover:text-navy disabled:opacity-40'
                }`}
              >
                - Tarik Dana
              </button>
            </div>

            {/* Live Progress Preview */}
            <div className="rounded-xl bg-bg-light p-3 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500">Simulasi sesudah transaksi:</span>
                <span className="font-bold text-emerald">
                  {formatCurrency(txPreviewSaved)} ({txPreviewPct}%)
                </span>
              </div>
              <div className="w-full bg-white rounded-full h-2 overflow-hidden">
                <div
                  className="h-2 bg-emerald rounded-full transition-all duration-200"
                  style={{ width: `${txPreviewPct}%` }}
                />
              </div>
            </div>

            {/* Quick Amount Chips */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-medium text-gray-500">
                Pilih nominal cepat:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {txType === 'deposit' ? (
                  <>
                    {QUICK_DEPOSIT_AMOUNTS.map((item) => (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => setTxAmount(String(item.value))}
                        className="text-xs px-2.5 py-1 rounded-full bg-emerald/10 text-emerald font-semibold hover:bg-emerald/20 transition-colors"
                      >
                        {item.label}
                      </button>
                    ))}
                    {txTargetAmt > txCurrentSaved && (
                      <button
                        type="button"
                        onClick={() =>
                          setTxAmount(String(txTargetAmt - txCurrentSaved))
                        }
                        className="text-xs px-2.5 py-1 rounded-full bg-navy text-white font-semibold hover:bg-navy/90 transition-colors"
                      >
                        Genapkan Sisa ({formatCurrency(txTargetAmt - txCurrentSaved)})
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    {[0.25, 0.5, 1].map((ratio) => {
                      const val = Math.round(txCurrentSaved * ratio);
                      if (val <= 0) return null;
                      return (
                        <button
                          key={ratio}
                          type="button"
                          onClick={() => setTxAmount(String(val))}
                          className="text-xs px-2.5 py-1 rounded-full bg-bg-light border border-gray-200 text-navy font-semibold hover:bg-gray-100"
                        >
                          {ratio === 1 ? 'Tarik Semua' : `${ratio * 100}%`} (
                          {formatCurrency(val)})
                        </button>
                      );
                    })}
                  </>
                )}
              </div>
            </div>

            <form onSubmit={handleContributeSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-navy mb-1">
                  Nominal (Rp)
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  max={txType === 'withdraw' ? txCurrentSaved : undefined}
                  step="any"
                  value={txAmount}
                  onChange={(e) => setTxAmount(e.target.value)}
                  placeholder="Contoh: 100000"
                  className="w-full p-2.5 text-sm border border-gray-200 rounded-lg text-navy focus:outline-none focus:ring-2 focus:ring-emerald/30 focus:border-emerald"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-navy mb-1">
                    Tanggal
                  </label>
                  <input
                    type="date"
                    required
                    value={txDate}
                    onChange={(e) => setTxDate(e.target.value)}
                    className="w-full p-2.5 text-sm border border-gray-200 rounded-lg text-navy"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-navy mb-1">
                    Catatan (Opsional)
                  </label>
                  <input
                    type="text"
                    value={txNotes}
                    onChange={(e) => setTxNotes(e.target.value)}
                    placeholder="Sisa jajan / bonus"
                    className="w-full p-2.5 text-sm border border-gray-200 rounded-lg text-navy"
                  />
                </div>
              </div>

              {accounts.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-navy mb-1">
                    {txType === 'deposit'
                      ? 'Sumber Dana Akun (Opsional)'
                      : 'Kembalikan ke Akun (Opsional)'}
                  </label>
                  <select
                    value={txAccountId}
                    onChange={(e) => setTxAccountId(e.target.value)}
                    className="w-full p-2.5 text-sm border border-gray-200 rounded-lg bg-white text-navy"
                  >
                    <option value="">
                      Catat ke tabungan saja (tanpa ubah saldo akun)
                    </option>
                    {accounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} ({formatCurrency(acc.balance)})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <button
                type="submit"
                disabled={txSubmitting}
                className={`w-full py-2.5 px-4 rounded-xl text-white text-sm font-semibold transition-colors ${
                  txType === 'deposit'
                    ? 'bg-emerald hover:bg-emerald/90'
                    : 'bg-navy hover:bg-navy/90'
                } ${txSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {txSubmitting
                  ? 'Memproses...'
                  : txType === 'deposit'
                    ? 'Simpan Setoran Tabungan'
                    : 'Konfirmasi Penarikan'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Riwayat Setoran & Penarikan */}
      {historyGoal && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-navy/50 backdrop-blur-sm p-0 sm:p-4"
          onClick={() => setHistoryGoalId(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl shadow-xl border border-gray-100 p-5 sm:p-6 space-y-4 max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 shrink-0">
              <div>
                <h2 className="text-base font-bold text-navy">
                  Riwayat Tabungan — {historyGoal.title}
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Terkumpul {formatCurrency(historyGoal.saved_amount)} dari{' '}
                  {formatCurrency(historyGoal.target_amount)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setHistoryGoalId(null)}
                className="text-gray-400 hover:text-navy p-1"
                aria-label="Tutup riwayat"
              >
                ✕
              </button>
            </div>

            <div className="overflow-y-auto flex-1 divide-y divide-gray-100">
              {(historyGoal.contributions ?? []).length === 0 ? (
                <div className="py-8 text-center text-xs text-gray-500">
                  Belum ada riwayat setoran untuk target ini.
                </div>
              ) : (
                historyGoal.contributions.map((c) => {
                  const isWithdraw = c.type === 'withdraw';
                  return (
                    <div
                      key={c.id}
                      className="py-3 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-sm font-bold ${
                              isWithdraw ? 'text-red-600' : 'text-emerald'
                            }`}
                          >
                            {isWithdraw ? '-' : '+'}
                            {formatCurrency(c.amount)}
                          </span>
                          {c.account_name && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-bg-light text-navy font-medium">
                              via {c.account_name}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5 truncate">
                          {c.contribution_date}
                          {c.notes ? ` · ${c.notes}` : ''}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeleteContribution(historyGoal.id, c.id)}
                        className="text-xs text-gray-400 hover:text-red-600 shrink-0"
                      >
                        Batalkan
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            <div className="pt-2 shrink-0 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  const g = historyGoal;
                  setHistoryGoalId(null);
                  openContributeModal(g, 'deposit');
                }}
                className="px-4 py-2 bg-emerald text-white text-xs font-semibold rounded-lg hover:bg-emerald/90"
              >
                + Isi Tabungan Lagi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Edit Target */}
      {editGoal && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-navy/50 backdrop-blur-sm p-0 sm:p-4"
          onClick={() => setEditGoal(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-xl border border-gray-100 p-5 sm:p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-navy">Edit Target Tabungan</h2>
              <button
                type="button"
                onClick={() => setEditGoal(null)}
                className="text-gray-400 hover:text-navy p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-navy mb-1">
                  Nama Target / Barang
                </label>
                <input
                  type="text"
                  required
                  value={editForm.title}
                  onChange={(e) =>
                    setEditForm((p) => ({ ...p, title: e.target.value }))
                  }
                  className="w-full p-2.5 text-sm border border-gray-200 rounded-lg text-navy"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-navy mb-1">
                    Kategori
                  </label>
                  <select
                    value={editForm.category}
                    onChange={(e) =>
                      setEditForm((p) => ({ ...p, category: e.target.value }))
                    }
                    className="w-full p-2.5 text-sm border border-gray-200 rounded-lg bg-white text-navy"
                  >
                    {GOAL_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-navy mb-1">
                    Target Dana (Rp)
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    step="any"
                    value={editForm.target_amount}
                    onChange={(e) =>
                      setEditForm((p) => ({ ...p, target_amount: e.target.value }))
                    }
                    className="w-full p-2.5 text-sm border border-gray-200 rounded-lg text-navy"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-navy mb-1">
                  Target Tanggal (Opsional)
                </label>
                <input
                  type="date"
                  value={editForm.target_date}
                  onChange={(e) =>
                    setEditForm((p) => ({ ...p, target_date: e.target.value }))
                  }
                  className="w-full p-2.5 text-sm border border-gray-200 rounded-lg text-navy"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-navy mb-1">
                  Catatan
                </label>
                <input
                  type="text"
                  value={editForm.notes}
                  onChange={(e) =>
                    setEditForm((p) => ({ ...p, notes: e.target.value }))
                  }
                  className="w-full p-2.5 text-sm border border-gray-200 rounded-lg text-navy"
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setEditGoal(null)}
                  className="px-4 py-2 rounded-lg bg-bg-light text-navy text-xs font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={editSubmitting}
                  className="px-4 py-2 rounded-lg bg-emerald text-white text-xs font-semibold hover:bg-emerald/90"
                >
                  {editSubmitting ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Goals;
