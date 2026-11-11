import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

export const PRODUCTION_API_URL =
  'https://finmate-web-production-f30e63e3.up.railway.app/api/v1';

export const DEFAULT_API_URL =
  process.env.EXPO_PUBLIC_API_URL || PRODUCTION_API_URL;

export const STORAGE_KEYS = {
  TOKEN: 'finmate_access_token',
  USER: 'finmate_user',
  INFLATION_RATE: 'finmate_inflation_rate',
  API_BASE_URL: 'finmate_api_base_url',
};

let authFailureHandler = null;
export const setOnUnauthorized = (handler) => {
  authFailureHandler = handler;
};

const api = axios.create({
  baseURL: DEFAULT_API_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const initApiBaseUrl = async () => {
  try {
    const customUrl = await AsyncStorage.getItem(STORAGE_KEYS.API_BASE_URL);
    if (customUrl && customUrl.trim()) {
      api.defaults.baseURL = customUrl.trim().replace(/\/+$/, '');
    } else {
      api.defaults.baseURL = DEFAULT_API_URL;
    }
  } catch {
    api.defaults.baseURL = DEFAULT_API_URL;
  }
  return api.defaults.baseURL;
};

export const setCustomApiBaseUrl = async (url) => {
  const cleaned = String(url || '').trim().replace(/\/+$/, '');
  if (!cleaned) {
    await AsyncStorage.removeItem(STORAGE_KEYS.API_BASE_URL);
    api.defaults.baseURL = DEFAULT_API_URL;
  } else {
    await AsyncStorage.setItem(STORAGE_KEYS.API_BASE_URL, cleaned);
    api.defaults.baseURL = cleaned;
  }
  return api.defaults.baseURL;
};

api.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem(STORAGE_KEYS.TOKEN);
    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const reqUrl = String(error?.config?.url || '');
    const isAuthRequest =
      reqUrl.includes('/login') || reqUrl.includes('/register');
    if (error?.response?.status === 401 && !isAuthRequest) {
      await AsyncStorage.multiRemove([STORAGE_KEYS.TOKEN, STORAGE_KEYS.USER]);
      if (typeof authFailureHandler === 'function') {
        authFailureHandler();
      }
    }
    return Promise.reject(error);
  }
);

export default api;
