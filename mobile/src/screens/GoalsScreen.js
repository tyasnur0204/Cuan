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
import api from '../services/api';
import { COLORS, SHADOW } from '../theme/theme';
import {
  extractApiError,
  formatCurrency,
  getTodayISO,
  parseNominalInput,
} from '../utils/format';

const GOAL_CATEGORIES = [
  'Barang Impian',
  'Elektronik',
  'Kendaraan',
  'Dana Darurat',
  'Liburan',
  'Pendidikan',
  'Rumah & Properti',
];

const QUICK_PRESETS = [
  { title: 'Laptop Kerja', category: 'Elektronik', target: '10000000' },
  { title: 'HP Baru', category: 'Elektronik', target: '5000000' },
  { title: 'Motor Baru', category: 'Kendaraan', target: '22000000' },
  { title: 'Dana Darurat', category: 'Dana Darurat', target: '15000000' },
];

const QUICK_NOMINALS = [
  { label: '+20 rb', val: 20000 },
  { label: '+50 rb', val: 50000 },
  { label: '+100 rb', val: 100000 },
  { label: '+250 rb', val: 250000 },
  { label: '+500 rb', val: 500000 },
  { label: '+1 jt', val: 1000000 },
];

const GoalsScreen = ({ user, onDataChanged }) => {
  const [goals, setGoals] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterTab, setFilterTab] = useState('all');

  // Create modal
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Barang Impian');
  const [targetAmount, setTargetAmount] = useState('');
  const [initialAmount, setInitialAmount] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [notes, setNotes] = useState('');
  const [savingGoal, setSavingGoal] = useState(false);

  // Contribute / Withdraw modal
  const [txGoal, setTxGoal] = useState(null);
  const [txType, setTxType] = useState('deposit');
  const [txAmount, setTxAmount] = useState('');
  const [txAccountId, setTxAccountId] = useState('');
  const [txNotes, setTxNotes] = useState('');
  const [txSaving, setTxSaving] = useState(false);

  // History modal
  const [historyGoalId, setHistoryGoalId] = useState(null);

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const [gRes, aRes] = await Promise.all([
        api.get('/goals'),
        api.get('/accounts', {
          params: user?.id ? { user_id: user.id } : undefined,
        }),
      ]);
      setGoals(gRes.data ?? []);
      setAccounts(aRes.data ?? []);
    } catch (err) {
      Alert.alert('Error', extractApiError(err, 'Gagal memuat target tabungan'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadData(false);
  }, [loadData]);

  const handleCreateGoal = async () => {
    const targetVal = parseNominalInput(targetAmount);
    const initVal = initialAmount.trim() ? parseNominalInput(initialAmount) : 0;
    if (!title.trim() || !Number.isFinite(targetVal) || targetVal <= 0) {
      Alert.alert('Validasi', 'Isi nama target dan nominal target (> 0).');
      return;
    }
    if (!Number.isFinite(initVal) || initVal < 0) {
      Alert.alert('Validasi', 'Setoran awal tidak valid.');
      return;
    }
    const cleanDate = targetDate.trim();
    if (cleanDate && !/^\d{4}-\d{2}-\d{2}$/.test(cleanDate)) {
      Alert.alert('Validasi', 'Format target tanggal harus YYYY-MM-DD (atau kosongkan).');
      return;
    }
    setSavingGoal(true);
    try {
      await api.post('/goals', {
        title: title.trim(),
        category,
        target_amount: targetVal,
        initial_amount: initVal > 0 ? initVal : 0,
        target_date: cleanDate || null,
        notes: notes.trim() || null,
      });
      setTitle('');
      setCategory('Barang Impian');
      setTargetAmount('');
      setInitialAmount('');
      setTargetDate('');
      setNotes('');
      setCreateOpen(false);
      await loadData(false);
      onDataChanged?.();
    } catch (err) {
      Alert.alert('Error', extractApiError(err, 'Gagal membuat target tabungan'));
    } finally {
      setSavingGoal(false);
    }
  };

  const openContribute = (goal, mode = 'deposit') => {
    setTxGoal(goal);
    setTxType(mode);
    setTxAmount('');
    setTxAccountId('');
    setTxNotes('');
  };

  const handleContribute = async () => {
    if (!txGoal) return;
    const amt = parseNominalInput(txAmount);
    if (!Number.isFinite(amt) || amt <= 0) {
      Alert.alert('Validasi', 'Masukkan nominal (> 0).');
      return;
    }
    if (txType === 'withdraw' && amt > Number(txGoal.saved_amount || 0)) {
      Alert.alert('Validasi', 'Nominal penarikan melebihi saldo tabungan target ini.');
      return;
    }
    setTxSaving(true);
    try {
      await api.post(`/goals/${txGoal.id}/contribute`, {
        type: txType,
        amount: amt,
        contribution_date: getTodayISO(),
        account_id: txAccountId || null,
        notes: txNotes.trim() || null,
      });
      setTxGoal(null);
      await loadData(false);
      onDataChanged?.();
    } catch (err) {
      Alert.alert('Error', extractApiError(err, 'Gagal memproses setoran'));
    } finally {
      setTxSaving(false);
    }
  };

  const handleTogglePurchased = async (goal) => {
    try {
      await api.patch(`/goals/${goal.id}`, { is_purchased: !goal.is_purchased });
      await loadData(false);
      onDataChanged?.();
    } catch (err) {
      Alert.alert('Error', extractApiError(err, 'Gagal memperbarui status target'));
    }
  };

  const handleDeleteGoal = (goal) => {
    Alert.alert('Hapus Target', `Hapus target tabungan "${goal.title}"?`, [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/goals/${goal.id}`);
            await loadData(false);
            onDataChanged?.();
          } catch (err) {
            Alert.alert('Error', extractApiError(err, 'Gagal menghapus target'));
          }
        },
      },
    ]);
  };

  const handleRevertContribution = (goalId, contributionId) => {
    Alert.alert(
      'Batalkan Catatan',
      'Saldo target dan akun terkait akan disesuaikan kembali.',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Ya, Batalkan',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/goals/${goalId}/contributions/${contributionId}`);
              await loadData(false);
              onDataChanged?.();
            } catch (err) {
              Alert.alert('Error', extractApiError(err, 'Gagal membatalkan catatan'));
            }
          },
        },
      ]
    );
  };

  const activeGoals = goals.filter((g) => !g.is_purchased);
  const achievedGoals = goals.filter((g) => g.is_achieved && !g.is_purchased);
  const purchasedGoals = goals.filter((g) => g.is_purchased);

  const totalSaved = activeGoals.reduce(
    (acc, g) => acc + Number(g.saved_amount || 0),
    0
  );
  const totalTarget = activeGoals.reduce(
    (acc, g) => acc + Number(g.target_amount || 0),
    0
  );
  const overallPct =
    totalTarget > 0 ? Math.min(100, Math.round((totalSaved / totalTarget) * 100)) : 0;

  const filteredGoals = goals.filter((g) => {
    if (filterTab === 'active') return !g.is_purchased && !g.is_achieved;
    if (filterTab === 'achieved') return g.is_achieved && !g.is_purchased;
    if (filterTab === 'purchased') return g.is_purchased;
    return true;
  });

  const historyGoal = goals.find((g) => g.id === historyGoalId) || null;
  const txCurrentSaved = Number(txGoal?.saved_amount || 0);
  const txTargetVal = Number(txGoal?.target_amount || 0);
  const parsedTxDelta = txAmount ? parseNominalInput(txAmount) : 0;
  const txDelta = Number.isFinite(parsedTxDelta) && parsedTxDelta > 0 ? parsedTxDelta : 0;
  const txPreviewSaved =
    txType === 'deposit'
      ? txCurrentSaved + txDelta
      : Math.max(0, txCurrentSaved - txDelta);
  const rawTxPreviewPct =
    txTargetVal > 0 ? Math.round((txPreviewSaved / txTargetVal) * 100) : 0;
  const txPreviewPct = Number.isFinite(rawTxPreviewPct)
    ? Math.min(100, Math.max(0, rawTxPreviewPct))
    : 0;

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadData(true)}
            colors={[COLORS.emerald]}
            tintColor={COLORS.emerald}
          />
        }
      >
        <View style={styles.topRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Target Tabungan</Text>
            <Text style={styles.subtitle}>
              Menabung untuk beli barang impian — isi bebas kapanpun
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => setCreateOpen(true)}
            style={styles.addBtn}
          >
            <Ionicons name="add" size={18} color="#FFFFFF" />
            <Text style={styles.addBtnText}>Target</Text>
          </TouchableOpacity>
        </View>

        {/* Hero Summary */}
        <View style={[styles.heroCard, SHADOW]}>
          <View style={styles.heroHead}>
            <Text style={styles.heroLabel}>Total Tabungan Aktif</Text>
            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeText}>{overallPct}%</Text>
            </View>
          </View>
          <Text style={styles.heroAmount}>{formatCurrency(totalSaved)}</Text>
          <View style={styles.heroTrack}>
            <View style={[styles.heroFill, { width: `${overallPct}%` }]} />
          </View>
          <Text style={styles.heroMeta}>
            dari total target {formatCurrency(totalTarget)} · {activeGoals.length} aktif
            · {achievedGoals.length} siap dibeli
          </Text>
        </View>

        {/* Filter Tabs */}
        {goals.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
          >
            {[
              { key: 'all', label: `Semua (${goals.length})` },
              {
                key: 'active',
                label: `Berjalan (${goals.filter((g) => !g.is_purchased && !g.is_achieved).length})`,
              },
              { key: 'achieved', label: `Tercapai (${achievedGoals.length})` },
              { key: 'purchased', label: `Dibeli (${purchasedGoals.length})` },
            ].map((tab) => (
              <TouchableOpacity
                key={tab.key}
                onPress={() => setFilterTab(tab.key)}
                style={[
                  styles.filterChip,
                  filterTab === tab.key && styles.filterChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    filterTab === tab.key && styles.filterChipTextActive,
                  ]}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* List */}
        {loading && goals.length === 0 ? (
          <ActivityIndicator
            size="large"
            color={COLORS.emerald}
            style={{ marginTop: 24 }}
          />
        ) : filteredGoals.length === 0 ? (
          <View style={[styles.card, SHADOW, { alignItems: 'center', padding: 24 }]}>
            <Ionicons name="wallet-outline" size={34} color={COLORS.emerald} />
            <Text style={styles.emptyTitle}>
              {goals.length === 0
                ? 'Belum Ada Target Tabungan'
                : 'Tidak Ada Target di Filter Ini'}
            </Text>
            <Text style={styles.mutedDesc}>
              Buat target seperti beli Laptop, HP baru, atau Dana Darurat lalu isi kapan saja.
            </Text>
          </View>
        ) : (
          filteredGoals.map((g) => {
            const saved = Number(g.saved_amount || 0);
            const target = Number(g.target_amount || 0);
            const remain = Math.max(0, target - saved);
            const pct = Number(g.progress_pct || 0);
            return (
              <View key={g.id} style={[styles.card, SHADOW]}>
                <View style={styles.itemHead}>
                  <View style={styles.itemLeft}>
                    <CategoryBadge category={g.category} size={38} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemTitle} numberOfLines={1}>
                        {g.title}
                      </Text>
                      <Text style={styles.mutedDesc}>
                        {g.category}
                        {g.target_date ? ` · ${g.target_date}` : ' · Fleksibel'}
                      </Text>
                    </View>
                  </View>
                  <View
                    style={[
                      styles.statusBadge,
                      g.is_purchased
                        ? { backgroundColor: '#EEF2FF' }
                        : g.is_achieved
                          ? { backgroundColor: COLORS.emeraldLight }
                          : { backgroundColor: COLORS.bg },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusBadgeText,
                        {
                          color: g.is_purchased
                            ? COLORS.navy
                            : g.is_achieved
                              ? COLORS.emerald
                              : COLORS.navy,
                        },
                      ]}
                    >
                      {g.is_purchased
                        ? 'Dibeli ✓'
                        : g.is_achieved
                          ? 'Tercapai!'
                          : `${pct}%`}
                    </Text>
                  </View>
                </View>

                <View style={styles.amountRow}>
                  <Text style={styles.savedAmount}>{formatCurrency(saved)}</Text>
                  <Text style={styles.targetAmount}>dari {formatCurrency(target)}</Text>
                </View>

                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${Math.min(100, pct)}%`,
                        backgroundColor: g.is_purchased ? COLORS.navy : COLORS.emerald,
                      },
                    ]}
                  />
                </View>

                <Text style={styles.remainText}>
                  {remain === 0
                    ? 'Dana target sudah tercukupi!'
                    : `Kurang ${formatCurrency(remain)} lagi`}
                </Text>

                {!!g.notes && <Text style={styles.noteBox}>{g.notes}</Text>}

                <View style={styles.actionRow}>
                  <TouchableOpacity
                    onPress={() => openContribute(g, 'deposit')}
                    style={styles.topUpBtn}
                  >
                    <Ionicons name="add-circle-outline" size={16} color="#FFFFFF" />
                    <Text style={styles.topUpBtnText}>Isi Tabungan</Text>
                  </TouchableOpacity>

                  {saved > 0 && (
                    <TouchableOpacity
                      onPress={() => openContribute(g, 'withdraw')}
                      style={styles.secBtn}
                    >
                      <Text style={styles.secBtnText}>Tarik</Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    onPress={() => setHistoryGoalId(g.id)}
                    style={styles.secBtn}
                  >
                    <Text style={styles.secBtnText}>
                      Riwayat ({g.contributions?.length || 0})
                    </Text>
                  </TouchableOpacity>

                  {(g.is_achieved || g.is_purchased) && (
                    <TouchableOpacity
                      onPress={() => handleTogglePurchased(g)}
                      style={[styles.secBtn, { backgroundColor: COLORS.emeraldLight }]}
                    >
                      <Text style={[styles.secBtnText, { color: COLORS.emerald }]}>
                        {g.is_purchased ? 'Aktifkan' : 'Tandai Dibeli'}
                      </Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    onPress={() => handleDeleteGoal(g)}
                    style={{ padding: 6 }}
                  >
                    <Ionicons name="trash-outline" size={17} color={COLORS.grayLight} />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Modal: Create Goal */}
      <Modal
        visible={createOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setCreateOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalBackdrop}
        >
          <View style={styles.modalSheet}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Target Tabungan Baru</Text>
                <TouchableOpacity onPress={() => setCreateOpen(false)}>
                  <Ionicons name="close" size={24} color={COLORS.navy} />
                </TouchableOpacity>
              </View>

              <Text style={styles.label}>Inspirasi Cepat</Text>
              <View style={styles.chipWrap}>
                {QUICK_PRESETS.map((p) => (
                  <TouchableOpacity
                    key={p.title}
                    onPress={() => {
                      setTitle(p.title);
                      setCategory(p.category);
                      setTargetAmount(p.target);
                    }}
                    style={styles.presetChip}
                  >
                    <Text style={styles.presetChipText}>+ {p.title}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Nama Target / Barang</Text>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="Contoh: Beli Laptop Kerja"
                placeholderTextColor={COLORS.grayLight}
                style={styles.input}
              />

              <Text style={styles.label}>Kategori</Text>
              <View style={styles.chipWrap}>
                {GOAL_CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    onPress={() => setCategory(cat)}
                    style={[
                      styles.catChip,
                      category === cat && styles.catChipActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.catChipText,
                        category === cat && styles.catChipTextActive,
                      ]}
                    >
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Target Dana (Rp)</Text>
              <TextInput
                value={targetAmount}
                onChangeText={setTargetAmount}
                placeholder="5000000"
                placeholderTextColor={COLORS.grayLight}
                keyboardType="numeric"
                style={styles.input}
              />

              <Text style={styles.label}>Setoran Awal (Rp · Opsional)</Text>
              <TextInput
                value={initialAmount}
                onChangeText={setInitialAmount}
                placeholder="0 (boleh diisi kapan nanti)"
                placeholderTextColor={COLORS.grayLight}
                keyboardType="numeric"
                style={styles.input}
              />

              <Text style={styles.label}>Target Tanggal (Opsional, YYYY-MM-DD)</Text>
              <TextInput
                value={targetDate}
                onChangeText={setTargetDate}
                placeholder="Kosongkan jika bebas waktu"
                placeholderTextColor={COLORS.grayLight}
                style={styles.input}
              />

              <Text style={styles.label}>Catatan (Opsional)</Text>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder="Spesifikasi barang atau rencana nabung"
                placeholderTextColor={COLORS.grayLight}
                style={styles.input}
              />

              <TouchableOpacity
                onPress={handleCreateGoal}
                disabled={savingGoal}
                style={[styles.saveBtn, savingGoal && { opacity: 0.6 }]}
              >
                {savingGoal ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.saveBtnText}>Simpan Target Tabungan</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal: Contribute / Withdraw */}
      <Modal
        visible={Boolean(txGoal)}
        animationType="slide"
        transparent
        onRequestClose={() => setTxGoal(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalBackdrop}
        >
          <View style={styles.modalSheet}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.modalHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalTitle} numberOfLines={1}>
                    {txType === 'deposit' ? 'Isi Tabungan' : 'Tarik Tabungan'} —{' '}
                    {txGoal?.title}
                  </Text>
                  <Text style={styles.mutedDesc}>
                    Terkumpul {formatCurrency(txCurrentSaved)} /{' '}
                    {formatCurrency(txTargetVal)}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setTxGoal(null)}>
                  <Ionicons name="close" size={24} color={COLORS.navy} />
                </TouchableOpacity>
              </View>

              <View style={styles.switchRow}>
                <TouchableOpacity
                  onPress={() => setTxType('deposit')}
                  style={[
                    styles.switchBtn,
                    txType === 'deposit' && { backgroundColor: COLORS.emerald },
                  ]}
                >
                  <Text
                    style={[
                      styles.switchText,
                      txType === 'deposit' && { color: '#FFFFFF' },
                    ]}
                  >
                    + Setor Nabung
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  disabled={txCurrentSaved <= 0}
                  onPress={() => setTxType('withdraw')}
                  style={[
                    styles.switchBtn,
                    txType === 'withdraw' && { backgroundColor: COLORS.navy },
                    txCurrentSaved <= 0 && { opacity: 0.4 },
                  ]}
                >
                  <Text
                    style={[
                      styles.switchText,
                      txType === 'withdraw' && { color: '#FFFFFF' },
                    ]}
                  >
                    - Tarik Dana
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.previewBox}>
                <View style={styles.amountRow}>
                  <Text style={styles.mutedDesc}>Sesudah transaksi:</Text>
                  <Text style={styles.previewVal}>
                    {formatCurrency(txPreviewSaved)} ({txPreviewPct}%)
                  </Text>
                </View>
                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${txPreviewPct}%`, backgroundColor: COLORS.emerald },
                    ]}
                  />
                </View>
              </View>

              {txType === 'deposit' && (
                <View style={styles.chipWrap}>
                  {QUICK_NOMINALS.map((q) => (
                    <TouchableOpacity
                      key={q.val}
                      onPress={() => setTxAmount(String(q.val))}
                      style={styles.presetChip}
                    >
                      <Text style={styles.presetChipText}>{q.label}</Text>
                    </TouchableOpacity>
                  ))}
                  {txTargetVal > txCurrentSaved && (
                    <TouchableOpacity
                      onPress={() => setTxAmount(String(txTargetVal - txCurrentSaved))}
                      style={[styles.presetChip, { backgroundColor: COLORS.navy }]}
                    >
                      <Text style={[styles.presetChipText, { color: '#FFFFFF' }]}>
                        Genapkan Sisa
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              <Text style={styles.label}>Nominal (Rp)</Text>
              <TextInput
                value={txAmount}
                onChangeText={setTxAmount}
                placeholder="Contoh: 100000"
                placeholderTextColor={COLORS.grayLight}
                keyboardType="numeric"
                style={styles.input}
              />

              {accounts.length > 0 && (
                <>
                  <Text style={styles.label}>
                    {txType === 'deposit'
                      ? 'Sumber Dana Akun (Opsional)'
                      : 'Kembalikan ke Akun (Opsional)'}
                  </Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
                  >
                    <TouchableOpacity
                      onPress={() => setTxAccountId('')}
                      style={[
                        styles.catChip,
                        txAccountId === '' && styles.catChipActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.catChipText,
                          txAccountId === '' && styles.catChipTextActive,
                        ]}
                      >
                        Tabungan Saja
                      </Text>
                    </TouchableOpacity>
                    {accounts.map((acc) => (
                      <TouchableOpacity
                        key={acc.id}
                        onPress={() => setTxAccountId(acc.id)}
                        style={[
                          styles.catChip,
                          txAccountId === acc.id && styles.catChipActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.catChipText,
                            txAccountId === acc.id && styles.catChipTextActive,
                          ]}
                        >
                          {acc.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </>
              )}

              <Text style={styles.label}>Catatan (Opsional)</Text>
              <TextInput
                value={txNotes}
                onChangeText={setTxNotes}
                placeholder="Sisa jajan / bonus project"
                placeholderTextColor={COLORS.grayLight}
                style={styles.input}
              />

              <TouchableOpacity
                onPress={handleContribute}
                disabled={txSaving}
                style={[
                  styles.saveBtn,
                  txType === 'withdraw' && { backgroundColor: COLORS.navy },
                  txSaving && { opacity: 0.6 },
                ]}
              >
                {txSaving ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.saveBtnText}>
                    {txType === 'deposit'
                      ? 'Simpan Setoran Tabungan'
                      : 'Konfirmasi Penarikan'}
                  </Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal: History */}
      <Modal
        visible={Boolean(historyGoal)}
        animationType="slide"
        transparent
        onRequestClose={() => setHistoryGoalId(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalSheet, { maxHeight: '78%' }]}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle} numberOfLines={1}>
                  Riwayat — {historyGoal?.title}
                </Text>
                <Text style={styles.mutedDesc}>
                  Terkumpul {formatCurrency(historyGoal?.saved_amount)} /{' '}
                  {formatCurrency(historyGoal?.target_amount)}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setHistoryGoalId(null)}>
                <Ionicons name="close" size={24} color={COLORS.navy} />
              </TouchableOpacity>
            </View>

            <ScrollView>
              {(historyGoal?.contributions ?? []).length === 0 ? (
                <Text style={[styles.mutedDesc, { textAlign: 'center', padding: 24 }]}>
                  Belum ada riwayat setoran.
                </Text>
              ) : (
                historyGoal.contributions.map((c) => {
                  const isW = c.type === 'withdraw';
                  return (
                    <View key={c.id} style={styles.histRow}>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.histAmt,
                            { color: isW ? COLORS.danger : COLORS.emerald },
                          ]}
                        >
                          {isW ? '-' : '+'}
                          {formatCurrency(c.amount)}
                        </Text>
                        <Text style={styles.mutedDesc}>
                          {c.contribution_date}
                          {c.account_name ? ` · via ${c.account_name}` : ''}
                          {c.notes ? ` · ${c.notes}` : ''}
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => handleRevertContribution(historyGoal.id, c.id)}
                      >
                        <Text style={styles.revertText}>Batalkan</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>
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
    gap: 10,
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
  heroCard: {
    backgroundColor: COLORS.emerald,
    borderRadius: 18,
    padding: 18,
    gap: 8,
  },
  heroHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroLabel: { fontSize: 12, color: 'rgba(255,255,255,0.85)', fontWeight: '600' },
  heroBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 99,
  },
  heroBadgeText: { fontSize: 11, fontWeight: '800', color: '#FFFFFF' },
  heroAmount: { fontSize: 24, fontWeight: '800', color: '#FFFFFF' },
  heroTrack: {
    height: 7,
    borderRadius: 99,
    backgroundColor: 'rgba(255,255,255,0.25)',
    overflow: 'hidden',
  },
  heroFill: { height: '100%', backgroundColor: '#FFFFFF', borderRadius: 99 },
  heroMeta: { fontSize: 11, color: 'rgba(255,255,255,0.88)', fontWeight: '500' },
  filterRow: { gap: 8, paddingVertical: 2 },
  filterChip: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 99,
  },
  filterChipActive: { backgroundColor: COLORS.navy, borderColor: COLORS.navy },
  filterChipText: { fontSize: 12, fontWeight: '600', color: COLORS.grayText },
  filterChipTextActive: { color: '#FFFFFF' },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 10,
  },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: COLORS.navy, marginTop: 6 },
  mutedDesc: { fontSize: 12, color: COLORS.grayText },
  itemHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  itemLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  itemTitle: { fontSize: 15, fontWeight: '700', color: COLORS.navy },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99 },
  statusBadgeText: { fontSize: 11, fontWeight: '700' },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  savedAmount: { fontSize: 18, fontWeight: '800', color: COLORS.emerald },
  targetAmount: { fontSize: 12, color: COLORS.grayText },
  progressTrack: {
    height: 9,
    backgroundColor: '#EAEFED',
    borderRadius: 99,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 99 },
  remainText: { fontSize: 12, fontWeight: '600', color: COLORS.navy },
  noteBox: {
    fontSize: 12,
    color: COLORS.grayText,
    backgroundColor: COLORS.bg,
    padding: 10,
    borderRadius: 10,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  topUpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.emerald,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 10,
  },
  topUpBtnText: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },
  secBtn: {
    backgroundColor: COLORS.bg,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 10,
  },
  secBtnText: { fontSize: 12, fontWeight: '600', color: COLORS.navy },
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
    marginBottom: 10,
    gap: 10,
  },
  modalTitle: { fontSize: 17, fontWeight: '800', color: COLORS.navy },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.navy,
    marginTop: 10,
    marginBottom: 4,
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
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginVertical: 4 },
  presetChip: {
    backgroundColor: COLORS.emeraldLight,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 99,
  },
  presetChipText: { fontSize: 11, fontWeight: '700', color: COLORS.emerald },
  catChip: {
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 99,
  },
  catChipActive: { backgroundColor: COLORS.navy, borderColor: COLORS.navy },
  catChipText: { fontSize: 11, fontWeight: '600', color: COLORS.navy },
  catChipTextActive: { color: '#FFFFFF' },
  switchRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.bg,
    padding: 4,
    borderRadius: 12,
    gap: 6,
    marginBottom: 10,
  },
  switchBtn: { flex: 1, paddingVertical: 8, borderRadius: 9, alignItems: 'center' },
  switchText: { fontSize: 12, fontWeight: '700', color: COLORS.grayText },
  previewBox: {
    backgroundColor: COLORS.bg,
    borderRadius: 12,
    padding: 12,
    gap: 6,
    marginBottom: 8,
  },
  previewVal: { fontSize: 12, fontWeight: '800', color: COLORS.emerald },
  saveBtn: {
    backgroundColor: COLORS.emerald,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 14,
    marginBottom: 8,
  },
  saveBtnText: { fontSize: 14, fontWeight: '800', color: '#FFFFFF' },
  histRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 10,
  },
  histAmt: { fontSize: 14, fontWeight: '800' },
  revertText: { fontSize: 12, fontWeight: '600', color: COLORS.danger },
});

export default GoalsScreen;
