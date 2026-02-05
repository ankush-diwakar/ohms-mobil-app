import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import EyeDropQueueScreen from '../screens/EyeDropQueueScreen';
import AttendanceScreen from '../screens/AttendanceScreen';
import ProfileScreen from '../screens/ProfileScreen';

const Tab = createBottomTabNavigator();

interface TabNavigatorProps {
  onLogout: () => void;
}

export default function TabNavigator({ onLogout }: TabNavigatorProps) {
  const insets = useSafeAreaInsets();
  
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          const iconSize = Math.min(size + 2, 26); // Cap icon size to prevent overflow
          
          if (route.name === 'EyeDropQueue') {
            return (
              <MaterialCommunityIcons 
                name={focused ? 'eye-check' : 'eye-check-outline'} 
                size={iconSize} 
                color={color} 
              />
            );
          } else if (route.name === 'Attendance') {
            return (
              <Ionicons 
                name={focused ? 'calendar' : 'calendar-outline'} 
                size={iconSize} 
                color={color} 
              />
            );
          } else if (route.name === 'Profile') {
            return (
              <Ionicons 
                name={focused ? 'person-circle' : 'person-circle-outline'} 
                size={iconSize} 
                color={color} 
              />
            );
          } else {
            return (
              <Ionicons 
                name="help-outline" 
                size={iconSize} 
                color={color} 
              />
            );
          }
        },
        tabBarActiveTintColor: '#0ea5e9',
        tabBarInactiveTintColor: '#657786',
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopColor: '#E1E8ED',
          borderTopWidth: 0.5,
          paddingTop: 6,
          paddingBottom: Math.max(insets.bottom, 8), // Use safe area bottom inset
          paddingHorizontal: 4,
          height: 64 + Math.max(insets.bottom - 8, 0), // Adjust height for safe area
          shadowColor: '#000',
          shadowOffset: {
            width: 0,
            height: -4,
          },
          shadowOpacity: 0.08,
          shadowRadius: 12,
          elevation: 10,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          textTransform: 'capitalize',
          letterSpacing: 0.3,
          marginTop: 2,
          marginBottom: 2,
        },
        tabBarItemStyle: {
          paddingVertical: 4,
          paddingHorizontal: 8,
          borderRadius: 12,
          marginHorizontal: 2,
        },
        headerShown: false,
      })}
    >
      <Tab.Screen 
        name="EyeDropQueue" 
        component={EyeDropQueueScreen}
        options={{
          tabBarLabel: 'Queue',
        }}
      />
      <Tab.Screen 
        name="Attendance" 
        component={AttendanceScreen}
        options={{
          tabBarLabel: 'Attendance',
        }}
      />
      <Tab.Screen 
        name="Profile"
        options={{
          tabBarLabel: 'Profile',
        }}
      >
        {() => <ProfileScreen onLogout={onLogout} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}