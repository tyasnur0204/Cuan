import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import FinMateLogo from '../components/FinMateLogo';
import api, {
  DEFAULT_API_URL,
  PRODUCTION_API_URL,
  setCustomApiBaseUrl,
  STORAGE_KEYS,
} from '../services/api';
import { COLORS, SHADOW } from '../theme/theme';
import { extractApiError } from '../utils/format';

const FEATURES = [
  'Zero-Based Budgeting',
  'Analisis Return Investasi vs Inflasi',
  'Multi-Akun & Mode Bisnis / Usaha',
  'Laporan Keuangan Interaktif',
];

const LoginScreen = ({ onAuthenticated }) => {
  const [mode, setMode] = useState('login');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [showServerConfig, setShowServerConfig] = useState(false);
  const [serverUrl, setServerUrl] = useState(api.defaults.baseURL || DEFAULT_API_URL);

  const switchMode = (nextMode) => {
    setMode(nextMode);
    setErrorMessage('');
    setSuccessMessage('');
  };

  const handleSaveServerUrl = async () => {
    const updated = await setCustomApiBaseUrl(serverUrl);
    setServerUrl(updated);
    setShowServerConfig(false);
    setSuccessMessage(`Server API diatur ke: ${updated}`);
  };

  const handleSubmit = async () => {
    const cleanEmail = email.trim();
    const cleanName = username.trim();

    if (mode === 'register' && cleanName.length < 2) {
      setErrorMessage('Nama lengkap minimal 2 karakter.');
      return;
    }
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMessage('Masukkan alamat email yang valid.');
      return;
    }
    if (password.length < 6) {
      setErrorMessage('Password minimal 6 karakter.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      if (mode === 'register') {
        await api.post('/register', {
          username: cleanName,
          email: cleanEmail,
          password,
        });

        try {
          const loginRes = await api.post('/login', {
            email: cleanEmail,
            password,
          });
          const { access_token, user } = loginRes.data;
          await AsyncStorage.setItem(STORAGE_KEYS.TOKEN, access_token);
          if (user) {
            await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
          }
          onAuthenticated(user);
          return;
        } catch {
          setSuccessMessage('Registrasi berhasil! Silakan masuk dengan akun Anda.');
          setMode('login');
          setPassword('');
          return;
        }
      }

      const res = await api.post('/login', {
        email: cleanEmail,
        password,
      });
      const { access_token, user } = res.data;
      await AsyncStorage.setItem(STORAGE_KEYS.TOKEN, access_token);
      if (user) {
        await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
      }
      onAuthenticated(user);
    } catch (err) {
      setErrorMessage(extractApiError(err, 'Autentikasi gagal'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Brand Hero Banner */}
          <View style={styles.heroCard}>
            <View style={styles.brandRow}>
              <FinMateLogo size={46} variant="glass" />
              <View style={styles.brandTextWrap}>
                <Text style={styles.brandTitle}>FinMate</Text>
                <Text style={styles.brandSub}>Manajemen Keuangan Mahasiswa</Text>
              </View>
            </View>

            <Text style={styles.heroHeadline}>
              Atur Keuanganmu, Raih Masa Depanmu!
            </Text>
            <View style={styles.featureList}>
              {FEATURES.map((feat) => (
                <View key={feat} style={styles.featureItem}>
                  <Ionicons name="checkmark-circle" size={14} color="#A7F3D0" />
                  <Text style={styles.featureText}>{feat}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Auth Card */}
          <View style={[styles.authCard, SHADOW]}>
            <Text style={styles.authTitle}>
              {mode === 'login' ? 'Selamat Datang Kembali' : 'Buat Akun Baru'}
            </Text>
            <Text style={styles.authSubtitle}>
              {mode === 'login'
                ? 'Masuk dengan akun Anda, atau daftar bebas pada tab Daftar'
                : 'Daftar bebas dengan email apa saja untuk mulai mengelola keuangan'}
            </Text>

            {/* Segmented Mode Switch */}
            <View style={styles.segmentWrap}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => switchMode('login')}
                style={[styles.segmentBtn, mode === 'login' && styles.segmentBtnActive]}
              >
                <Text
                  style={[
                    styles.segmentText,
                    mode === 'login' && styles.segmentTextActive,
                  ]}
                >
                  Masuk
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => switchMode('register')}
                style={[
                  styles.segmentBtn,
                  mode === 'register' && styles.segmentBtnActive,
                ]}
              >
                <Text
                  style={[
                    styles.segmentText,
                    mode === 'register' && styles.segmentTextActive,
                  ]}
                >
                  Daftar
                </Text>
              </TouchableOpacity>
            </View>

            {!!successMessage && (
              <View style={styles.successBanner}>
                <Text style={styles.successText}>{successMessage}</Text>
              </View>
            )}

            {!!errorMessage && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            )}

            {mode === 'register' && (
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Nama Lengkap</Text>
                <TextInput
                  value={username}
                  onChangeText={setUsername}
                  placeholder="Masukkan nama lengkap Anda"
                  placeholderTextColor={COLORS.grayLight}
                  autoCapitalize="words"
                  style={styles.input}
                />
              </View>
            )}

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="Masukkan email Anda"
                placeholderTextColor={COLORS.grayLight}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.input}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.passwordWrap}>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder={
                    mode === 'login'
                      ? 'Masukkan password Anda'
                      : 'Minimal 6 karakter'
                  }
                  placeholderTextColor={COLORS.grayLight}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  style={[styles.input, styles.passwordInput]}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword((prev) => !prev)}
                  style={styles.eyeBtn}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={COLORS.grayText}
                  />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleSubmit}
              disabled={isSubmitting}
              style={[styles.submitBtn, isSubmitting && styles.submitBtnDisabled]}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <Text style={styles.submitText}>
                    {mode === 'login' ? 'Masuk ke Dashboard' : 'Daftar Akun'}
                  </Text>
                  <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => switchMode(mode === 'login' ? 'register' : 'login')}
              style={styles.switchLinkWrap}
            >
              <Text style={styles.switchHint}>
                {mode === 'login' ? 'Belum punya akun? ' : 'Sudah punya akun? '}
                <Text style={styles.switchAction}>
                  {mode === 'login' ? 'Daftar sekarang' : 'Masuk'}
                </Text>
              </Text>
            </TouchableOpacity>
          </View>

          {/* Advanced Server Endpoint Toggle */}
          <TouchableOpacity
            onPress={() => setShowServerConfig((prev) => !prev)}
            style={styles.serverToggle}
          >
            <Ionicons name="server-outline" size={14} color={COLORS.grayText} />
            <Text style={styles.serverToggleText}>
              {showServerConfig ? 'Tutup Konfigurasi Server' : 'Pengaturan Server API'}
            </Text>
          </TouchableOpacity>

          {showServerConfig && (
            <View style={[styles.serverBox, SHADOW]}>
              <Text style={styles.label}>URL Backend API</Text>
              <TextInput
                value={serverUrl}
                onChangeText={setServerUrl}
                placeholder={PRODUCTION_API_URL}
                placeholderTextColor={COLORS.grayLight}
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.input}
              />
              <View style={styles.serverActions}>
                <TouchableOpacity
                  onPress={() => setServerUrl(PRODUCTION_API_URL)}
                  style={styles.resetServerBtn}
                >
                  <Text style={styles.resetServerText}>Pakai Cloud Railway</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSaveServerUrl}
                  style={styles.saveServerBtn}
                >
                  <Text style={styles.saveServerText}>Simpan URL</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.bg },
  flex: { flex: 1 },
  scrollContent: { padding: 18, paddingBottom: 32, gap: 16 },
  heroCard: {
    backgroundColor: COLORS.emerald,
    borderRadius: 20,
    padding: 20,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  brandTextWrap: { flex: 1 },
  brandTitle: { fontSize: 20, fontWeight: '800', color: '#FFFFFF' },
  brandSub: { fontSize: 12, color: 'rgba(255,255,255,0.82)', marginTop: 2 },
  heroHeadline: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 16,
    lineHeight: 24,
  },
  featureList: { marginTop: 12, gap: 6 },
  featureItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  featureText: { fontSize: 12, color: 'rgba(255,255,255,0.92)', fontWeight: '500' },
  authCard: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  authTitle: { fontSize: 19, fontWeight: '700', color: COLORS.navy },
  authSubtitle: { fontSize: 12, color: COLORS.grayText, marginTop: 4, marginBottom: 16 },
  segmentWrap: {
    flexDirection: 'row',
    backgroundColor: COLORS.bg,
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 9,
    alignItems: 'center',
  },
  segmentBtnActive: {
    backgroundColor: '#FFFFFF',
    ...SHADOW,
  },
  segmentText: { fontSize: 13, fontWeight: '600', color: COLORS.grayText },
  segmentTextActive: { color: COLORS.navy },
  successBanner: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  successText: { fontSize: 12, color: COLORS.emeraldDark, fontWeight: '600' },
  errorBanner: {
    backgroundColor: COLORS.dangerBg,
    borderColor: '#FECACA',
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  errorText: { fontSize: 12, color: COLORS.danger, fontWeight: '600' },
  fieldGroup: { marginBottom: 14 },
  label: { fontSize: 12, fontWeight: '600', color: COLORS.navy, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    color: COLORS.navy,
    backgroundColor: '#FFFFFF',
  },
  passwordWrap: { position: 'relative', justifyContent: 'center' },
  passwordInput: { paddingRight: 44 },
  eyeBtn: { position: 'absolute', right: 12, padding: 4 },
  submitBtn: {
    backgroundColor: COLORS.emerald,
    borderRadius: 12,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  switchLinkWrap: { marginTop: 14, alignItems: 'center' },
  switchHint: { fontSize: 12, color: COLORS.grayText },
  switchAction: { fontWeight: '700', color: COLORS.emerald },
  serverToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  serverToggleText: { fontSize: 12, color: COLORS.grayText, fontWeight: '500' },
  serverBox: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 10,
  },
  serverActions: { flexDirection: 'row', gap: 10 },
  resetServerBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
  },
  resetServerText: { fontSize: 12, fontWeight: '600', color: COLORS.navy },
  saveServerBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: COLORS.navy,
    alignItems: 'center',
  },
  saveServerText: { fontSize: 12, fontWeight: '600', color: '#FFFFFF' },
});

export default LoginScreen;
