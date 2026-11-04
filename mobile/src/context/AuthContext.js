import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi } from '../services/api/auth.api';
import {
  saveAuthToken,
  getAuthToken,
  saveAuthUser,
  getAuthUser,
  clearAuthSession,
} from '../services/storage/secureStore';
import { setOnUnauthorizedCallback } from '../services/api/client';
import { setDisplayPreferences } from '../utils/formatters';

const AuthContext = createContext(null);

export const AuthProvider = ({ children, queryClient }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState(null);

  // Auto-handle 401s from API client
  useEffect(() => {
    setOnUnauthorizedCallback(() => {
      setUser(null);
      setToken(null);
      if (queryClient) queryClient.clear();
    });
  }, [queryClient]);

  // Restore session on app launch
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const storedToken = await getAuthToken();
        const storedUser = await getAuthUser();

        if (storedToken && storedUser) {
          setToken(storedToken);
          setUser(storedUser);

          // Verify with server in background
          try {
            const fresh = await authApi.getMe();
            if (fresh?.user) {
              setUser(fresh.user);
              await saveAuthUser(fresh.user);
            }
          } catch (err) {
            if (err.status === 401 || err.status === 403) {
              await clearAuthSession();
              setToken(null);
              setUser(null);
            }
          }
        }
      } catch (err) {
        console.error('Session restoration error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    restoreSession();
  }, []);

  const login = useCallback(async (identifier, password) => {
    const res = await authApi.login(identifier, password);
    if (res.token && res.user) {
      await saveAuthToken(res.token);
      await saveAuthUser(res.user);
      setToken(res.token);
      setUser(res.user);
      setPendingVerificationEmail(null);
      return { success: true, user: res.user };
    }
    return { success: false, error: 'Login response invalid' };
  }, []);

  const register = useCallback(async (data) => {
    const res = await authApi.register(data);
    if (res.email) {
      setPendingVerificationEmail(res.email);
    }
    return res;
  }, []);

  const verifyEmail = useCallback(async (email, code) => {
    const res = await authApi.verifyEmail(email, code);
    if (res.token && res.user) {
      await saveAuthToken(res.token);
      await saveAuthUser(res.user);
      setToken(res.token);
      setUser(res.user);
      setPendingVerificationEmail(null);
      return { success: true, user: res.user };
    }
    return res;
  }, []);

  const googleLogin = useCallback(async (idToken) => {
    const res = await authApi.googleLogin(idToken);
    if (res.token && res.user) {
      await saveAuthToken(res.token);
      await saveAuthUser(res.user);
      setToken(res.token);
      setUser(res.user);
      setPendingVerificationEmail(null);
      return { success: true, user: res.user };
    }
    return { success: false, error: 'Google login failed' };
  }, []);

  const logout = useCallback(async () => {
    await clearAuthSession();
    setToken(null);
    setUser(null);
    setPendingVerificationEmail(null);
    if (queryClient) {
      queryClient.clear();
    }
  }, [queryClient]);

  // During render, so screens rendering below already format with the new preferences.
  setDisplayPreferences(user || {});

  const updateUser = useCallback(async (updatedUser) => {
    setUser(updatedUser);
    await saveAuthUser(updatedUser);
  }, []);

  const value = {
    user,
    token,
    isLoading,
    isAuthenticated: Boolean(token && user && user.emailVerified !== false),
    isAdmin: user?.role === 'ADMIN',
    pendingVerificationEmail,
    setPendingVerificationEmail,
    login,
    register,
    verifyEmail,
    googleLogin,
    logout,
    updateUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
