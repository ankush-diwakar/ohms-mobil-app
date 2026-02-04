const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || process.env.EXPO_PUBLIC_API_URL;

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface ApiResponse<T> {
  message: string;
  data: T;
}

export interface StaffLoginResponse {
  user: {
    id: string;
    employeeId: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    staffType: string;
    department: string;
    isActive: boolean;
    employmentStatus: string;
    lastLogin: string;
    createdAt: string;
    updatedAt: string;
  };
}

class ApiClient {
  private baseURL: string;

  constructor() {
    this.baseURL = API_BASE_URL || '';
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseURL}${endpoint}`;
    
    const config: RequestInit = {
      ...options,
      credentials: 'include', // Use cookies for authentication
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    };

    try {
      const response = await fetch(url, config);
      
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
}

// Create and export a singleton instance
export const apiClient = new ApiClient();

// Auth Service
export const authService = {
  // Staff Login
  staffLogin: async (credentials: LoginCredentials): Promise<ApiResponse<StaffLoginResponse>> => {
    return apiClient.post<StaffLoginResponse>('/staff/login', credentials);
  },

  // Super Admin Login
  superAdminLogin: async (credentials: LoginCredentials): Promise<ApiResponse<any>> => {
    return apiClient.post('/super-admin/login', credentials);
  },

  // Patient Login (if needed)
  patientLogin: async (credentials: LoginCredentials): Promise<ApiResponse<any>> => {
    return apiClient.post('/patients/login', credentials);
  },

  // Staff Logout
  staffLogout: async (): Promise<ApiResponse<any>> => {
    return apiClient.post('/staff/logout');
  },

  // Get Staff Profile
  getStaffProfile: async (token?: string): Promise<ApiResponse<any>> => {
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
    return apiClient.get('/staff/profile', headers);
  },

  // Get Super Admin Profile
  getSuperAdminProfile: async (token?: string): Promise<ApiResponse<any>> => {
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
    return apiClient.get('/super-admin/profile', headers);
  },

  // Get Patient Profile
  getPatientProfile: async (token?: string): Promise<ApiResponse<any>> => {
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
    return apiClient.get('/patients/profile', headers);
  },
};

export default authService;