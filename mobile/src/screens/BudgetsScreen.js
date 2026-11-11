import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import CategoryBadge from '../components/CategoryBadge';
import { DONUT_COLORS, DonutChart } from '../components/SimpleCharts';
import api from '../services/api';
import { COLORS, SHADOW } from '../theme/theme';
import {
  extractApiError,
  formatCurrency,
  MONTH_NAMES_ID,
  parseNominalInput,
} from '../utils/format';

const BudgetsScreen = ({ user, onDataChanged }) => {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [budgets, setBudgets] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [category, setCategory] = useState('');
  const [limitAmount, setLimitAmount] = useState('');
  const [saving, setSaving] = useState(false);

  const loadBudgets = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const [bRes, txRes] = await Promise.all([
        api.get('/budgets', {
          params: {
            month,
            year,
            ...(user?.id ? { user_id: user.id } : {}),
          },
        }),
        api.get('/transactions', { params: { month, year, limit: 500 } }),
      ]);
      setBudgets(bRes.data ?? []);
      setTransactions(txRes.data ?? []);
    } catch (err) {
      Alert.alert('Error', extractApiError(err, 'Gagal memuat anggaran'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [month, year, user?.id]);

  useEffect(() => {
    loadBudgets(false);
  }, [loadBudgets]);

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

  const totalIncome = transactions
    .filter((t) => t.type === 'Income')
    .reduce((acc, t) => acc + Number(t.amount || 0), 0);

  const spentByCategory = transactions
    .filter((t) => t.type === 'Expense')
    .reduce((acc, t) => {
      const key = String(t.category || '').toLowerCase();
      acc[key] = (acc[key] || 0) + Number(t.amount || 0);
      return acc;
    }, {});

  const totalAllocated = budgets.reduce(
    (acc, b) => acc + Number(b.limit_amount || 0),
    0
  );
  const unallocated = totalIncome - totalAllocated;
  const allocationPct =
    totalIncome > 0 ? Math.min(100, Math.round((totalAllocated / totalIncome) * 100)) : 0;

  const segments = budgets.map((b, idx) => ({
    label: b.category,
    value: Number(b.limit_amount || 0),
    color: DONUT_COLORS[idx % DONUT_COLORS.length],
  }));
  if (unallocated > 0) {
    segments.push({
      label: 'Belum Teralokasi',
      value: unallocated,
      color: '#D1D5DB',
    });
  }

  const handleCreateBudget = async () => {
    const val = parseNominalInput(limitAmount);
    if (!category.trim() || !Number.isFinite(val) || val <= 0) {
      Alert.alert('Validasi', 'Isi nama kategori dan batas anggaran (> 0).');
      return;
    }
    setSaving(true);
    try {
      await api.post('/budgets', {
        category: category.trim(),
        limit_amount: val,
        month,
        year,
        ...(user?.id ? { user_id: user.id } : {}),
      });
      setCategory('');
      setLimitAmount('');
      setModalOpen(false);
      await loadBudgets(false);
      onDataChanged?.();
    } catch (err) {
      Alert.alert('Error', extractApiError(err, 'Gagal menambahkan budget'));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBudget = (b) => {
    Alert.alert('Hapus Anggaran', `Hapus pos "${b.category}"?`, [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/budgets/${b.id}`);
            await loadBudgets(false);
            onDataChanged?.();
          } catch (err) {
            Alert.alert('Error', extractApiError(err, 'Gagal menghapus budget'));
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadBudgets(true)}
            colors={[COLORS.emerald]}
            tintColor={COLORS.emerald}
          />
        }
      >
        <View style={styles.topRow}>
          <View>
            <Text style={styles.title}>Budgeting</Text>
            <Text style={styles.subtitle}>Zero-Based Budgeting bulanan</Text>
          </View>
          <TouchableOpacity onPress={() => setModalOpen(true)} style={styles.addBtn}>
            <Ionicons name="add" size={18} color="#FFFFFF" />
            <Text style={styles.addBtnText}>Budget</Text>
          </TouchableOpacity>
        </View>

        {/* Period Selector */}
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

        {/* Zero-Based Donut Summary */}
        <View style={[styles.card, SHADOW]}>
          <DonutChart
            segments={segments}
            centerTitle="Total Pemasukan"
            centerValue={formatCurrency(totalIncome)}
          />

          <View style={styles.summaryRows}>
            <View style={styles.summaryLine}>
              <Text style={styles.summaryLabel}>Total Dialokasikan</Text>
              <Text style={styles.summaryVal}>{formatCurrency(totalAllocated)}</Text>
            </View>
            <View style={styles.summaryLine}>
              <Text style={styles.summaryLabel}>Sisa Belum Dialokasikan</Text>
              <Text
                style={[
                  styles.summaryVal,
                  { color: unallocated < 0 ? COLORS.danger : COLORS.emerald },
                ]}
              >
                {formatCurrency(unallocated)}
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.banner,
              {
                backgroundColor:
                  unallocated === 0 && totalIncome > 0
                    ? COLORS.emeraldLight
                    : unallocated < 0
                      ? COLORS.dangerBg
                      : COLORS.blueBg,
              },
            ]}
          >
            <Text style={styles.bannerText}>
              {totalIncome === 0
                ? 'Catat pemasukan bulan ini untuk melihat target alokasi 100%.'
                : unallocated === 0
                  ? 'Sempurna! 100% pemasukan sudah teralokasi (Sisa Rp 0).'
                  : unallocated < 0
                    ? 'Total anggaran melebihi pemasukan bulan ini.'
                    : `${allocationPct}% teralokasi — masih ada ${formatCurrency(unallocated)} lagi menuju Rp 0.`}
            </Text>
          </View>
        </View>

        {/* Category Budget Cards */}
        {loading && budgets.length === 0 ? (
          <ActivityIndicator
            size="large"
            color={COLORS.emerald}
            style={{ marginTop: 24 }}
          />
        ) : budgets.length === 0 ? (
          <View style={[styles.card, SHADOW, { alignItems: 'center', padding: 24 }]}>
            <Text style={styles.emptyTitle}>Belum Ada Pos Anggaran</Text>
            <Text style={styles.mutedDesc}>
              Tambahkan kategori seperti Makan & Minum, Transport, atau Tabungan.
            </Text>
          </View>
        ) : (
          budgets.map((b, idx) => {
            const limit = Number(b.limit_amount || 0);
            const spent = spentByCategory[String(b.category || '').toLowerCase()] || 0;
            const rawPct = limit > 0 ? Math.round((spent / limit) * 100) : 0;
            const pct = Number.isFinite(rawPct) ? Math.min(100, Math.max(0, rawPct)) : 0;
            const over = spent > limit;
            return (
              <View key={b.id} style={[styles.card, SHADOW]}>
                <View style={styles.itemHead}>
                  <View style={styles.itemLeft}>
                    <CategoryBadge category={b.category} size={36} />
                    <View>
                      <Text style={styles.itemTitle}>{b.category}</Text>
                      <Text style={styles.mutedDesc}>
                        Terpakai {formatCurrency(spent)} / {formatCurrency(limit)}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={() => handleDeleteBudget(b)}
                    style={{ padding: 4 }}
                  >
                    <Ionicons name="trash-outline" size={17} color={COLORS.grayLight} />
                  </TouchableOpacity>
                </View>

                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${pct}%`,
                        backgroundColor: over
                          ? COLORS.danger
                          : DONUT_COLORS[idx % DONUT_COLORS.length],
                      },
                    ]}
                  />
                </View>

                <View style={styles.itemFoot}>
                  <Text
                    style={[
                      styles.pctText,
                      { color: over ? COLORS.danger : COLORS.grayText },
                    ]}
                  >
                    {pct}% terpakai
                  </Text>
                  <Text
                    style={[
                      styles.remainText,
                      { color: over ? COLORS.danger : COLORS.emerald },
                    ]}
                  >
                    {over
                      ? `Lebih ${formatCurrency(spent - limit)}`
                      : `Sisa ${formatCurrency(limit - spent)}`}
                  </Text>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      <Modal
        visible={modalOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setModalOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalBackdrop}
        >
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Tambah Pos Anggaran</Text>
              <TouchableOpacity onPress={() => setModalOpen(false)}>
                <Ionicons name="close" size={24} color={COLORS.navy} />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.label}>Kategori</Text>
              <TextInput
                value={category}
                onChangeText={setCategory}
                placeholder="Contoh: Makan & Minum"
                placeholderTextColor={COLORS.grayLight}
                style={styles.input}
              />

              <Text style={styles.label}>Batas Anggaran (Rp)</Text>
              <TextInput
                value={limitAmount}
                onChangeText={setLimitAmount}
                placeholder="1000000"
                placeholderTextColor={COLORS.grayLight}
                keyboardType="numeric"
                style={styles.input}
              />

              <TouchableOpacity
                onPress={handleCreateBudget}
                disabled={saving}
                style={[styles.saveBtn, saving && { opacity: 0.6 }]}
              >
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.saveBtnText}>Simpan Anggaran</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 16, paddingBottom: 96, gap: 12 },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { fontSize: 22, fontWeight: '800', color: COLORS.navy },
  subtitle: { fontSize: 12, color: COLORS.grayText, marginTop: 2 },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.emerald,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
  },
  addBtnText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
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
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 10,
  },
  summaryRows: { gap: 6, marginTop: 6 },
  summaryLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: { fontSize: 12, color: COLORS.grayText },
  summaryVal: { fontSize: 13, fontWeight: '700', color: COLORS.navy },
  banner: { borderRadius: 10, padding: 10, marginTop: 2 },
  bannerText: { fontSize: 12, fontWeight: '600', color: COLORS.navy },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: COLORS.navy },
  mutedDesc: { fontSize: 12, color: COLORS.grayText },
  itemHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  itemLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  itemTitle: { fontSize: 14, fontWeight: '700', color: COLORS.navy },
  progressTrack: {
    height: 8,
    backgroundColor: '#EAEFED',
    borderRadius: 99,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 99 },
  itemFoot: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pctText: { fontSize: 11, fontWeight: '600' },
  remainText: { fontSize: 12, fontWeight: '700' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(20,44,75,0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '88%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: COLORS.navy },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.navy,
    marginTop: 10,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.navy,
  },
  saveBtn: {
    backgroundColor: COLORS.emerald,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 8,
  },
  saveBtnText: { fontSize: 14, fontWeight: '800', color: '#FFFFFF' },
});

export default BudgetsScreen;
