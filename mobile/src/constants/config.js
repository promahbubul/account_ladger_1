import Constants from 'expo-constants';
import { Platform } from 'react-native';

const getDevApiUrl = () => {
  const envUrl = process.env.EXPO_PUBLIC_API_URL;

  // Explicit remote API URL takes precedence (HTTP or HTTPS)
  if (envUrl && typeof envUrl === 'string' && envUrl.trim().length > 0) {
    const sanitized = envUrl.trim().replace(/\/+$/, '');
    // If it points to an external remote server or specified endpoint
    if (!sanitized.includes('localhost') && !sanitized.includes('127.0.0.1')) {
      return sanitized;
    }
  }

  // Web environment
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.location?.hostname) {
      return `http://${window.location.hostname}:5001`;
    }
    return 'http://localhost:5001';
  }

  // Physical device or Expo Go over LAN: debuggerHost points to PC's local network IP
  const debuggerHost = Constants.expoConfig?.hostUri || Constants.manifest2?.extra?.expoGo?.debuggerHost;
  if (debuggerHost) {
    const ip = debuggerHost.split(':')[0];
    if (ip && ip !== 'localhost' && ip !== '127.0.0.1') {
      return `http://${ip}:5001`;
    }
  }

  // If localhost was explicitly supplied for emulator/dev
  if (envUrl && (envUrl.includes('localhost') || envUrl.includes('127.0.0.1'))) {
    if (Platform.OS === 'android') {
      return 'http://10.0.2.2:5001';
    }
    return 'http://localhost:5001';
  }

  // Android emulator
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:5001';
  }

  // iOS simulator / default fallback
  return 'http://localhost:5001';
};

export const API_BASE_URL = getDevApiUrl();
export const APP_NAME = 'Account Ledger';
export const APP_VERSION = Constants.expoConfig?.version || '';

