import React, { useEffect, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { View, AppState } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';

import LoginScreen from './screens/LoginScreen';
import TabNavigator from './navigation/TabNavigator';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import PushNotificationService from './services/pushNotificationService';

import './global.css';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync().catch(() => {
  // Ignore errors - splash screen may already be hidden
});

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 2,
    },
  },
});

export default function App() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <NavigationContainer>
            <AuthProvider>
              <AppContent />
            </AuthProvider>
          </NavigationContainer>
        </QueryClientProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

function AppContent() {
  const { isAuthenticated, logout, isLoading, extendSessionIfNeeded, user } = useAuth();
  const pushRegistered = useRef(false);
  const pushService = useRef(PushNotificationService.getInstance());

  // Hide splash screen once auth check is complete
  useEffect(() => {
    if (!isLoading) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [isLoading]);

  // Initialize and register push notifications when user is authenticated
  useEffect(() => {
    const setupPush = async () => {
      if (user && isAuthenticated() && !pushRegistered.current) {
        const token = await pushService.current.initialize();
        if (token) {
          await pushService.current.registerWithBackend(
            user.id || '',
            user.staffType || 'unknown'
          );
          pushRegistered.current = true;
        }
      } else if (!user && pushRegistered.current) {
        await pushService.current.unregisterFromBackend();
        pushService.current.cleanup();
        pushRegistered.current = false;
      }
    };

    setupPush();
  }, [user]);

  // Monitor app state for session extension
  useEffect(() => {
    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'active') {
        extendSessionIfNeeded();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, [extendSessionIfNeeded]);

  // While checking auth, keep splash screen visible (don't render anything)
  if (isLoading) {
    return null;
  }

  return (
    <View style={{ flex: 1 }}>
      <StatusBar style="auto" />
      {isAuthenticated() ? (
        <TabNavigator onLogout={logout} />
      ) : (
        <LoginScreen />
      )}
    </View>
  );
}
