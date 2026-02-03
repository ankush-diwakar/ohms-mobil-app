import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFonts, Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold, Poppins_700Bold } from '@expo-google-fonts/poppins';

export default function AttendanceScreen() {
  const [checkInStatus, setCheckInStatus] = useState(false);
  const [checkOutStatus, setCheckOutStatus] = useState(false);
  
  let [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });

  if (!fontsLoaded) {
    return null;
  }

  const handleQRScan = () => {
    Alert.alert('QR Scanner', 'Opening QR code scanner to mark attendance...');
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
              QR Attendance Tracker
            </Text>
            <Text 
              className="text-blue-100 text-sm mt-1"
              style={{ fontFamily: 'Poppins_400Regular' }}
            >
              Mark your daily attendance with QR scan
            </Text>
          </View>
        </SafeAreaView>
      </LinearGradient>

      {/* Content */}
      <ScrollView 
        className="flex-1" 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 30 }}
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
              <View className="bg-green-50 px-4 py-2 rounded-full mb-2">
                <Text 
                  className="text-green-600 text-sm font-semibold"
                  style={{ fontFamily: 'Poppins_600SemiBold' }}
                >
                  Ready to Check-in
                </Text>
              </View>
              <Text 
                className="text-[#657786] text-sm"
                style={{ fontFamily: 'Poppins_400Regular' }}
              >
                Shift: 09:00 AM - 05:00 PM
              </Text>
            </View>

            {/* QR Scan Button */}
            <TouchableOpacity 
              onPress={handleQRScan}
              activeOpacity={0.8}
              className="mt-6 -mx-6 -mb-6 bg-[#0ea5e9] rounded-b-xl p-4"
              style={{
                shadowColor: '#0ea5e9',
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.25,
                shadowRadius: 12,
                elevation: 30,
              }}
            >
              <View className="flex-row items-center"> 
                <Ionicons name="qr-code" size={24} color="white" />
                <View className="ml-3">
                  <Text 
                    className="text-white text-lg font-bold"
                    style={{ fontFamily: 'Poppins_700Bold' }}
                  >
                    Scan QR to Mark Attendance
                  </Text>
                  <Text 
                    className="text-blue-100 text-sm"
                    style={{ fontFamily: 'Poppins_400Regular' }}
                  >
                    Tap here to open camera
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Today's Attendance Status */}
        <View className="px-4 mt-6">
          <Text 
            className="text-[#14171A] text-lg font-bold mb-4"
            style={{ fontFamily: 'Poppins_700Bold' }}
          >
            Today's Status
          </Text>
          
          <View className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            {/* Check-In */}
            <TouchableOpacity 
              className={`p-4 border-b border-gray-100 ${checkInStatus ? 'bg-green-50' : 'bg-white'}`}
              onPress={() => setCheckInStatus(!checkInStatus)}
              activeOpacity={0.7}
            >
              <View className="flex-row items-center">
                <View className={`w-10 h-10 rounded-full items-center justify-center mr-4 ${
                  checkInStatus ? 'bg-green-100' : 'bg-blue-100'
                }`}>
                  <Ionicons 
                    name="log-in-outline" 
                    size={20} 
                    color={checkInStatus ? "#16a34a" : "#0ea5e9"} 
                  />
                </View>
                <View className="flex-1">
                  <Text 
                    className={`text-base font-semibold ${
                      checkInStatus ? 'text-green-700' : 'text-[#14171A]'
                    }`}
                    style={{ fontFamily: 'Poppins_600SemiBold' }}
                  >
                    Check-In
                  </Text>
                  <Text 
                    className={`text-sm ${
                      checkInStatus ? 'text-green-600' : 'text-[#657786]'
                    }`}
                    style={{ fontFamily: 'Poppins_400Regular' }}
                  >
                    {checkInStatus ? 'Checked In' : 'Not marked yet'}
                  </Text>
                </View>
                {checkInStatus && (
                  <Ionicons name="checkmark-circle" size={20} color="#16a34a" />
                )}
              </View>
            </TouchableOpacity>
            
            {/* Check-Out */}
            <TouchableOpacity 
              className={`p-4 ${checkOutStatus ? 'bg-red-50' : 'bg-white'}`}
              onPress={() => setCheckOutStatus(!checkOutStatus)}
              activeOpacity={0.7}
            >
              <View className="flex-row items-center">
                <View className={`w-10 h-10 rounded-full items-center justify-center mr-4 ${
                  checkOutStatus ? 'bg-red-100' : 'bg-red-100'
                }`}>
                  <Ionicons 
                    name="log-out-outline" 
                    size={20} 
                    color={checkOutStatus ? "#dc2626" : "#dc2626"} 
                  />
                </View>
                <View className="flex-1">
                  <Text 
                    className={`text-base font-semibold ${
                      checkOutStatus ? 'text-red-700' : 'text-[#14171A]'
                    }`}
                    style={{ fontFamily: 'Poppins_600SemiBold' }}
                  >
                    Check-Out
                  </Text>
                  <Text 
                    className={`text-sm ${
                      checkOutStatus ? 'text-red-600' : 'text-[#657786]'
                    }`}
                    style={{ fontFamily: 'Poppins_400Regular' }}
                  >
                    {checkOutStatus ? 'Checked Out' : 'Not marked yet'}
                  </Text>
                </View>
                {checkOutStatus && (
                  <Ionicons name="checkmark-circle" size={20} color="#dc2626" />
                )}
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Monthly Stats */}
        <View className="px-4 mt-6 mb-6">
          <Text 
            className="text-[#14171A] text-lg font-bold mb-4"
            style={{ fontFamily: 'Poppins_700Bold' }}
          >
            This Month Summary
          </Text>
          
          <View className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            {/* Present Days */}
            <View className="p-4 border-b border-gray-100">
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center">
                  <View className="w-12 h-12 bg-green-100 rounded-full items-center justify-center mr-4">
                    <Ionicons name="checkmark-circle" size={24} color="#16a34a" />
                  </View>
                  <View>
                    <Text 
                      className="text-[#14171A] text-base font-semibold"
                      style={{ fontFamily: 'Poppins_600SemiBold' }}
                    >
                      Present Days
                    </Text>
                    <Text 
                      className="text-[#657786] text-xs"
                      style={{ fontFamily: 'Poppins_400Regular' }}
                    >
                      Days you attended work
                    </Text>
                  </View>
                </View>
                <Text 
                  className="text-green-600 text-xl font-bold"
                  style={{ fontFamily: 'Poppins_700Bold' }}
                >
                  22
                </Text>
              </View>
            </View>

            {/* Absent Days */}
            <View className="p-4 border-b border-gray-100">
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center">
                  <View className="w-12 h-12 bg-red-100 rounded-full items-center justify-center mr-4">
                    <Ionicons name="close-circle" size={24} color="#dc2626" />
                  </View>
                  <View>
                    <Text 
                      className="text-[#14171A] text-base font-semibold"
                      style={{ fontFamily: 'Poppins_600SemiBold' }}
                    >
                      Absent Days
                    </Text>
                    <Text 
                      className="text-[#657786] text-xs"
                      style={{ fontFamily: 'Poppins_400Regular' }}
                    >
                      Days you were absent
                    </Text>
                  </View>
                </View>
                <Text 
                  className="text-red-600 text-xl font-bold"
                  style={{ fontFamily: 'Poppins_700Bold' }}
                >
                  2
                </Text>
              </View>
            </View>

            {/* Attendance Rate */}
            <View className="p-4">
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center">
                  <View className="w-12 h-12 bg-blue-100 rounded-full items-center justify-center mr-4">
                    <Ionicons name="analytics" size={24} color="#0ea5e9" />
                  </View>
                  <View>
                    <Text 
                      className="text-[#14171A] text-base font-semibold"
                      style={{ fontFamily: 'Poppins_600SemiBold' }}
                    >
                      Attendance Rate
                    </Text>
                    <Text 
                      className="text-[#657786] text-xs"
                      style={{ fontFamily: 'Poppins_400Regular' }}
                    >
                      Overall attendance percentage
                    </Text>
                  </View>
                </View>
                <Text 
                  className="text-[#0ea5e9] text-xl font-bold"
                  style={{ fontFamily: 'Poppins_700Bold' }}
                >
                  92%
                </Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}