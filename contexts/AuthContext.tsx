import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Types for user data
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

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (userData: User) => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: () => boolean;
  getUserRole: () => string | null;
  checkAuthStatus: () => Promise<void>;
  fetchStaffProfile: () => Promise<User | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check authentication status on app load
  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      setIsLoading(true);
      
      // Try to get stored user data from AsyncStorage
      const storedUser = await AsyncStorage.getItem('user');
      
      if (storedUser) {
        const userData = JSON.parse(storedUser);
        setUser(userData);
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error('Error checking auth status:', error);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (userData: User) => {
    try {
     
      setUser(userData);
      
      // Store user data in AsyncStorage
      await AsyncStorage.setItem('user', JSON.stringify(userData));

      // For now, let's skip the secondary profile fetch and just use login data
      console.log('User logged in successfully with profile photo:', userData.profilePhoto);
    } catch (error) {
      console.error('Error storing user data:', error);
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

  const logout = async () => {
    try {
      // Clear user state
      setUser(null);
      
      // Clear stored data from AsyncStorage (no token to remove)
      await AsyncStorage.multiRemove(['user']);
      
      // You can also call logout endpoint here if needed
      // await logoutAPI();
      
    } catch (error) {
      console.error('Error during logout:', error);
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
    login,
    logout,
    isAuthenticated,
    getUserRole,
    checkAuthStatus,
    fetchStaffProfile,
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