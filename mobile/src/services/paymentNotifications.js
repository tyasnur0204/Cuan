import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeEventEmitter, NativeModules, Platform } from 'react-native';
import api, { DEFAULT_API_URL, STORAGE_KEYS } from './api';
import { getInstalledAppInfo } from './appUpdater';
import {
  MONITORED_APPS,
  parsePaymentNotification,
} from './paymentNotificationParser';

const SETTINGS_KEY = 'cuan_notif_settings_v1';
const JS_PENDING_KEY = 'cuan_notif_js_pending_v1';
const JS_HISTORY_KEY = 'cuan_notif_js_history_v1';
const PROCESSED_IDS_KEY = 'cuan_notif_processed_ids_v1';

const { CuanNotificationModule } = NativeModules;

export const isNativeNotifModuleAvailable =
  Platform.OS === 'android' && Boolean(CuanNotificationModule);

export const DEFAULT_NOTIF_SETTINGS = {
  enabled: false,
  mode: 'queue', // 'queue' | 'auto'
  enabledApps: MONITORED_APPS.map((a) => a.key),
  accountMap: {},
  defaultAccountId: '',
  businessApps: [],
};

const safeParseJson = (raw, fallback) => {
  try {
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
};

export const getNotificationListenerStatus = async () => {
  const installed = getInstalledAppInfo();
  if (!isNativeNotifModuleAvailable) {
    return {
      supported: false,
      permissionGranted: false,
      isExpoGo: installed.isExpoGo,
      isStandaloneAndroid: installed.isStandaloneAndroid,
    };
  }
  try {
    const granted = await CuanNotificationModule.isNotificationAccessEnabled();
    return {
      supported: true,
      permissionGranted: Boolean(granted),
      isExpoGo: installed.isExpoGo,
      isStandaloneAndroid: installed.isStandaloneAndroid,
    };
  } catch {
    return {
      supported: true,
      permissionGranted: false,
      isExpoGo: installed.isExpoGo,
      isStandaloneAndroid: installed.isStandaloneAndroid,
    };
  }
};

export const openNotificationAccessSettings = async () => {
  if (!isNativeNotifModuleAvailable) return false;
  return CuanNotificationModule.openNotificationAccessSettings();
};

export const openAppDetailsSettings = async () => {
  if (!isNativeNotifModuleAvailable) return false;
  return CuanNotificationModule.openAppDetailsSettings();
};

export const openBatteryOptimizationSettings = async () => {
  if (!isNativeNotifModuleAvailable) return false;
  return CuanNotificationModule.openBatteryOptimizationSettings();
};

export const loadNotifSettings = async () => {
  const raw = await AsyncStorage.getItem(SETTINGS_KEY);
  const saved = raw ? safeParseJson(raw, {}) : {};
  return {
    ...DEFAULT_NOTIF_SETTINGS,
    ...saved,
    enabledApps: Array.isArray(saved.enabledApps)
      ? saved.enabledApps
      : DEFAULT_NOTIF_SETTINGS.enabledApps,
    accountMap:
      saved.accountMap && typeof saved.accountMap === 'object'
        ? saved.accountMap
        : {},
    businessApps: Array.isArray(saved.businessApps) ? saved.businessApps : [],
  };
};

export const syncNativeNotifConfig = async (
  settingsOverride = null,
  { clearToken = false } = {}
) => {
  const settings = settingsOverride || (await loadNotifSettings());
  if (!isNativeNotifModuleAvailable) return false;

  const [token, storedUrl] = await Promise.all([
    clearToken ? Promise.resolve('') : AsyncStorage.getItem(STORAGE_KEYS.TOKEN),
    AsyncStorage.getItem(STORAGE_KEYS.API_BASE_URL),
  ]);

  const watchedPackages = MONITORED_APPS.filter((a) =>
    settings.enabledApps.includes(a.key)
  ).flatMap((a) => a.packages);

  const payload = {
    enabled: Boolean(settings.enabled),
    mode: settings.mode === 'auto' ? 'auto' : 'queue',
    watchedPackages,
    accountMap: settings.accountMap || {},
    defaultAccountId: settings.defaultAccountId || '',
    businessApps: settings.businessApps || [],
    apiBaseUrl: (storedUrl || api.defaults.baseURL || DEFAULT_API_URL).replace(
      /\/+$/,
      ''
    ),
    authToken: clearToken ? '' : String(token || ''),
  };

  try {
    await CuanNotificationModule.syncConfig(JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
};

export const saveNotifSettings = async (patch) => {
  const current = await loadNotifSettings();
  const next = {
    ...current,
    ...patch,
  };
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  await syncNativeNotifConfig(next);
  return next;
};

const getProcessedIds = async () => {
  const raw = await AsyncStorage.getItem(PROCESSED_IDS_KEY);
  const arr = raw ? safeParseJson(raw, []) : [];
  return Array.isArray(arr) ? arr : [];
};

const markProcessedId = async (eventId) => {
  if (!eventId) return;
  const ids = await getProcessedIds();
  if (ids.includes(eventId)) return;
  const next = [eventId, ...ids].slice(0, 200);
  await AsyncStorage.setItem(PROCESSED_IDS_KEY, JSON.stringify(next));
};

const readJsList = async (key) => {
  const raw = await AsyncStorage.getItem(key);
  const arr = raw ? safeParseJson(raw, []) : [];
  return Array.isArray(arr) ? arr : [];
};

const writeJsList = async (key, items) => {
  await AsyncStorage.setItem(key, JSON.stringify(items.slice(0, 80)));
};

const mergeById = (primary = [], secondary = []) => {
  const map = new Map();
  [...primary, ...secondary].forEach((item) => {
    if (!item?.id) return;
    if (!map.has(item.id)) {
      map.set(item.id, item);
    }
  });
  return Array.from(map.values()).sort(
    (a, b) => Number(b.receivedAt || b.postTime || 0) - Number(a.receivedAt || a.postTime || 0)
  );
};

export const removePendingEvent = async (eventId) => {
  if (!eventId) return;
  await markProcessedId(eventId);
  const jsPending = await readJsList(JS_PENDING_KEY);
  await writeJsList(
    JS_PENDING_KEY,
    jsPending.filter((item) => item.id !== eventId)
  );
  if (isNativeNotifModuleAvailable) {
    try {
      await CuanNotificationModule.removePendingEvent(eventId);
    } catch {
      // Ignore native queue cleanup errors
    }
  }
};

export const appendToHistory = async (item) => {
  if (!item?.id) return;
  const entry = {
    ...item,
    status: 'synced',
    syncedAt: item.syncedAt || Date.now(),
  };
  const jsHistory = await readJsList(JS_HISTORY_KEY);
  const merged = mergeById([entry], jsHistory).slice(0, 60);
  await writeJsList(JS_HISTORY_KEY, merged);

  if (isNativeNotifModuleAvailable) {
    try {
      await CuanNotificationModule.appendHistoryEvent(JSON.stringify(entry));
    } catch {
      // Optional native sync
    }
  }
};

const submitTransactionForEvent = async (item, overrides = {}) => {
  const accountId =
    overrides.accountId || item.accountId || item.suggestedAccountId || '';
  if (!accountId) {
    throw new Error('Pilih akun/rekening CUAN terlebih dahulu.');
  }

  const payload = {
    account_id: accountId,
    type: overrides.type || item.type || 'Expense',
    category: (overrides.category || item.category || 'Belanja & Pembayaran').trim(),
    amount: Number(overrides.amount ?? item.amount),
    transaction_date: overrides.transactionDate || item.transactionDate,
    notes: (overrides.notes ?? item.notes ?? '').trim() || null,
    is_business: Boolean(overrides.isBusiness ?? item.isBusiness),
  };

  const res = await api.post('/transactions', payload);
  await removePendingEvent(item.id);
  await appendToHistory({
    ...item,
    ...overrides,
    accountId,
    txId: res.data?.id || '',
    status: 'synced',
    syncedAt: Date.now(),
  });
  return res.data;
};

export const confirmPendingEvent = async (item, overrides = {}) => {
  return submitTransactionForEvent(item, overrides);
};

export const dismissPendingEvent = async (eventId) => {
  await removePendingEvent(eventId);
};

export const clearAllPending = async () => {
  const current = await readJsList(JS_PENDING_KEY);
  for (const item of current) {
    if (item?.id) await markProcessedId(item.id);
  }
  await writeJsList(JS_PENDING_KEY, []);
  if (isNativeNotifModuleAvailable) {
    try {
      const nativeRaw = await CuanNotificationModule.getPendingEvents();
      const nativeArr = safeParseJson(nativeRaw, []);
      for (const item of nativeArr) {
        if (item?.id) await markProcessedId(item.id);
      }
      await CuanNotificationModule.clearPendingEvents();
    } catch {
      // Ignore
    }
  }
};

export const clearAllHistory = async () => {
  await writeJsList(JS_HISTORY_KEY, []);
  if (isNativeNotifModuleAvailable) {
    try {
      await CuanNotificationModule.clearHistory();
    } catch {
      // Ignore
    }
  }
};

export const reconcileNotificationQueues = async ({ accounts = [] } = {}) => {
  const [settings, processedIds, jsPending, jsHistory] = await Promise.all([
    loadNotifSettings(),
    getProcessedIds(),
    readJsList(JS_PENDING_KEY),
    readJsList(JS_HISTORY_KEY),
  ]);

  let nativePending = [];
  let nativeHistory = [];
  if (isNativeNotifModuleAvailable) {
    try {
      const [pRaw, hRaw] = await Promise.all([
        CuanNotificationModule.getPendingEvents(),
        CuanNotificationModule.getRecentHistory(),
      ]);
      nativePending = safeParseJson(pRaw, []);
      nativeHistory = safeParseJson(hRaw, []);
    } catch {
      nativePending = [];
      nativeHistory = [];
    }
  }

  let history = mergeById(nativeHistory, jsHistory);
  for (const h of history) {
    if (h?.id && !processedIds.includes(h.id)) {
      await markProcessedId(h.id);
    }
  }

  const processedSet = new Set([
    ...processedIds,
    ...history.map((h) => h.id).filter(Boolean),
  ]);

  let pending = mergeById(nativePending, jsPending).filter(
    (item) => item?.id && !processedSet.has(item.id)
  );

  let autoSyncedCount = 0;

  if (settings.enabled && settings.mode === 'auto' && accounts.length > 0 && pending.length > 0) {
    const validAccountIds = new Set(accounts.map((a) => a.id));
    const remainingPending = [];

    for (const item of pending) {
      const mappedId = settings.accountMap?.[item.appKey];
      const fallbackId = settings.defaultAccountId;
      const targetAccountId =
        (mappedId && validAccountIds.has(mappedId) && mappedId) ||
        (fallbackId && validAccountIds.has(fallbackId) && fallbackId) ||
        (item.suggestedAccountId &&
          validAccountIds.has(item.suggestedAccountId) &&
          item.suggestedAccountId) ||
        accounts[0]?.id ||
        '';

      const isBusiness =
        Boolean(item.isBusiness) ||
        (Array.isArray(settings.businessApps) &&
          settings.businessApps.includes(item.appKey));

      if (!targetAccountId) {
        remainingPending.push(item);
        continue;
      }

      try {
        await submitTransactionForEvent(item, {
          accountId: targetAccountId,
          isBusiness,
        });
        autoSyncedCount += 1;
      } catch (err) {
        remainingPending.push({
          ...item,
          errorReason:
            err?.response?.data?.detail || err?.message || 'Gagal kirim otomatis',
        });
      }
    }

    pending = remainingPending;
    const refreshedJsHistory = await readJsList(JS_HISTORY_KEY);
    history = mergeById(refreshedJsHistory, history);
  } else if (nativePending.length > 0) {
    // Also clean native duplicates if already processed
    for (const np of nativePending) {
      if (np?.id && processedSet.has(np.id) && isNativeNotifModuleAvailable) {
        CuanNotificationModule.removePendingEvent(np.id).catch(() => {});
      }
    }
  }

  await writeJsList(JS_PENDING_KEY, pending);

  return {
    pending,
    history,
    autoSyncedCount,
  };
};

export const simulatePaymentNotification = async ({
  packageName,
  title,
  text,
  accounts = [],
}) => {
  const settings = await loadNotifSettings();
  const parsed = parsePaymentNotification({
    packageName,
    title,
    text,
    postTime: Date.now(),
  });

  if (!parsed) {
    return { matched: false, parsed: null, synced: false };
  }

  const eventObj = {
    ...parsed,
    id: `sim_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    receivedAt: Date.now(),
    suggestedAccountId:
      settings.accountMap?.[parsed.appKey] ||
      settings.defaultAccountId ||
      accounts[0]?.id ||
      '',
    isBusiness:
      Array.isArray(settings.businessApps) &&
      settings.businessApps.includes(parsed.appKey),
    status: 'pending',
    simulated: true,
  };

  if (settings.enabled && settings.mode === 'auto' && eventObj.suggestedAccountId) {
    await submitTransactionForEvent(eventObj, {
      accountId: eventObj.suggestedAccountId,
      isBusiness: eventObj.isBusiness,
    });
    return { matched: true, parsed: eventObj, synced: true };
  }

  const current = await readJsList(JS_PENDING_KEY);
  await writeJsList(JS_PENDING_KEY, [eventObj, ...current]);
  return { matched: true, parsed: eventObj, synced: false };
};

export const subscribeNativeNotificationEvents = (callback) => {
  if (!isNativeNotifModuleAvailable) return () => {};
  const emitter = new NativeEventEmitter(CuanNotificationModule);
  const sub = emitter.addListener('CuanPaymentNotification', (event) => {
    const payload =
      typeof event?.payload === 'string'
        ? safeParseJson(event.payload, null)
        : event;
    callback?.(payload);
  });
  return () => sub.remove();
};
