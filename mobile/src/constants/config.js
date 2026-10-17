import Constants from 'expo-constants';
import { Platform } from 'react-native';

const getDevApiUrl = () => {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  const debuggerHost = Constants.expoConfig?.hostUri || Constants.manifest2?.extra?.expoGo?.debuggerHost;
  if (debuggerHost) {
    const ip = debuggerHost.split(':')[0];
    return `http://${ip}:5001`;
  }

  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:5001';
  }

  return 'http://localhost:5001';
};

export const API_BASE_URL = getDevApiUrl();
export const APP_NAME = 'AccountLedger.com';
export const APP_VERSION = '2.0.0-mobile';
