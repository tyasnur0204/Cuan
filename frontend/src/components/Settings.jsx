import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

const formatCurrency = (value) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(value ?? 0);
};

const Settings = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('user') || 'null') || {};
    } catch {
      return {};
    }
  });
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({
    username: user?.username || '',
    email: user?.email || '',
  });
  const [activeSection, setActiveSection] = useState('accounts');

  // Accounts state
  const [accounts, setAccounts] = useState([]);
  const [accountForm, setAccountForm] = useState({
    name: '',
    type: 'Cash',
    balance: '0',
    is_business_account: false,
  });

  // Security / Password & API Keys state
  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });
  const [apiKeys, setApiKeys] = useState([]);
  const [newKeyName, setNewKeyName] = useState('PhoBo Local Server');
  const [newlyCreatedKey, setNewlyCreatedKey] = useState(null);
  const [copiedKey, setCopiedKey] = useState(false);

  // Preferences state
  const [inflationRate, setInflationRate] = useState(
    () => localStorage.getItem('finmate_inflation_rate') || '3.2'
  );

  // Feedback alerts
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const notifySuccess = (msg) => {
    setErrorMsg('');
    setStatusMsg(msg);
  };

  const notifyError = (err, fallback) => {
    setStatusMsg('');
    const detail = err?.response?.data?.detail;
    const msg = Array.isArray(detail)
      ? detail.map((d) => `${d.loc?.join('.')}: ${d.msg}`).join(', ')
      : detail || err?.message || fallback;
    setErrorMsg(msg);
  };

  const loadAllSettingsData = async () => {
    try {
      const meRes = await api.get('/me');
      const me = meRes.data;
      setUser(me);
      setProfileForm({ username: me.username, email: me.email });
      localStorage.setItem('user', JSON.stringify(me));
      window.dispatchEvent(new Event('finmate-user-updated'));

      const [accRes, keysRes] = await Promise.all([
        api.get('/accounts', { params: { user_id: me.id } }),
        api.get('/api-keys'),
      ]);
      setAccounts(accRes.data ?? []);
      setApiKeys(keysRes.data ?? []);
    } catch (err) {
      notifyError(err, 'Gagal memuat data pengaturan');
    }
  };

  useEffect(() => {
    loadAllSettingsData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    navigate('/login', { replace: true });
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await api.put('/me', {
        username: profileForm.username.trim(),
        email: profileForm.email.trim(),
      });
      setUser(res.data);
      localStorage.setItem('user', JSON.stringify(res.data));
      window.dispatchEvent(new Event('finmate-user-updated'));
      setEditingProfile(false);
      notifySuccess('Profil pengguna berhasil diperbarui.');
    } catch (err) {
      notifyError(err, 'Gagal memperbarui profil');
    } finally {
      setBusy(false);
    }
  };

  const handleCreateAccount = async (e) => {
    e.preventDefault();
    if (!user?.id) return;
    setBusy(true);
    try {
      await api.post('/accounts', {
        user_id: user.id,
        name: accountForm.name.trim(),
        type: accountForm.type,
        balance: Number(accountForm.balance || 0),
        is_business_account: accountForm.is_business_account,
      });
      setAccountForm({
        name: '',
        type: 'Cash',
        balance: '0',
        is_business_account: false,
      });
      notifySuccess('Akun keuangan baru berhasil dibuat!');
      const accRes = await api.get('/accounts', {
        params: { user_id: user.id },
      });
      setAccounts(accRes.data ?? []);
    } catch (err) {
      notifyError(err, 'Gagal menambahkan akun keuangan');
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteAccount = async (accountId, accountName) => {
    if (
      !window.confirm(
        `Hapus akun "${accountName}"? Pastikan transaksi terkait tidak dibutuhkan lagi.`
      )
    ) {
      return;
    }
    try {
      await api.delete(`/accounts/${accountId}`);
      notifySuccess(`Akun "${accountName}" berhasil dihapus.`);
      setAccounts((prev) => prev.filter((a) => a.id !== accountId));
    } catch (err) {
      notifyError(err, 'Gagal menghapus akun (mungkin masih memiliki transaksi)');
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      setErrorMsg('Konfirmasi password baru tidak cocok.');
      return;
    }
    setBusy(true);
    try {
      await api.put('/me/password', {
        current_password: passwordForm.current_password,
        new_password: passwordForm.new_password,
      });
      setPasswordForm({
        current_password: '',
        new_password: '',
        confirm_password: '',
      });
      notifySuccess('Password akun berhasil diubah.');
    } catch (err) {
      notifyError(err, 'Gagal mengubah password');
    } finally {
      setBusy(false);
    }
  };

  const handleCreateApiKey = async (e) => {
    e.preventDefault();
    if (!newKeyName.trim()) return;
    setBusy(true);
    try {
      const res = await api.post('/api-keys', { name: newKeyName.trim() });
      setNewlyCreatedKey(res.data);
      setCopiedKey(false);
      setNewKeyName('PhoBo Local Server');
      const keysRes = await api.get('/api-keys');
      setApiKeys(keysRes.data ?? []);
      notifySuccess(
        'API Key M2M berhasil dibuat! Salin kunci sekarang karena tidak dapat dilihat kembali.'
      );
    } catch (err) {
      notifyError(err, 'Gagal membuat API Key');
    } finally {
      setBusy(false);
    }
  };

  const handleToggleApiKey = async (keyId) => {
    try {
      const res = await api.patch(`/api-keys/${keyId}/toggle`);
      setApiKeys((prev) => prev.map((k) => (k.id === keyId ? res.data : k)));
    } catch (err) {
      notifyError(err, 'Gagal mengubah status API Key');
    }
  };

  const handleDeleteApiKey = async (keyId, keyName) => {
    if (!window.confirm(`Hapus API Key "${keyName}"?`)) return;
    try {
      await api.delete(`/api-keys/${keyId}`);
      setApiKeys((prev) => prev.filter((k) => k.id !== keyId));
      notifySuccess(`API Key "${keyName}" berhasil dihapus.`);
    } catch (err) {
      notifyError(err, 'Gagal menghapus API Key');
    }
  };

  const handleSavePreferences = (e) => {
    e.preventDefault();
    const numericRate = Number(inflationRate);
    if (Number.isNaN(numericRate) || numericRate < 0) {
      setErrorMsg('Laju inflasi harus berupa angka >= 0.');
      return;
    }
    localStorage.setItem('finmate_inflation_rate', String(numericRate));
    notifySuccess(
      `Preferensi target laju inflasi disimpan (${numericRate}% / tahun).`
    );
  };

  const copyRawKey = async () => {
    if (!newlyCreatedKey?.raw_key) return;
    try {
      await navigator.clipboard.writeText(newlyCreatedKey.raw_key);
      setCopiedKey(true);
    } catch {
      setCopiedKey(false);
    }
  };

  const initials = (user?.username || 'FM')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');

  const menuItems = [
    {
      key: 'accounts',
      title: 'Akun Keuangan',
      desc: 'Kelola dompet tunai, rekening bank, akun investasi & usaha PhoBo',
    },
    {
      key: 'security',
      title: 'Keamanan & API Key M2M',
      desc: 'Ubah password dan kelola X-API-Key untuk server lokal PhoBo',
    },
    {
      key: 'preferences',
      title: 'Preferensi Aplikasi',
      desc: 'Atur asumsi laju inflasi tahunan untuk analisis portofolio',
    },
    {
      key: 'help',
      title: 'Bantuan & Tentang Aplikasi',
      desc: 'Panduan Zero-Based Budgeting, Cek Inflasi, dan integrasi M2M',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy">Pengaturan</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Kelola profil pengguna, akun keuangan, keamanan M2M, dan preferensi
          aplikasi
        </p>
      </div>

      {statusMsg && (
        <div className="p-3.5 bg-emerald/10 border border-emerald/20 text-emerald rounded-xl text-sm font-medium">
          {statusMsg}
        </div>
      )}

      {errorMsg && (
        <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm font-medium">
          Error: {errorMsg}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Card Profil Pengguna (Kiri) */}
        <div className="lg:col-span-4 bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col items-center text-center">
          <div className="w-20 h-20 rounded-full bg-emerald/15 text-emerald flex items-center justify-center text-2xl font-bold mb-4">
            {initials || 'FM'}
          </div>

          {!editingProfile ? (
            <>
              <h2 className="text-lg font-bold text-navy">
                {user?.username || 'Pengguna'}
              </h2>
              <p className="text-xs text-gray-500 mt-0.5 mb-5">
                {user?.email || '-'}
              </p>
              <button
                type="button"
                onClick={() => setEditingProfile(true)}
                className="w-full py-2.5 px-4 border border-gray-200 rounded-lg text-sm font-semibold text-navy hover:bg-bg-light transition-colors"
              >
                Ubah Profil
              </button>
            </>
          ) : (
            <form
              onSubmit={handleSaveProfile}
              className="w-full space-y-3 text-left"
            >
              <div>
                <label className="block text-xs font-medium text-navy mb-1">
                  Nama Lengkap
                </label>
                <input
                  type="text"
                  required
                  minLength={3}
                  value={profileForm.username}
                  onChange={(e) =>
                    setProfileForm((p) => ({ ...p, username: e.target.value }))
                  }
                  className="w-full p-2 text-sm border border-gray-200 rounded-lg text-navy"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-navy mb-1">
                  Email
                </label>
                <input
                  type="email"
                  required
                  value={profileForm.email}
                  onChange={(e) =>
                    setProfileForm((p) => ({ ...p, email: e.target.value }))
                  }
                  className="w-full p-2 text-sm border border-gray-200 rounded-lg text-navy"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setEditingProfile(false)}
                  className="flex-1 py-2 text-xs font-semibold rounded-lg bg-bg-light text-navy hover:bg-gray-200"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="flex-1 py-2 text-xs font-semibold rounded-lg bg-emerald text-white hover:bg-emerald/90 disabled:opacity-50"
                >
                  Simpan
                </button>
              </div>
            </form>
          )}

          <div className="w-full pt-5 mt-6 border-t border-gray-100">
            <button
              type="button"
              onClick={handleLogout}
              className="w-full py-2.5 px-4 rounded-lg text-sm font-semibold text-red-600 bg-red-50 hover:bg-red-100 transition-colors"
            >
              Keluar
            </button>
          </div>
        </div>

        {/* Panel Kanan: Menu Pengaturan & Konten */}
        <div className="lg:col-span-8 space-y-5">
          {/* Menu Tabs Horizontal / List */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {menuItems.map((item) => {
              const isSelected = activeSection === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setActiveSection(item.key)}
                  className={`text-left p-4 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                    isSelected
                      ? 'bg-white border-emerald ring-2 ring-emerald/15 shadow-sm'
                      : 'bg-white border-gray-100 hover:border-gray-200 shadow-sm'
                  }`}
                >
                  <div>
                    <p className="text-sm font-semibold text-navy">
                      {item.title}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">
                      {item.desc}
                    </p>
                  </div>
                  <span
                    className={`text-sm font-bold ${
                      isSelected ? 'text-emerald' : 'text-gray-400'
                    }`}
                  >
                    ›
                  </span>
                </button>
              );
            })}
          </div>

          {/* Section 1: Akun Keuangan */}
          {activeSection === 'accounts' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-6">
              <div>
                <h3 className="text-base font-semibold text-navy">
                  Tambah Akun Keuangan
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Buat akun dompet tunai, bank, investasi, atau kas usaha
                  photobooth
                </p>
              </div>

              <form
                onSubmit={handleCreateAccount}
                className="grid grid-cols-1 sm:grid-cols-2 gap-4"
              >
                <div>
                  <label className="block text-xs font-medium text-navy mb-1">
                    Nama Akun
                  </label>
                  <input
                    type="text"
                    required
                    value={accountForm.name}
                    onChange={(e) =>
                      setAccountForm((p) => ({ ...p, name: e.target.value }))
                    }
                    placeholder="Contoh: Bank BCA / Kas Usaha PhoBo"
                    className="w-full p-2.5 text-sm border border-gray-200 rounded-lg text-navy"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-navy mb-1">
                    Tipe Akun
                  </label>
                  <select
                    value={accountForm.type}
                    onChange={(e) =>
                      setAccountForm((p) => ({ ...p, type: e.target.value }))
                    }
                    className="w-full p-2.5 text-sm border border-gray-200 rounded-lg text-navy bg-white"
                  >
                    <option value="Cash">Tunai (Cash)</option>
                    <option value="Bank">Rekening Bank (Bank)</option>
                    <option value="Investment">Investasi (Investment)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-navy mb-1">
                    Saldo Awal (Rp)
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={accountForm.balance}
                    onChange={(e) =>
                      setAccountForm((p) => ({ ...p, balance: e.target.value }))
                    }
                    className="w-full p-2.5 text-sm border border-gray-200 rounded-lg text-navy"
                  />
                </div>

                <div className="flex items-end">
                  <label className="w-full flex items-center justify-between gap-2 p-2.5 rounded-lg border border-gray-200 bg-bg-light/60 cursor-pointer">
                    <span className="text-xs font-medium text-navy">
                      Tandai Akun Usaha (PhoBo)
                    </span>
                    <input
                      type="checkbox"
                      checked={accountForm.is_business_account}
                      onChange={(e) =>
                        setAccountForm((p) => ({
                          ...p,
                          is_business_account: e.target.checked,
                        }))
                      }
                      className="h-4 w-4 accent-emerald"
                    />
                  </label>
                </div>

                <div className="sm:col-span-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={busy}
                    className="px-5 py-2.5 bg-emerald text-white text-sm font-semibold rounded-lg hover:bg-emerald/90 disabled:opacity-50"
                  >
                    + Tambah Akun
                  </button>
                </div>
              </form>

              <div className="pt-4 border-t border-gray-100">
                <h4 className="text-sm font-semibold text-navy mb-3">
                  Daftar Akun Anda ({accounts.length})
                </h4>
                {accounts.length === 0 ? (
                  <p className="text-xs text-gray-500">
                    Belum ada akun keuangan terdaftar.
                  </p>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {accounts.map((acc) => (
                      <div
                        key={acc.id}
                        className="py-3 flex items-center justify-between gap-3 text-sm"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-navy">
                              {acc.name}
                            </span>
                            <span className="text-[11px] px-2 py-0.5 rounded bg-bg-light text-navy font-medium">
                              {acc.type}
                            </span>
                            {acc.is_business_account && (
                              <span className="text-[11px] px-2 py-0.5 rounded bg-emerald/10 text-emerald font-semibold">
                                Akun Usaha
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-gray-400 mt-0.5 font-mono">
                            ID: {acc.id}
                          </p>
                        </div>

                        <div className="flex items-center gap-4">
                          <span className="font-bold text-navy">
                            {formatCurrency(acc.balance)}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              handleDeleteAccount(acc.id, acc.name)
                            }
                            className="text-xs text-gray-400 hover:text-red-600"
                          >
                            Hapus
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Section 2: Keamanan & API Key M2M */}
          {activeSection === 'security' && (
            <div className="space-y-5">
              {/* Ganti Password */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
                <h3 className="text-base font-semibold text-navy">
                  Ubah Password Akun
                </h3>
                <form
                  onSubmit={handleChangePassword}
                  className="grid grid-cols-1 sm:grid-cols-3 gap-3"
                >
                  <input
                    type="password"
                    required
                    placeholder="Password saat ini"
                    value={passwordForm.current_password}
                    onChange={(e) =>
                      setPasswordForm((p) => ({
                        ...p,
                        current_password: e.target.value,
                      }))
                    }
                    className="p-2.5 text-sm border border-gray-200 rounded-lg text-navy"
                  />
                  <input
                    type="password"
                    required
                    minLength={6}
                    placeholder="Password baru (min 6)"
                    value={passwordForm.new_password}
                    onChange={(e) =>
                      setPasswordForm((p) => ({
                        ...p,
                        new_password: e.target.value,
                      }))
                    }
                    className="p-2.5 text-sm border border-gray-200 rounded-lg text-navy"
                  />
                  <input
                    type="password"
                    required
                    minLength={6}
                    placeholder="Konfirmasi password baru"
                    value={passwordForm.confirm_password}
                    onChange={(e) =>
                      setPasswordForm((p) => ({
                        ...p,
                        confirm_password: e.target.value,
                      }))
                    }
                    className="p-2.5 text-sm border border-gray-200 rounded-lg text-navy"
                  />
                  <div className="sm:col-span-3 flex justify-end">
                    <button
                      type="submit"
                      disabled={busy}
                      className="px-4 py-2 bg-navy text-white text-xs font-semibold rounded-lg hover:bg-navy/90 disabled:opacity-50"
                    >
                      Perbarui Password
                    </button>
                  </div>
                </form>
              </div>

              {/* API Key M2M PhoBo */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
                <div>
                  <h3 className="text-base font-semibold text-navy">
                    API Key Integrasi M2M (PhoBo Local Server)
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Kirim pemasukan otomatis dari server photobooth melalui
                    header <code className="font-mono">X-API-Key</code> ke{' '}
                    <code className="font-mono">
                      POST /api/v1/transactions/auto-log
                    </code>
                  </p>
                </div>

                <form onSubmit={handleCreateApiKey} className="flex gap-2">
                  <input
                    type="text"
                    required
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    placeholder="Nama client (misal: PhoBo Local Server)"
                    className="flex-1 p-2.5 text-sm border border-gray-200 rounded-lg text-navy"
                  />
                  <button
                    type="submit"
                    disabled={busy}
                    className="px-4 py-2.5 bg-emerald text-white text-xs font-semibold rounded-lg hover:bg-emerald/90 shrink-0 disabled:opacity-50"
                  >
                    + Buat API Key
                  </button>
                </form>

                {newlyCreatedKey && (
                  <div className="p-4 rounded-xl bg-emerald/10 border border-emerald/25 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-emerald">
                        API Key Baru ({newlyCreatedKey.name}) — Simpan sekarang!
                      </span>
                      <button
                        type="button"
                        onClick={copyRawKey}
                        className="px-2.5 py-1 rounded bg-emerald text-white text-[11px] font-semibold"
                      >
                        {copiedKey ? 'Tersalin ✓' : 'Salin Key'}
                      </button>
                    </div>
                    <pre className="p-2.5 rounded bg-white text-xs font-mono text-navy overflow-x-auto border border-emerald/20">
                      {newlyCreatedKey.raw_key}
                    </pre>
                    <p className="text-[11px] text-navy/80">
                      Contoh payload ke{' '}
                      <code className="font-mono">
                        POST /api/v1/transactions/auto-log
                      </code>
                      :{' '}
                      <code className="font-mono">
                        {'{"nominal": 35000, "tanggal": "2026-11-10"}'}
                      </code>
                    </p>
                  </div>
                )}

                <div className="divide-y divide-gray-100">
                  {apiKeys.length === 0 ? (
                    <p className="text-xs text-gray-500 py-2">
                      Belum ada API Key M2M dibuat.
                    </p>
                  ) : (
                    apiKeys.map((keyItem) => (
                      <div
                        key={keyItem.id}
                        className="py-3 flex items-center justify-between gap-3 text-sm"
                      >
                        <div>
                          <p className="font-semibold text-navy">
                            {keyItem.name}
                          </p>
                          <p className="text-[11px] text-gray-400 font-mono">
                            {keyItem.id}
                          </p>
                        </div>
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${
                              keyItem.is_active
                                ? 'bg-emerald/10 text-emerald'
                                : 'bg-gray-100 text-gray-500'
                            }`}
                          >
                            {keyItem.is_active ? 'Aktif' : 'Nonaktif'}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleToggleApiKey(keyItem.id)}
                            className="text-xs font-medium text-navy hover:underline"
                          >
                            {keyItem.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleDeleteApiKey(keyItem.id, keyItem.name)
                            }
                            className="text-xs text-gray-400 hover:text-red-600"
                          >
                            Hapus
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Section 3: Preferensi Aplikasi */}
          {activeSection === 'preferences' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
              <div>
                <h3 className="text-base font-semibold text-navy">
                  Preferensi Perhitungan Inflasi
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Digunakan untuk menghitung pertumbuhan riil aset di Dashboard
                  dan Portofolio Investasi
                </p>
              </div>

              <form
                onSubmit={handleSavePreferences}
                className="flex flex-col sm:flex-row sm:items-end gap-3"
              >
                <div className="flex-1">
                  <label className="block text-xs font-medium text-navy mb-1">
                    Asumsi Laju Inflasi Tahunan (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={inflationRate}
                    onChange={(e) => setInflationRate(e.target.value)}
                    className="w-full p-2.5 text-sm border border-gray-200 rounded-lg text-navy"
                  />
                </div>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-emerald text-white text-sm font-semibold rounded-lg hover:bg-emerald/90"
                >
                  Simpan Preferensi
                </button>
              </form>
            </div>
          )}

          {/* Section 4: Bantuan & Tentang Aplikasi */}
          {activeSection === 'help' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4 text-sm text-navy/85">
              <div>
                <h3 className="text-base font-semibold text-navy">
                  Tentang FinMate v0.2.0
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  Aplikasi manajemen keuangan personal & usaha mahasiswa berbasis
                  FastAPI, PostgreSQL, dan React.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3.5 rounded-lg bg-bg-light space-y-1">
                  <p className="font-semibold text-navy">
                    Zero-Based Budgeting
                  </p>
                  <p className="text-gray-600">
                    Alokasikan setiap rupiah pemasukan bulanan ke pos kebutuhan,
                    tabungan, dan investasi hingga sisa alokasi mencapai Rp 0.
                  </p>
                </div>
                <div className="p-3.5 rounded-lg bg-bg-light space-y-1">
                  <p className="font-semibold text-navy">
                    Cek Return vs Inflasi
                  </p>
                  <p className="text-gray-600">
                    Pastikan return tahunan aset RDPU, SBN, atau Saham melampaui
                    laju inflasi tahunan untuk menjaga daya beli.
                  </p>
                </div>
                <div className="p-3.5 rounded-lg bg-bg-light space-y-1 sm:col-span-2">
                  <p className="font-semibold text-navy">
                    Integrasi Otomatis Usaha PhoBo (M2M)
                  </p>
                  <p className="text-gray-600">
                    Buat API Key pada menu Keamanan & API Key M2M lalu kirimkan
                    POST request dengan header{' '}
                    <code className="font-mono">X-API-Key</code> ke{' '}
                    <code className="font-mono">
                      /api/v1/transactions/auto-log
                    </code>
                    . Sistem akan mencatat pemasukan kategori{' '}
                    <em>Usaha PhoBo</em> secara otomatis ke akun bisnis Anda.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Settings;
