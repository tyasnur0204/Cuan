import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import FinMateLogo from './src/components/FinMateLogo';
import BudgetsScreen from './src/screens/BudgetsScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import LoginScreen from './src/screens/LoginScreen';
import PortfolioScreen from './src/screens/PortfolioScreen';
import ReportsScreen from './src/screens/ReportsScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import TransactionsScreen from './src/screens/TransactionsScreen';
import {
  initApiBaseUrl,
  setOnUnauthorized,
  STORAGE_KEYS,
} from './src/services/api';
import { COLORS, SHADOW } from './src/theme/theme';

function MainApp() {
  const [booting, setBooting] = useState(true);
  const [user, setUser] = useState(null);
  const [activeRoute, setActiveRoute] = useState('dashboard');
  const [openTxCreate, setOpenTxCreate] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleLogout = useCallback(async () => {
    await AsyncStorage.multiRemove([STORAGE_KEYS.TOKEN, STORAGE_KEYS.USER]);
    setUser(null);
    setActiveRoute('dashboard');
  }, []);

  useEffect(() => {
    setOnUnauthorized(() => {
      setUser(null);
      setActiveRoute('dashboard');
    });
  }, []);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        await initApiBaseUrl();
        const [token, userJson] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.TOKEN),
          AsyncStorage.getItem(STORAGE_KEYS.USER),
        ]);
        if (token) {
          setUser(userJson ? JSON.parse(userJson) : { username: 'Pengguna' });
        }
      } catch {
        setUser(null);
      } finally {
        setBooting(false);
      }
    };
    bootstrap();
  }, []);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (user && activeRoute !== 'dashboard') {
        setActiveRoute('dashboard');
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [user, activeRoute]);

  const navigateTo = useCallback((target) => {
    if (target === 'transactions_new') {
      setOpenTxCreate(true);
      setActiveRoute('transactions');
      return;
    }
    setActiveRoute(target);
  }, []);

  const bumpRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  if (booting) {
    return (
      <View style={styles.bootWrap}>
        <FinMateLogo size={64} variant="solid" />
        <ActivityIndicator
          size="large"
          color={COLORS.emerald}
          style={{ marginTop: 18 }}
        />
      </View>
    );
  }

  if (!user) {
    return (
      <LoginScreen
        onAuthenticated={(loggedUser) => {
          setUser(loggedUser || { username: 'Pengguna' });
          setActiveRoute('dashboard');
        }}
      />
    );
  }

  const initials = (user?.username || 'FM')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      {/* Top Header Bar */}
      <View style={styles.header}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => setActiveRoute('dashboard')}
          style={styles.headerBrand}
        >
          <FinMateLogo size={34} variant="solid" />
          <View>
            <Text style={styles.headerTitle}>FinMate</Text>
            <Text style={styles.headerSub}>Keuangan Mahasiswa</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={() => setActiveRoute('reports')}
            style={[
              styles.headerIconBtn,
              activeRoute === 'reports' && styles.headerIconActive,
            ]}
            accessibilityLabel="Laporan Keuangan"
          >
            <Ionicons
              name="bar-chart-outline"
              size={19}
              color={
                activeRoute === 'reports' ? COLORS.emerald : COLORS.navy
              }
            />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveRoute('settings')}
            style={[
              styles.avatarBtn,
              activeRoute === 'settings' && styles.avatarBtnActive,
            ]}
            accessibilityLabel="Profil & Pengaturan"
          >
            <Text style={styles.avatarBtnText}>{initials || 'FM'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Active Screen */}
      <View style={styles.screenArea}>
        {activeRoute === 'dashboard' && (
          <DashboardScreen
            user={user}
            onNavigate={navigateTo}
            refreshKey={refreshKey}
          />
        )}
        {activeRoute === 'transactions' && (
          <TransactionsScreen
            openCreateModal={openTxCreate}
            onClearCreateModal={() => setOpenTxCreate(false)}
            onNavigate={navigateTo}
            onDataChanged={bumpRefresh}
          />
        )}
        {activeRoute === 'budgets' && (
          <BudgetsScreen onDataChanged={bumpRefresh} />
        )}
        {activeRoute === 'portfolio' && (
          <PortfolioScreen user={user} onDataChanged={bumpRefresh} />
        )}
        {activeRoute === 'reports' && <ReportsScreen />}
        {activeRoute === 'settings' && (
          <SettingsScreen
            user={user}
            onUserUpdated={setUser}
            onLogout={handleLogout}
            onDataChanged={bumpRefresh}
          />
        )}
      </View>

      {/* Bottom Tab Bar with Center Elevated + Action Button */}
      <View style={[styles.tabBar, SHADOW]}>
        <TouchableOpacity
          onPress={() => setActiveRoute('dashboard')}
          style={styles.tabItem}
        >
          <Ionicons
            name={activeRoute === 'dashboard' ? 'home' : 'home-outline'}
            size={21}
            color={activeRoute === 'dashboard' ? COLORS.emerald : COLORS.grayText}
          />
          <Text
            style={[
              styles.tabLabel,
              activeRoute === 'dashboard' && styles.tabLabelActive,
            ]}
          >
            Home
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveRoute('transactions')}
          style={styles.tabItem}
        >
          <Ionicons
            name={
              activeRoute === 'transactions'
                ? 'swap-horizontal'
                : 'swap-horizontal-outline'
            }
            size={21}
            color={
              activeRoute === 'transactions' ? COLORS.emerald : COLORS.grayText
            }
          />
          <Text
            style={[
              styles.tabLabel,
              activeRoute === 'transactions' && styles.tabLabelActive,
            ]}
          >
            Transaksi
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => navigateTo('transactions_new')}
          style={styles.fabBtn}
          accessibilityLabel="Tambah Transaksi"
        >
          <Ionicons name="add" size={28} color="#FFFFFF" />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveRoute('budgets')}
          style={styles.tabItem}
        >
          <Ionicons
            name={activeRoute === 'budgets' ? 'pie-chart' : 'pie-chart-outline'}
            size={21}
            color={activeRoute === 'budgets' ? COLORS.emerald : COLORS.grayText}
          />
          <Text
            style={[
              styles.tabLabel,
              activeRoute === 'budgets' && styles.tabLabelActive,
            ]}
          >
            Budget
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveRoute('portfolio')}
          style={styles.tabItem}
        >
          <Ionicons
            name={
              activeRoute === 'portfolio'
                ? 'trending-up'
                : 'trending-up-outline'
            }
            size={21}
            color={activeRoute === 'portfolio' ? COLORS.emerald : COLORS.grayText}
          />
          <Text
            style={[
              styles.tabLabel,
              activeRoute === 'portfolio' && styles.tabLabelActive,
            ]}
          >
            Investasi
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <MainApp />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  bootWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerBrand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerTitle: { fontSize: 16, fontWeight: '800', color: COLORS.navy },
  headerSub: { fontSize: 10, color: COLORS.grayText, fontWeight: '500' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIconActive: {
    backgroundColor: COLORS.emeraldLight,
  },
  avatarBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.emerald,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarBtnActive: {
    borderWidth: 2,
    borderColor: COLORS.navy,
  },
  avatarBtnText: { fontSize: 12, fontWeight: '800', color: '#FFFFFF' },
  screenArea: { flex: 1, backgroundColor: COLORS.bg },
  tabBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 6,
    paddingBottom: 6,
    paddingHorizontal: 6,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: 2,
  },
  tabLabel: { fontSize: 10, fontWeight: '600', color: COLORS.grayText },
  tabLabelActive: { color: COLORS.emerald, fontWeight: '700' },
  fabBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.emerald,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -24,
    borderWidth: 4,
    borderColor: COLORS.bg,
    ...SHADOW,
  },
});
