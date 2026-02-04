import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import LottieView from 'lottie-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFonts, Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold, Poppins_700Bold } from '@expo-google-fonts/poppins';
import * as SplashScreen from 'expo-splash-screen';

import { useAuth } from '../contexts/AuthContext';
import { authService } from '../services/authService';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const { login } = useAuth();

  let [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setIsLoading(true);

    try {
      // Call the staff login API
      const response = await authService.staffLogin({
        email: email.trim(),
        password: password.trim(),
      });

      if (response.data && response.data.user) {
        const userData = {
          ...response.data.user,
          role: 'staff', // Set the role explicitly
        };

        // Store user data in auth context
        await login(userData);

        Alert.alert('Success', `Welcome back, ${userData.firstName}!`);
      } else {
        throw new Error('Invalid response structure');
      }
    } catch (error: any) {
      console.error('Login error:', error);
      
      let errorMessage = 'Login failed. Please try again.';
      if (error.message) {
        errorMessage = error.message;
      }

      Alert.alert('Login Failed', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = () => {
    Alert.alert('Forgot Password', 'Password reset functionality coming soon!');
  };

  return (
    <LinearGradient
      colors={['#C8E6FF', '#E6F3FF', '#F5FAFF', '#FFFFFF']}
      locations={[0, 0.4, 0.7, 1]}
      style={{ flex: 1 }}
    >
      <SafeAreaView className="flex-1">
        <StatusBar style="dark" backgroundColor="#ffffff" />
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="flex-1"
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <ScrollView 
            contentContainerStyle={{ flexGrow: 1 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View className="flex-1 justify-center px-10 py-4 mt-[-40px]">
              
              {/* Logo and Animation Section */}
              <View className="items-center mb-6">
                <View className="w-45 h-40 mb-[-30px] mt-[-60px] ">
                  <LottieView
                    source={require('../animations/eye.json')}
                    autoPlay
                    loop
                    style={{ width: 180, height: 150 }}
                  />
                </View>
                
                <Text 
                  className="text-3xl text-[#14171A] text-center mb-2"
                  style={{ 
                    fontFamily: 'Poppins_700Bold',
                    letterSpacing: -0.5
                  }}
                >
                  Insight Institute of  Opthalmology
                </Text>
                
                <Text 
                  className="text-base text-[#657786] text-center"
                  style={{ 
                    fontFamily: 'Poppins_500Medium',
                    letterSpacing: 0.1,
                 
                  }}
                >
                  Login to your account
                </Text>
              </View>

              {/* Login Form */}
              <View className="space-y-6">
                
                {/* Email Input */}
                <View>
                  <Text 
                    className="text-sm text-[#14171A] mb-4 ml-1"
                    style={{ 
                      fontFamily: 'Poppins_600SemiBold',
                      letterSpacing: 0.1,
                      
                    }}
                  >
                    Email or Username
                  </Text>
                  <View className="flex-row items-center bg-[#F7F9FA] border border-[#E1E8ED] rounded-lg h-12 px-4 focus-within:border-[#1DA1F2] shadow-sm">
                    <View className="w-8 h-8 bg-[#1DA1F2]/10 rounded-lg items-center justify-center mr-3">
                      <Ionicons name="person-outline" size={18} color="#1DA1F2" />
                    </View>
                    <TextInput
                      className="flex-1 text-[#14171A]"
                      style={{ 
                        fontFamily: 'Poppins_400Regular',
                        fontSize: 14
                      }}
                      placeholder="Enter your email"
                      placeholderTextColor="#AAB8C2"
                      value={email}
                      onChangeText={setEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoComplete="email"
                    />
                  </View>
                </View>

                {/* Password Input */}
                <View className='mt-4'>
                  <Text 
                    className="text-sm text-[#14171A] mb-4 ml-1"
                    style={{ 
                      fontFamily: 'Poppins_600SemiBold',
                      letterSpacing: 0.1,
                    }}
                  >
                    Password
                  </Text>
                  <View className="flex-row items-center bg-[#F7F9FA] border border-[#E1E8ED] rounded-lg h-12 px-4 focus-within:border-[#1DA1F2] shadow-sm">
                    <View className="w-8 h-8 bg-[#1DA1F2]/10 rounded-lg items-center justify-center mr-3">
                      <Ionicons name="lock-closed-outline" size={18} color="#1DA1F2" />
                    </View>
                    <TextInput
                      className="flex-1 text-[#14171A]"
                      style={{ 
                        fontFamily: 'Poppins_400Regular',
                        fontSize: 14
                      }}
                      placeholder="Enter your password"
                      placeholderTextColor="#AAB8C2"
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPassword}
                      autoComplete="password"
                    />
                    <TouchableOpacity
                      onPress={() => setShowPassword(!showPassword)}
                      className="ml-2 p-1"
                    >
                      <Ionicons 
                        name={showPassword ? "eye-off-outline" : "eye-outline"} 
                        size={18} 
                        color="#657786" 
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Forgot Password */}
                <View className="flex-row justify-end mt-2">
                  <TouchableOpacity onPress={handleForgotPassword}>
                    <Text 
                      className="text-sm text-[#1DA1F2]"
                      style={{ 
                        fontFamily: 'Poppins_500Medium',
                        letterSpacing: 0.1
                      }}
                    >
                      Forgot Password?
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Login Button */}
                <TouchableOpacity
                  onPress={handleLogin}
                  disabled={isLoading}
                  className={`w-full h-12 ${isLoading ? 'bg-[#1DA1F2]/50' : 'bg-[#1DA1F2]'} rounded-lg items-center justify-center mt-8 shadow-lg`}
                  activeOpacity={0.8}
                  style={{
                    shadowColor: '#1DA1F2',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.3,
                    shadowRadius: 8,
                    elevation: 8,
                  }}
                >
                  {isLoading ? (
                    <ActivityIndicator color="white" size="small" />
                  ) : (
                    <Text 
                      className="text-white text-base"
                      style={{ 
                        fontFamily: 'Poppins_600SemiBold',
                        letterSpacing: 0.5
                      }}
                    >
                      Login to Dashboard
                    </Text>
                  )}
                </TouchableOpacity>

                {/* Remember Me Checkbox - Centered */}
                <View className="items-center mt-3">
                  <TouchableOpacity
                    onPress={() => setRememberMe(!rememberMe)}
                    className="flex-row items-center"
                  >
                    <View className={`w-5 h-5 border-2 rounded ${rememberMe ? 'bg-[#1DA1F2] border-[#1DA1F2]' : 'bg-white border-[#E1E8ED]'} items-center justify-center mr-3 shadow-sm`}>
                      {rememberMe && (
                        <Ionicons name="checkmark" size={12} color="white" />
                      )}
                    </View>
                    <Text 
                      className="text-sm text-[#14171A]"
                      style={{ 
                        fontFamily: 'Poppins_500Medium',
                        letterSpacing: 0.2,
                    
                      }}
                    >
                      Keep me logged in
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}