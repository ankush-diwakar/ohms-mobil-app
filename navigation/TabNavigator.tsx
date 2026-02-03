import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import EyeDropQueueScreen from '../screens/EyeDropQueueScreen';
import AttendanceScreen from '../screens/AttendanceScreen';
import ProfileScreen from '../screens/ProfileScreen';

const Tab = createBottomTabNavigator();

interface TabNavigatorProps {
  onLogout: () => void;
}

export default function TabNavigator({ onLogout }: TabNavigatorProps) {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          if (route.name === 'EyeDropQueue') {
            return (
              <MaterialCommunityIcons 
                name={focused ? 'eye-check' : 'eye-check-outline'} 
                size={size + 2} 
                color={color} 
              />
            );
          } else if (route.name === 'Attendance') {
            return (
              <Ionicons 
                name={focused ? 'calendar' : 'calendar-outline'} 
                size={size + 2} 
                color={color} 
              />
            );
          } else if (route.name === 'Profile') {
            return (
              <Ionicons 
                name={focused ? 'person-circle' : 'person-circle-outline'} 
                size={size + 2} 
                color={color} 
              />
            );
          } else {
            return (
              <Ionicons 
                name="help-outline" 
                size={size + 2} 
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
          borderTopWidth: 1,
          paddingTop: 8,
          paddingBottom: 16,
          height: 60,
          shadowColor: '#000',
          shadowOffset: {
            width: 0,
            height: -2,
          },
          shadowOpacity: 0.1,
          shadowRadius: 8,
          elevation: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
          textTransform: 'capitalize',
          letterSpacing: 0.5,
          marginTop: 3,
          marginBottom: 4,
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