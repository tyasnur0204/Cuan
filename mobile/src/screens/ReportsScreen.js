import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  CashflowBarChart,
  DONUT_COLORS,
  DonutChart,
} from '../components/SimpleCharts';
import api from '../services/api';
import { COLORS, SHADOW } from '../theme/theme';
import {
  extractApiError,
  formatCompactCurrency,
  formatCurrency,
  MONTH_NAMES_ID,
} from '../utils/format';

const ReportsScreen = () => {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [tab, setTab] = useState('summary');
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadReports = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await api.get('/reports/summary', { params: { month, year } });
      setReport(res.data);
    } catch (err) {
      Alert.alert('Error', extractApiError(err, 'Gagal memuat laporan keuangan'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [month, year]);

  useEffect(() => {
    loadReports(false);
  }, [loadReports]);

  const shiftMonth = (delta) => {
    let m = month + delta;
    let y = year;
    if (m < 1) {
      m = 12;
      y -= 1;
    } else if (m > 12) {
      m = 1;
      y += 1;
    }
    setMonth(m);
    setYear(y);
  };

  const expenseCats = report?.expense_by_category ?? [];
  const incomeCats = report?.income_by_category ?? [];
  const monthlyComp = report?.monthly_comparison ?? [];
  const netSavings = Number(report?.net_savings ?? 0);

  const activeCategoryList = tab === 'income' ? incomeCats : expenseCats;
  const donutSegments = activeCategoryList.map((item, idx) => ({
    label: item.category,
    value: item.amount,
    color: DONUT_COLORS[idx % DONUT_COLORS.length],
  }));

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => loadReports(true)}
          colors={[COLORS.emerald]}
          tintColor={COLORS.emerald}
        />
      }
    >
      <View>
        <Text style={styles.title}>Laporan Keuangan</Text>
        <Text style={styles.subtitle}>Analisis arus kas & kategori per periode</Text>
      </View>

      {/* Period Stepper */}
      <View style={[styles.periodBar, SHADOW]}>
        <TouchableOpacity onPress={() => shiftMonth(-1)} style={styles.stepBtn}>
          <Ionicons name="chevron-back" size={18} color={COLORS.navy} />
        </TouchableOpacity>
        <Text style={styles.periodText}>
          {MONTH_NAMES_ID[month - 1]} {year}
        </Text>
        <TouchableOpacity onPress={() => shiftMonth(1)} style={styles.stepBtn}>
          <Ionicons name="chevron-forward" size={18} color={COLORS.navy} />
        </TouchableOpacity>
      </View>

      {/* Sub Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabsRow}
      >
        {[
          { key: 'summary', label: 'Ringkasan' },
          { key: 'expense', label: 'Pengeluaran' },
          { key: 'income', label: 'Pemasukan' },
          { key: 'compare', label: '6 Bulan' },
        ].map((t) => (
          <TouchableOpacity
            key={t.key}
            onPress={() => setTab(t.key)}
            style={[styles.tabPill, tab === t.key && styles.tabPillActive]}
          >
            <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading && !report ? (
        <ActivityIndicator
          size="large"
          color={COLORS.emerald}
          style={{ marginTop: 28 }}
        />
      ) : (
        <>
          {/* Summary KPI Strip */}
          <View style={styles.kpiRow}>
            <View style={[styles.kpiCard, SHADOW]}>
              <Text style={styles.kpiLabel}>Pemasukan</Text>
              <Text style={[styles.kpiVal, { color: COLORS.emerald }]}>
                {formatCompactCurrency(report?.total_income)}
              </Text>
            </View>
            <View style={[styles.kpiCard, SHADOW]}>
              <Text style={styles.kpiLabel}>Pengeluaran</Text>
              <Text style={styles.kpiVal}>
                {formatCompactCurrency(report?.total_expenses)}
              </Text>
            </View>
            <View style={[styles.kpiCard, SHADOW]}>
              <Text style={styles.kpiLabel}>Selisih</Text>
              <Text
                style={[
                  styles.kpiVal,
                  { color: netSavings >= 0 ? COLORS.emerald : COLORS.danger },
                ]}
              >
                {formatCompactCurrency(netSavings)}
              </Text>
            </View>
          </View>

          {tab === 'compare' || tab === 'summary' ? (
            <View style={[styles.card, SHADOW]}>
              <Text style={styles.cardTitle}>Perbandingan 6 Bulan Terakhir</Text>
              <CashflowBarChart data={monthlyComp} />
              <View style={styles.tableWrap}>
                {monthlyComp.map((m) => (
                  <View key={`${m.year}-${m.month}`} style={styles.compRow}>
                    <Text style={styles.compMonth}>
                      {m.label} {m.year}
                    </Text>
                    <Text style={styles.compInc}>+{formatCompactCurrency(m.income)}</Text>
                    <Text style={styles.compExp}>-{formatCompactCurrency(m.expense)}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {tab !== 'compare' && (
            <View style={[styles.card, SHADOW]}>
              <Text style={styles.cardTitle}>
                Rincian {tab === 'income' ? 'Pemasukan' : 'Pengeluaran'} per Kategori
              </Text>
              {activeCategoryList.length === 0 ? (
                <Text style={styles.mutedDesc}>
                  Belum ada catatan pada kategori ini di periode terpilih.
                </Text>
              ) : (
                <>
                  <DonutChart
                    segments={donutSegments}
                    centerTitle={tab === 'income' ? 'Total Masuk' : 'Total Keluar'}
                    centerValue={formatCompactCurrency(
                      tab === 'income'
                        ? report?.total_income
                        : report?.total_expenses
                    )}
                    size={158}
                  />
                  <View style={styles.catList}>
                    {activeCategoryList.map((item, idx) => (
                      <View key={item.category} style={styles.catRow}>
                        <View style={styles.catTop}>
                          <View style={styles.catNameWrap}>
                            <View
                              style={[
                                styles.dot,
                                {
                                  backgroundColor:
                                    DONUT_COLORS[idx % DONUT_COLORS.length],
                                },
                              ]}
                            />
                            <Text style={styles.catName}>{item.category}</Text>
                          </View>
                          <Text style={styles.catAmt}>
                            {formatCurrency(item.amount)} ({item.percentage}%)
                          </Text>
                        </View>
                        <View style={styles.progressTrack}>
                          <View
                            style={[
                              styles.progressFill,
                              {
                                width: `${Math.min(100, item.percentage)}%`,
                                backgroundColor:
                                  DONUT_COLORS[idx % DONUT_COLORS.length],
                              },
                            ]}
                          />
                        </View>
                      </View>
                    ))}
                  </View>
                </>
              )}
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 16, paddingBottom: 96, gap: 12 },
  title: { fontSize: 22, fontWeight: '800', color: COLORS.navy },
  subtitle: { fontSize: 12, color: COLORS.grayText, marginTop: 2 },
  periodBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.card,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  stepBtn: { padding: 6 },
  periodText: { fontSize: 14, fontWeight: '700', color: COLORS.navy },
  tabsRow: { gap: 8 },
  tabPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 99,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  tabPillActive: { backgroundColor: COLORS.emerald, borderColor: COLORS.emerald },
  tabText: { fontSize: 12, fontWeight: '600', color: COLORS.navy },
  tabTextActive: { color: '#FFFFFF' },
  kpiRow: { flexDirection: 'row', gap: 8 },
  kpiCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  kpiLabel: { fontSize: 11, color: COLORS.grayText, fontWeight: '600' },
  kpiVal: { fontSize: 14, fontWeight: '800', color: COLORS.navy, marginTop: 4 },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 12,
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: COLORS.navy },
  mutedDesc: { fontSize: 12, color: COLORS.grayText },
  tableWrap: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 10,
    gap: 8,
  },
  compRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  compMonth: { fontSize: 12, fontWeight: '700', color: COLORS.navy, width: 90 },
  compInc: { fontSize: 12, fontWeight: '700', color: COLORS.emerald },
  compExp: { fontSize: 12, fontWeight: '700', color: COLORS.danger },
  catList: { gap: 10 },
  catRow: { gap: 5 },
  catTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  catNameWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  catName: { fontSize: 13, fontWeight: '700', color: COLORS.navy },
  catAmt: { fontSize: 12, fontWeight: '600', color: COLORS.grayText },
  progressTrack: {
    height: 7,
    backgroundColor: '#EAEFED',
    borderRadius: 99,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 99 },
});

export default ReportsScreen;
