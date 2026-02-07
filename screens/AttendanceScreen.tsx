import React, { useState, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, Modal, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useFonts, Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold, Poppins_700Bold } from '@expo-google-fonts/poppins';

import locationAttendanceService, { type AttendanceError } from '../services/locationAttendanceService';
import type { LocationAttendanceResponse } from '../services/apiClient';

export default function AttendanceScreen() {
  const insets = useSafeAreaInsets();
  const [attendanceData, setAttendanceData] = useState<LocationAttendanceResponse | null>(null);
  const [loading, setLoading] = useState(false);
  
  // QR Scanner state
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  
  // Manual OTP entry state
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualOTP, setManualOTP] = useState('');
  
  let [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });

  if (!fontsLoaded) {
    return null;
  }

  const handleQRScan = async () => {
    // Check camera permission
    if (!cameraPermission?.granted) {
      const result = await requestCameraPermission();
      if (!result.granted) {
        Alert.alert(
          'Camera Permission Required',
          'Please grant camera permission to scan QR codes.',
          [{ text: 'OK' }]
        );
        return;
      }
    }

    setScanned(false);
    setShowQRScanner(true);
  };

  const handleBarcodeScanned = ({ data }: { data: string }) => {
    if (scanned) return;
    
    setScanned(true);
    setShowQRScanner(false);
    
    // Extract OTP from QR data
    const otp = locationAttendanceService.extractOTPFromQR({ type: 'qr', data });
    
    if (otp) {
      markAttendance(otp);
    } else {
      Alert.alert(
        'Invalid QR Code',
        'The scanned QR code does not contain a valid OTP. Please scan the attendance QR code from the admin dashboard.',
        [{ text: 'OK' }]
      );
    }
  };

  const handleManualOTPSubmit = () => {
    const trimmedOTP = manualOTP.trim();
    
    if (!locationAttendanceService.validateOTP(trimmedOTP)) {
      Alert.alert(
        'Invalid OTP',
        'Please enter a valid 6-digit OTP.',
        [{ text: 'OK' }]
      );
      return;
    }

    setShowManualEntry(false);
    setManualOTP('');
    markAttendance(trimmedOTP);
  };

  const markAttendance = async (otp: string) => {
    setLoading(true);
    
    try {
      const result = await locationAttendanceService.completeAttendanceFlow(otp);
      
      setAttendanceData(result);
      
      Alert.alert(
        'Attendance Marked Successfully! ✅',
        `Your attendance has been marked at ${new Date(result.checkInTime).toLocaleTimeString()}.\n\nLocation: ${result.location.distance}m from hospital center`,
        [{ text: 'Great!', style: 'default' }]
      );
      
    } catch (error) {
      const attendanceError = error as AttendanceError;
      
      let alertTitle = 'Attendance Failed';
      let alertMessage = attendanceError.message;
      let alertButtons = [{ text: 'OK' }];
      
      switch (attendanceError.code) {
        case 'PERMISSION_DENIED':
          alertTitle = 'Location Permission Required';
          alertButtons = [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => {/* Could open device settings */} }
          ];
          break;
        case 'OUTSIDE_GEOFENCE':
          alertTitle = 'Not at Hospital';
          alertMessage += '\n\nYou need to be within 100 meters of the hospital to mark attendance.';
          break;
        case 'ALREADY_MARKED':
          alertTitle = 'Already Checked In';
          break;
        case 'INVALID_OTP':
          alertTitle = 'Invalid OTP';
          alertButtons = [
            { text: 'OK' },
            { text: 'Try Again', onPress: () => setShowManualEntry(true) }
          ];
          break;
      }
      
      Alert.alert(alertTitle, alertMessage, alertButtons);
    } finally {
      setLoading(false);
    }
  };

  const getCurrentDate = () => {
    const today = new Date();
    const monthNames = ["January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"];
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    
    return {
      day: today.getDate(),
      month: monthNames[today.getMonth()],
      dayName: dayNames[today.getDay()],
      year: today.getFullYear()
    };
  };

  const dateInfo = getCurrentDate();

  return (
    <View className="flex-1 bg-[#F8FAFC]">
      <StatusBar style="light" backgroundColor="#0ea5e9" />
      
      {/* Header with Gradient */}
      <LinearGradient
        colors={['#0ea5e9', '#38bdf8', '#7dd3fc']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        className="pb-8"
      >
        <SafeAreaView>
          <View className="px-6 pt-4 pb-4">
            <Text 
              className="text-white text-2xl font-bold"
              style={{ fontFamily: 'Poppins_700Bold' }}
            >
              Location-Based Attendance
            </Text>
            <Text 
              className="text-blue-100 text-sm mt-1"
              style={{ fontFamily: 'Poppins_400Regular' }}
            >
              Scan QR code or enter OTP to mark attendance
            </Text>
          </View>
        </SafeAreaView>
      </LinearGradient>

      {/* Content */}
      <ScrollView 
        className="flex-1" 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
      >
        {/* Today's Date Card */}
        <View className="px-4 mt-6">
          <View className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
            <View className="items-center mb-6">
              <Text 
                className="text-[#0ea5e9] text-lg font-semibold mb-2"
                style={{ fontFamily: 'Poppins_600SemiBold' }}
              >
                Today's Date
              </Text>
              <Text 
                className="text-[#14171A] text-3xl font-bold"
                style={{ fontFamily: 'Poppins_700Bold' }}
              >
                {dateInfo.dayName}
              </Text>
              <Text 
                className="text-[#14171A] text-xl font-semibold"
                style={{ fontFamily: 'Poppins_600SemiBold' }}
              >
                {dateInfo.month} {dateInfo.day}, {dateInfo.year}
              </Text>
            </View>

            {/* Current Status */}
            <View className="items-center mb-6">
              <View className={`px-4 py-2 rounded-full mb-2 ${
                attendanceData ? 'bg-green-50' : 'bg-blue-50'
              }`}>
                <Text 
                  className={`text-sm font-semibold ${
                    attendanceData ? 'text-green-600' : 'text-blue-600'
                  }`}
                  style={{ fontFamily: 'Poppins_600SemiBold' }}
                >
                  {attendanceData ? 'Checked In ✅' : 'Ready to Check-in'}
                </Text>
              </View>
              <Text 
                className="text-[#657786] text-sm text-center"
                style={{ fontFamily: 'Poppins_400Regular' }}
              >
                {attendanceData 
                  ? `Marked at ${new Date(attendanceData.checkInTime).toLocaleTimeString()}`
                  : 'Scan QR code from admin dashboard or enter OTP'
                }
              </Text>
            </View>

            {/* Action Buttons */}
            {!attendanceData && (
              <>
                {/* QR Scan Button */}
                <TouchableOpacity 
                  onPress={handleQRScan}
                  activeOpacity={0.8}
                  disabled={loading}
                  className="bg-[#0ea5e9] rounded-xl p-4 mb-4"
                  style={{
                    shadowColor: '#0ea5e9',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.3,
                    shadowRadius: 8,
                    elevation: 8,
                    opacity: loading ? 0.6 : 1
                  }}
                >
                  <View className="flex-row items-center justify-center"> 
                    <Ionicons name="qr-code" size={24} color="white" />
                    <View className="ml-3">
                      <Text 
                        className="text-white text-lg font-bold"
                        style={{ fontFamily: 'Poppins_700Bold' }}
                      >
                        Scan QR Code
                      </Text>
                      <Text 
                        className="text-blue-100 text-sm"
                        style={{ fontFamily: 'Poppins_400Regular' }}
                      >
                        Open camera to scan attendance QR
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>

                {/* Manual OTP Button */}
                <TouchableOpacity 
                  onPress={() => setShowManualEntry(true)}
                  activeOpacity={0.8}
                  disabled={loading}
                  className="bg-gray-100 rounded-xl p-4 border border-gray-200"
                  style={{ opacity: loading ? 0.6 : 1 }}
                >
                  <View className="flex-row items-center justify-center"> 
                    <Ionicons name="keypad" size={24} color="#6b7280" />
                    <View className="ml-3">
                      <Text 
                        className="text-gray-700 text-lg font-bold"
                        style={{ fontFamily: 'Poppins_700Bold' }}
                      >
                        Enter OTP Manually
                      </Text>
                      <Text 
                        className="text-gray-500 text-sm"
                        style={{ fontFamily: 'Poppins_400Regular' }}
                      >
                        Type the 6-digit OTP if QR scan fails
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              </>
            )}

            {/* Loading Indicator */}
            {loading && (
              <View className="items-center justify-center py-8">
                <ActivityIndicator size="large" color="#0ea5e9" />
                <Text 
                  className="text-[#657786] text-sm mt-4 text-center"
                  style={{ fontFamily: 'Poppins_400Regular' }}
                >
                  Marking attendance...{'\n'}Getting your location and verifying with hospital premises
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Attendance Details (shown after successful check-in) */}
        {attendanceData && (
          <View className="px-4 mt-6">
            <Text 
              className="text-[#14171A] text-lg font-bold mb-4"
              style={{ fontFamily: 'Poppins_700Bold' }}
            >
              Attendance Details
            </Text>
            
            <View className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <View className="mb-4">
                <Text className="text-gray-500 text-sm mb-1" style={{ fontFamily: 'Poppins_400Regular' }}>
                  Check-in Time
                </Text>
                <Text className="text-gray-900 text-lg font-semibold" style={{ fontFamily: 'Poppins_600SemiBold' }}>
                  {new Date(attendanceData.checkInTime).toLocaleTimeString()} 
                </Text>
              </View>

              <View className="mb-4">
                <Text className="text-gray-500 text-sm mb-1" style={{ fontFamily: 'Poppins_400Regular' }}>
                  Location Accuracy
                </Text>
                <Text className="text-green-600 text-lg font-semibold" style={{ fontFamily: 'Poppins_600SemiBold' }}>
                  {attendanceData.location.distance}m from hospital center
                </Text>
              </View>

              <View className="mb-4">
                <Text className="text-gray-500 text-sm mb-1" style={{ fontFamily: 'Poppins_400Regular' }}>
                  Attendance Method
                </Text>
                <Text className="text-blue-600 text-lg font-semibold" style={{ fontFamily: 'Poppins_600SemiBold' }}>
                  Location-based verification
                </Text>
              </View>

              <View className="bg-green-50 rounded-lg p-4 border border-green-200">
                <View className="flex-row items-center">
                  <Ionicons name="checkmark-circle" size={24} color="#16a34a" />
                  <Text className="text-green-700 font-semibold ml-3" style={{ fontFamily: 'Poppins_600SemiBold' }}>
                    Successfully verified at hospital premises
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Hospital Info */}
        <View className="px-4 mt-6 mb-6">
          <Text 
            className="text-[#14171A] text-lg font-bold mb-4"
            style={{ fontFamily: 'Poppins_700Bold' }}
          >
            Location Requirements
          </Text>
          
          <View className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <View className="flex-row items-start">
              <Ionicons name="location" size={24} color="#0ea5e9" className="mt-1" />
              <View className="ml-4 flex-1">
                <Text 
                  className="text-[#14171A] text-base font-semibold mb-2"
                  style={{ fontFamily: 'Poppins_600SemiBold' }}
                >
                  Hospital OHMS
                </Text>
                <Text 
                  className="text-[#657786] text-sm leading-5"
                  style={{ fontFamily: 'Poppins_400Regular' }}
                >
                  You must be within 100 meters of the hospital to mark attendance. 
                  The app will automatically verify your location when you scan the QR code or enter the OTP.
                </Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* QR Scanner Modal */}
      <Modal
        animationType="slide"
        transparent={false}
        visible={showQRScanner}
        onRequestClose={() => setShowQRScanner(false)}
      >
        <View className="flex-1 bg-black">
          <SafeAreaView className="flex-1">
            {/* Header */}
            <View className="flex-row items-center justify-between p-4 bg-black">
              <TouchableOpacity 
                onPress={() => setShowQRScanner(false)}
                className="p-2"
              >
                <Ionicons name="close" size={28} color="white" />
              </TouchableOpacity>
              <Text className="text-white text-lg font-semibold" style={{ fontFamily: 'Poppins_600SemiBold' }}>
                Scan Attendance QR
              </Text>
              <View className="w-12" />
            </View>

            {/* Camera */}
            <CameraView
              style={{ flex: 1 }}
              facing="back"
              onBarcodeScanned={handleBarcodeScanned}
              barcodeScannerSettings={{
                barcodeTypes: ['qr']
              }}
            >
              {/* QR Scanner Overlay */}
              <View className="flex-1 items-center justify-center">
                <View 
                  className="w-64 h-64 border-2 border-white rounded-xl"
                  style={{
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.8,
                    shadowRadius: 4,
                  }}
                />
                <Text 
                  className="text-white text-center mt-6 px-8"
                  style={{ fontFamily: 'Poppins_400Regular' }}
                >
                  Point your camera at the attendance QR code from the admin dashboard
                </Text>
              </View>
            </CameraView>

            {/* Bottom Instructions */}
            <View className="bg-black p-4">
              <TouchableOpacity 
                onPress={() => {
                  setShowQRScanner(false);
                  setShowManualEntry(true);
                }}
                className="bg-gray-800 rounded-xl p-4"
              >
                <Text className="text-white text-center font-semibold" style={{ fontFamily: 'Poppins_600SemiBold' }}>
                  Can't scan? Enter OTP manually
                </Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </View>
      </Modal>

      {/* Manual OTP Entry Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showManualEntry}
        onRequestClose={() => setShowManualEntry(false)}
      >
        <View className="flex-1 justify-center items-center px-6" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
          <View className="bg-white rounded-xl p-6 w-full max-w-sm">
            <Text 
              className="text-xl font-bold text-center mb-4"
              style={{ fontFamily: 'Poppins_700Bold' }}
            >
              Enter Attendance OTP
            </Text>
            
            <Text 
              className="text-gray-600 text-center mb-6"
              style={{ fontFamily: 'Poppins_400Regular' }}
            >
              Enter the 6-digit OTP from the admin dashboard
            </Text>

            <TextInput
              className="border-2 border-gray-300 rounded-xl p-4 text-center text-2xl font-bold tracking-widest"
              style={{ fontFamily: 'Poppins_700Bold' }}
              placeholder="000000"
              placeholderTextColor="#9CA3AF"
              value={manualOTP}
              onChangeText={setManualOTP}
              keyboardType="numeric"
              maxLength={6}
              autoFocus={true}
            />

            <View className="flex-row mt-6">
              <TouchableOpacity 
                onPress={() => {
                  setShowManualEntry(false);
                  setManualOTP('');
                }}
                className="flex-1 p-4 mr-2 bg-gray-200 rounded-xl"
              >
                <Text className="text-gray-700 text-center font-semibold" style={{ fontFamily: 'Poppins_600SemiBold' }}>
                  Cancel
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                onPress={handleManualOTPSubmit}
                className="flex-1 p-4 ml-2 bg-[#0ea5e9] rounded-xl"
                disabled={manualOTP.length !== 6}
                style={{ opacity: manualOTP.length === 6 ? 1 : 0.5 }}
              >
                <Text className="text-white text-center font-semibold" style={{ fontFamily: 'Poppins_600SemiBold' }}>
                  Mark Attendance
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}