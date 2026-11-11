import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { DONUT_COLORS, DonutChart } from '../components/SimpleCharts';
import api, { STORAGE_KEYS } from '../services/api';
import { COLORS, SHADOW } from '../theme/theme';
import { extractApiError, formatCompactCurrency, formatCurrency } from '../utils/format';

const ASSET_CLASSES = ['RDPU', 'SBN', 'Saham'];

const PortfolioScreen = ({ user, onDataChanged }) => {
  const [data, setData] = useState(null);
  const [inflationRate, setInflationRate] = useState(3.2);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [assetName, setAssetName] = useState('');
  const [assetClass, setAssetClass] = useState('RDPU');
  const [investedAmount, setInvestedAmount] = useState('');
  const [annualReturn, setAnnualReturn] = useState('');
  const [saving, setSaving] = useState(false);

  const loadPortfolio = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const savedInf = await AsyncStorage.getItem(STORAGE_KEYS.INFLATION_RATE);
      const rate = Number(savedInf) || 3.2;
      setInflationRate(rate);

      const res = await api.get('/investments/inflation-check', {
        params: {
          user_id: user?.id,
          inflation_rate: rate,
        },
      });
      setData(res.data);
    } catch (err) {
      Alert.alert('Error', extractApiError(err, 'Gagal memuat portofolio'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadPortfolio(false);
  }, [loadPortfolio]);

  const handleAddAsset = async () => {
    const retVal = Number(annualReturn);
    const invVal = Number(investedAmount || 0);
    if (!assetName.trim() || Number.isNaN(retVal) || annualReturn.trim() === '') {
      Alert.alert('Validasi', 'Isi nama aset dan return tahunan (%).');
      return;
    }

    setSaving(true);
    try {
      await api.post('/investments', {
        asset_name: assetName.trim(),
        asset_class: assetClass,
        annual_return_rate: retVal,
        invested_amount: Math.max(0, invVal),
      });
      setAssetName('');
      setInvestedAmount('');
      setAnnualReturn('');
      setModalOpen(false);
      await loadPortfolio(false);
      onDataChanged?.();
    } catch (err) {
      Alert.alert('Error', extractApiError(err, 'Gagal menambah aset'));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAsset = (asset) => {
    Alert.alert('Hapus Aset', `Hapus "${asset.asset_name}" dari portofolio?`, [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/investments/${asset.asset_id}`);
            await loadPortfolio(false);
            onDataChanged?.();
          } catch (err) {
            Alert.alert('Error', extractApiError(err, 'Gagal menghapus aset'));
          }
        },
      },
    ]);
  };

  const assets = data?.assets ?? [];
  const allocations = data?.allocation_by_class ?? [];
  const beatingCount = assets.filter((a) => a.beats_inflation).length;

  const segments = allocations.map((item, idx) => ({
    label: item.asset_class,
    value: item.amount > 0 ? item.amount : item.percentage,
    color: DONUT_COLORS[idx % DONUT_COLORS.length],
  }));

  const maxRate = Math.max(
    inflationRate * 1.5,
    10,
    ...assets.map((a) => Number(a.annual_return_rate_pct || 0))
  );

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadPortfolio(true)}
            colors={[COLORS.emerald]}
            tintColor={COLORS.emerald}
          />
        }
      >
        <View style={styles.topRow}>
          <View>
            <Text style={styles.title}>Portofolio</Text>
            <Text style={styles.subtitle}>
              Analisis return investasi vs inflasi ({inflationRate}%)
            </Text>
          </View>
          <TouchableOpacity onPress={() => setModalOpen(true)} style={styles.addBtn}>
            <Ionicons name="add" size={18} color="#FFFFFF" />
            <Text style={styles.addBtnText}>Aset</Text>
          </TouchableOpacity>
        </View>

        {/* KPI Cards */}
        <View style={styles.kpiRow}>
          <View style={[styles.kpiCard, SHADOW]}>
            <Text style={styles.kpiLabel}>Total Investasi</Text>
            <Text style={styles.kpiVal}>
              {formatCompactCurrency(data?.total_invested_value)}
            </Text>
          </View>
          <View style={[styles.kpiCard, SHADOW]}>
            <Text style={styles.kpiLabel}>Jumlah Aset</Text>
            <Text style={styles.kpiVal}>{assets.length} Aset</Text>
          </View>
          <View style={[styles.kpiCard, SHADOW]}>
            <Text style={styles.kpiLabel}>Lawan Inflasi</Text>
            <Text style={[styles.kpiVal, { color: COLORS.emerald }]}>
              {beatingCount}/{assets.length}
            </Text>
          </View>
        </View>

        {/* Asset Class Allocation Donut */}
        <View style={[styles.card, SHADOW]}>
          <Text style={styles.cardTitle}>Alokasi Kelas Aset</Text>
          {segments.length === 0 ? (
            <Text style={styles.mutedDesc}>Belum ada aset investasi tercatat.</Text>
          ) : (
            <>
              <DonutChart
                segments={segments}
                centerTitle="Portofolio"
                centerValue={formatCompactCurrency(data?.total_invested_value)}
                size={156}
              />
              <View style={styles.legendList}>
                {allocations.map((al, idx) => (
                  <View key={al.asset_class} style={styles.legendLine}>
                    <View style={styles.legendLeft}>
                      <View
                        style={[
                          styles.dot,
                          {
                            backgroundColor:
                              DONUT_COLORS[idx % DONUT_COLORS.length],
                          },
                        ]}
                      />
                      <Text style={styles.legendName}>{al.asset_class}</Text>
                    </View>
                    <Text style={styles.legendVal}>
                      {al.percentage}% · {formatCurrency(al.amount)}
                    </Text>
                  </View>
                ))}
              </View>
            </>
          )}
        </View>

        {/* Assets Return List */}
        {loading && assets.length === 0 ? (
          <ActivityIndicator
            size="large"
            color={COLORS.emerald}
            style={{ marginTop: 24 }}
          />
        ) : (
          assets.map((asset) => {
            const ret = Number(asset.annual_return_rate_pct || 0);
            const net = Number(asset.net_real_return_pct || 0);
            const barW = Math.min(100, Math.max(6, Math.round((ret / maxRate) * 100)));
            const infMark = Math.min(95, Math.round((inflationRate / maxRate) * 100));

            return (
              <View key={asset.asset_id} style={[styles.card, SHADOW]}>
                <View style={styles.assetHead}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.assetTitleRow}>
                      <Text style={styles.assetName}>{asset.asset_name}</Text>
                      <View style={styles.clsChip}>
                        <Text style={styles.clsChipText}>{asset.asset_class}</Text>
                      </View>
                    </View>
                    <Text style={styles.mutedDesc}>
                      Modal: {formatCurrency(asset.invested_amount)}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => handleDeleteAsset(asset)}
                    style={{ padding: 4 }}
                  >
                    <Ionicons name="trash-outline" size={17} color={COLORS.grayLight} />
                  </TouchableOpacity>
                </View>

                <View style={styles.barWrap}>
                  <View
                    style={[
                      styles.barFill,
                      {
                        width: `${barW}%`,
                        backgroundColor: asset.beats_inflation
                          ? COLORS.emerald
                          : COLORS.warning,
                      },
                    ]}
                  />
                  <View style={[styles.infLine, { left: `${infMark}%` }]} />
                </View>

                <View style={styles.assetFoot}>
                  <Text style={styles.rateText}>Return: {ret.toFixed(2)}% / thn</Text>
                  <View
                    style={[
                      styles.statusChip,
                      {
                        backgroundColor: asset.beats_inflation
                          ? COLORS.emeraldLight
                          : COLORS.dangerBg,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusChipText,
                        {
                          color: asset.beats_inflation
                            ? COLORS.emerald
                            : COLORS.danger,
                        },
                      ]}
                    >
                      {asset.beats_inflation ? 'Kalahkan Inflasi' : 'Di Bawah Inflasi'} (
                      {net >= 0 ? `+${net.toFixed(1)}%` : `${net.toFixed(1)}%`})
                    </Text>
                  </View>
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
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Tambah Aset Investasi</Text>
              <TouchableOpacity onPress={() => setModalOpen(false)}>
                <Ionicons name="close" size={24} color={COLORS.navy} />
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Nama Aset</Text>
            <TextInput
              value={assetName}
              onChangeText={setAssetName}
              placeholder="Contoh: Bibit RDPU / ORI025 / BBCA"
              placeholderTextColor={COLORS.grayLight}
              style={styles.input}
            />

            <Text style={styles.label}>Kelas Aset</Text>
            <View style={styles.clsRow}>
              {ASSET_CLASSES.map((cls) => (
                <TouchableOpacity
                  key={cls}
                  onPress={() => setAssetClass(cls)}
                  style={[
                    styles.clsBtn,
                    assetClass === cls && styles.clsBtnActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.clsBtnText,
                      assetClass === cls && styles.clsBtnTextActive,
                    ]}
                  >
                    {cls}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Nilai Investasi (Rp)</Text>
            <TextInput
              value={investedAmount}
              onChangeText={setInvestedAmount}
              placeholder="2500000"
              placeholderTextColor={COLORS.grayLight}
              keyboardType="numeric"
              style={styles.input}
            />

            <Text style={styles.label}>Estimasi Return Tahunan (%)</Text>
            <TextInput
              value={annualReturn}
              onChangeText={setAnnualReturn}
              placeholder="6.8"
              placeholderTextColor={COLORS.grayLight}
              keyboardType="decimal-pad"
              style={styles.input}
            />

            <TouchableOpacity
              onPress={handleAddAsset}
              disabled={saving}
              style={[styles.saveBtn, saving && { opacity: 0.6 }]}
            >
              {saving ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.saveBtnText}>Simpan Aset</Text>
              )}
            </TouchableOpacity>
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
  kpiVal: { fontSize: 15, fontWeight: '800', color: COLORS.navy, marginTop: 4 },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 10,
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: COLORS.navy },
  mutedDesc: { fontSize: 12, color: COLORS.grayText },
  legendList: { gap: 8, marginTop: 4 },
  legendLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  legendLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  legendName: { fontSize: 13, fontWeight: '700', color: COLORS.navy },
  legendVal: { fontSize: 12, fontWeight: '600', color: COLORS.grayText },
  assetHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  assetTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  assetName: { fontSize: 15, fontWeight: '700', color: COLORS.navy },
  clsChip: {
    backgroundColor: COLORS.bg,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  clsChipText: { fontSize: 10, fontWeight: '700', color: COLORS.navy },
  barWrap: {
    height: 10,
    backgroundColor: '#EAEFED',
    borderRadius: 99,
    overflow: 'hidden',
    position: 'relative',
  },
  barFill: { height: '100%', borderRadius: 99 },
  infLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: COLORS.navy,
  },
  assetFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 6,
  },
  rateText: { fontSize: 12, fontWeight: '700', color: COLORS.navy },
  statusChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99 },
  statusChipText: { fontSize: 11, fontWeight: '700' },
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
    gap: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: COLORS.navy },
  label: { fontSize: 12, fontWeight: '700', color: COLORS.navy, marginTop: 6 },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.navy,
  },
  clsRow: { flexDirection: 'row', gap: 8 },
  clsBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    backgroundColor: COLORS.bg,
  },
  clsBtnActive: {
    backgroundColor: COLORS.emerald,
    borderColor: COLORS.emerald,
  },
  clsBtnText: { fontSize: 13, fontWeight: '700', color: COLORS.navy },
  clsBtnTextActive: { color: '#FFFFFF' },
  saveBtn: {
    backgroundColor: COLORS.emerald,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  saveBtnText: { fontSize: 14, fontWeight: '800', color: '#FFFFFF' },
});

export default PortfolioScreen;
