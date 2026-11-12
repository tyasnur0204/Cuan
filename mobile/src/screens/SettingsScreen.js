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
import {
  getInstalledAppInfo,
  openDownloadInBrowser,
} from '../services/appUpdater';
import { MONITORED_APPS } from '../services/paymentNotificationParser';
import {
  clearAllHistory,
  getNotificationListenerStatus,
  isNativeNotifModuleAvailable,
  loadNotifSettings,
  openAppDetailsSettings,
  openBatteryOptimizationSettings,
  openNotificationAccessSettings,
  saveNotifSettings,
  simulatePaymentNotification,
} from '../services/paymentNotifications';
import { COLORS, SHADOW } from '../theme/theme';
import {
  extractApiError,
  formatCurrency,
  parseNominalInput,
  parsePercentInput,
} from '../utils/format';

const SettingsScreen = ({
  user,
  onUserUpdated,
  onLogout,
  onDataChanged,
  updateInfo,
  onCheckUpdate,
  onOpenUpdateModal,
  initialSection = 'accounts',
  pendingNotifs = [],
  historyNotifs = [],
  onOpenNotifReview,
  onSyncNotificationState,
}) => {
  const [section, setSection] = useState(initialSection || 'accounts');
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateStatusText, setUpdateStatusText] = useState('');
  const installedInfo = getInstalledAppInfo();

  // Notification listener state
  const [notifSettings, setNotifSettings] = useState(null);
  const [notifStatus, setNotifStatus] = useState({
    supported: isNativeNotifModuleAvailable,
    permissionGranted: false,
    isExpoGo: installedInfo.isExpoGo,
    isStandaloneAndroid: installedInfo.isStandaloneAndroid,
  });
  const [simResultMsg, setSimResultMsg] = useState('');

  useEffect(() => {
    if (initialSection) {
      setSection(initialSection);
    }
  }, [initialSection]);

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
      const [meRes, accRes, keyRes, savedInf, nCfg, nStat] = await Promise.all([
        api.get('/me'),
        api.get('/accounts', {
          params: user?.id ? { user_id: user.id } : undefined,
        }),
        api.get('/api-keys'),
        AsyncStorage.getItem(STORAGE_KEYS.INFLATION_RATE),
        loadNotifSettings(),
        getNotificationListenerStatus(),
      ]);
      const me = meRes.data;
      setProfileName(me.username);
      setProfileEmail(me.email);
      await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(me));
      onUserUpdated?.(me);
      setAccounts(accRes.data ?? []);
      setApiKeys(keyRes.data ?? []);
      if (savedInf) setInflationRate(savedInf);
      setNotifSettings(nCfg);
      setNotifStatus(nStat);
    } catch (err) {
      Alert.alert('Error', extractApiError(err, 'Gagal memuat data pengaturan'));
    } finally {
      setRefreshing(false);
    }
  }, [onUserUpdated, user?.id]);

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
    const initialBal = accBalance.trim() ? parseNominalInput(accBalance) : 0;
    if (!Number.isFinite(initialBal)) {
      Alert.alert('Validasi', 'Saldo awal harus berupa angka yang valid.');
      return;
    }
    setBusy(true);
    try {
      await api.post('/accounts', {
        name: accName.trim(),
        type: accType,
        balance: initialBal,
        is_business_account: accBiz,
        ...(user?.id ? { user_id: user.id } : {}),
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
    const val = parsePercentInput(inflationRate);
    if (!Number.isFinite(val) || val < 0) {
      Alert.alert('Validasi', 'Laju inflasi harus angka >= 0.');
      return;
    }
    await AsyncStorage.setItem(STORAGE_KEYS.INFLATION_RATE, String(val));
    const savedUrl = await setCustomApiBaseUrl(serverUrl);
    setServerUrl(savedUrl);
    onDataChanged?.();
    Alert.alert('Tersimpan', `Preferensi inflasi (${val}%) dan server API disimpan.`);
  };

  const handleResetDefaultServer = async () => {
    const savedUrl = await setCustomApiBaseUrl('');
    setServerUrl(savedUrl);
    await saveNotifSettings({});
    onDataChanged?.();
    Alert.alert('Reset Berhasil', `Server API dikembalikan ke default: ${savedUrl}`);
  };

  const handleUpdateNotifSetting = async (patch) => {
    const next = await saveNotifSettings(patch);
    setNotifSettings(next);
    const stat = await getNotificationListenerStatus();
    setNotifStatus(stat);
    await onSyncNotificationState?.();
  };

  const handleToggleMonitoredApp = async (appKey) => {
    const cur = notifSettings?.enabledApps || [];
    const exists = cur.includes(appKey);
    const nextApps = exists ? cur.filter((k) => k !== appKey) : [...cur, appKey];
    await handleUpdateNotifSetting({ enabledApps: nextApps });
  };

  const handleMapAppAccount = async (appKey, accId) => {
    const currentMap = notifSettings?.accountMap || {};
    const nextMap = { ...currentMap, [appKey]: accId };
    await handleUpdateNotifSetting({ accountMap: nextMap });
  };

  const handleToggleBusinessApp = async (appKey) => {
    const cur = notifSettings?.businessApps || [];
    const exists = cur.includes(appKey);
    const nextBiz = exists ? cur.filter((k) => k !== appKey) : [...cur, appKey];
    await handleUpdateNotifSetting({ businessApps: nextBiz });
  };

  const handleSimulateAppNotif = async (appItem, isIncome = false, isPromo = false) => {
    setSimResultMsg('');
    try {
      const sample = isPromo
        ? {
            title: `Promo ${appItem.shortName}!`,
            text: `Cashback s.d Rp50.000 bayar pakai ${appItem.shortName} hari ini!`,
          }
        : isIncome
          ? appItem.sampleIncome
          : appItem.sampleExpense;

      const res = await simulatePaymentNotification({
        packageName: appItem.packages[0],
        title: sample.title,
        text: sample.text,
        accounts,
      });

      if (!res.matched) {
        setSimResultMsg(
          `Filter Anti-Promo: Notifikasi "${sample.title}" otomatis diabaikan (tidak tercatat sebagai transaksi).`
        );
      } else if (res.synced) {
        await onSyncNotificationState?.();
        onDataChanged?.();
        setSimResultMsg(
          `Auto-Catat Berhasil: ${res.parsed.appName} (${res.parsed.type === 'Income' ? '+' : '-'}${formatCurrency(res.parsed.amount)}) langsung masuk ke riwayat transaksi.`
        );
      } else {
        await onSyncNotificationState?.();
        setSimResultMsg(
          `Masuk Antrean Konfirmasi: ${res.parsed.appName} (${formatCurrency(res.parsed.amount)}). Ketuk tombol "Tinjau Antrean" untuk mencatat.`
        );
      }
    } catch (err) {
      setSimResultMsg(extractApiError(err, 'Gagal menjalankan simulasi notifikasi.'));
    }
  };

  const handleClearNotifHistory = async () => {
    await clearAllHistory();
    await onSyncNotificationState?.();
  };

  const handleManualCheckUpdate = async () => {
    setCheckingUpdate(true);
    setUpdateStatusText('');
    try {
      const info = await onCheckUpdate?.({ interactive: true, forceRefresh: true });
      if (!info) {
        setUpdateStatusText(
          'Gagal memeriksa pembaruan. Pastikan koneksi internet dan server CUAN aktif.'
        );
      } else if (info.hasUpdate) {
        setUpdateStatusText(
          `Tersedia CUAN v${info.latestVersion} (Build ${info.latestVersionCode}).`
        );
      } else {
        setUpdateStatusText(
          `Aplikasi Anda sudah versi terbaru (v${installedInfo.version}).`
        );
      }
    } finally {
      setCheckingUpdate(false);
    }
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
      keyboardShouldPersistTaps="handled"
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
          <Text style={styles.avatarText}>{initials || 'CU'}</Text>
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
          {
            key: 'notif',
            label:
              pendingNotifs.length > 0
                ? `Deteksi Bayar (${pendingNotifs.length})`
                : 'Deteksi Bayar',
          },
          { key: 'security', label: 'Keamanan & M2M' },
          { key: 'prefs', label: 'Preferensi' },
          {
            key: 'about',
            label: updateInfo?.hasUpdate ? 'Update Tersedia •' : 'Tentang & Update',
          },
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

      {section === 'notif' && (
        <>
          <View style={[styles.card, SHADOW]}>
            <View style={styles.notifHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>
                  Deteksi Notifikasi Pembayaran
                </Text>
                <Text style={styles.mutedDesc}>
                  Tangkap transaksi masuk/keluar otomatis dari ShopeePay, SeaBank,
                  DANA, GoPay, dan BRImo (dengan filter anti-promo & anti-OTP).
                </Text>
              </View>
              <Switch
                value={Boolean(notifSettings?.enabled)}
                onValueChange={(v) => handleUpdateNotifSetting({ enabled: v })}
                trackColor={{ false: '#D1D5DB', true: '#6EE7B7' }}
                thumbColor={notifSettings?.enabled ? COLORS.emerald : '#F9FAFB'}
              />
            </View>

            {/* Status & Android Permissions */}
            {!notifStatus.supported ? (
              <View style={styles.infoNoticeBox}>
                <Ionicons
                  name="information-circle-outline"
                  size={18}
                  color={COLORS.blue}
                />
                <Text style={styles.infoNoticeText}>
                  Saat ini berjalan di {installedInfo.isExpoGo ? 'Expo Go' : 'Web/Non-Android'}.
                  Listener latar belakang aktif penuh di APK CUAN Android v1.2.0 ke atas. Anda
                  tetap dapat mencoba Simulator di bawah.
                </Text>
              </View>
            ) : notifStatus.permissionGranted ? (
              <View style={styles.grantedBox}>
                <Ionicons
                  name="checkmark-circle-outline"
                  size={18}
                  color={COLORS.emerald}
                />
                <Text style={styles.grantedText}>
                  Izin Akses Notifikasi Android aktif.{' '}
                  {notifSettings?.enabled
                    ? 'Pemantauan berjalan otomatis.'
                    : 'Aktifkan sakelar di atas untuk mulai memantau.'}
                </Text>
              </View>
            ) : (
              <View style={styles.permWarnBox}>
                <View style={styles.permWarnHead}>
                  <Ionicons name="warning-outline" size={18} color="#B45309" />
                  <Text style={styles.permWarnTitle}>
                    Izin Akses Notifikasi Belum Aktif
                  </Text>
                </View>
                <Text style={styles.permWarnDesc}>
                  Untuk Android 13–15 (APK sideload), lakukan 2 langkah sekali saja:
                  {'\n'}1. Buka Info Aplikasi → ikon titik 3 kanan atas → pilih
                  {' "'}Izinkan pengaturan terbatas{'"'}.
                  {'\n'}2. Buka Akses Notifikasi lalu aktifkan sakelar CUAN.
                </Text>
                <View style={styles.permBtnRow}>
                  <TouchableOpacity
                    onPress={() => openAppDetailsSettings()}
                    style={styles.permSecondaryBtn}
                  >
                    <Ionicons name="settings-outline" size={14} color={COLORS.navy} />
                    <Text style={styles.permSecondaryText}>1. Info Aplikasi</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => openNotificationAccessSettings()}
                    style={styles.permPrimaryBtn}
                  >
                    <Ionicons name="notifications-outline" size={14} color="#FFFFFF" />
                    <Text style={styles.permPrimaryText}>2. Akses Notifikasi</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {notifStatus.supported && (
              <TouchableOpacity
                onPress={() => openBatteryOptimizationSettings()}
                style={styles.secondaryOutlineBtn}
              >
                <Ionicons name="battery-charging-outline" size={16} color={COLORS.navy} />
                <Text style={styles.secondaryOutlineText}>
                  Matikan Hemat Baterai (Agar Stabil di Background)
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Mode Selection: Antrean vs Auto-Catat */}
          <View style={[styles.card, SHADOW]}>
            <Text style={styles.cardTitle}>Mode Pencatatan Otomatis</Text>
            <View style={styles.modeCardsCol}>
              {[
                {
                  key: 'queue',
                  icon: 'list-outline',
                  title: 'Antrean Konfirmasi (1-Ketuk)',
                  desc: 'Notifikasi valid masuk daftar review dulu supaya kategori & rekening bisa dicek sebelum disimpan.',
                },
                {
                  key: 'auto',
                  icon: 'flash-outline',
                  title: 'Auto-Catat Langsung (Background)',
                  desc: 'Langsung mencatat transaksi otomatis di latar belakang ke rekening pilihan (tetap masuk antrean bila offline).',
                },
              ].map((m) => {
                const active = (notifSettings?.mode || 'queue') === m.key;
                return (
                  <TouchableOpacity
                    key={m.key}
                    onPress={() => handleUpdateNotifSetting({ mode: m.key })}
                    style={[styles.modeOptionCard, active && styles.modeOptionActive]}
                  >
                    <View style={styles.modeOptionHead}>
                      <Ionicons
                        name={m.icon}
                        size={17}
                        color={active ? COLORS.emerald : COLORS.navy}
                      />
                      <Text
                        style={[
                          styles.modeOptionTitle,
                          active && { color: COLORS.emeraldDark },
                        ]}
                      >
                        {m.title}
                      </Text>
                    </View>
                    <Text style={styles.mutedDesc}>{m.desc}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.label}>Rekening Default (Untuk Auto-Catat)</Text>
            {accounts.length === 0 ? (
              <Text style={styles.mutedDesc}>
                Tambahkan minimal 1 rekening di tab Akun Keuangan terlebih dahulu.
              </Text>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.tabsRow}>
                  {accounts.map((acc) => {
                    const selected =
                      (notifSettings?.defaultAccountId || accounts[0]?.id) === acc.id;
                    return (
                      <TouchableOpacity
                        key={acc.id}
                        onPress={() =>
                          handleUpdateNotifSetting({ defaultAccountId: acc.id })
                        }
                        style={[styles.tabPill, selected && styles.tabPillActive]}
                      >
                        <Text
                          style={[
                            styles.tabText,
                            selected && styles.tabTextActive,
                          ]}
                        >
                          {acc.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>
            )}
          </View>

          {/* 5 Priority Apps & Account Mapping */}
          <View style={[styles.card, SHADOW]}>
            <Text style={styles.cardTitle}>
              Aplikasi Pembayaran & Pemetaan Rekening
            </Text>
            <Text style={styles.mutedDesc}>
              Pilih aplikasi yang dipantau dan arahkan otomatis ke rekening CUAN
              masing-masing.
            </Text>

            {MONITORED_APPS.map((appItem) => {
              const isEnabled = (notifSettings?.enabledApps || []).includes(appItem.key);
              const mappedAccId =
                notifSettings?.accountMap?.[appItem.key] || '';
              const isBiz = (notifSettings?.businessApps || []).includes(
                appItem.key
              );

              return (
                <View key={appItem.key} style={styles.appMapRow}>
                  <View style={styles.appMapHeader}>
                    <View
                      style={[
                        styles.appIconBox,
                        { backgroundColor: appItem.badgeBg },
                      ]}
                    >
                      <Ionicons
                        name={appItem.iconName}
                        size={16}
                        color={appItem.badgeColor}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.accName}>{appItem.name}</Text>
                      <Text style={styles.mutedDesc}>
                        {appItem.packages.join(' · ')}
                      </Text>
                    </View>
                    <Switch
                      value={isEnabled}
                      onValueChange={() => handleToggleMonitoredApp(appItem.key)}
                      trackColor={{ false: '#D1D5DB', true: '#6EE7B7' }}
                      thumbColor={isEnabled ? COLORS.emerald : '#F9FAFB'}
                    />
                  </View>

                  {isEnabled && accounts.length > 0 && (
                    <View style={styles.appMapBody}>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        <View style={styles.tabsRow}>
                          <TouchableOpacity
                            onPress={() => handleMapAppAccount(appItem.key, '')}
                            style={[
                              styles.miniPill,
                              !mappedAccId && styles.miniPillActive,
                            ]}
                          >
                            <Text
                              style={[
                                styles.miniPillText,
                                !mappedAccId && styles.miniPillTextActive,
                              ]}
                            >
                              Ikuti Default
                            </Text>
                          </TouchableOpacity>
                          {accounts.map((acc) => (
                            <TouchableOpacity
                              key={acc.id}
                              onPress={() =>
                                handleMapAppAccount(appItem.key, acc.id)
                              }
                              style={[
                                styles.miniPill,
                                mappedAccId === acc.id && styles.miniPillActive,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.miniPillText,
                                  mappedAccId === acc.id &&
                                    styles.miniPillTextActive,
                                ]}
                              >
                                {acc.name}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </ScrollView>

                      <TouchableOpacity
                        onPress={() => handleToggleBusinessApp(appItem.key)}
                        style={styles.bizTagBtn}
                      >
                        <Ionicons
                          name={isBiz ? 'checkbox' : 'square-outline'}
                          size={15}
                          color={isBiz ? COLORS.emerald : COLORS.grayText}
                        />
                        <Text style={styles.bizTagText}>
                          Tandai otomatis sebagai transaksi Usaha / Bisnis
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })}
          </View>

          {/* Pending Review Queue + Recent History */}
          <View style={[styles.card, SHADOW]}>
            <View style={styles.notifHeaderRow}>
              <Text style={styles.cardTitle}>
                Antrean ({pendingNotifs.length}) & Riwayat ({historyNotifs.length})
              </Text>
              {pendingNotifs.length > 0 && (
                <TouchableOpacity
                  onPress={() => onOpenNotifReview?.()}
                  style={styles.reviewActionBtn}
                >
                  <Text style={styles.reviewActionText}>Tinjau Antrean</Text>
                </TouchableOpacity>
              )}
            </View>

            {historyNotifs.length === 0 ? (
              <Text style={styles.mutedDesc}>
                Belum ada transaksi yang tercatat dari deteksi notifikasi.
              </Text>
            ) : (
              <>
                {historyNotifs.slice(0, 6).map((h) => (
                  <View key={h.id} style={styles.accRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.accName}>
                        {h.appName} · {h.category}
                      </Text>
                      <Text style={styles.mutedDesc} numberOfLines={1}>
                        {h.rawText || h.notes}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.histAmount,
                        {
                          color:
                            h.type === 'Income' ? COLORS.emerald : COLORS.danger,
                        },
                      ]}
                    >
                      {h.type === 'Income' ? '+' : '-'}
                      {formatCurrency(h.amount)}
                    </Text>
                  </View>
                ))}
                <TouchableOpacity
                  onPress={handleClearNotifHistory}
                  style={styles.secondaryOutlineBtn}
                >
                  <Ionicons name="trash-outline" size={14} color={COLORS.grayText} />
                  <Text style={styles.secondaryOutlineText}>Bersihkan Riwayat</Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          {/* Uji Coba / Simulasi Notifikasi */}
          <View style={[styles.card, SHADOW]}>
            <Text style={styles.cardTitle}>Simulasi & Uji Parser</Text>
            <Text style={styles.mutedDesc}>
              Uji langsung deteksi notifikasi untuk tiap aplikasi sesuai mode aktif (
              {notifSettings?.mode === 'auto'
                ? 'Auto-Catat Langsung'
                : 'Antrean Konfirmasi'}
              ).
            </Text>
            <View style={styles.simGrid}>
              {MONITORED_APPS.map((appItem) => (
                <View key={appItem.key} style={styles.simRow}>
                  <Text style={styles.simAppLabel}>{appItem.shortName}</Text>
                  <TouchableOpacity
                    onPress={() => handleSimulateAppNotif(appItem, false, false)}
                    style={styles.simBtn}
                  >
                    <Ionicons name="play-outline" size={12} color={COLORS.navy} />
                    <Text style={styles.simBtnText}>Keluar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleSimulateAppNotif(appItem, true, false)}
                    style={styles.simBtn}
                  >
                    <Ionicons name="play-outline" size={12} color={COLORS.emerald} />
                    <Text style={[styles.simBtnText, { color: COLORS.emerald }]}>
                      Masuk
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleSimulateAppNotif(appItem, false, true)}
                    style={styles.simBtn}
                  >
                    <Text style={[styles.simBtnText, { color: COLORS.grayText }]}>
                      Promo
                    </Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
            {!!simResultMsg && (
              <View style={styles.statusBanner}>
                <Text style={styles.statusBannerText}>{simResultMsg}</Text>
              </View>
            )}
          </View>
        </>
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
          <TouchableOpacity
            onPress={handleResetDefaultServer}
            style={styles.secondaryOutlineBtn}
          >
            <Ionicons name="refresh-outline" size={16} color={COLORS.navy} />
            <Text style={styles.secondaryOutlineText}>Reset ke Server Cloud Default</Text>
          </TouchableOpacity>
        </View>
      )}

      {section === 'about' && (
        <View style={[styles.card, SHADOW]}>
          <Text style={styles.cardTitle}>Tentang & Pembaruan Otomatis</Text>
          <Text style={styles.mutedDesc}>
            CUAN (Catat Uang, Aset Naik) versi Mobile App terhubung langsung ke
            cloud server untuk pencatatan transaksi, Zero-Based Budgeting,
            Target Tabungan, Mode Bisnis, dan analisis investasi vs inflasi.
          </Text>

          <View style={styles.metaGrid}>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Versi Terpasang</Text>
              <Text style={styles.versionTag}>
                v{installedInfo.version} (Build {installedInfo.versionCode})
              </Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Mode Aplikasi</Text>
              <Text style={styles.metaValue}>
                {installedInfo.isStandaloneAndroid
                  ? 'CUAN APK Android'
                  : 'Expo Go Preview'}
              </Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Package ID</Text>
              <Text style={styles.metaValue}>{installedInfo.appId}</Text>
            </View>
          </View>

          {updateInfo?.hasUpdate && (
            <View style={styles.updateHighlight}>
              <View style={styles.updateHighlightHead}>
                <Ionicons name="sparkles" size={16} color={COLORS.emeraldDark} />
                <Text style={styles.updateHighlightTitle}>
                  Pembaruan v{updateInfo.latestVersion} Tersedia
                  {updateInfo.sizeMb ? ` (${updateInfo.sizeMb} MB)` : ''}
                </Text>
              </View>
              {(updateInfo.releaseNotes ?? []).slice(0, 4).map((note, idx) => (
                <Text key={idx} style={styles.updateNoteLine}>
                  • {note}
                </Text>
              ))}
              <TouchableOpacity
                onPress={() => onOpenUpdateModal?.()}
                style={styles.primaryBtn}
              >
                <Text style={styles.primaryBtnText}>Update Otomatis Sekarang</Text>
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity
            onPress={handleManualCheckUpdate}
            disabled={checkingUpdate}
            style={[styles.checkUpdateBtn, checkingUpdate && { opacity: 0.7 }]}
          >
            {checkingUpdate ? (
              <ActivityIndicator color={COLORS.navy} size="small" />
            ) : (
              <>
                <Ionicons name="cloud-download-outline" size={17} color={COLORS.navy} />
                <Text style={styles.checkUpdateText}>Cek Pembaruan Aplikasi</Text>
              </>
            )}
          </TouchableOpacity>

          {!!updateStatusText && (
            <View style={styles.statusBanner}>
              <Text style={styles.statusBannerText}>{updateStatusText}</Text>
            </View>
          )}

          <TouchableOpacity
            onPress={() =>
              openDownloadInBrowser(
                updateInfo || {
                  apkProxyUrl: `${PRODUCTION_API_URL.replace(/\/api\/v1$/, '')}/api/v1/app/download?proxy=1`,
                }
              )
            }
            style={styles.browserLinkWrap}
          >
            <Ionicons name="open-outline" size={14} color={COLORS.grayText} />
            <Text style={styles.browserLinkText}>
              Unduh Installer APK Terbaru via Browser
            </Text>
          </TouchableOpacity>
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
  secondaryOutlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bg,
  },
  secondaryOutlineText: { fontSize: 12, fontWeight: '700', color: COLORS.navy },
  metaGrid: {
    backgroundColor: COLORS.bg,
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  metaLabel: { fontSize: 12, color: COLORS.grayText },
  metaValue: { fontSize: 12, fontWeight: '700', color: COLORS.navy },
  updateHighlight: {
    backgroundColor: COLORS.emeraldLight,
    borderRadius: 14,
    padding: 12,
    gap: 6,
  },
  updateHighlightHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  updateHighlightTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.emeraldDark,
  },
  updateNoteLine: {
    fontSize: 12,
    color: COLORS.navy,
    lineHeight: 17,
  },
  checkUpdateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bg,
  },
  checkUpdateText: { fontSize: 13, fontWeight: '700', color: COLORS.navy },
  statusBanner: {
    backgroundColor: COLORS.blueBg,
    borderRadius: 10,
    padding: 10,
  },
  statusBannerText: { fontSize: 12, fontWeight: '600', color: COLORS.navy },
  browserLinkWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 4,
  },
  browserLinkText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.grayText,
    textDecorationLine: 'underline',
  },
  notifHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  infoNoticeBox: {
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: COLORS.blueBg,
    alignItems: 'flex-start',
  },
  infoNoticeText: { flex: 1, fontSize: 12, color: COLORS.navy, lineHeight: 17 },
  grantedBox: {
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: COLORS.emeraldLight,
    alignItems: 'center',
  },
  grantedText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.emeraldDark,
    lineHeight: 17,
  },
  permWarnBox: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    gap: 8,
  },
  permWarnHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  permWarnTitle: { fontSize: 13, fontWeight: '800', color: '#92400E' },
  permWarnDesc: { fontSize: 12, color: '#78350F', lineHeight: 17 },
  permBtnRow: { flexDirection: 'row', gap: 8, marginTop: 2 },
  permSecondaryBtn: {
    flex: 1,
    flexDirection: 'row',
    gap: 5,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#F59E0B',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  permSecondaryText: { fontSize: 12, fontWeight: '700', color: COLORS.navy },
  permPrimaryBtn: {
    flex: 1,
    flexDirection: 'row',
    gap: 5,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: COLORS.emerald,
    alignItems: 'center',
    justifyContent: 'center',
  },
  permPrimaryText: { fontSize: 12, fontWeight: '800', color: '#FFFFFF' },
  modeCardsCol: { gap: 8 },
  modeOptionCard: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bg,
    gap: 4,
  },
  modeOptionActive: {
    borderColor: COLORS.emerald,
    backgroundColor: COLORS.emeraldLight,
  },
  modeOptionHead: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  modeOptionTitle: { fontSize: 13, fontWeight: '800', color: COLORS.navy },
  appMapRow: {
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: 8,
  },
  appMapHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  appIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appMapBody: { paddingLeft: 44, gap: 6 },
  miniPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bg,
  },
  miniPillActive: {
    backgroundColor: COLORS.navy,
    borderColor: COLORS.navy,
  },
  miniPillText: { fontSize: 11, fontWeight: '600', color: COLORS.navy },
  miniPillTextActive: { color: '#FFFFFF' },
  bizTagBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 2 },
  bizTagText: { fontSize: 11, color: COLORS.grayText, fontWeight: '600' },
  reviewActionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 99,
    backgroundColor: COLORS.emerald,
  },
  reviewActionText: { fontSize: 11, fontWeight: '800', color: '#FFFFFF' },
  histAmount: { fontSize: 12, fontWeight: '800' },
  simGrid: { gap: 8 },
  simRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  simAppLabel: { width: 78, fontSize: 12, fontWeight: '700', color: COLORS.navy },
  simBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 7,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bg,
  },
  simBtnText: { fontSize: 11, fontWeight: '700', color: COLORS.navy },
});

export default SettingsScreen;
