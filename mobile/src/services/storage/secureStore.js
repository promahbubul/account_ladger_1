import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'accountledger_auth_token';
const USER_KEY = 'accountledger_auth_user';
const THEME_KEY = 'accountledger_theme';

const memoryStore = new Map();
const isWeb = Platform.OS === 'web';

const setItem = async (key, value) => {
  if (isWeb) {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
        return;
      }
    } catch {
      // Fallback to memory
    }
    memoryStore.set(key, value);
    return;
  }
  return await SecureStore.setItemAsync(key, value);
};

const getItem = async (key) => {
  if (isWeb) {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(key);
      }
    } catch {
      // Fallback to memory
    }
    return memoryStore.get(key) || null;
  }
  return await SecureStore.getItemAsync(key);
};

const deleteItem = async (key) => {
  if (isWeb) {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
        return;
      }
    } catch {
      // Fallback to memory
    }
    memoryStore.delete(key);
    return;
  }
  return await SecureStore.deleteItemAsync(key);
};

export const saveAuthToken = async (token) => {
  try {
    if (!token) {
      await deleteItem(TOKEN_KEY);
    } else {
      await setItem(TOKEN_KEY, token);
    }
  } catch (error) {
    console.error('Failed to save auth token:', error);
  }
};

export const getAuthToken = async () => {
  try {
    return await getItem(TOKEN_KEY);
  } catch (error) {
    console.error('Failed to get auth token:', error);
    return null;
  }
};

export const saveAuthUser = async (user) => {
  try {
    if (!user) {
      await deleteItem(USER_KEY);
    } else {
      await setItem(USER_KEY, JSON.stringify(user));
    }
  } catch (error) {
    console.error('Failed to save auth user:', error);
  }
};

export const getAuthUser = async () => {
  try {
    const json = await getItem(USER_KEY);
    return json ? JSON.parse(json) : null;
  } catch (error) {
    console.error('Failed to get auth user:', error);
    return null;
  }
};

export const clearAuthSession = async () => {
  try {
    await deleteItem(TOKEN_KEY);
    await deleteItem(USER_KEY);
  } catch (error) {
    console.error('Failed to clear auth session:', error);
  }
};

export const getThemePreference = () => getItem(THEME_KEY);
export const saveThemePreference = (preference) => setItem(THEME_KEY, preference);
