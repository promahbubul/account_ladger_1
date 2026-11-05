import React, { useEffect, useMemo, useRef } from 'react';
import { DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { AuthNavigator } from './AuthNavigator';
import { AppNavigator } from './AppNavigator';
import { AdminNavigator } from './AdminNavigator';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { navigationRef } from './navigationRef';
import { useTheme } from '../context/ThemeContext';
import { COLORS } from '../constants/theme';

export const RootNavigator = () => {
  const { isAuthenticated, isAdmin, isLoading, user } = useAuth();
  const { resolved } = useTheme();
  // A theme change redraws every screen, and this puts the user back where they were.
  const savedState = useRef(undefined);

  useEffect(() => {
    savedState.current = undefined;
  }, [isAuthenticated]);

  const navigationTheme = useMemo(() => {
    const base = resolved === 'dark' ? DarkTheme : DefaultTheme;
    return { ...base, colors: { ...base.colors, background: COLORS.background, card: COLORS.surface, border: COLORS.border, text: COLORS.text } };
  }, [resolved]);

  if (isLoading) {
    return <LoadingSpinner message="Starting Account Ledger..." fullScreen />;
  }

  return (
    <NavigationContainer
      key={resolved}
      ref={navigationRef}
      theme={navigationTheme}
      initialState={savedState.current}
      onStateChange={(state) => {
        savedState.current = state;
      }}
    >
      {!isAuthenticated ? (
        <AuthNavigator />
      ) : isAdmin ? (
        <AdminNavigator />
      ) : (
        <AppNavigator key={user?.currency} />
      )}
    </NavigationContainer>
  );
};
