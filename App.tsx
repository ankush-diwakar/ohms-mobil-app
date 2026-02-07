import React, { useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, Text, TouchableOpacity } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import LoginScreen from './screens/LoginScreen';
import TabNavigator from './navigation/TabNavigator';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ErrorBoundary } from './components/ErrorBoundary';

import './global.css';

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
  const { isAuthenticated, logout, isLoading } = useAuth();
  const [forceSkipLoading, setForceSkipLoading] = useState(false);

  // Show loading screen while checking authentication
  if (isLoading && !forceSkipLoading) {
    return (
      <LinearGradient
        colors={['#C8E6FF', '#E6F3FF', '#F5FAFF', '#FFFFFF']}
        locations={[0, 0.4, 0.7, 1]}
        style={{ flex: 1 }}
      >
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#0ea5e9" />
          <Text className="mt-4 text-gray-600 text-base">Loading...</Text>
          <TouchableOpacity
            onPress={() => setForceSkipLoading(true)}
            className="mt-6 bg-blue-500 px-6 py-3 rounded-lg"
          >
            <Text className="text-white font-semibold">Skip Loading</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    );
  }

  return (
    <>
      <StatusBar style="auto" />
      {isAuthenticated() ? (
        <TabNavigator onLogout={logout} />
      ) : (
        <LoginScreen />
      )}
    </>
  );
}
