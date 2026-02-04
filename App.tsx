import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import LoginScreen from './screens/LoginScreen';
import TabNavigator from './navigation/TabNavigator';
import { AuthProvider, useAuth } from './contexts/AuthContext';

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

function AppContent() {
  const { isAuthenticated, logout } = useAuth();

  return (
    <NavigationContainer>
      <StatusBar style="auto" />
      {isAuthenticated() ? (
        <TabNavigator onLogout={logout} />
      ) : (
        <LoginScreen />
      )}
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </QueryClientProvider>
  );
}
