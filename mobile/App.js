import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

WebBrowser.maybeCompleteAuthSession();
import { AuthProvider } from './src/context/AuthContext';
import { DateFilterProvider } from './src/context/DateFilterContext';
import { RootNavigator } from './src/navigation/RootNavigator';

// Optimized QueryClient with standard 5-minute cache and single retry
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30, // 30 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" backgroundColor="#0B0D10" />
      <QueryClientProvider client={queryClient}>
        <AuthProvider queryClient={queryClient}>
          <DateFilterProvider>
            <RootNavigator />
          </DateFilterProvider>
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
