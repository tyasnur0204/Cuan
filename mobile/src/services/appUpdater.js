import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Application from 'expo-application';
import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import { Linking, Platform } from 'react-native';
import api, { getApiOrigin, STORAGE_KEYS } from './api';

const PACKAGE_ID = 'id.cuan.app';
const SNOOZE_DURATION_MS = 12 * 60 * 60 * 1000;

export const getInstalledAppInfo = () => {
  const cfg = Constants.expoConfig || {};
  const executionEnv = Constants.executionEnvironment;
  const isExpoGo =
    executionEnv === 'storeClient' || Constants.appOwnership === 'expo';
  const appId = Application.applicationId || cfg?.android?.package || PACKAGE_ID;
  const isStandaloneAndroid =
    Platform.OS === 'android' && !isExpoGo && appId === PACKAGE_ID;

  const nativeVersion = isStandaloneAndroid
    ? Application.nativeApplicationVersion
    : null;
  const nativeBuildRaw = isStandaloneAndroid
    ? Application.nativeBuildVersion
    : null;

  const version = String(nativeVersion || cfg.version || '1.2.0');
  const parsedBuild = Number.parseInt(
    String(nativeBuildRaw || cfg?.android?.versionCode || '3'),
    10
  );
  const versionCode = Number.isFinite(parsedBuild) ? parsedBuild : 3;

  return {
    version,
    versionCode,
    appId,
    isExpoGo,
    isStandaloneAndroid,
    platform: Platform.OS,
  };
};

