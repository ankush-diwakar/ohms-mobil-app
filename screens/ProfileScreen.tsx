import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFonts, Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold, Poppins_700Bold } from '@expo-google-fonts/poppins';

import { useAuth } from '../contexts/AuthContext';
import Avatar from '../components/Avatar';

interface ProfileScreenProps {
  onLogout: () => void;
}

export default function ProfileScreen({ onLogout }: ProfileScreenProps) {
  const [avatarVisible, setAvatarVisible] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { user, logout, fetchStaffProfile } = useAuth();
  
  let [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });

  if (!fontsLoaded) {
    return null;
  }

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Logout', style: 'destructive', onPress: async () => {
          await logout();
          onLogout();
        }}
      ]
    );
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchStaffProfile();
    } catch (error) {
      console.error('Failed to refresh profile:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleScroll = (event: any) => {
    const scrollY = event.nativeEvent.contentOffset.y;
    // Hide avatar when scrolled up more than 50px, show when scrolled back down
    setAvatarVisible(scrollY < 50);
  };

  const personalInfo = [
    {
      title: 'Full Name',
      value: user ? `${user.firstName} ${user.lastName}` : 'N/A',
      icon: 'person-outline',
    },
    {
      title: 'Email',
      value: user?.email || 'N/A',
      icon: 'mail-outline',
    },
    {
      title: 'Phone',
      value: user?.phone || 'N/A',
      icon: 'call-outline',
    },
    {
      title: 'Employee ID',
      value: user?.employeeId || 'N/A',
      icon: 'card-outline',
    },
    {
      title: 'Staff Type',
      value: user?.staffType || 'N/A',
      icon: 'briefcase-outline',
    },
    {
      title: 'Department',
      value: user?.department || 'N/A',
      icon: 'business-outline',
    },
  ];

  const settingsItems = [
    {
      title: 'Change Password',
      icon: 'lock-closed-outline',
      onPress: () => Alert.alert('Change Password', 'Feature coming soon!'),
      hasToggle: false,
    },
    {
      title: 'Notifications',
      icon: 'notifications-outline',
      hasToggle: true,
      toggleValue: true,
    },
    {
      title: 'Language',
      subtitle: 'English (US)',
      icon: 'language-outline',
      onPress: () => Alert.alert('Language', 'Feature coming soon!'),
      hasToggle: false,
    },
    {
      title: 'Help & Support',
      icon: 'help-circle-outline',
      onPress: () => Alert.alert('Help & Support', 'Feature coming soon!'),
      hasToggle: false,
    },
    {
      title: 'Terms & Conditions',
      icon: 'document-text-outline',
      onPress: () => Alert.alert('Terms & Conditions', 'Feature coming soon!'),
      hasToggle: false,
    },
  ];

  return (
    <View className="flex-1 bg-[#F5F7F8]">
      <StatusBar style="light" backgroundColor="#0ea5e9" />
      
      {/* Header with Gradient */}
      <LinearGradient
        colors={['#0ea5e9', '#38bdf8', '#7dd3fc']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        className="h-56 w-full relative"
      >
        <SafeAreaView>
          <View className="flex-row items-center justify-between p-4 mt-2">
            <View className="w-10 h-10 bg-black/10 rounded-full items-center justify-center">
              <Ionicons name="arrow-back-outline" size={20} color="white" />
            </View>
            <Text 
              className="text-white text-lg font-bold"
              style={{ fontFamily: 'Poppins_700Bold' }}
            >
              Profile
            </Text>
            <View className="w-10 h-10 bg-black/10 rounded-full items-center justify-center">
              <Ionicons name="share-outline" size={20} color="white" />
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      {/* Absolute Positioned Avatar */}
      {avatarVisible && (
        <View 
          className="absolute w-32 h-32 bg-white rounded-full border-4 border-white shadow-xl items-center justify-center"
          style={{
            top: 139, // Position it to overlap gradient and content
            left: 16, // 16px from left
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.2,
            shadowRadius: 12,
            elevation: 20,
            zIndex: 9999,
          }}
        >
          <Avatar
            src={user?.profilePhoto}
            firstName={user?.firstName}
            lastName={user?.lastName}
            size="xl"
          />
        </View>
      )}

      {/* Content */}
      <ScrollView 
        className="flex-1" 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: 10 }}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#0ea5e9"
            title="Pull to refresh profile"
          />
        }
      >
        {/* Profile Info */}
        <View className="px-4">
          <View className="flex-col gap-4">
            <View className="flex-row justify-end items-center mb-4">
              <TouchableOpacity 
                className="bg-white border-2 border-[#0ea5e9] rounded-full h-10 px-6 items-center justify-center"
                style={{
                  shadowColor: '#0ea5e9',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 8,
                  elevation: 8,
                }}
              >
                <Text 
                  className="text-[#0ea5e9] text-sm font-bold"
                  style={{ fontFamily: 'Poppins_600SemiBold' }}
                >
                  Edit Profile
                </Text>
              </TouchableOpacity>
            </View>
            
            <View className="mt-2">
              <Text 
                className="text-[#14171A] text-2xl font-bold"
                style={{ fontFamily: 'Poppins_700Bold' }}
              >
                {user ? `${user.firstName} ${user.lastName}` : 'User Name'}
              </Text>
              <Text 
                className="text-[#0ea5e9] text-base font-medium mt-1"
                style={{ fontFamily: 'Poppins_500Medium' }}
              >
                {user?.email || 'user@hospital.com'}
              </Text>
              <Text 
                className="text-[#657786] text-sm mt-1"
                style={{ fontFamily: 'Poppins_400Regular' }}
              >
                Employee ID: {user?.employeeId || 'N/A'}
              </Text>
            </View>
          </View>
        </View>

        {/* Personal Information Section */}
        <View className="mt-6">
          <Text 
            className="text-[#14171A] text-lg font-bold px-4 pb-2"
            style={{ fontFamily: 'Poppins_700Bold' }}
          >
            Personal Information
          </Text>
          <View className="mx-4 bg-white rounded-2xl shadow-sm overflow-hidden">
            {personalInfo.map((item, index) => (
              <View 
                key={index} 
                className={`flex-row items-center gap-4 px-4 py-4 ${index < personalInfo.length - 1 ? 'border-b border-gray-100' : ''}`}
              >
                <View className="w-10 h-10 bg-[#1DA1F2]/10 rounded-xl items-center justify-center">
                  <Ionicons name={item.icon as any} size={20} color="#1DA1F2" />
                </View>
                <View className="flex-1">
                  <Text 
                    className="text-[#14171A] text-sm font-medium mb-1"
                    style={{ fontFamily: 'Poppins_600SemiBold' }}
                  >
                    {item.title}
                  </Text>
                  <Text 
                    className="text-[#657786] text-base"
                    style={{ fontFamily: 'Poppins_400Regular' }}
                  >
                    {item.value}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Settings & Preferences Section */}
        <View className="mt-6">
          <Text 
            className="text-[#14171A] text-lg font-bold px-4 pb-2"
            style={{ fontFamily: 'Poppins_700Bold' }}
          >
            Settings & Preferences
          </Text>
          <View className="mx-4 bg-white rounded-2xl shadow-sm overflow-hidden">
            {settingsItems.map((item, index) => (
              <TouchableOpacity
                key={index}
                onPress={item.onPress}
                className={`flex-row items-center justify-between px-4 py-4 ${index < settingsItems.length - 1 ? 'border-b border-gray-100' : ''} ${!item.hasToggle ? 'active:bg-gray-50' : ''}`}
                disabled={item.hasToggle}
              >
                <View className="flex-row items-center gap-4 flex-1">
                  <View className="w-6 h-6 items-center justify-center">
                    <Ionicons name={item.icon as any} size={20} color="#657786" />
                  </View>
                  <View className="flex-1">
                    <Text 
                      className="text-[#14171A] font-medium"
                      style={{ fontFamily: 'Poppins_500Medium' }}
                    >
                      {item.title}
                    </Text>
                    {item.subtitle && (
                      <Text 
                        className="text-xs text-[#657786] mt-1"
                        style={{ fontFamily: 'Poppins_400Regular' }}
                      >
                        {item.subtitle}
                      </Text>
                    )}
                  </View>
                </View>
                
                {item.hasToggle ? (
                  <View className="w-12 h-6 bg-[#1DA1F2] rounded-full relative">
                    <View className="w-5 h-5 bg-white rounded-full absolute top-0.5 right-0.5" />
                  </View>
                ) : (
                  <Ionicons name="chevron-forward-outline" size={20} color="#657786" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Logout and Footer */}
        <View className="mt-10 px-4 mb-10">
          <TouchableOpacity
            onPress={handleLogout}
            className="w-full h-14 border-2 border-[#E0245E] rounded-full items-center justify-center mb-6 active:bg-[#E0245E]/5"
            activeOpacity={0.8}
          >
            <View className="flex-row items-center gap-2">
              <Ionicons name="log-out-outline" size={20} color="#E0245E" />
              <Text 
                className="text-[#E0245E] text-lg font-bold"
                style={{ fontFamily: 'Poppins_700Bold' }}
              >
                Logout
              </Text>
            </View>
          </TouchableOpacity>

          <View className="items-center">
            <Text 
              className="text-[#657786] text-xs font-medium uppercase tracking-widest"
              style={{ fontFamily: 'Poppins_600SemiBold' }}
            >
              OHMS Mobile App
            </Text>
            <Text 
              className="text-[#657786] text-sm mt-1"
              style={{ fontFamily: 'Poppins_400Regular' }}
            >
              v1.0.4 build 882
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}