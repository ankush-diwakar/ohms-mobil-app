import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

// Types for authentication
export interface User {
  id: string;
  employeeId?: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  staffType?: string;
  department?: string;
  isActive?: boolean;
  employmentStatus?: string;
  role?: string;
  patientId?: string;
  userType?: string;
  profilePhoto?: string;
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: () => boolean;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  logout: () => Promise<void>;
  refreshTokens: () => Promise<boolean>;
  checkAuthStatus: () => Promise<void>;
  getUserRole: () => string | null;
  fetchStaffProfile: () => Promise<User | null>;
  extendSessionIfNeeded: () => Promise<void>;
}

// Secure storage keys
const TOKENS_KEY = 'auth_tokens';
const USER_KEY = 'user_profile';
const REMEMBER_ME_KEY = 'remember_me';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check authentication status on app load
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      console.log('⚠️ Auth check timeout, forcing loading to false');
      setIsLoading(false);
    }, 10000); // 10 second timeout

    checkAuthStatus().finally(() => {
      clearTimeout(timeoutId);
    });

    return () => {
      clearTimeout(timeoutId);
    };
  }, []);

  // Get API base URL
  const getApiBaseUrl = (): string => {
    return process.env.EXPO_PUBLIC_API_BASE_URL || process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000/api';
  };

  // Store tokens securely
  const storeTokens = async (tokens: AuthTokens, rememberMe: boolean = true): Promise<void> => {
    try {
      await SecureStore.setItemAsync(TOKENS_KEY, JSON.stringify(tokens));
      await AsyncStorage.setItem(REMEMBER_ME_KEY, rememberMe.toString());
      console.log('✅ Tokens stored securely');
    } catch (error) {
      console.error('❌ Error storing tokens:', error);
      throw error;
    }
  };

  // Get stored tokens
  const getStoredTokens = async (): Promise<AuthTokens | null> => {
    try {
      const tokensJson = await SecureStore.getItemAsync(TOKENS_KEY);
      if (!tokensJson) return null;

      const tokens: AuthTokens = JSON.parse(tokensJson);
      
      // Check if tokens are expired
      const now = new Date().getTime();
      const expiresAt = new Date(tokens.expiresAt).getTime();
      
      if (now >= expiresAt) {
        console.log('🕐 Tokens expired, attempting refresh');
        const refreshSuccess = await refreshTokens();
        if (!refreshSuccess) {
          await clearStoredAuth();
          return null;
        }
        // Get the refreshed tokens
        const refreshedTokensJson = await SecureStore.getItemAsync(TOKENS_KEY);
        return refreshedTokensJson ? JSON.parse(refreshedTokensJson) : null;
      }

      return tokens;
    } catch (error) {
      console.error('❌ Error getting stored tokens:', error);
      return null;
    }
  };

  // Clear stored authentication data
  const clearStoredAuth = async (): Promise<void> => {
    try {
      await SecureStore.deleteItemAsync(TOKENS_KEY);
      await AsyncStorage.removeItem(USER_KEY);
      await AsyncStorage.removeItem(REMEMBER_ME_KEY);
      console.log('🗑️ Cleared stored auth data');
    } catch (error) {
      console.error('❌ Error clearing stored auth:', error);
    }
  };

  // Validate tokens by calling user profile endpoint
  const validateTokens = async (accessToken: string): Promise<User | null> => {
    try {
      const API_BASE_URL = getApiBaseUrl();
      
      const response = await fetch(`${API_BASE_URL}/staff/profile`, {
        method: 'GET',
        credentials: 'include', // Use cookies like web app
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        const staffData = data.data?.staff || data.data;
        return staffData || null;
      }
      
      return null;
    } catch (error) {
      console.error('❌ Token validation error:', error);
      return null;
    }
  };

  // Refresh access token using refresh token
  const refreshTokens = async (): Promise<boolean> => {
    try {
      const tokensJson = await SecureStore.getItemAsync(TOKENS_KEY);
      if (!tokensJson) return false;

      const currentTokens: AuthTokens = JSON.parse(tokensJson);
      const API_BASE_URL = getApiBaseUrl();

      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          refreshToken: currentTokens.refreshToken,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const newTokens: AuthTokens = {
          accessToken: data.accessToken,
          refreshToken: data.refreshToken || currentTokens.refreshToken,
          expiresAt: new Date(Date.now() + (data.expiresIn * 1000)).toISOString(),
        };

        const rememberMe = await AsyncStorage.getItem(REMEMBER_ME_KEY);
        await storeTokens(newTokens, rememberMe === 'true');
        console.log('🔄 Tokens refreshed successfully');
        return true;
      }

      return false;
    } catch (error) {
      console.error('❌ Token refresh error:', error);
      return false;
    }
  };

  // Check authentication status on app startup
  const checkAuthStatus = async (): Promise<void> => {
    setIsLoading(true);
    
    try {
      // Get remember me preference and tokens
      const rememberMe = await AsyncStorage.getItem(REMEMBER_ME_KEY);
      const tokens = await getStoredTokens();

      // If no remember me AND no valid session, logout
      if (rememberMe !== 'true' && !tokens) {
        console.log('📱 No remember me and no valid tokens, showing login');
        setUser(null);
        setIsLoading(false);
        return;
      }

      // If no remember me but has valid short-term session, check if expired
      if (rememberMe !== 'true' && tokens) {
        const now = new Date().getTime();
        const expiresAt = new Date(tokens.expiresAt).getTime();
        
        if (now >= expiresAt) {
          console.log('📱 Short-term session expired, showing login');
          await clearStoredAuth();
          setUser(null);
          setIsLoading(false);
          return;
        }
      }

      // Continue with normal token validation if tokens exist
      if (!tokens) {
        console.log('🔑 No valid tokens found, showing login');
        setUser(null);
        setIsLoading(false);
        return;
      }

      // Validate tokens by calling user profile endpoint
      const userProfile = await validateTokens(tokens.accessToken);
      if (userProfile) {
        setUser(userProfile);
        console.log('✅ User authenticated from stored tokens');
      } else {
        console.log('❌ Token validation failed, clearing auth');
        await clearStoredAuth();
        setUser(null);
      }
    } catch (error) {
      console.error('❌ Error checking auth status:', error);
      await clearStoredAuth();
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Login function
  const login = async (email: string, password: string, rememberMe: boolean = true): Promise<void> => {
    try {
      setIsLoading(true);
      const API_BASE_URL = getApiBaseUrl();

      const response = await fetch(`${API_BASE_URL}/staff/login`, {
        method: 'POST',
        credentials: 'include', // Include cookies for authentication
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.trim(),
          password: password.trim(),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        
        // Backend returns: { message: "Login successful", data: { user: {...} } }
        const user = data.data?.user;
        
        if (!user) {
          console.error('Response structure:', data);
          throw new Error('Invalid response structure from login API');
        }

        // Backend uses httpOnly cookies for auth, but for React Native we need tokens
        // Extract token from Set-Cookie header if available, or create a placeholder
        const setCookieHeader = response.headers.get('set-cookie');
        let token = null;
        
        if (setCookieHeader) {
          const tokenMatch = setCookieHeader.match(/authToken=([^;]+)/);
          if (tokenMatch) {
            token = tokenMatch[1];
          }
        }
        
        // Calculate expiry based on remember me preference
        const expiryDuration = rememberMe 
          ? (7 * 24 * 60 * 60 * 1000) // 7 days for remember me
          : (8 * 60 * 60 * 1000);      // 8 hours for regular session
        
        // If no token in cookie, we'll need to rely on credentials: 'include' for subsequent requests
        // For now, create a placeholder token structure for compatibility
        const tokens: AuthTokens = {
          accessToken: token || `session_${Date.now()}`, // Placeholder if no token
          refreshToken: token || `session_${Date.now()}`,
          expiresAt: new Date(Date.now() + expiryDuration).toISOString(),
        };

        // Store tokens securely (even if placeholder)
        await storeTokens(tokens, rememberMe);

        // Store user profile in AsyncStorage for quick access
        await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));

        // Set user in context
        setUser(user);
        
        console.log('✅ Login successful');
      } else {
        const errorData = await response.json().catch(() => ({ message: 'Login failed' }));
        throw new Error(errorData.message || `Login failed with status: ${response.status}`);
      }
    } catch (error: any) {
      console.error('❌ Login error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Extend session when user is active (if remember me is enabled)
  const extendSessionIfNeeded = async (): Promise<void> => {
    try {
      const rememberMe = await AsyncStorage.getItem(REMEMBER_ME_KEY);
      const tokens = await getStoredTokens();
      
      if (rememberMe === 'true' && tokens) {
        const now = new Date().getTime();
        const expiresAt = new Date(tokens.expiresAt).getTime();
        const timeUntilExpiry = expiresAt - now;
        
        // If less than 24 hours remaining, extend for another 7 days
        if (timeUntilExpiry < (24 * 60 * 60 * 1000)) {
          const extendedTokens: AuthTokens = {
            ...tokens,
            expiresAt: new Date(Date.now() + (7 * 24 * 60 * 60 * 1000)).toISOString(),
          };
          
          await storeTokens(extendedTokens, true);
          console.log('🔄 Session extended for active user');
        }
      }
    } catch (error) {
      console.error('❌ Error extending session:', error);
    }
  };

  const fetchStaffProfile = async (): Promise<User | null> => {
    try {
      const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || process.env.EXPO_PUBLIC_API_URL;
      
      const response = await fetch(`${API_BASE_URL}/staff/profile`, {
        method: 'GET',
        credentials: 'include', // Use cookies like web app
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch profile: ${response.status}`);
      }

      const data = await response.json();
      const staffData = data.data?.staff || data.data;
      
      if (staffData) {
        return staffData;
      }
      
      return null;
    } catch (error) {
      console.error('Error fetching staff profile:', error);
      return null;
    }
  };

  // Logout function
  const logout = async (): Promise<void> => {
    try {
      setIsLoading(true);
      
      // Call logout endpoint to invalidate tokens on server
      try {
        const tokens = await getStoredTokens();
        if (tokens) {
          const API_BASE_URL = getApiBaseUrl();
          await fetch(`${API_BASE_URL}/auth/logout`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${tokens.accessToken}`,
            },
          });
        }
      } catch (error) {
        console.log('Server logout failed, proceeding with local logout');
      }

      // Clear all stored auth data
      await clearStoredAuth();
      
      // Clear user from context
      setUser(null);
      
      console.log('🚪 Logout successful');
    } catch (error) {
      console.error('❌ Logout error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const isAuthenticated = (): boolean => {
    // User is authenticated if:
    // 1. User object exists
    // 2. User has either staffType (for staff), userType (for superadmin), or patientId (for patient)
    // 3. User has a role explicitly set
    return !!(user && (user.staffType || user.userType || user.role || user.patientId));
  };

  const getUserRole = (): string | null => {
    if (!user) return null;
    
    // If user has patientId or role is patient, they are a patient
    if (user.patientId || user.role === 'patient') {
      return 'patient';
    }
    
    // If user has userType, they are a superadmin
    if (user.userType || user.role === 'superadmin') {
      return 'superadmin';
    }
    
    // If user has staffType, they are a staff member
    if (user.staffType || user.role === 'staff') {
      return 'staff';
    }
    
    return null;
  };

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated,
    login,
    logout,
    refreshTokens,
    checkAuthStatus,
    getUserRole,
    fetchStaffProfile,
    extendSessionIfNeeded,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Custom hook to use AuthContext
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;