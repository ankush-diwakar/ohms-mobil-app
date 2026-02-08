import * as Location from 'expo-location';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { apiClient } from './apiClient';
import type { LocationAttendanceResponse } from './apiClient';

interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
}

interface QRScanResult {
  type: string;
  data: string;
}

interface AttendanceError {
  code: 'PERMISSION_DENIED' | 'LOCATION_ERROR' | 'INVALID_OTP' | 'OUTSIDE_GEOFENCE' | 'ALREADY_MARKED' | 'NETWORK_ERROR' | 'UNKNOWN';
  message: string;
}

class LocationAttendanceService {
  private static instance: LocationAttendanceService;

  static getInstance(): LocationAttendanceService {
    if (!LocationAttendanceService.instance) {
      LocationAttendanceService.instance = new LocationAttendanceService();
    }
    return LocationAttendanceService.instance;
  }

  /**
   * Request location permissions
   */
  async requestLocationPermission(): Promise<boolean> {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        console.log('❌ Location permission denied');
        return false;
      }

      console.log('✅ Location permission granted');
      return true;
    } catch (error) {
      console.error('❌ Error requesting location permission:', error);
      return false;
    }
  }

  /**
   * Check if location services are enabled
   */
  async isLocationEnabled(): Promise<boolean> {
    try {
      return await Location.hasServicesEnabledAsync();
    } catch (error) {
      console.error('❌ Error checking location services:', error);
      return false;
    }
  }

  /**
   * Get current GPS location with high accuracy
   */
  async getCurrentLocation(): Promise<LocationData> {
    try {
      console.log('📍 Getting current location...');
      
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
        timeInterval: 1000,
        distanceInterval: 1
      });

      const locationData: LocationData = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy || 0,
        timestamp: location.timestamp
      };

      console.log(`📍 Location obtained: ${locationData.latitude}, ${locationData.longitude} (accuracy: ${locationData.accuracy}m)`);
      
      return locationData;
    } catch (error) {
      console.error('❌ Error getting location:', error);
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Location error: ${message}`);
    }
  }

  /**
   * Validate OTP format (6-digit number)
   */
  validateOTP(otp: string): boolean {
    return /^\d{6}$/.test(otp.trim());
  }

  /**
   * Extract OTP from QR scan result
   */
  extractOTPFromQR(scanResult: QRScanResult): string | null {
    try {
      const { data } = scanResult;
      
      // Simple case: QR contains just the 6-digit OTP
      if (this.validateOTP(data)) {
        return data.trim();
      }

      // Try to extract 6-digit number from the data
      const otpMatch = data.match(/\d{6}/);
      if (otpMatch && this.validateOTP(otpMatch[0])) {
        return otpMatch[0];
      }

      return null;
    } catch (error) {
      console.error('❌ Error extracting OTP from QR:', error);
      return null;
    }
  }

  /**
   * Mark location-based attendance
   */
  async markAttendance(otp: string, location: LocationData): Promise<LocationAttendanceResponse> {
    try {
      console.log(`🎯 Marking attendance with OTP: ${otp} at location: ${location.latitude}, ${location.longitude}`);
      
      const response = await apiClient.markLocationAttendance(
        otp,
        location.latitude,
        location.longitude
      );

      if (response.success && response.data) {
        console.log('✅ Attendance marked successfully');
        return response.data;
      } else {
        throw new Error(response.message || 'Failed to mark attendance');
      }
    } catch (error) {
      console.error('❌ Error marking attendance:', error);
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Check for backend API error response format
      if (error && typeof error === 'object' && 'response' in error) {
        const apiError = (error as any).response;
        if (apiError && apiError.error) {
          switch (apiError.error) {
            case 'INVALID_OTP':
              throw { code: 'INVALID_OTP', message: apiError.message || 'The OTP is invalid or has expired. Please get a new QR code.' } as AttendanceError;
            case 'OUTSIDE_GEOFENCE':
              throw { code: 'OUTSIDE_GEOFENCE', message: apiError.message || 'You are not within the hospital premises. Please move closer to the hospital.' } as AttendanceError;
          }
        }
      }
      
      // Map API errors to user-friendly error codes based on message content
      if (errorMessage.includes('OTP verification failed') || errorMessage.includes('OTP is invalid or expired')) {
        throw { code: 'INVALID_OTP', message: 'The OTP is invalid or has expired. Please get a new QR code.' } as AttendanceError;
      } else if (errorMessage.includes('already marked')) {
        throw { code: 'ALREADY_MARKED', message: 'Attendance has already been marked for today.' } as AttendanceError;
      } else if (errorMessage.includes('not within hospital premises') || errorMessage.includes('not in the hospital premises')) {
        throw { code: 'OUTSIDE_GEOFENCE', message: errorMessage || 'You are not within the hospital premises. Please move closer to the hospital.' } as AttendanceError;
      } else if (errorMessage.includes('Network') || errorMessage.includes('fetch')) {
        throw { code: 'NETWORK_ERROR', message: 'Network error. Please check your internet connection.' } as AttendanceError;
      } else {
        throw { code: 'UNKNOWN', message: errorMessage || 'An unknown error occurred.' } as AttendanceError;
      }
    }
  }

  /**
   * Complete attendance flow: get location + mark attendance
   */
  async completeAttendanceFlow(otp: string): Promise<LocationAttendanceResponse> {
    try {
      // 1. Validate OTP format
      if (!this.validateOTP(otp)) {
        throw { code: 'INVALID_OTP', message: 'Please enter a valid 6-digit OTP.' } as AttendanceError;
      }

      // 2. Check if location services are enabled
      const locationEnabled = await this.isLocationEnabled();
      if (!locationEnabled) {
        throw { code: 'LOCATION_ERROR', message: 'Location services are disabled. Please enable GPS in your device settings.' } as AttendanceError;
      }

      // 3. Request location permission if needed
      const hasPermission = await this.requestLocationPermission();
      if (!hasPermission) {
        throw { code: 'PERMISSION_DENIED', message: 'Location permission is required to mark attendance. Please grant permission in settings.' } as AttendanceError;
      }

      // 4. Get current location
      const location = await this.getCurrentLocation();

      // 5. Mark attendance
      const result = await this.markAttendance(otp, location);

      return result;
    } catch (error) {
      console.error('❌ Attendance flow error:', error);
      
      if (error && typeof error === 'object' && 'code' in error) {
        // Re-throw AttendanceError as-is
        throw error;
      } else {
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.includes('Location')) {
          throw { code: 'LOCATION_ERROR', message: errorMessage } as AttendanceError;
        } else {
          throw { code: 'UNKNOWN', message: errorMessage || 'Failed to complete attendance marking.' } as AttendanceError;
        }
      }
    }
  }

  /**
   * Get hospital geofence information
   */
  getHospitalInfo() {
    return {
      name: 'Hospital OHMS',
      coordinates: {
        latitude: 18.64708126832894,
        longitude: 73.84803671386994
      },
      radius: 100, // meters
      description: 'You must be within 100 meters of the hospital to mark attendance.'
    };
  }
}

// Export singleton instance
export const locationAttendanceService = LocationAttendanceService.getInstance();
export default locationAttendanceService;
export type { LocationData, QRScanResult, AttendanceError };