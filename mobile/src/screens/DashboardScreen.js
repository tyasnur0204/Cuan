import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import CategoryBadge from '../components/CategoryBadge';
import { CashflowBarChart } from '../components/SimpleCharts';
import api, { STORAGE_KEYS } from '../services/api';
import { COLORS, SHADOW } from '../theme/theme';
import { extractApiError, formatCurrency, MONTH_NAMES_ID } from '../utils/format';

const DashboardScreen = ({ user, onNavigate, refreshKey }) => {
  const [summary, setSummary] = useState(null);
  const [businessStats, setBusinessStats] = useState({
    income: 0,
    expense: 0,
    profit: 0,
    txCount: 0,
    accountCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadDashboard = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');

    try {
      const savedInf = await AsyncStorage.getItem(STORAGE_KEYS.INFLATION_RATE);
      const inflationRate = Number(savedInf) || 3.2;
      const now = new Date();
      const month = now.getMonth() + 1;
      const year = now.getFullYear();

      const [summaryRes, accountsRes, monthTxRes] = await Promise.all([
        api.get('/dashboard/summary', { params: { inflation_rate: inflationRate } }),
        api.get('/accounts'),
        api.get('/transactions', { params: { month, year, limit: 500 } }),
      ]);

      setSummary(summaryRes.data);

      const accounts = accountsRes.data ?? [];
      const monthTxs = monthTxRes.data ?? [];
      const businessAccIds = new Set(
        accounts.filter((a) => a.is_business_account).map((a) => a.id)
      );

      let bizIncome = 0;
      let bizExpense = 0;
      let bizCount = 0;
      for (const tx of monthTxs) {
        const catLower = String(tx.category || '').toLowerCase();
        const isBiz =
          Boolean(tx.is_business) ||
          businessAccIds.has(tx.account_id) ||
          catLower.includes('usaha') ||
          catLower.includes('bisnis') ||
          catLower.includes('proyek');
        if (!isBiz) continue;
        bizCount += 1;
        const amt = Number(tx.amount || 0);
        if (tx.type === 'Income') bizIncome += amt;
        else if (tx.type === 'Expense') bizExpense += amt;
      }

      setBusinessStats({
        income: bizIncome,
        expense: bizExpense,
        profit: bizIncome - bizExpense,
        txCount: bizCount,
        accountCount: businessAccIds.size,
      });
    } catch (err) {
      setError(extractApiError(err, 'Gagal memuat ringkasan dashboard'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard(false);
  }, [loadDashboard, refreshKey]);

  const now = new Date();
  const periodLabel = `${MONTH_NAMES_ID[now.getMonth()]} ${now.getFullYear()}`;
  const budgetLimit = Number(summary?.total_budget_limit ?? 0);
  const budgetRemaining = Number(summary?.remaining_budget ?? 0);
  const budgetSpent = Number(summary?.current_month_expenses ?? 0);
  const budgetUsedPct =
    budgetLimit > 0 ? Math.min(100, Math.round((budgetSpent / budgetLimit) * 100)) : 0;
  const netReal = Number(summary?.net_real_growth_pct ?? 0);

  if (loading && !summary) {
    return (
      <View style={styles.centerState}>
        <ActivityIndicator size="large" color={COLORS.emerald} />
        <Text style={styles.loadingText}>Memuat ringkasan keuangan...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => loadDashboard(true)}
          colors={[COLORS.emerald]}
          tintColor={COLORS.emerald}
        />
      }
    >
      {/* Greeting Header */}
      <View style={styles.greetingRow}>
        <View style={styles.greetingTextWrap}>
          <Text style={styles.greetingSub}>Halo, {user?.username || 'Pengguna'}</Text>
          <Text style={styles.greetingTitle}>Ringkasan {periodLabel}</Text>
        </View>
        <TouchableOpacity
          onPress={() => onNavigate('reports')}
          style={styles.reportPill}
        >
          <Ionicons name="bar-chart-outline" size={14} color={COLORS.emerald} />
          <Text style={styles.reportPillText}>Laporan</Text>
        </TouchableOpacity>
      </View>

      {!!error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Total Assets Hero Card */}
      <View style={[styles.heroCard, SHADOW]}>
        <Text style={styles.heroLabel}>Total Kekayaan Bersih</Text>
        <Text style={styles.heroAmount}>{formatCurrency(summary?.total_assets)}</Text>
        <View style={styles.heroMetaRow}>
          <View style={styles.heroMetaChip}>
            <Ionicons name="wallet-outline" size={14} color="#A7F3D0" />
            <Text style={styles.heroMetaText}>
              Kas Likuid: {formatCurrency(summary?.cash_balance)}
            </Text>
          </View>
        </View>
      </View>

      {/* Income & Expense Row */}
      <View style={styles.kpiRow}>
        <View style={[styles.kpiCard, SHADOW]}>
          <View style={styles.kpiHead}>
            <Text style={styles.kpiLabel}>Pemasukan</Text>
            <View style={[styles.kpiIcon, { backgroundColor: COLORS.emeraldLight }]}>
              <Ionicons name="arrow-down" size={14} color={COLORS.emerald} />
            </View>
          </View>
          <Text style={[styles.kpiValue, { color: COLORS.emerald }]}>
            {formatCurrency(summary?.current_month_income)}
          </Text>
        </View>

        <View style={[styles.kpiCard, SHADOW]}>
          <View style={styles.kpiHead}>
            <Text style={styles.kpiLabel}>Pengeluaran</Text>
            <View style={[styles.kpiIcon, { backgroundColor: COLORS.dangerBg }]}>
              <Ionicons name="arrow-up" size={14} color={COLORS.danger} />
            </View>
          </View>
          <Text style={[styles.kpiValue, { color: COLORS.navy }]}>
            {formatCurrency(summary?.current_month_expenses)}
          </Text>
        </View>
      </View>

      {/* Quick Menu Shortcuts */}
      <View style={styles.shortcutRow}>
        {[
          { key: 'transactions_new', label: 'Catat', icon: 'add-circle' },
          { key: 'goals', label: 'Tabungan', icon: 'flag' },
          { key: 'budgets', label: 'Budget', icon: 'pie-chart' },
          { key: 'portfolio', label: 'Investasi', icon: 'trending-up' },
          { key: 'reports', label: 'Laporan', icon: 'document-text' },
        ].map((item) => (
          <TouchableOpacity
            key={item.key}
            activeOpacity={0.75}
            onPress={() => onNavigate(item.key)}
            style={styles.shortcutItem}
          >
            <View style={[styles.shortcutCircle, SHADOW]}>
              <Ionicons name={item.icon} size={20} color={COLORS.emerald} />
            </View>
            <Text style={styles.shortcutLabel}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Budget Progress & Inflation Growth */}
      <View style={[styles.card, SHADOW]}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Sisa Budget Bulan Ini</Text>
          <TouchableOpacity onPress={() => onNavigate('budgets')}>
            <Text style={styles.cardAction}>Kelola →</Text>
          </TouchableOpacity>
        </View>
        {budgetLimit > 0 ? (
          <>
            <View style={styles.budgetTopRow}>
              <Text
                style={[
                  styles.budgetRemain,
                  { color: budgetRemaining < 0 ? COLORS.danger : COLORS.navy },
                ]}
              >
                {formatCurrency(budgetRemaining)}
              </Text>
              <Text style={styles.budgetLimitText}>
                dari {formatCurrency(budgetLimit)} ({budgetUsedPct}%)
              </Text>
            </View>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${budgetUsedPct}%`,
                    backgroundColor:
                      budgetRemaining < 0 ? COLORS.danger : COLORS.emerald,
                  },
                ]}
              />
            </View>
          </>
        ) : (
          <Text style={styles.mutedDesc}>
            Belum ada anggaran ditetapkan bulan ini. Ketuk Kelola untuk membuat
            Zero-Based Budget.
          </Text>
        )}

        <View style={styles.divider} />

        <View style={styles.inflationRow}>
          <View>
            <Text style={styles.inflationLabel}>Pertumbuhan Riil Investasi</Text>
            <Text style={styles.mutedDesc}>
              Dibanding asumsi inflasi {summary?.inflation_rate_pct ?? 3.2}% / thn
            </Text>
          </View>
          <View
            style={[
              styles.growthBadge,
              {
                backgroundColor:
                  netReal >= 0 ? COLORS.emeraldLight : COLORS.dangerBg,
              },
            ]}
          >
            <Text
              style={[
                styles.growthBadgeText,
                { color: netReal >= 0 ? COLORS.emerald : COLORS.danger },
              ]}
            >
              {netReal >= 0 ? `+${netReal}%` : `${netReal}%`}
            </Text>
          </View>
        </View>
      </View>

      {/* Target Tabungan Impian Card */}
      <View style={[styles.card, SHADOW]}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.cardTitle}>Target Tabungan Impian</Text>
            <Text style={styles.mutedDesc}>
              {(summary?.saving_goals_summary?.active_count ?? 0) > 0
                ? `${summary.saving_goals_summary.active_count} aktif · ${formatCurrency(summary.saving_goals_summary.total_saved)}`
                : 'Menabung untuk barang impian kapanpun'}
            </Text>
          </View>
          <TouchableOpacity onPress={() => onNavigate('goals')}>
            <Text style={styles.cardAction}>
              {(summary?.saving_goals_summary?.active_count ?? 0) > 0
                ? 'Isi / Kelola →'
                : '+ Buat Target →'}
            </Text>
          </TouchableOpacity>
        </View>

        {(summary?.saving_goals_summary?.top_goals ?? []).length === 0 ? (
          <Text style={styles.mutedDesc}>
            Belum ada target tabungan aktif. Ketuk + Buat Target untuk mulai menabung membeli barang impian.
          </Text>
        ) : (
          <View style={{ gap: 10 }}>
            {summary.saving_goals_summary.top_goals.map((g) => (
              <TouchableOpacity
                key={g.id}
                onPress={() => onNavigate('goals')}
                style={{
                  backgroundColor: COLORS.bg,
                  borderRadius: 12,
                  padding: 11,
                  gap: 6,
                }}
              >
                <View style={styles.txRow}>
                  <CategoryBadge category={g.category} size={32} />
                  <Text style={[styles.txCat, { flex: 1 }]} numberOfLines={1}>
                    {g.title}
                  </Text>
                  <Text style={styles.cardAction}>{g.progress_pct}%</Text>
                </View>
                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${Math.min(100, Number(g.progress_pct || 0))}%`,
                        backgroundColor: COLORS.emerald,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.txMeta}>
                  {formatCurrency(g.saved_amount)} / {formatCurrency(g.target_amount)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* 6-Month Cashflow Chart */}
      <View style={[styles.card, SHADOW]}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Arus Kas 6 Bulan Terakhir</Text>
          <TouchableOpacity onPress={() => onNavigate('reports')}>
            <Text style={styles.cardAction}>Detail →</Text>
          </TouchableOpacity>
        </View>
        <CashflowBarChart data={summary?.monthly_cashflow ?? []} />
      </View>

      {/* Recent Transactions */}
      <View style={[styles.card, SHADOW]}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Transaksi Terbaru</Text>
          <TouchableOpacity onPress={() => onNavigate('transactions')}>
            <Text style={styles.cardAction}>Lihat Semua →</Text>
          </TouchableOpacity>
        </View>

        {(summary?.recent_transactions ?? []).length === 0 ? (
          <Text style={styles.mutedDesc}>
            Belum ada transaksi tercatat. Tambahkan transaksi pertama Anda!
          </Text>
        ) : (
          <View style={styles.txList}>
            {summary.recent_transactions.map((tx) => {
              const isInc = tx.type === 'Income';
              const isTrf = tx.type === 'Transfer';
              return (
                <View key={tx.id} style={styles.txRow}>
                  <CategoryBadge category={tx.category} type={tx.type} size={38} />
                  <View style={styles.txInfo}>
                    <Text style={styles.txCat} numberOfLines={1}>
                      {tx.category}
                    </Text>
                    <Text style={styles.txMeta} numberOfLines={1}>
                      {tx.account_name} · {tx.transaction_date}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.txAmount,
                      {
                        color: isInc
                          ? COLORS.emerald
                          : isTrf
                            ? COLORS.navy
                            : COLORS.danger,
                      },
                    ]}
                  >
                    {isInc ? '+' : isTrf ? '' : '-'}
                    {formatCurrency(tx.amount)}
                  </Text>
                </View>
              );
            })}
          </View>
        )}
      </View>

      {/* Business Mode Card */}
      <View style={[styles.card, SHADOW]}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.cardTitle}>Laba/Rugi Usaha Bulan Ini</Text>
            <Text style={styles.mutedDesc}>
              {businessStats.accountCount} akun usaha · {businessStats.txCount} transaksi
            </Text>
          </View>
          <View style={styles.bizTag}>
            <Text style={styles.bizTagText}>Mode Bisnis</Text>
          </View>
        </View>

        <View style={styles.bizGrid}>
          <View style={styles.bizCell}>
            <Text style={styles.bizCellLabel}>Omzet</Text>
            <Text style={[styles.bizCellVal, { color: COLORS.emerald }]}>
              {formatCurrency(businessStats.income)}
            </Text>
          </View>
          <View style={styles.bizCell}>
            <Text style={styles.bizCellLabel}>Biaya</Text>
            <Text style={[styles.bizCellVal, { color: COLORS.navy }]}>
              {formatCurrency(businessStats.expense)}
            </Text>
          </View>
          <View style={styles.bizCellHighlight}>
            <Text style={styles.bizCellLabel}>Laba Bersih</Text>
            <Text
              style={[
                styles.bizCellVal,
                {
                  color:
                    businessStats.profit >= 0 ? COLORS.emerald : COLORS.danger,
                },
              ]}
            >
              {businessStats.profit >= 0 ? '+' : ''}
              {formatCurrency(businessStats.profit)}
            </Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 16, paddingBottom: 96, gap: 14 },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.bg,
    gap: 10,
  },
  loadingText: { fontSize: 13, color: COLORS.grayText },
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  greetingTextWrap: { flex: 1 },
  greetingSub: { fontSize: 12, color: COLORS.grayText, fontWeight: '500' },
  greetingTitle: { fontSize: 20, fontWeight: '800', color: COLORS.navy },
  reportPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: COLORS.emeraldLight,
  },
  reportPillText: { fontSize: 12, fontWeight: '700', color: COLORS.emerald },
  errorBox: {
    backgroundColor: COLORS.dangerBg,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorText: { fontSize: 12, color: COLORS.danger, fontWeight: '600' },
  heroCard: {
    backgroundColor: COLORS.emerald,
    borderRadius: 18,
    padding: 18,
  },
  heroLabel: { fontSize: 12, color: 'rgba(255,255,255,0.82)', fontWeight: '600' },
  heroAmount: { fontSize: 26, fontWeight: '800', color: '#FFFFFF', marginTop: 4 },
  heroMetaRow: { flexDirection: 'row', marginTop: 12 },
  heroMetaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.16)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  heroMetaText: { fontSize: 12, color: '#FFFFFF', fontWeight: '600' },
  kpiRow: { flexDirection: 'row', gap: 12 },
  kpiCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  kpiHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  kpiLabel: { fontSize: 12, color: COLORS.grayText, fontWeight: '600' },
  kpiIcon: {
    width: 24,
    height: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiValue: { fontSize: 15, fontWeight: '800' },
  shortcutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  shortcutItem: { alignItems: 'center', gap: 6, flex: 1 },
  shortcutCircle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shortcutLabel: { fontSize: 11, color: COLORS.navy, fontWeight: '600' },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: COLORS.navy },
  cardAction: { fontSize: 12, fontWeight: '700', color: COLORS.emerald },
  budgetTopRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  budgetRemain: { fontSize: 18, fontWeight: '800' },
  budgetLimitText: { fontSize: 11, color: COLORS.grayText },
  progressTrack: {
    height: 8,
    backgroundColor: '#EAEFED',
    borderRadius: 99,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 99 },
  mutedDesc: { fontSize: 12, color: COLORS.grayText, lineHeight: 17 },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 14 },
  inflationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  inflationLabel: { fontSize: 13, fontWeight: '700', color: COLORS.navy },
  growthBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99 },
  growthBadgeText: { fontSize: 13, fontWeight: '800' },
  txList: { gap: 12 },
  txRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  txInfo: { flex: 1 },
  txCat: { fontSize: 13, fontWeight: '700', color: COLORS.navy },
  txMeta: { fontSize: 11, color: COLORS.grayText, marginTop: 1 },
  txAmount: { fontSize: 13, fontWeight: '700' },
  bizTag: {
    backgroundColor: COLORS.emeraldLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 99,
  },
  bizTagText: { fontSize: 11, fontWeight: '700', color: COLORS.emerald },
  bizGrid: { gap: 8 },
  bizCell: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    backgroundColor: COLORS.bg,
  },
  bizCellHighlight: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    backgroundColor: COLORS.emeraldLight,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  bizCellLabel: { fontSize: 12, color: COLORS.grayText, fontWeight: '600' },
  bizCellVal: { fontSize: 14, fontWeight: '800' },
});

export default DashboardScreen;
