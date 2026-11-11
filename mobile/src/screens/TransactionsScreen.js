import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import CategoryBadge from '../components/CategoryBadge';
import api from '../services/api';
import { COLORS, SHADOW } from '../theme/theme';
import { extractApiError, formatCurrency, getTodayISO } from '../utils/format';

const QUICK_CATEGORIES = [
  'Makan & Minum',
  'Transport',
  'Pendidikan',
  'Gaji',
  'Pemasukan Usaha',
  'Hiburan',
  'Transfer',
];

const TransactionsScreen = ({
  openCreateModal = false,
  onClearCreateModal,
  onNavigate,
  onDataChanged,
}) => {
  const [transactions, setTransactions] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('ALL');
  const [search, setSearch] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Modal Form state
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formType, setFormType] = useState('Expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Makan & Minum');
  const [txDate, setTxDate] = useState(getTodayISO());
  const [accountId, setAccountId] = useState('');
  const [destAccountId, setDestAccountId] = useState('');
  const [notes, setNotes] = useState('');
  const [isBusiness, setIsBusiness] = useState(false);

  useEffect(() => {
    if (openCreateModal) {
      setModalOpen(true);
      onClearCreateModal?.();
    }
  }, [openCreateModal, onClearCreateModal]);

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setErrorMsg('');

    try {
      const params = { limit: 200 };
      if (activeTab !== 'ALL') params.type = activeTab;
      if (search.trim()) params.search = search.trim();

      const [txRes, accRes] = await Promise.all([
        api.get('/transactions', { params }),
        api.get('/accounts'),
      ]);

      setTransactions(txRes.data ?? []);
      const accList = accRes.data ?? [];
      setAccounts(accList);
      if (accList.length > 0 && !accountId) {
        setAccountId(accList[0].id);
      }
    } catch (err) {
      setErrorMsg(extractApiError(err, 'Gagal memuat daftar transaksi'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeTab, search, accountId]);

  useEffect(() => {
    loadData(false);
  }, [loadData]);

  const accountNameMap = accounts.reduce((map, acc) => {
    map[acc.id] = acc.name;
    return map;
  }, {});

  const handleSaveTransaction = async () => {
    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) {
      Alert.alert('Validasi', 'Masukkan nominal lebih besar dari 0.');
      return;
    }
    if (!category.trim()) {
      Alert.alert('Validasi', 'Kategori wajib diisi.');
      return;
    }
    if (!accountId) {
      Alert.alert(
        'Akun Keuangan Kosong',
        'Buat akun keuangan terlebih dahulu di menu Pengaturan.'
      );
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        account_id: accountId,
        type: formType,
        category: category.trim(),
        amount: numAmount,
        transaction_date: txDate.trim() || getTodayISO(),
        notes: notes.trim() || null,
        is_business: isBusiness,
      };
      if (formType === 'Transfer' && destAccountId && destAccountId !== accountId) {
        payload.destination_account_id = destAccountId;
      }

      await api.post('/transactions', payload);
      setAmount('');
      setNotes('');
      setDestAccountId('');
      setModalOpen(false);
      await loadData(false);
      onDataChanged?.();
    } catch (err) {
      Alert.alert('Gagal Menyimpan', extractApiError(err, 'Tidak dapat mencatat transaksi'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteTx = (tx) => {
    Alert.alert(
      'Hapus Transaksi',
      `Hapus transaksi "${tx.category}" sebesar ${formatCurrency(tx.amount)}? Saldo akun akan dikembalikan.`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/transactions/${tx.id}`);
              await loadData(false);
              onDataChanged?.();
            } catch (err) {
              Alert.alert('Error', extractApiError(err, 'Gagal menghapus transaksi'));
            }
          },
        },
      ]
    );
  };

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
          <View>
            <Text style={styles.title}>Transaksi</Text>
            <Text style={styles.subtitle}>Arus kas, usaha & transfer antar akun</Text>
          </View>
          <TouchableOpacity
            onPress={() => setModalOpen(true)}
            style={styles.addBtn}
          >
            <Ionicons name="add" size={18} color="#FFFFFF" />
            <Text style={styles.addBtnText}>Catat</Text>
          </TouchableOpacity>
        </View>

        {/* Search Input */}
        <View style={[styles.searchBox, SHADOW]}>
          <Ionicons name="search" size={16} color={COLORS.grayLight} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Cari kategori atau catatan..."
            placeholderTextColor={COLORS.grayLight}
            style={styles.searchInput}
          />
          {!!search && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={16} color={COLORS.grayLight} />
            </TouchableOpacity>
          )}
        </View>

        {/* Filter Tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsRow}
        >
          {[
            { key: 'ALL', label: 'Semua' },
            { key: 'Income', label: 'Pemasukan' },
            { key: 'Expense', label: 'Pengeluaran' },
            { key: 'Transfer', label: 'Transfer' },
          ].map((tab) => {
            const active = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                onPress={() => setActiveTab(tab.key)}
                style={[styles.tabPill, active && styles.tabPillActive]}
              >
                <Text style={[styles.tabText, active && styles.tabTextActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {accounts.length === 0 && !loading && (
          <View style={styles.warnBox}>
            <Text style={styles.warnText}>
              Anda belum memiliki akun keuangan (Tunai/Bank). Buat dulu agar dapat
              mencatat transaksi.
            </Text>
            <TouchableOpacity
              onPress={() => onNavigate('settings')}
              style={styles.warnBtn}
            >
              <Text style={styles.warnBtnText}>+ Buat Akun di Pengaturan</Text>
            </TouchableOpacity>
          </View>
        )}

        {!!errorMsg && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        )}

        {loading && transactions.length === 0 ? (
          <ActivityIndicator
            size="large"
            color={COLORS.emerald}
            style={{ marginTop: 32 }}
          />
        ) : transactions.length === 0 ? (
          <View style={[styles.emptyBox, SHADOW]}>
            <Ionicons name="receipt-outline" size={32} color={COLORS.grayLight} />
            <Text style={styles.emptyTitle}>Belum Ada Transaksi</Text>
            <Text style={styles.emptySub}>
              Ketuk tombol + di bawah atau + Catat untuk menambah transaksi baru.
            </Text>
          </View>
        ) : (
          <View style={[styles.listCard, SHADOW]}>
            {transactions.map((tx, idx) => {
              const isInc = tx.type === 'Income';
              const isTrf = tx.type === 'Transfer';
              return (
                <View
                  key={tx.id}
                  style={[
                    styles.txItem,
                    idx < transactions.length - 1 && styles.txDivider,
                  ]}
                >
                  <CategoryBadge category={tx.category} type={tx.type} size={40} />
                  <View style={styles.txBody}>
                    <View style={styles.txTopLine}>
                      <Text style={styles.txCat} numberOfLines={1}>
                        {tx.category}
                      </Text>
                      {tx.is_business && (
                        <View style={styles.bizChip}>
                          <Text style={styles.bizChipText}>Usaha</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.txSub} numberOfLines={1}>
                      {accountNameMap[tx.account_id] || 'Akun'} · {tx.transaction_date}
                    </Text>
                    {!!tx.notes && (
                      <Text style={styles.txNote} numberOfLines={1}>
                        {tx.notes}
                      </Text>
                    )}
                  </View>
                  <View style={styles.txRight}>
                    <Text
                      style={[
                        styles.txAmt,
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
                    <TouchableOpacity
                      onPress={() => handleDeleteTx(tx)}
                      style={styles.delIcon}
                    >
                      <Ionicons name="trash-outline" size={16} color={COLORS.grayLight} />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Add Transaction Modal */}
      <Modal
        visible={modalOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Tambah Transaksi</Text>
              <TouchableOpacity onPress={() => setModalOpen(false)}>
                <Ionicons name="close" size={24} color={COLORS.navy} />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.fieldLabel}>Tipe Transaksi</Text>
              <View style={styles.typeRow}>
                {[
                  { key: 'Income', label: 'Pemasukan' },
                  { key: 'Expense', label: 'Pengeluaran' },
                  { key: 'Transfer', label: 'Transfer' },
                ].map((opt) => (
                  <TouchableOpacity
                    key={opt.key}
                    onPress={() => {
                      setFormType(opt.key);
                      if (opt.key === 'Transfer') setCategory('Transfer');
                    }}
                    style={[
                      styles.typeBtn,
                      formType === opt.key && styles.typeBtnActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.typeBtnText,
                        formType === opt.key && styles.typeBtnTextActive,
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Nominal (Rp)</Text>
              <TextInput
                value={amount}
                onChangeText={setAmount}
                placeholder="100000"
                placeholderTextColor={COLORS.grayLight}
                keyboardType="numeric"
                style={styles.input}
              />

              <Text style={styles.fieldLabel}>Kategori</Text>
              <TextInput
                value={category}
                onChangeText={setCategory}
                placeholder="Makan & Minum"
                placeholderTextColor={COLORS.grayLight}
                style={styles.input}
              />
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipScroll}
              >
                {QUICK_CATEGORIES.map((cat) => (
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
              </ScrollView>

              <Text style={styles.fieldLabel}>Tanggal (YYYY-MM-DD)</Text>
              <TextInput
                value={txDate}
                onChangeText={setTxDate}
                placeholder="2026-11-11"
                placeholderTextColor={COLORS.grayLight}
                style={styles.input}
              />

              <Text style={styles.fieldLabel}>Akun Sumber</Text>
              {accounts.length === 0 ? (
                <Text style={styles.emptyAccHint}>
                  Belum ada akun. Buat di menu Pengaturan dulu.
                </Text>
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.chipScroll}
                >
                  {accounts.map((acc) => (
                    <TouchableOpacity
                      key={acc.id}
                      onPress={() => setAccountId(acc.id)}
                      style={[
                        styles.catChip,
                        accountId === acc.id && styles.catChipActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.catChipText,
                          accountId === acc.id && styles.catChipTextActive,
                        ]}
                      >
                        {acc.name} ({formatCurrency(acc.balance)})
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}

              {formType === 'Transfer' && accounts.length > 1 && (
                <>
                  <Text style={styles.fieldLabel}>Akun Tujuan</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.chipScroll}
                  >
                    {accounts
                      .filter((a) => a.id !== accountId)
                      .map((acc) => (
                        <TouchableOpacity
                          key={acc.id}
                          onPress={() => setDestAccountId(acc.id)}
                          style={[
                            styles.catChip,
                            destAccountId === acc.id && styles.catChipActive,
                          ]}
                        >
                          <Text
                            style={[
                              styles.catChipText,
                              destAccountId === acc.id && styles.catChipTextActive,
                            ]}
                          >
                            {acc.name}
                          </Text>
                        </TouchableOpacity>
                      ))}
                  </ScrollView>
                </>
              )}

              <Text style={styles.fieldLabel}>Catatan (Opsional)</Text>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder="Keterangan singkat..."
                placeholderTextColor={COLORS.grayLight}
                style={styles.input}
              />

              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>
                  Tandai sebagai Transaksi Usaha / Bisnis
                </Text>
                <Switch
                  value={isBusiness}
                  onValueChange={setIsBusiness}
                  trackColor={{ false: '#D1D5DB', true: '#6EE7B7' }}
                  thumbColor={isBusiness ? COLORS.emerald : '#F9FAFB'}
                />
              </View>

              <TouchableOpacity
                onPress={handleSaveTransaction}
                disabled={submitting}
                style={[styles.saveBtn, submitting && { opacity: 0.6 }]}
              >
                {submitting ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.saveBtnText}>Simpan Transaksi</Text>
                )}
              </TouchableOpacity>
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
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.card,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchInput: { flex: 1, fontSize: 13, color: COLORS.navy, paddingVertical: 0 },
  tabsRow: { gap: 8, paddingVertical: 2 },
  tabPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 99,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  tabPillActive: {
    backgroundColor: COLORS.emerald,
    borderColor: COLORS.emerald,
  },
  tabText: { fontSize: 12, fontWeight: '600', color: COLORS.navy },
  tabTextActive: { color: '#FFFFFF' },
  warnBox: {
    backgroundColor: COLORS.warningBg,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#FDE68A',
    gap: 8,
  },
  warnText: { fontSize: 12, color: '#92400E', fontWeight: '500' },
  warnBtn: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.emerald,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  warnBtnText: { fontSize: 12, color: '#FFFFFF', fontWeight: '700' },
  errorBox: { backgroundColor: COLORS.dangerBg, padding: 12, borderRadius: 12 },
  errorText: { fontSize: 12, color: COLORS.danger, fontWeight: '600' },
  emptyBox: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: COLORS.navy },
  emptySub: { fontSize: 12, color: COLORS.grayText, textAlign: 'center' },
  listCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  txItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
  },
  txDivider: { borderBottomWidth: 1, borderBottomColor: COLORS.border },
  txBody: { flex: 1 },
  txTopLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  txCat: { fontSize: 14, fontWeight: '700', color: COLORS.navy, flexShrink: 1 },
  bizChip: {
    backgroundColor: COLORS.emeraldLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  bizChipText: { fontSize: 10, fontWeight: '700', color: COLORS.emerald },
  txSub: { fontSize: 11, color: COLORS.grayText, marginTop: 2 },
  txNote: { fontSize: 11, color: COLORS.grayLight, marginTop: 1 },
  txRight: { alignItems: 'flex-end', gap: 4 },
  txAmt: { fontSize: 13, fontWeight: '800' },
  delIcon: { padding: 4 },
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
    marginBottom: 14,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: COLORS.navy },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.navy,
    marginTop: 12,
    marginBottom: 6,
  },
  typeRow: {
    flexDirection: 'row',
    gap: 6,
    backgroundColor: COLORS.bg,
    borderRadius: 12,
    padding: 4,
  },
  typeBtn: { flex: 1, paddingVertical: 9, borderRadius: 9, alignItems: 'center' },
  typeBtnActive: { backgroundColor: COLORS.card, ...SHADOW },
  typeBtnText: { fontSize: 12, fontWeight: '600', color: COLORS.grayText },
  typeBtnTextActive: { color: COLORS.emerald, fontWeight: '700' },
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
  chipScroll: { gap: 8, paddingVertical: 8 },
  catChip: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bg,
  },
  catChipActive: {
    backgroundColor: COLORS.emeraldLight,
    borderColor: COLORS.emerald,
  },
  catChipText: { fontSize: 12, fontWeight: '600', color: COLORS.navy },
  catChipTextActive: { color: COLORS.emerald },
  emptyAccHint: { fontSize: 12, color: COLORS.danger, paddingVertical: 4 },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    padding: 12,
    borderRadius: 12,
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  switchLabel: { fontSize: 12, fontWeight: '600', color: COLORS.navy, flex: 1 },
  saveBtn: {
    backgroundColor: COLORS.emerald,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 12,
  },
  saveBtnText: { fontSize: 14, fontWeight: '800', color: '#FFFFFF' },
});

export default TransactionsScreen;
