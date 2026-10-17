import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'accountledger_auth_token';
const USER_KEY = 'accountledger_auth_user';

export const saveAuthToken = async (token) => {
  try {
    if (!token) {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
    } else {
      await SecureStore.setItemAsync(TOKEN_KEY, token);
    }
  } catch (error) {
    console.error('Failed to save auth token:', error);
  }
};

export const getAuthToken = async () => {
  try {
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch (error) {
    console.error('Failed to get auth token:', error);
    return null;
  }
};

export const saveAuthUser = async (user) => {
  try {
    if (!user) {
      await SecureStore.deleteItemAsync(USER_KEY);
    } else {
      await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
    }
  } catch (error) {
    console.error('Failed to save auth user:', error);
  }
};

export const getAuthUser = async () => {
  try {
    const json = await SecureStore.getItemAsync(USER_KEY);
    return json ? JSON.parse(json) : null;
  } catch (error) {
    console.error('Failed to get auth user:', error);
    return null;
  }
};

export const clearAuthSession = async () => {
  try {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(USER_KEY);
  } catch (error) {
    console.error('Failed to clear auth session:', error);
  }
};
