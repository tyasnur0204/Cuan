import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import api, {
  DEFAULT_API_URL,
  PRODUCTION_API_URL,
  setCustomApiBaseUrl,
  STORAGE_KEYS,
} from '../services/api';
import { COLORS, SHADOW } from '../theme/theme';
import { extractApiError, formatCurrency } from '../utils/format';

const SettingsScreen = ({ user, onUserUpdated, onLogout, onDataChanged }) => {
  const [section, setSection] = useState('accounts');
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);

  // Profile
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileName, setProfileName] = useState(user?.username || '');
  const [profileEmail, setProfileEmail] = useState(user?.email || '');

  // Accounts
  const [accounts, setAccounts] = useState([]);
  const [accName, setAccName] = useState('');
  const [accType, setAccType] = useState('Cash');
  const [accBalance, setAccBalance] = useState('0');
  const [accBiz, setAccBiz] = useState(false);

  // Password & API Keys
  const [curPw, setCurPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [apiKeys, setApiKeys] = useState([]);
  const [newKeyName, setNewKeyName] = useState('');
  const [createdKey, setCreatedKey] = useState(null);

  // Preferences
  const [inflationRate, setInflationRate] = useState('3.2');
  const [serverUrl, setServerUrl] = useState(api.defaults.baseURL || DEFAULT_API_URL);

  const loadSettingsData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const [meRes, accRes, keyRes, savedInf] = await Promise.all([
        api.get('/me'),
        api.get('/accounts'),
        api.get('/api-keys'),
        AsyncStorage.getItem(STORAGE_KEYS.INFLATION_RATE),
      ]);
      const me = meRes.data;
      setProfileName(me.username);
      setProfileEmail(me.email);
      await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(me));
      onUserUpdated?.(me);
      setAccounts(accRes.data ?? []);
      setApiKeys(keyRes.data ?? []);
      if (savedInf) setInflationRate(savedInf);
    } catch (err) {
      Alert.alert('Error', extractApiError(err, 'Gagal memuat data pengaturan'));
    } finally {
      setRefreshing(false);
    }
  }, [onUserUpdated]);

  useEffect(() => {
    loadSettingsData(false);
  }, [loadSettingsData]);

  const handleSaveProfile = async () => {
    if (profileName.trim().length < 2) {
      Alert.alert('Validasi', 'Nama minimal 2 karakter.');
      return;
    }
    setBusy(true);
    try {
      const res = await api.put('/me', {
        username: profileName.trim(),
        email: profileEmail.trim(),
      });
      await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(res.data));
      onUserUpdated?.(res.data);
      setEditingProfile(false);
      Alert.alert('Berhasil', 'Profil berhasil diperbarui.');
    } catch (err) {
      Alert.alert('Error', extractApiError(err, 'Gagal memperbarui profil'));
    } finally {
      setBusy(false);
    }
  };

  const handleCreateAccount = async () => {
    if (!accName.trim()) {
      Alert.alert('Validasi', 'Masukkan nama akun keuangan.');
      return;
    }
    setBusy(true);
    try {
      await api.post('/accounts', {
        name: accName.trim(),
        type: accType,
        balance: Number(accBalance || 0),
        is_business_account: accBiz,
      });
      setAccName('');
      setAccBalance('0');
      setAccBiz(false);
      await loadSettingsData(false);
      onDataChanged?.();
      Alert.alert('Berhasil', 'Akun keuangan baru ditambahkan.');
    } catch (err) {
      Alert.alert('Error', extractApiError(err, 'Gagal menambahkan akun'));
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteAccount = (acc) => {
    Alert.alert('Hapus Akun', `Hapus akun "${acc.name}"?`, [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/accounts/${acc.id}`);
            await loadSettingsData(false);
            onDataChanged?.();
          } catch (err) {
            Alert.alert('Error', extractApiError(err, 'Gagal menghapus akun'));
          }
        },
      },
    ]);
  };

  const handleChangePassword = async () => {
    if (!curPw || newPw.length < 6) {
      Alert.alert('Validasi', 'Password baru minimal 6 karakter.');
      return;
    }
    setBusy(true);
    try {
      await api.put('/me/password', {
        current_password: curPw,
        new_password: newPw,
      });
      setCurPw('');
      setNewPw('');
      Alert.alert('Berhasil', 'Password berhasil diubah.');
    } catch (err) {
      Alert.alert('Error', extractApiError(err, 'Gagal mengubah password'));
    } finally {
      setBusy(false);
    }
  };

  const handleCreateKey = async () => {
    if (!newKeyName.trim()) {
      Alert.alert('Validasi', 'Isi nama client API Key.');
      return;
    }
    setBusy(true);
    try {
      const res = await api.post('/api-keys', { name: newKeyName.trim() });
      setCreatedKey(res.data);
      setNewKeyName('');
      await loadSettingsData(false);
    } catch (err) {
      Alert.alert('Error', extractApiError(err, 'Gagal membuat API Key'));
    } finally {
      setBusy(false);
    }
  };

  const handleToggleKey = async (id) => {
    try {
      await api.patch(`/api-keys/${id}/toggle`);
      await loadSettingsData(false);
    } catch (err) {
      Alert.alert('Error', extractApiError(err, 'Gagal mengubah status API Key'));
    }
  };

  const handleDeleteKey = (keyItem) => {
    Alert.alert('Hapus API Key', `Hapus "${keyItem.name}"?`, [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/api-keys/${keyItem.id}`);
            await loadSettingsData(false);
          } catch (err) {
            Alert.alert('Error', extractApiError(err, 'Gagal menghapus API Key'));
          }
        },
      },
    ]);
  };

  const handleSavePrefs = async () => {
    const val = Number(inflationRate);
    if (Number.isNaN(val) || val < 0) {
      Alert.alert('Validasi', 'Laju inflasi harus angka >= 0.');
      return;
    }
    await AsyncStorage.setItem(STORAGE_KEYS.INFLATION_RATE, String(val));
    const savedUrl = await setCustomApiBaseUrl(serverUrl);
    setServerUrl(savedUrl);
    onDataChanged?.();
    Alert.alert('Tersimpan', `Preferensi inflasi (${val}%) dan server API disimpan.`);
  };

  const confirmLogout = () => {
    Alert.alert('Keluar Akun', 'Anda yakin ingin keluar dari sesi CUAN?', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Keluar',
        style: 'destructive',
        onPress: onLogout,
      },
    ]);
  };

  const initials = (user?.username || 'CU')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => loadSettingsData(true)}
          colors={[COLORS.emerald]}
          tintColor={COLORS.emerald}
        />
      }
    >
      {/* Profile Card */}
      <View style={[styles.profileCard, SHADOW]}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials || 'FM'}</Text>
        </View>
        {!editingProfile ? (
          <>
            <Text style={styles.profileName}>{user?.username || 'Pengguna'}</Text>
            <Text style={styles.profileEmail}>{user?.email || '-'}</Text>
            <View style={styles.profileBtns}>
              <TouchableOpacity
                onPress={() => setEditingProfile(true)}
                style={styles.editProfileBtn}
              >
                <Text style={styles.editProfileText}>Ubah Profil</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={confirmLogout} style={styles.logoutBtn}>
                <Ionicons name="log-out-outline" size={16} color={COLORS.danger} />
                <Text style={styles.logoutText}>Keluar</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <View style={{ width: '100%', gap: 10 }}>
            <TextInput
              value={profileName}
              onChangeText={setProfileName}
              placeholder="Nama Lengkap"
              style={styles.input}
            />
            <TextInput
              value={profileEmail}
              onChangeText={setProfileEmail}
              placeholder="Email"
              keyboardType="email-address"
              autoCapitalize="none"
              style={styles.input}
            />
            <View style={styles.profileBtns}>
              <TouchableOpacity
                onPress={() => setEditingProfile(false)}
                style={styles.editProfileBtn}
              >
                <Text style={styles.editProfileText}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSaveProfile}
                disabled={busy}
                style={styles.saveProfileBtn}
              >
                <Text style={styles.saveProfileText}>Simpan</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {/* Section Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabsRow}
      >
        {[
          { key: 'accounts', label: 'Akun Keuangan' },
          { key: 'security', label: 'Keamanan & M2M' },
          { key: 'prefs', label: 'Preferensi' },
          { key: 'about', label: 'Tentang' },
        ].map((t) => (
          <TouchableOpacity
            key={t.key}
            onPress={() => setSection(t.key)}
            style={[styles.tabPill, section === t.key && styles.tabPillActive]}
          >
            <Text
              style={[styles.tabText, section === t.key && styles.tabTextActive]}
            >
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {section === 'accounts' && (
        <View style={[styles.card, SHADOW]}>
          <Text style={styles.cardTitle}>Tambah Akun Keuangan</Text>
          <TextInput
            value={accName}
            onChangeText={setAccName}
            placeholder="Contoh: Bank BCA / Dompet Tunai / Kas Usaha"
            placeholderTextColor={COLORS.grayLight}
            style={styles.input}
          />
          <View style={styles.typeRow}>
            {['Cash', 'Bank', 'Investment'].map((tp) => (
              <TouchableOpacity
                key={tp}
                onPress={() => setAccType(tp)}
                style={[styles.typeBtn, accType === tp && styles.typeBtnActive]}
              >
                <Text
                  style={[
                    styles.typeBtnText,
                    accType === tp && styles.typeBtnTextActive,
                  ]}
                >
                  {tp}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput
            value={accBalance}
            onChangeText={setAccBalance}
            placeholder="Saldo Awal (Rp)"
            keyboardType="numeric"
            style={styles.input}
          />
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Tandai Akun Usaha / Bisnis</Text>
            <Switch
              value={accBiz}
              onValueChange={setAccBiz}
              trackColor={{ false: '#D1D5DB', true: '#6EE7B7' }}
              thumbColor={accBiz ? COLORS.emerald : '#F9FAFB'}
            />
          </View>
          <TouchableOpacity
            onPress={handleCreateAccount}
            disabled={busy}
            style={styles.primaryBtn}
          >
            {busy ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.primaryBtnText}>+ Tambah Akun</Text>
            )}
          </TouchableOpacity>

          <View style={styles.divider} />
          <Text style={styles.cardTitle}>Daftar Akun ({accounts.length})</Text>
          {accounts.length === 0 ? (
            <Text style={styles.mutedDesc}>Belum ada akun terdaftar.</Text>
          ) : (
            accounts.map((acc) => (
              <View key={acc.id} style={styles.accRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.accName}>
                    {acc.name}{' '}
                    {acc.is_business_account ? '· Usaha' : ''}
                  </Text>
                  <Text style={styles.mutedDesc}>
                    {acc.type} · {formatCurrency(acc.balance)}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => handleDeleteAccount(acc)}>
                  <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>
      )}

      {section === 'security' && (
        <>
          <View style={[styles.card, SHADOW]}>
            <Text style={styles.cardTitle}>Ubah Password</Text>
            <TextInput
              value={curPw}
              onChangeText={setCurPw}
              placeholder="Password saat ini"
              secureTextEntry
              style={styles.input}
            />
            <TextInput
              value={newPw}
              onChangeText={setNewPw}
              placeholder="Password baru (min 6 karakter)"
              secureTextEntry
              style={styles.input}
            />
            <TouchableOpacity
              onPress={handleChangePassword}
              disabled={busy}
              style={styles.primaryBtn}
            >
              <Text style={styles.primaryBtnText}>Perbarui Password</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.card, SHADOW]}>
            <Text style={styles.cardTitle}>API Key Integrasi M2M (Webhook)</Text>
            <Text style={styles.mutedDesc}>
              Gunakan header X-API-Key untuk mengirim transaksi pemasukan
              otomatis ke POST /api/v1/transactions/auto-log.
            </Text>
            <TextInput
              value={newKeyName}
              onChangeText={setNewKeyName}
              placeholder="Nama client (misal: Sistem Kasir)"
              style={styles.input}
            />
            <TouchableOpacity
              onPress={handleCreateKey}
              disabled={busy}
              style={styles.primaryBtn}
            >
              <Text style={styles.primaryBtnText}>+ Buat API Key</Text>
            </TouchableOpacity>

            {createdKey && (
              <View style={styles.keyBox}>
                <Text style={styles.keyBoxTitle}>
                  Simpan Key Baru ({createdKey.name}):
                </Text>
                <Text selectable style={styles.keyRaw}>
                  {createdKey.raw_key}
                </Text>
              </View>
            )}

            {apiKeys.map((k) => (
              <View key={k.id} style={styles.accRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.accName}>{k.name}</Text>
                  <Text style={styles.mutedDesc}>
                    Status: {k.is_active ? 'Aktif' : 'Nonaktif'}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => handleToggleKey(k.id)}
                  style={styles.toggleBtn}
                >
                  <Text style={styles.toggleText}>
                    {k.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDeleteKey(k)}>
                  <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </>
      )}

      {section === 'prefs' && (
        <View style={[styles.card, SHADOW]}>
          <Text style={styles.cardTitle}>Preferensi & Koneksi API</Text>
          <Text style={styles.label}>Asumsi Laju Inflasi Tahunan (%)</Text>
          <TextInput
            value={inflationRate}
            onChangeText={setInflationRate}
            keyboardType="decimal-pad"
            style={styles.input}
          />
          <Text style={styles.label}>URL Backend API</Text>
          <TextInput
            value={serverUrl}
            onChangeText={setServerUrl}
            placeholder={PRODUCTION_API_URL}
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.input}
          />
          <TouchableOpacity onPress={handleSavePrefs} style={styles.primaryBtn}>
            <Text style={styles.primaryBtnText}>Simpan Preferensi</Text>
          </TouchableOpacity>
        </View>
      )}

      {section === 'about' && (
        <View style={[styles.card, SHADOW]}>
          <Text style={styles.cardTitle}>Tentang CUAN Mobile</Text>
          <Text style={styles.mutedDesc}>
            CUAN (Catat Uang, Aset Naik) versi Mobile App (React Native + Expo)
            terhubung langsung ke REST API FastAPI & PostgreSQL untuk manajemen
            keuangan harian, Zero-Based Budgeting, Mode Bisnis, dan analisis
            investasi vs inflasi.
          </Text>
          <Text style={styles.versionTag}>Versi Aplikasi: 1.0.0</Text>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 16, paddingBottom: 96, gap: 12 },
  profileCard: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.emeraldLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  avatarText: { fontSize: 22, fontWeight: '800', color: COLORS.emerald },
  profileName: { fontSize: 18, fontWeight: '800', color: COLORS.navy },
  profileEmail: { fontSize: 12, color: COLORS.grayText, marginTop: 2, marginBottom: 12 },
  profileBtns: { flexDirection: 'row', gap: 10, width: '100%' },
  editProfileBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  editProfileText: { fontSize: 13, fontWeight: '700', color: COLORS.navy },
  saveProfileBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: COLORS.emerald,
    alignItems: 'center',
  },
  saveProfileText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  logoutBtn: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: COLORS.dangerBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutText: { fontSize: 13, fontWeight: '700', color: COLORS.danger },
  tabsRow: { gap: 8 },
  tabPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 99,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  tabPillActive: { backgroundColor: COLORS.emerald, borderColor: COLORS.emerald },
  tabText: { fontSize: 12, fontWeight: '600', color: COLORS.navy },
  tabTextActive: { color: '#FFFFFF' },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 10,
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: COLORS.navy },
  label: { fontSize: 12, fontWeight: '700', color: COLORS.navy, marginTop: 4 },
  mutedDesc: { fontSize: 12, color: COLORS.grayText, lineHeight: 17 },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.navy,
    backgroundColor: '#FFFFFF',
  },
  typeRow: { flexDirection: 'row', gap: 8 },
  typeBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    backgroundColor: COLORS.bg,
  },
  typeBtnActive: { backgroundColor: COLORS.emerald, borderColor: COLORS.emerald },
  typeBtnText: { fontSize: 12, fontWeight: '700', color: COLORS.navy },
  typeBtnTextActive: { color: '#FFFFFF' },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    borderRadius: 10,
    backgroundColor: COLORS.bg,
  },
  switchLabel: { fontSize: 12, fontWeight: '600', color: COLORS.navy },
  primaryBtn: {
    backgroundColor: COLORS.emerald,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryBtnText: { fontSize: 13, fontWeight: '800', color: '#FFFFFF' },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 4 },
  accRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  accName: { fontSize: 13, fontWeight: '700', color: COLORS.navy },
  keyBox: {
    backgroundColor: COLORS.emeraldLight,
    borderRadius: 10,
    padding: 10,
    gap: 4,
  },
  keyBoxTitle: { fontSize: 11, fontWeight: '700', color: COLORS.emeraldDark },
  keyRaw: { fontSize: 12, fontFamily: 'monospace', color: COLORS.navy },
  toggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: COLORS.bg,
  },
  toggleText: { fontSize: 11, fontWeight: '700', color: COLORS.navy },
  versionTag: { fontSize: 12, fontWeight: '700', color: COLORS.emerald },
});

export default SettingsScreen;
