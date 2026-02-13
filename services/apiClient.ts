import * as SecureStore from 'expo-secure-store';
import { useAuth } from '../contexts/AuthContext';

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}

interface ApiResponse<T = any> {
  data?: T;
  message?: string;
  success?: boolean;
  error?: string;
}

interface LocationAttendanceRequest {
  otp: string;
  latitude: number;
  longitude: number;
}

interface LocationAttendanceResponse {
  id: string;
  checkInTime: string;
  checkOutTime?: string; // Optional checkout time
  workingHours?: number; // Optional working hours
  status: string;
  attendanceMethod: string;
  location: {
    latitude: number;
    longitude: number;
    distance: number;
    withinGeofence: boolean;
  };
  staff: {
    firstName: string;
    lastName: string;
    staffType: string;
    department?: string;
  };
  geofenceInfo: {
    allowedRadius: number;
    hospitalLocation: {
      latitude: number;
      longitude: number;
    };
  };
}

class ApiClient {
  private baseURL: string;
  private static instance: ApiClient;

  constructor() {
    this.baseURL = process.env.EXPO_PUBLIC_API_BASE_URL || 
                   process.env.EXPO_PUBLIC_API_URL || 
                   'http://localhost:3000/api/v1';
  }

  static getInstance(): ApiClient {
    if (!ApiClient.instance) {
      ApiClient.instance = new ApiClient();
    }
    return ApiClient.instance;
  }

  private async getStoredTokens(): Promise<AuthTokens | null> {
    try {
      const tokensJson = await SecureStore.getItemAsync('auth_tokens');
      if (!tokensJson) return null;

      const tokens: AuthTokens = JSON.parse(tokensJson);
      
      // Check if tokens are expired
      const now = new Date().getTime();
      const expiresAt = new Date(tokens.expiresAt).getTime();
      
      if (now >= expiresAt) {
        console.log('🕐 Tokens expired');
        return null;
      }

      return tokens;
    } catch (error) {
      console.error('❌ Error getting stored tokens:', error);
      return null;
    }
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseURL}${endpoint}`;
    
    // Get auth tokens
    const tokens = await this.getStoredTokens();
    
    const config: RequestInit = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(tokens && { 'Authorization': `Bearer ${tokens.accessToken}` }),
        ...options.headers,
      },
    };

    try {
      const response = await fetch(url, config);
      
      if (response.status === 401) {
        // Token expired or invalid - try to refresh if we have refresh token
        if (tokens?.refreshToken) {
          console.log('🔄 Attempting token refresh...');
          const refreshed = await this.refreshTokens(tokens.refreshToken);
          if (refreshed) {
            // Retry the original request with new tokens
            const newTokens = await this.getStoredTokens();
            config.headers = {
              ...config.headers,
              'Authorization': `Bearer ${newTokens?.accessToken}`,
            };
            
            const retryResponse = await fetch(url, config);
            if (retryResponse.ok) {
              const data = await retryResponse.json();
              return data;
            }
          }
        }
        
        // If refresh failed or no refresh token, user needs to login again
        throw new Error('Authentication failed. Please login again.');
      }
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({
          message: 'Network error occurred'
        }));
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('API Request Error:', error);
      throw error;
    }
  }

  private async refreshTokens(refreshToken: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseURL}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          refreshToken: refreshToken,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const newTokens: AuthTokens = {
          accessToken: data.accessToken,
          refreshToken: data.refreshToken || refreshToken,
          expiresAt: new Date(Date.now() + (data.expiresIn * 1000)).toISOString(),
        };

        await SecureStore.setItemAsync('auth_tokens', JSON.stringify(newTokens));
        console.log('🔄 Tokens refreshed successfully');
        return true;
      }

      return false;
    } catch (error) {
      console.error('❌ Token refresh error:', error);
      return false;
    }
  }

  async get<T>(endpoint: string, headers?: Record<string, string>): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'GET',
      headers,
    });
  }

  async post<T>(
    endpoint: string,
    data?: any,
    headers?: Record<string, string>
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      headers,
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T>(
    endpoint: string,
    data?: any,
    headers?: Record<string, string>
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      headers,
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T>(endpoint: string, headers?: Record<string, string>): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'DELETE',
      headers,
    });
  }

  async patch<T>(
    endpoint: string,
    data?: any,
    headers?: Record<string, string>
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      headers,
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  // Location-based attendance marking
  async markLocationAttendance(
    otp: string,
    latitude: number,
    longitude: number
  ): Promise<ApiResponse<LocationAttendanceResponse>> {
    const data: LocationAttendanceRequest = {
      otp,
      latitude,
      longitude
    };

    return this.post<LocationAttendanceResponse>('/attendance/mark-location', data);
  }

  // Check today's attendance status
  async getTodayAttendanceStatus(): Promise<ApiResponse<LocationAttendanceResponse | null>> {
    return this.get<LocationAttendanceResponse | null>('/attendance/today-status');
  }

  // Checkout attendance
  async checkOut(): Promise<ApiResponse<any>> {
    return this.post('/attendance/checkout', {});
  }
}

// Export singleton instance
export const apiClient = ApiClient.getInstance();
export default apiClient;

// Export types
export type { LocationAttendanceResponse, LocationAttendanceRequest, ApiResponse };