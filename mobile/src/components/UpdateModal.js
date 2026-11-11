import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  downloadAndInstallUpdate,
  openDownloadInBrowser,
  openUnknownAppSourcesSettings,
} from '../services/appUpdater';
import { COLORS, SHADOW } from '../theme/theme';

const formatMb = (bytes) => {
  if (!bytes || bytes <= 0) return '0.0 MB';
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const UpdateModal = ({ visible, updateInfo, onDismissLater }) => {
  const [phase, setPhase] = useState('idle'); // idle | downloading | installing | error
  const [progress, setProgress] = useState({
    bytesWritten: 0,
    totalBytes: 0,
    progressPct: 0,
  });
  const [errMsg, setErrMsg] = useState('');

  useEffect(() => {
    if (visible) {
      setPhase('idle');
      setErrMsg('');
      setProgress({
        bytesWritten: 0,
        totalBytes: Number(updateInfo?.sizeBytes || 0),
        progressPct: 0,
      });
    }
  }, [visible, updateInfo?.latestVersion, updateInfo?.sizeBytes]);

  if (!visible || !updateInfo) return null;

  const isStandalone = Boolean(updateInfo?.installed?.isStandaloneAndroid);
  const currentVersion = updateInfo?.installed?.version || '1.0.0';
  const latestVersion = updateInfo?.latestVersion || '1.1.0';
  const notes =
    updateInfo?.releaseNotes?.length > 0
      ? updateInfo.releaseNotes
      : [
          'Perbaikan kestabilan & kecepatan sinkronisasi data',
          'Pembaruan fitur manajemen keuangan & Target Tabungan',
        ];

  const handleStartUpdate = async () => {
    setErrMsg('');
    setPhase('downloading');
    try {
      const result = await downloadAndInstallUpdate(updateInfo, (p) => {
        setProgress(p);
      });
      if (result.mode === 'browser') {
        setPhase('idle');
        onDismissLater?.();
      } else {
        setPhase('installing');
      }
    } catch (err) {
      setPhase('error');
      setErrMsg(
        err?.message ||
          'Gagal mengunduh atau membuka pemasang pembaruan Android.'
      );
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (phase !== 'downloading') onDismissLater?.();
      }}
    >
      <View style={styles.backdrop}>
        <View style={[styles.card, SHADOW]}>
          <View style={styles.topBadge}>
            <Ionicons name="cloud-download" size={26} color={COLORS.emerald} />
          </View>

          <Text style={styles.title}>Pembaruan CUAN Tersedia</Text>
          <Text style={styles.versionPill}>
            v{currentVersion} → v{latestVersion}
            {updateInfo?.sizeMb ? ` · ${updateInfo.sizeMb} MB` : ''}
          </Text>

          <View style={styles.notesBox}>
            <Text style={styles.notesHeading}>Yang Baru di Versi Ini:</Text>
            {notes.slice(0, 5).map((item, idx) => (
              <View key={idx} style={styles.noteLine}>
                <Ionicons
                  name="checkmark-circle"
                  size={14}
                  color={COLORS.emerald}
                  style={{ marginTop: 2 }}
                />
                <Text style={styles.noteText}>{item}</Text>
              </View>
            ))}
          </View>

          {phase === 'downloading' && (
            <View style={styles.progressWrap}>
              <View style={styles.progressHeader}>
                <Text style={styles.progressLabel}>Mengunduh Pembaruan...</Text>
                <Text style={styles.progressPct}>{progress.progressPct}%</Text>
              </View>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${Math.min(100, Math.max(4, progress.progressPct))}%`,
                    },
                  ]}
                />
              </View>
              <Text style={styles.progressSub}>
                {formatMb(progress.bytesWritten)}
                {progress.totalBytes > 0
                  ? ` / ${formatMb(progress.totalBytes)}`
                  : ''}
              </Text>
            </View>
          )}

          {phase === 'installing' && (
            <View style={styles.infoBox}>
              <Text style={styles.infoTitle}>Installer Android Dibuka</Text>
              <Text style={styles.infoSub}>
                Ketuk "Update" atau "Pasang" pada dialog sistem Android untuk
                menyelesaikan pembaruan. Jika diminta izin sumber tidak dikenal,
                aktifkan lalu coba lagi.
              </Text>
              <TouchableOpacity
                onPress={openUnknownAppSourcesSettings}
                style={styles.permLink}
              >
                <Ionicons name="shield-checkmark-outline" size={14} color={COLORS.navy} />
                <Text style={styles.permLinkText}>Buka Izin Pasang Aplikasi</Text>
              </TouchableOpacity>
            </View>
          )}

          {!!errMsg && (
            <View style={styles.errBox}>
              <Text style={styles.errText}>{errMsg}</Text>
            </View>
          )}

          {!isStandalone && (
            <Text style={styles.expoNote}>
              Anda sedang membuka lewat Expo Go. Tekan tombol di bawah jika ingin
              mengunduh installer Android (`CUAN.apk`) via browser.
            </Text>
          )}

          <TouchableOpacity
            onPress={handleStartUpdate}
            disabled={phase === 'downloading'}
            style={[
              styles.primaryBtn,
              phase === 'downloading' && { opacity: 0.65 },
            ]}
          >
            {phase === 'downloading' ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Ionicons
                  name={isStandalone ? 'sparkles' : 'download-outline'}
                  size={17}
                  color="#FFFFFF"
                />
                <Text style={styles.primaryBtnText}>
                  {phase === 'installing'
                    ? 'Buka Ulang Installer'
                    : isStandalone
                      ? 'Update Otomatis Sekarang'
                      : 'Unduh CUAN.apk via Browser'}
                </Text>
              </>
            )}
          </TouchableOpacity>

          <View style={styles.bottomActions}>
            {phase !== 'downloading' && (
              <TouchableOpacity
                onPress={() => openDownloadInBrowser(updateInfo)}
                style={styles.secondaryBtn}
              >
                <Text style={styles.secondaryText}>Unduh via Browser</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={onDismissLater}
              disabled={phase === 'downloading'}
              style={styles.laterBtn}
            >
              <Text style={styles.laterText}>Nanti Saja</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(20,44,75,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 20,
    gap: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  topBadge: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: COLORS.emeraldLight,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.navy,
    textAlign: 'center',
  },
  versionPill: {
    alignSelf: 'center',
    backgroundColor: COLORS.emeraldLight,
    color: COLORS.emeraldDark,
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 99,
  },
  notesBox: {
    backgroundColor: COLORS.bg,
    borderRadius: 14,
    padding: 12,
    gap: 6,
  },
  notesHeading: { fontSize: 12, fontWeight: '700', color: COLORS.navy },
  noteLine: { flexDirection: 'row', gap: 7, alignItems: 'flex-start' },
  noteText: { flex: 1, fontSize: 12, color: COLORS.grayText, lineHeight: 17 },
  progressWrap: { gap: 6 },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressLabel: { fontSize: 12, fontWeight: '700', color: COLORS.navy },
  progressPct: { fontSize: 12, fontWeight: '800', color: COLORS.emerald },
  progressTrack: {
    height: 8,
    borderRadius: 99,
    backgroundColor: '#EAEFED',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 99,
    backgroundColor: COLORS.emerald,
  },
  progressSub: { fontSize: 11, color: COLORS.grayText },
  infoBox: {
    backgroundColor: COLORS.blueBg,
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  infoTitle: { fontSize: 12, fontWeight: '700', color: COLORS.navy },
  infoSub: { fontSize: 11, color: COLORS.grayText, lineHeight: 16 },
  permLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    marginTop: 2,
  },
  permLinkText: { fontSize: 11, fontWeight: '700', color: COLORS.navy },
  errBox: { backgroundColor: COLORS.dangerBg, borderRadius: 10, padding: 10 },
  errText: { fontSize: 12, color: COLORS.danger, fontWeight: '600' },
  expoNote: {
    fontSize: 11,
    color: COLORS.grayText,
    textAlign: 'center',
    lineHeight: 16,
  },
  primaryBtn: {
    backgroundColor: COLORS.emerald,
    borderRadius: 14,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryBtnText: { fontSize: 14, fontWeight: '800', color: '#FFFFFF' },
  bottomActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  secondaryBtn: { paddingVertical: 8, paddingHorizontal: 4 },
  secondaryText: { fontSize: 12, fontWeight: '700', color: COLORS.navy },
  laterBtn: { paddingVertical: 8, paddingHorizontal: 8, marginLeft: 'auto' },
  laterText: { fontSize: 12, fontWeight: '600', color: COLORS.grayText },
});

export default UpdateModal;
