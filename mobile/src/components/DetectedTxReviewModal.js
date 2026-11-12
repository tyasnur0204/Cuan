import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { findMonitoredAppByKey } from '../services/paymentNotificationParser';
import {
  clearAllPending,
  confirmPendingEvent,
  dismissPendingEvent,
} from '../services/paymentNotifications';
import { COLORS, SHADOW } from '../theme/theme';
import {
  extractApiError,
  formatCurrency,
  getTodayISO,
  parseNominalInput,
} from '../utils/format';

const QUICK_CATEGORIES = [
  'Makan & Minum',
  'Transport',
  'Belanja & Pembayaran',
  'Tagihan & Utilitas',
  'Transfer & Pembayaran',
  'Pemasukan Usaha',
  'Hiburan',
];

const DetectedTxReviewModal = ({
  visible,
  pendingItems = [],
  accounts = [],
  onClose,
  onRefreshQueues,
  onTransactionSaved,
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [type, setType] = useState('Expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Belanja & Pembayaran');
  const [accountId, setAccountId] = useState('');
  const [txDate, setTxDate] = useState(getTodayISO());
  const [notes, setNotes] = useState('');
  const [isBusiness, setIsBusiness] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const safeIndex = Math.min(selectedIndex, Math.max(0, pendingItems.length - 1));
  const activeItem = pendingItems[safeIndex] || null;

  useEffect(() => {
    if (!visible || !activeItem) return;
    setType(activeItem.type === 'Income' ? 'Income' : 'Expense');
    setAmount(String(activeItem.amount || ''));
    setCategory(activeItem.category || 'Belanja & Pembayaran');
    const validSuggested =
      activeItem.suggestedAccountId &&
      accounts.some((a) => a.id === activeItem.suggestedAccountId)
        ? activeItem.suggestedAccountId
        : accounts[0]?.id || '';
    setAccountId(validSuggested);
    setTxDate(activeItem.transactionDate || getTodayISO());
    setNotes(activeItem.notes || '');
    setIsBusiness(Boolean(activeItem.isBusiness));
  }, [visible, activeItem?.id, accounts]);

  const handleConfirmCurrent = async () => {
    if (!activeItem) return;
    const numAmount = parseNominalInput(amount);
    if (!Number.isFinite(numAmount) || numAmount <= 0) {
      Alert.alert('Validasi', 'Masukkan nominal lebih besar dari 0.');
      return;
    }
    if (!category.trim()) {
      Alert.alert('Validasi', 'Kategori wajib diisi.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(txDate.trim())) {
      Alert.alert('Validasi', 'Format tanggal harus YYYY-MM-DD.');
      return;
    }
    if (!accountId) {
      Alert.alert(
        'Rekening Kosong',
        'Buat rekening/dompet terlebih dahulu di Pengaturan -> Akun.'
      );
      return;
    }

    setSubmitting(true);
    try {
      await confirmPendingEvent(activeItem, {
        accountId,
        type,
        category: category.trim(),
        amount: numAmount,
        transactionDate: txDate.trim(),
        notes: notes.trim(),
        isBusiness,
      });
      await onRefreshQueues?.();
      onTransactionSaved?.();
      if (pendingItems.length <= 1) {
        onClose?.();
      }
    } catch (err) {
      Alert.alert('Gagal Mencatat', extractApiError(err, 'Gagal menyimpan transaksi.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDismissCurrent = async () => {
    if (!activeItem) return;
    setSubmitting(true);
    try {
      await dismissPendingEvent(activeItem.id);
      await onRefreshQueues?.();
      if (pendingItems.length <= 1) {
        onClose?.();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmAll = async () => {
    if (accounts.length === 0) {
      Alert.alert(
        'Rekening Kosong',
        'Buat minimal 1 rekening di menu Pengaturan sebelum mencatat otomatis.'
      );
      return;
    }
    setSubmitting(true);
    let savedCount = 0;
    let failedCount = 0;
    try {
      for (const item of pendingItems) {
        const targetAcc =
          (item.suggestedAccountId &&
            accounts.some((a) => a.id === item.suggestedAccountId) &&
            item.suggestedAccountId) ||
          accountId ||
          accounts[0]?.id;
        if (!targetAcc) {
          failedCount += 1;
          continue;
        }
        try {
          await confirmPendingEvent(item, { accountId: targetAcc });
          savedCount += 1;
        } catch {
          failedCount += 1;
        }
      }
      await onRefreshQueues?.();
      if (savedCount > 0) {
        onTransactionSaved?.();
      }
      if (failedCount > 0) {
        Alert.alert(
          'Sebagian Tersimpan',
          `${savedCount} transaksi berhasil dicatat, ${failedCount} gagal. Periksa koneksi atau isi manual.`
        );
      } else {
        Alert.alert('Berhasil', `${savedCount} transaksi otomatis berhasil dicatat!`);
        onClose?.();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleClearAll = () => {
    Alert.alert(
      'Abaikan Semua Antrean',
      `Hapus ${pendingItems.length} notifikasi pembayaran yang menunggu konfirmasi?`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus Semua',
          style: 'destructive',
          onPress: async () => {
            await clearAllPending();
            await onRefreshQueues?.();
            onClose?.();
          },
        },
      ]
    );
  };

  const appMeta = activeItem ? findMonitoredAppByKey(activeItem.appKey) : null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Konfirmasi Transaksi Terdeteksi</Text>
              <Text style={styles.subtitle}>
                {pendingItems.length > 0
                  ? `${pendingItems.length} notifikasi pembayaran siap dicatat`
                  : 'Tidak ada antrean notifikasi'}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={COLORS.navy} />
            </TouchableOpacity>
          </View>

          {!activeItem ? (
            <View style={styles.emptyWrap}>
              <Ionicons name="checkmark-done-circle-outline" size={44} color={COLORS.emerald} />
              <Text style={styles.emptyText}>Semua notifikasi pembayaran sudah diproses.</Text>
            </View>
          ) : (
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.scrollBody}
            >
              {pendingItems.length > 1 && (
                <View style={styles.pagerRow}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.chipRow}>
                      {pendingItems.map((it, idx) => (
                        <TouchableOpacity
                          key={it.id}
                          onPress={() => setSelectedIndex(idx)}
                          style={[
                            styles.pagerChip,
                            idx === safeIndex && styles.pagerChipActive,
                          ]}
                        >
                          <Text
                            style={[
                              styles.pagerChipText,
                              idx === safeIndex && styles.pagerChipTextActive,
                            ]}
                          >
                            {idx + 1}. {it.appName} · {formatCurrency(it.amount)}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                </View>
              )}

              {/* Detected App & Raw Notification Card */}
              <View style={styles.rawCard}>
                <View style={styles.rawTop}>
                  <View
                    style={[
                      styles.appBadge,
                      { backgroundColor: appMeta?.badgeBg || COLORS.emeraldLight },
                    ]}
                  >
                    <Ionicons
                      name={appMeta?.iconName || 'notifications-outline'}
                      size={14}
                      color={appMeta?.badgeColor || COLORS.emerald}
                    />
                    <Text
                      style={[
                        styles.appBadgeText,
                        { color: appMeta?.badgeColor || COLORS.emerald },
                      ]}
                    >
                      {activeItem.appName}
                    </Text>
                  </View>
                  {activeItem.simulated && (
                    <Text style={styles.simTag}>Simulasi</Text>
                  )}
                </View>
                {!!activeItem.rawTitle && (
                  <Text style={styles.rawTitle}>{activeItem.rawTitle}</Text>
                )}
                <Text style={styles.rawText}>{activeItem.rawText}</Text>
                {!!activeItem.errorReason && (
                  <Text style={styles.errNote}>
                    Catatan sync: {activeItem.errorReason}
                  </Text>
                )}
              </View>

              {/* Tipe Transaksi */}
              <Text style={styles.label}>Tipe Transaksi</Text>
              <View style={styles.typeRow}>
                {[
                  { key: 'Expense', label: 'Pengeluaran' },
                  { key: 'Income', label: 'Pemasukan' },
                ].map((opt) => (
                  <TouchableOpacity
                    key={opt.key}
                    onPress={() => setType(opt.key)}
                    style={[
                      styles.typeBtn,
                      type === opt.key &&
                        (opt.key === 'Income'
                          ? styles.typeIncomeActive
                          : styles.typeExpenseActive),
                    ]}
                  >
                    <Text
                      style={[
                        styles.typeBtnText,
                        type === opt.key && { color: COLORS.card },
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Nominal */}
              <Text style={styles.label}>Nominal (Rp)</Text>
              <TextInput
                value={amount}
                onChangeText={setAmount}
                keyboardType="numeric"
                placeholder="50.000"
                style={styles.input}
              />

              {/* Pilih Rekening */}
              <Text style={styles.label}>Rekening / Dompet CUAN</Text>
              {accounts.length === 0 ? (
                <Text style={styles.warnAcc}>
                  Belum ada rekening. Tambahkan rekening di menu Pengaturan -&gt; Akun.
                </Text>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.chipRow}>
                    {accounts.map((acc) => (
                      <TouchableOpacity
                        key={acc.id}
                        onPress={() => setAccountId(acc.id)}
                        style={[
                          styles.chip,
                          accountId === acc.id && styles.chipActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            accountId === acc.id && styles.chipTextActive,
                          ]}
                        >
                          {acc.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              )}

              {/* Kategori */}
              <Text style={styles.label}>Kategori</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.chipRow}>
                  {QUICK_CATEGORIES.map((cat) => (
                    <TouchableOpacity
                      key={cat}
                      onPress={() => setCategory(cat)}
                      style={[
                        styles.chip,
                        category === cat && styles.chipActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          category === cat && styles.chipTextActive,
                        ]}
                      >
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
              <TextInput
                value={category}
                onChangeText={setCategory}
                placeholder="Kategori transaksi"
                style={[styles.input, { marginTop: 8 }]}
              />

              {/* Tanggal & Catatan */}
              <Text style={styles.label}>Tanggal (YYYY-MM-DD)</Text>
              <TextInput
                value={txDate}
                onChangeText={setTxDate}
                placeholder="2026-11-12"
                style={styles.input}
              />

              <Text style={styles.label}>Catatan</Text>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder="Catatan transaksi"
                style={styles.input}
              />

              <View style={styles.switchRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.switchTitle}>Tandai Transaksi Usaha</Text>
                  <Text style={styles.switchSub}>
                    Masuk ke analitik laba bersih Mode Bisnis
                  </Text>
                </View>
                <Switch
                  value={isBusiness}
                  onValueChange={setIsBusiness}
                  trackColor={{ false: '#D1D5DB', true: COLORS.emerald }}
                  thumbColor={COLORS.card}
                />
              </View>

              {/* Actions */}
              <View style={styles.actionRow}>
                <TouchableOpacity
                  onPress={handleDismissCurrent}
                  disabled={submitting}
                  style={styles.dismissBtn}
                >
                  <Text style={styles.dismissBtnText}>Abaikan</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleConfirmCurrent}
                  disabled={submitting}
                  style={styles.confirmBtn}
                >
                  {submitting ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
                      <Text style={styles.confirmBtnText}>Simpan Transaksi</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              {pendingItems.length > 1 && (
                <View style={styles.bulkRow}>
                  <TouchableOpacity
                    onPress={handleConfirmAll}
                    disabled={submitting}
                    style={[styles.bulkBtn, SHADOW]}
                  >
                    <Ionicons name="flash-outline" size={16} color={COLORS.emerald} />
                    <Text style={styles.bulkBtnText}>
                      Catat Semua ({pendingItems.length})
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleClearAll}
                    disabled={submitting}
                    style={styles.clearAllBtn}
                  >
                    <Text style={styles.clearAllText}>Hapus Semua</Text>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(20, 44, 75, 0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 24,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  title: { fontSize: 17, fontWeight: '800', color: COLORS.navy },
  subtitle: { fontSize: 12, color: COLORS.grayText, marginTop: 2 },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: 36,
    gap: 10,
  },
  emptyText: { fontSize: 13, color: COLORS.grayText, fontWeight: '600' },
  scrollBody: { paddingBottom: 16 },
  pagerRow: { marginBottom: 10 },
  pagerChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bg,
  },
  pagerChipActive: {
    backgroundColor: COLORS.emerald,
    borderColor: COLORS.emerald,
  },
  pagerChipText: { fontSize: 11, fontWeight: '700', color: COLORS.navy },
  pagerChipTextActive: { color: COLORS.card },
  rawCard: {
    backgroundColor: COLORS.bg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
    marginBottom: 8,
  },
  rawTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  appBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  appBadgeText: { fontSize: 11, fontWeight: '800' },
  simTag: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.blue,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  rawTitle: { fontSize: 13, fontWeight: '700', color: COLORS.navy, marginBottom: 2 },
  rawText: { fontSize: 12, color: COLORS.grayText, lineHeight: 17 },
  errNote: { fontSize: 11, color: COLORS.danger, marginTop: 6, fontWeight: '600' },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.navy,
    marginTop: 10,
    marginBottom: 6,
  },
  typeRow: { flexDirection: 'row', gap: 8 },
  typeBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    backgroundColor: COLORS.bg,
  },
  typeExpenseActive: {
    backgroundColor: COLORS.danger,
    borderColor: COLORS.danger,
  },
  typeIncomeActive: {
    backgroundColor: COLORS.emerald,
    borderColor: COLORS.emerald,
  },
  typeBtnText: { fontSize: 13, fontWeight: '700', color: COLORS.navy },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.navy,
    backgroundColor: COLORS.card,
  },
  chipRow: { flexDirection: 'row', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bg,
  },
  chipActive: {
    backgroundColor: COLORS.emerald,
    borderColor: COLORS.emerald,
  },
  chipText: { fontSize: 12, fontWeight: '600', color: COLORS.navy },
  chipTextActive: { color: COLORS.card },
  warnAcc: { fontSize: 12, color: COLORS.danger, fontWeight: '600' },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: COLORS.bg,
  },
  switchTitle: { fontSize: 13, fontWeight: '700', color: COLORS.navy },
  switchSub: { fontSize: 11, color: COLORS.grayText, marginTop: 1 },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  dismissBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dismissBtnText: { fontSize: 13, fontWeight: '700', color: COLORS.grayText },
  confirmBtn: {
    flex: 2,
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: COLORS.emerald,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnText: { fontSize: 14, fontWeight: '800', color: COLORS.card },
  bulkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
  },
  bulkBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: COLORS.emeraldLight,
    borderWidth: 1,
    borderColor: '#BCE3D6',
  },
  bulkBtnText: { fontSize: 12, fontWeight: '800', color: COLORS.emerald },
  clearAllBtn: {
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: COLORS.dangerBg,
  },
  clearAllText: { fontSize: 12, fontWeight: '700', color: COLORS.danger },
});

export default DetectedTxReviewModal;
