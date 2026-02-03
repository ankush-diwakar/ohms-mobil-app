import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFonts, Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold, Poppins_700Bold } from '@expo-google-fonts/poppins';

export default function EyeDropQueueScreen() {
  let [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });

  if (!fontsLoaded) {
    return null;
  }
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
          <View className="px-4 pt-4 pb-4">
            <Text 
              className="text-white text-2xl font-bold"
              style={{ fontFamily: 'Poppins_700Bold' }}
            >
              Eye Drop Queue
            </Text>
            <Text 
              className="text-blue-100 text-sm mt-1"
              style={{ fontFamily: 'Poppins_400Regular' }}
            >
              Patient queue management dashboard
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
        <View className="px-4 mt-6">
          
          {/* Quick Stats Cards */}
          <View className="flex-row space-x-3 mb-6">
            <View className="flex-1 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
              <Text 
                className="text-2xl font-bold text-[#0ea5e9]"
                style={{ fontFamily: 'Poppins_700Bold' }}
              >
                12
              </Text>
              <Text 
                className="text-xs font-medium text-[#657786] uppercase tracking-wide"
                style={{ fontFamily: 'Poppins_500Medium' }}
              >
                In Queue
              </Text>
            </View>
            
            <View className="flex-1 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
              <Text 
                className="text-2xl font-bold text-green-600"
                style={{ fontFamily: 'Poppins_700Bold' }}
              >
                8
              </Text>
              <Text 
                className="text-xs font-medium text-[#657786] uppercase tracking-wide"
                style={{ fontFamily: 'Poppins_500Medium' }}
              >
                Completed Today
              </Text>
            </View>
          </View>

          {/* Current Patient Card */}
          <View className="bg-[#0ea5e9] p-4 rounded-xl mb-6 shadow-sm">
            <Text 
              className="text-white text-xs font-bold uppercase tracking-wider mb-2"
              style={{ fontFamily: 'Poppins_600SemiBold' }}
            >
              Current Patient
            </Text>
            <Text 
              className="text-white text-lg font-bold mb-1"
              style={{ fontFamily: 'Poppins_700Bold' }}
            >
              John Doe - #PT001
            </Text>
            <Text 
              className="text-blue-100 text-sm"
              style={{ fontFamily: 'Poppins_400Regular' }}
            >
              Eye Drop Treatment • Started 10:30 AM
            </Text>
          </View>

          {/* Queue List */}
          <View>
            <Text 
              className="text-lg font-bold text-[#14171A] mb-4"
              style={{ fontFamily: 'Poppins_700Bold' }}
            >
              Waiting Queue
            </Text>
            
            <View className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              {[1, 2, 3, 4].map((item, index) => (
                <View 
                  key={item} 
                  className={`p-4 ${index < 3 ? 'border-b border-gray-100' : ''}`}
                >
                  <View className="flex-row items-center">
                    <View className="w-10 h-10 bg-blue-100 rounded-full items-center justify-center mr-4">
                      <Ionicons name="person" size={18} color="#0ea5e9" />
                    </View>
                    <View className="flex-1">
                      <Text 
                        className="text-base font-semibold text-[#14171A]"
                        style={{ fontFamily: 'Poppins_600SemiBold' }}
                      >
                        Patient #{String(item + 1).padStart(3, '0')}
                      </Text>
                      <Text 
                        className="text-sm text-[#657786]"
                        style={{ fontFamily: 'Poppins_400Regular' }}
                      >
                        Estimated wait: {15 + (index * 10)} minutes
                      </Text>
                    </View>
                    <View className="bg-[#0ea5e9] w-8 h-8 rounded-full items-center justify-center">
                      <Text 
                        className="text-white text-xs font-bold"
                        style={{ fontFamily: 'Poppins_700Bold' }}
                      >
                        {index + 2}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}