export const compareSemver = (vA, vB) => {
  const clean = (v) =>
    String(v || '0')
      .replace(/^v/i, '')
      .split('.')
      .map((n) => Number.parseInt(n.replace(/[^\d]/g, ''), 10) || 0);
  const a = clean(vA);
  const b = clean(vB);
  const len = Math.max(a.length, b.length, 3);
  for (let i = 0; i < len; i += 1) {
    const diff = (a[i] || 0) - (b[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
};

export const isRemoteVersionNewer = (installed, remoteVersion, remoteCode) => {
  if (!installed) return false;
  const rCode = Number(remoteCode || 0);
  if (
    installed.isStandaloneAndroid &&
    Number.isFinite(rCode) &&
    rCode > 0 &&
    installed.versionCode > 0
  ) {
    if (rCode > installed.versionCode) return true;
    if (rCode < installed.versionCode) return false;
  }
  return compareSemver(remoteVersion, installed.version) > 0;
};

const toAbsoluteServerUrl = (pathOrUrl) => {
  const raw = String(pathOrUrl || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  const origin = getApiOrigin();
  return `${origin}${raw.startsWith('/') ? '' : '/'}${raw}`;
};

export const checkForAppUpdate = async ({ forceRefresh = false } = {}) => {
  const installed = getInstalledAppInfo();
  const res = await api.get('/app/release', {
    params: forceRefresh ? { refresh: 1 } : undefined,
    timeout: 15000,
  });
  const data = res.data || {};
  const latestVersion = String(data.version || data.latest_version || '1.0.0');
  const latestVersionCode = Number(
    data.version_code || data.latest_version_code || 1
  );
  const available = Boolean(data.available);
  const hasUpdate =
    available &&
    isRemoteVersionNewer(installed, latestVersion, latestVersionCode);

  const apkPrimaryUrl = toAbsoluteServerUrl(
    data.download_url || '/api/v1/app/download'
  );
  const apkProxyUrl = toAbsoluteServerUrl(
    data.proxy_download_url || '/api/v1/app/download?proxy=1'
  );

  return {
    installed,
    available,
    hasUpdate,
    latestVersion,
    latestVersionCode,
    filename: data.filename || 'CUAN.apk',
    sizeBytes: data.size_bytes ?? null,
    sizeMb: data.size_mb ?? null,
    builtAt: data.built_at ?? null,
    sha256: data.sha256 ?? null,
    releaseNotes: Array.isArray(data.release_notes) ? data.release_notes : [],
    apkPrimaryUrl,
    apkProxyUrl,
    directUrl: data.direct_url || apkPrimaryUrl,
    releasePageUrl: data.release_page_url || apkPrimaryUrl,
  };
};

export const isUpdateSnoozed = async (targetVersion) => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.SNOOZED_UPDATE_VERSION);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    if (parsed?.version !== targetVersion) return false;
    return Date.now() - Number(parsed?.ts || 0) < SNOOZE_DURATION_MS;
  } catch {
    return false;
  }
};

export const snoozeUpdatePrompt = async (targetVersion) => {
  try {
    await AsyncStorage.setItem(
      STORAGE_KEYS.SNOOZED_UPDATE_VERSION,
      JSON.stringify({ version: targetVersion, ts: Date.now() })
    );
  } catch {
    // Abaikan kegagalan cache lokal
  }
};

export const openDownloadInBrowser = async (updateInfo) => {
  const url =
    updateInfo?.apkProxyUrl ||
    updateInfo?.apkPrimaryUrl ||
    updateInfo?.directUrl;
  if (!url) return false;
  await Linking.openURL(url);
  return true;
};

export const openUnknownAppSourcesSettings = async () => {
  if (Platform.OS !== 'android') return false;
  try {
    await IntentLauncher.startActivityAsync(
      IntentLauncher.ActivityAction.MANAGE_UNKNOWN_APP_SOURCES,
      { data: `package:${PACKAGE_ID}` }
    );
    return true;
  } catch {
    try {
      await IntentLauncher.startActivityAsync(
        IntentLauncher.ActivityAction.SECURITY_SETTINGS
      );
      return true;
    } catch {
      return false;
    }
  }
};

export const downloadAndInstallUpdate = async (updateInfo, onProgress) => {
  const installed = getInstalledAppInfo();
  if (Platform.OS !== 'android' || !installed.isStandaloneAndroid) {
    await openDownloadInBrowser(updateInfo);
    return { ok: true, mode: 'browser' };
  }

  if (!FileSystem.cacheDirectory) {
    throw new Error('Direktori cache perangkat tidak tersedia.');
  }

  const destUri = `${FileSystem.cacheDirectory}CUAN-update.apk`;
  try {
    await FileSystem.deleteAsync(destUri, { idempotent: true });
  } catch {
    // Abaikan bila file lama belum ada
  }

  const urlsToTry = [
    updateInfo?.apkPrimaryUrl,
    updateInfo?.apkProxyUrl,
    updateInfo?.directUrl,
  ].filter(Boolean);

  const uniqueUrls = [...new Set(urlsToTry)];
  const expectedTotal = Number(updateInfo?.sizeBytes || 0);
  let downloadedResult = null;
  let lastError = null;

  for (const url of uniqueUrls) {
    try {
      const task = FileSystem.createDownloadResumable(
        url,
        destUri,
        {},
        (progressData) => {
          const written = Number(progressData?.totalBytesWritten || 0);
          const total =
            Number(progressData?.totalBytesExpectedToWrite || 0) ||
            expectedTotal;
          const pct =
            total > 0 ? Math.min(100, Math.round((written / total) * 100)) : 0;
          onProgress?.({
            bytesWritten: written,
            totalBytes: total,
            progressPct: pct,
          });
        }
      );

      const res = await task.downloadAsync();
      if (res?.uri) {
        const info = await FileSystem.getInfoAsync(res.uri);
        if (info.exists && Number(info.size || 0) > 1_000_000) {
          downloadedResult = res;
          break;
        }
      }
      lastError = new Error('File APK tidak lengkap atau rusak.');
    } catch (err) {
      lastError = err;
    }
  }

  if (!downloadedResult?.uri) {
    throw (
      lastError ||
      new Error('Gagal mengunduh file pembaruan APK dari semua server.')
    );
  }

  onProgress?.({
    bytesWritten: expectedTotal,
    totalBytes: expectedTotal,
    progressPct: 100,
  });

  const contentUri = await FileSystem.getContentUriAsync(downloadedResult.uri);
  const intentParams = {
    data: contentUri,
    flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
    type: 'application/vnd.android.package-archive',
  };

  try {
    await IntentLauncher.startActivityAsync(
      'android.intent.action.VIEW',
      intentParams
    );
  } catch {
    await IntentLauncher.startActivityAsync(
      'android.intent.action.INSTALL_PACKAGE',
      intentParams
    );
  }

  return { ok: true, mode: 'installer', uri: downloadedResult.uri };
};
