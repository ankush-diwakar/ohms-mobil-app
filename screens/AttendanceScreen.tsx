import React, { useState, useRef, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, Modal, TextInput, AlertButton, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useFonts, Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold, Poppins_700Bold } from '@expo-google-fonts/poppins';
import LottieView from 'lottie-react-native';

import locationAttendanceService, { type AttendanceError } from '../services/locationAttendanceService';
import type { LocationAttendanceResponse } from '../services/apiClient';
import { apiClient } from '../services/apiClient';
import Loading from '../components/Loading';

export default function AttendanceScreen() {
  const insets = useSafeAreaInsets();
  const [attendanceData, setAttendanceData] = useState<LocationAttendanceResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);
  
  // QR Scanner state
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  
  // Manual OTP entry state
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualOTP, setManualOTP] = useState('');
  
  // Checkout state
  const [checkingOut, setCheckingOut] = useState(false);
  
  let [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });

  // Check today's attendance status on component mount
  useEffect(() => {
    checkTodayAttendanceStatus();
  }, []);

  const checkTodayAttendanceStatus = async () => {
    try {
      setCheckingStatus(true);
      const response = await apiClient.getTodayAttendanceStatus();
      
      if (response.success && response.data) {
        // If response.data exists, attendance is marked
        const attendanceInfo = response.data as any; // Type assertion since API response structure might be different
        
        if (attendanceInfo.hasAttendance) {
          // Transform API response to match LocationAttendanceResponse format
          const transformedData: LocationAttendanceResponse = {
            id: attendanceInfo.id,
            checkInTime: attendanceInfo.checkInTime,
            checkOutTime: attendanceInfo.checkOutTime, // Include checkout time
            workingHours: attendanceInfo.workingHours, // Include working hours
            status: attendanceInfo.status,
            attendanceMethod: attendanceInfo.attendanceMethod || 'location_based',
            location: attendanceInfo.location || {
              latitude: 0,
              longitude: 0,
              distance: 0,
              withinGeofence: true
            },
            staff: attendanceInfo.staff,
            geofenceInfo: {
              allowedRadius: 100,
              hospitalLocation: {
                latitude: 19.120570736906668,
                longitude: 72.89275097480169
              }
            }
          };
          
          setAttendanceData(transformedData);
        }
      }
    } catch (error) {
      console.error('❌ Error checking today\'s attendance status:', error);
    } finally {
      setCheckingStatus(false);
    }
  };

  if (!fontsLoaded) {
    return null;
  }

  // Show loading while checking attendance status
  if (checkingStatus) {
    return (
      <Loading message="Checking today's attendance status..." />
    );
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
        [{ text: 'Great!' }]
      );
      
    } catch (error) {
      const attendanceError = error as AttendanceError;
      
      let alertTitle = 'Attendance Failed';
      let alertMessage = attendanceError.message;
      let alertButtons: AlertButton[] = [{ text: 'OK' }];
      
      switch (attendanceError.code) {
        case 'PERMISSION_DENIED':
          alertTitle = 'Location Permission Required';
          alertButtons = [
            { text: 'Cancel' },
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

  const handleCheckOut = async () => {
    Alert.alert(
      'Check Out',
      'Are you sure you want to check out for today?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Check Out',
          style: 'destructive',
          onPress: async () => {
            try {
              setCheckingOut(true);
              
              const response = await apiClient.checkOut();
              
              if (response.success) {
                // Clear attendance data to show check-in UI again
                setAttendanceData(null);
                
                Alert.alert(
                  'Checked Out Successfully!',
                  `You have been checked out at ${new Date().toLocaleTimeString()}.\n\nSee you tomorrow!`,
                  [{ text: 'OK' }]
                );
              } else {
                Alert.alert(
                  'Check Out Failed',
                  response.message || 'Failed to check out. Please try again or contact support.',
                  [{ text: 'OK' }]
                );
              }
            } catch (error) {
              console.error('❌ Check out error:', error);
              Alert.alert(
                'Check Out Error',
                'An error occurred while checking out. Please try again.',
                [{ text: 'OK' }]
              );
            } finally {
              setCheckingOut(false);
            }
          },
        },
      ]
    );
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
        {/* Today's Date Card - Only show when not checked in */}
        {!attendanceData && (
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
                  ? `Marked at ${new Date((attendanceData as any).checkInTime).toLocaleTimeString()}`
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
              <Loading 
                message="Marking attendance...\nGetting your location and verifying with hospital premises" 
                animationSize={120} 
              />
            )}
            </View>
          </View>
        )}

        {/* Attendance Success (shown after successful check-in) */}
        {attendanceData && (
          <View className="px-4 mt-6">
            {/* Combined Success Card with Green Message, Animation and Date */}
            <View className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-6">
              {/* Success Status at Top */}
              <View className="px-6 py-6" style={{ backgroundColor: attendanceData.checkOutTime ? '#6b7280' : '#10b981' }}>
                <View className="items-center mb-2">
                  <Ionicons 
                    name={attendanceData.checkOutTime ? "timer" : "checkmark-circle"} 
                    size={28} 
                    color="white" 
                  />
                  <Text 
                    className="text-white text-xl font-bold mt-2 text-center"
                    style={{ fontFamily: 'Poppins_700Bold' }}
                  >
                    {attendanceData.checkOutTime ? 'Work Day Completed' : 'Attendance Marked'}
                  </Text>
                </View>
                <Text 
                  className="text-white text-center text-sm opacity-90"
                  style={{ fontFamily: 'Poppins_400Regular' }}
                >
                  {attendanceData.checkOutTime 
                    ? `CHECKED OUT AT ${new Date(attendanceData.checkOutTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`
                    : `MARKED AT ${attendanceData ? new Date((attendanceData as any).checkInTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : ''}`
                  }
                </Text>
              </View>

              {/* Success Animation */}
              <View 
                className="items-center py-6"
                style={{ backgroundColor: '#FDFDFD' }}
              >
                <LottieView
                  source={require('../animations/done.json')}
                  autoPlay
                  loop={false}
                  style={{ width: 120, height: 120 }}
                />
              </View>

              {/* Today's Date Section */}
              <View className="px-6 pb-6 border-t border-gray-100">
                <Text 
                  className="text-[#0ea5e9] text-sm font-semibold text-center mb-3 tracking-wide mt-4"
                  style={{ fontFamily: 'Poppins_600SemiBold' }}
                >
                  TODAY'S DATE
                </Text>
                <Text 
                  className="text-[#14171A] text-3xl font-bold text-center"
                  style={{ fontFamily: 'Poppins_700Bold' }}
                >
                  {new Date().toLocaleDateString('en-US', { weekday: 'long' })}
                </Text>
                <Text 
                  className="text-[#14171A] text-lg font-semibold text-center mt-1"
                  style={{ fontFamily: 'Poppins_600SemiBold' }}
                >
                  {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </Text>
              </View>
            </View>

            {/* Attendance Details */}
            <View className="rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-6" style={{ backgroundColor: '#FDFDFD' }}>
              <View className="px-6 py-4 border-b border-gray-100" style={{ backgroundColor: '#f1f5f9' }}>
                <View className="flex-row items-center">
                  <Ionicons name="information-circle" size={20} color="#6b7280" />
                  <Text 
                    className="text-[#14171A] text-lg font-bold ml-2"
                    style={{ fontFamily: 'Poppins_700Bold' }}
                  >
                    Attendance Details
                  </Text>
                </View>
              </View>

              <View className="p-6">
                {/* Check-in Time */}
                <View className="flex-row items-center mb-6">
                  <View className="w-12 h-12 bg-blue-100 rounded-xl items-center justify-center">
                    <Ionicons name="time" size={24} color="#3b82f6" />
                  </View>
                  <View className="ml-4 flex-1">
                    <Text 
                      className="text-gray-500 text-sm font-medium mb-1"
                      style={{ fontFamily: 'Poppins_500Medium' }}
                    >
                      CHECK-IN TIME
                    </Text>
                    <Text 
                      className="text-[#14171A] text-lg font-bold"
                      style={{ fontFamily: 'Poppins_700Bold' }}
                    >
                      {attendanceData ? new Date((attendanceData as any).checkInTime).toLocaleTimeString('en-US', { 
                        hour: '2-digit', 
                        minute: '2-digit',
                        second: '2-digit',
                        hour12: true 
                      }) : ''}
                    </Text>
                  </View>
                </View>

                {/* Check-out Time - Only show if checked out */}
                {attendanceData.checkOutTime && (
                  <View className="flex-row items-center mb-6">
                    <View className="w-12 h-12 bg-orange-100 rounded-xl items-center justify-center">
                      <Ionicons name="time-outline" size={24} color="#f97316" />
                    </View>
                    <View className="ml-4 flex-1">
                      <Text 
                        className="text-gray-500 text-sm font-medium mb-1"
                        style={{ fontFamily: 'Poppins_500Medium' }}
                      >
                        CHECK-OUT TIME
                      </Text>
                      <Text 
                        className="text-[#14171A] text-lg font-bold"
                        style={{ fontFamily: 'Poppins_700Bold' }}
                      >
                        {new Date(attendanceData.checkOutTime).toLocaleTimeString('en-US', { 
                          hour: '2-digit', 
                          minute: '2-digit',
                          second: '2-digit',
                          hour12: true 
                        })}
                      </Text>
                    </View>
                  </View>
                )}

                {/* Total Working Hours - Only show if checked out */}
                {attendanceData.workingHours && (
                  <View className="flex-row items-center mb-6">
                    <View className="w-12 h-12 bg-blue-100 rounded-xl items-center justify-center">
                      <Ionicons name="timer" size={24} color="#3b82f6" />
                    </View>
                    <View className="ml-4 flex-1">
                      <Text 
                        className="text-gray-500 text-sm font-medium mb-1"
                        style={{ fontFamily: 'Poppins_500Medium' }}
                      >
                        TOTAL WORKING TIME
                      </Text>
                      <Text 
                        className="text-[#14171A] text-lg font-bold"
                        style={{ fontFamily: 'Poppins_700Bold' }}
                      >
                        {attendanceData.workingHours.toFixed(2)} hours
                      </Text>
                    </View>
                  </View>
                )}

                {/* Location Accuracy */}
                <View className="flex-row items-center mb-6">
                  <View className="w-12 h-12 bg-green-100 rounded-xl items-center justify-center">
                    <Ionicons name="location" size={24} color="#10b981" />
                  </View>
                  <View className="ml-4 flex-1">
                    <Text 
                      className="text-gray-500 text-sm font-medium mb-1"
                      style={{ fontFamily: 'Poppins_500Medium' }}
                    >
                      LOCATION ACCURACY
                    </Text>
                    <Text 
                      className="text-[#14171A] text-lg font-bold"
                      style={{ fontFamily: 'Poppins_700Bold' }}
                    >
                      {attendanceData.location.distance}m{' '}
                      <Text className="text-gray-500 font-normal text-base">from center</Text>
                    </Text>
                  </View>
                </View>

                {/* Verification Method */}
                <View className="flex-row items-center">
                  <View className="w-12 h-12 bg-purple-100 rounded-xl items-center justify-center">
                    <Ionicons name="shield-checkmark" size={24} color="#8b5cf6" />
                  </View>
                  <View className="ml-4 flex-1">
                    <Text 
                      className="text-gray-500 text-sm font-medium mb-1"
                      style={{ fontFamily: 'Poppins_500Medium' }}
                    >
                      VERIFICATION METHOD
                    </Text>
                    <Text 
                      className="text-[#14171A] text-lg font-bold"
                      style={{ fontFamily: 'Poppins_700Bold' }}
                    >
                      Location-based
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Check Out Button or Check Out Status */}
            <View className="px-6 pb-6">
              {attendanceData.checkOutTime ? (
                // Show checkout status if already checked out
                <View className="bg-gray-100 rounded-xl p-4 border border-gray-200">
                  <View className="flex-row items-center justify-center mb-2">
                    <Ionicons name="checkmark-circle" size={24} color="#10b981" />
                    <Text 
                      className="text-gray-700 text-lg font-bold ml-3"
                      style={{ fontFamily: 'Poppins_700Bold' }}
                    >
                      Already Checked Out
                    </Text>
                  </View>
                  <Text 
                    className="text-gray-500 text-sm text-center"
                    style={{ fontFamily: 'Poppins_400Regular' }}
                  >
                    Checked out at {new Date(attendanceData.checkOutTime).toLocaleTimeString('en-US', {
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: true
                    })}
                  </Text>
                  {attendanceData.workingHours && (
                    <Text 
                      className="text-blue-600 text-sm text-center mt-1 font-medium"
                      style={{ fontFamily: 'Poppins_500Medium' }}
                    >
                      Total work time: {attendanceData.workingHours.toFixed(2)} hours
                    </Text>
                  )}
                </View>
              ) : (
                // Show checkout button if not checked out yet
                <TouchableOpacity 
                  onPress={handleCheckOut}
                  activeOpacity={0.8}
                  disabled={checkingOut}
                  className="bg-red-500 rounded-xl p-4"
                  style={{
                    shadowColor: '#ef4444',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.3,
                    shadowRadius: 8,
                    elevation: 8,
                    opacity: checkingOut ? 0.6 : 1
                  }}
                >
                  <View className="flex-row items-center justify-center"> 
                    {checkingOut ? (
                      <>
                        <LottieView
                          source={require('../animations/eye.json')}
                          autoPlay
                          loop
                          style={{ width: 24, height: 24 }}
                        />
                        <Text 
                          className="text-white text-lg font-bold ml-3"
                          style={{ fontFamily: 'Poppins_700Bold' }}
                        >
                          Checking Out...
                        </Text>
                      </>
                    ) : (
                    <>
                      <Ionicons name="log-out" size={24} color="white" />
                      <Text 
                        className="text-white text-lg font-bold ml-3"
                        style={{ fontFamily: 'Poppins_700Bold' }}
                      >
                        Check Out
                      </Text>
                    </>
                  )}
                </View>
                <Text 
                  className="text-red-100 text-sm text-center mt-2"
                  style={{ fontFamily: 'Poppins_400Regular' }}
                >
                  End your workday and mark checkout time
                </Text>
              </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* Hospital OHMS Info - Always Visible */}
        <View className="px-4 mt-6">
          <View className="bg-slate-800 rounded-2xl p-6">
            <View className="flex-row items-start">
              <View className="w-12 h-12 bg-blue-500 rounded-xl items-center justify-center">
                <Ionicons name="business" size={24} color="white" />
              </View>
              <View className="ml-4 flex-1">
                <Text 
                  className="text-white text-lg font-bold mb-2"
                  style={{ fontFamily: 'Poppins_700Bold' }}
                >
                  Hospital OHMS
                </Text>
                <Text 
                  className="text-gray-300 text-sm leading-5"
                  style={{ fontFamily: 'Poppins_400Regular' }}
                >
                  You must be within{' '}
                  <Text className="text-blue-400 font-semibold">100 meters</Text>
                  {' '}of the hospital to mark attendance. The app verifies your location automatically.
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
                  Point your camera at the attendance QR code 
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
              Enter the 6-digit OTP 
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