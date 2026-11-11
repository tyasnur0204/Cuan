export const APK_DOWNLOAD_URL =
  'https://github.com/tyasnur0204/Cuan/releases/latest/download/CUAN.apk';

export const APK_RELEASE_PAGE_URL =
  'https://github.com/tyasnur0204/Cuan/releases/latest';

export const APP_VERSION_LABEL = 'v1.0.0 · Android APK';

let deferredInstallPrompt = null;
let pwaInstalled = false;
let initialized = false;
const listeners = new Set();

const notifyListeners = () => {
  const snapshot = getPwaState();
  listeners.forEach((cb) => cb(snapshot));
};

export const isIosDevice = () => {
  if (typeof navigator === 'undefined') return false;
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent || '') ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
};

export const isAndroidDevice = () => {
  if (typeof navigator === 'undefined') return false;
  return /android/i.test(navigator.userAgent || '');
};

export const isStandaloneMode = () => {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)')?.matches === true ||
    window.navigator?.standalone === true
  );
};

export const getPwaState = () => ({
  canInstallPwa: Boolean(deferredInstallPrompt),
  isInstalled: pwaInstalled || isStandaloneMode(),
  isIos: isIosDevice(),
  isAndroid: isAndroidDevice(),
});

export const initPwaInstallListener = () => {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    notifyListeners();
  });

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    pwaInstalled = true;
    notifyListeners();
  });
};

export const subscribePwaInstall = (callback) => {
  listeners.add(callback);
  callback(getPwaState());
  return () => {
    listeners.delete(callback);
  };
};

export const triggerPwaInstall = async () => {
  if (!deferredInstallPrompt) {
    return { outcome: 'unavailable' };
  }
  deferredInstallPrompt.prompt();
  try {
    const choiceResult = await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    notifyListeners();
    return choiceResult || { outcome: 'dismissed' };
  } catch {
    deferredInstallPrompt = null;
    notifyListeners();
    return { outcome: 'dismissed' };
  }
};
