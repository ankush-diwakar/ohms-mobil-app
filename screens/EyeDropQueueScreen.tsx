import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, RefreshControl, Modal, TextInput, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Loading from '../components/Loading';
import { useQueryClient, useQuery } from '@tanstack/react-query';

import { eyeDropQueueService, QueuePatient, QueueStats } from '../services/eyeDropQueueService';
import { useEyeDropQueueSocket, useSocketConnectionStatus } from '../services/socketService';
import '../global.css';

interface TimerComponentProps {
  patient: QueuePatient;
  onTimerExpire: () => void;
}

const TimerComponent: React.FC<TimerComponentProps> = ({ patient, onTimerExpire }) => {
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [isTimerCompleted, setIsTimerCompleted] = useState(false);
  const [isAlarmPlaying, setIsAlarmPlaying] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const alarmTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize timer
  useEffect(() => {
    let initialTime = patient.timing.timeRemaining || 0;
    
    if (!initialTime && (patient.estimatedResumeTime || patient.timing.estimatedResumeTime)) {
      const estimatedTime = patient.estimatedResumeTime || patient.timing.estimatedResumeTime;
      if (estimatedTime) {
        const resumeTime = new Date(estimatedTime);
        const now = new Date();
        const remainingMs = resumeTime.getTime() - now.getTime();
        initialTime = Math.max(0, Math.ceil(remainingMs / 1000));
      }
    }

    if (!initialTime || initialTime <= 0) {
      setTimeRemaining(0);
      return;
    }

    setTimeRemaining(initialTime);
    setIsTimerCompleted(false);

    intervalRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        const newTime = prev - 1;
        if (newTime <= 0) {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
          }
          // Schedule completion for next tick to avoid setState during render
          setTimeout(() => {
            setIsTimerCompleted(true);
            playAlarm();
            onTimerExpire();
            
            // Send notification
            Notifications.scheduleNotificationAsync({
              content: {
                title: '⏰ Timer Complete!',
                body: `Eye drop timer for ${patient.patient.fullName} has expired.`,
                sound: 'default',
                data: { 
                  patientId: patient.queueEntryId,
                  patientName: patient.patient.fullName,
                  type: 'timer_expired'
                },
              },
              trigger: null,
              identifier: `timer_${patient.queueEntryId}_${Date.now()}`,
            });
          }, 0);
          return 0;
        }
        return newTime;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [patient.queueEntryId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (alarmTimeoutRef.current) {
        clearTimeout(alarmTimeoutRef.current);
      }
    };
  }, []);

  const playAlarm = async () => {
    try {
      setIsAlarmPlaying(true);
      
      // Strong vibration feedback
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      
      // Stop alarm after 10 seconds
      alarmTimeoutRef.current = setTimeout(() => {
        setIsAlarmPlaying(false);
      }, 10000);
      
    } catch (error) {
      console.log('Error playing alarm:', error);
      setIsAlarmPlaying(false);
    }
  };

  const stopAlarm = () => {
    setIsAlarmPlaying(false);
    if (alarmTimeoutRef.current) {
      clearTimeout(alarmTimeoutRef.current);
      alarmTimeoutRef.current = null;
    }
  };

  // Show stop alarm button when alarm is playing
  if (isAlarmPlaying) {
    return (
      <View className="flex items-center">
        <TouchableOpacity
          onPress={stopAlarm}
          className="bg-red-500 px-4 py-3 rounded-xl flex-row items-center animate-pulse"
        >
          <Ionicons name="stop-outline" size={18} color="white" />
          <Text className="text-white text-sm font-semibold ml-2">
            Stop Alarm
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Timer completed - return null so parent can show buttons
  if (timeRemaining <= 0 || isTimerCompleted) {
    return null;
  }

  // Timer still running - show countdown
  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;

  return (
    <View className="flex items-center">
      <View className="bg-blue-100 px-4 py-2 rounded-full flex-row items-center">
        <Ionicons name="timer-outline" size={16} color="#3B82F6" />
        <Text className="text-blue-600 text-sm font-semibold ml-2">
          {minutes}:{seconds.toString().padStart(2, '0')}
        </Text>
      </View>
    </View>
  );
};

export default function EyeDropQueueScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [patients, setPatients] = useState<QueuePatient[]>([]);
  const [stats, setStats] = useState<QueueStats>({
    totalOnHold: 0,
    needingDrops: 0,
    waitingForDilation: 0,
    readyToResume: 0
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Timer settings
  const [defaultTimerDuration, setDefaultTimerDuration] = useState(10);
  const [showTimerSettings, setShowTimerSettings] = useState(false);
  const [showPatientTimer, setShowPatientTimer] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<QueuePatient | null>(null);
  const [customTimerInput, setCustomTimerInput] = useState('');

  // 🔌 Enable real-time WebSocket updates
  useEyeDropQueueSocket(() => {
    console.log('📱 Socket triggered queue refresh');
    fetchQueueData();
  });
  const isSocketConnected = useSocketConnectionStatus();

  // Helper function to format reasons display
  const formatReasons = (reasons: string | undefined): string => {
    if (!reasons) return 'Eye examination preparation';
    
    // Split by comma and trim whitespace
    const reasonsList = reasons.split(',').map(r => r.trim()).filter(r => r.length > 0);
    
    if (reasonsList.length <= 1) {
      return reasons;
    }
    
    // Show first reason + count of additional
    const firstReason = reasonsList[0];
    const additionalCount = reasonsList.length - 1;
    return `${firstReason} +${additionalCount}`;
  };

  // Initialize notifications
  useEffect(() => {
    setupNotifications();
    fetchQueueData();
    loadTimerDuration();
  }, []);

  // 🔄 Automatically refetch data when socket receives updates
  useEffect(() => {
    if (isSocketConnected) {
      console.log('✅ Socket connected - queue will update in real-time');
    }
  }, [isSocketConnected]);

  const setupNotifications = async () => {
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        console.log('Failed to get push notification permissions');
        return;
      }

      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
        }),
      });
    } catch (error) {
      console.log('Error setting up notifications:', error);
    }
  };

  const loadTimerDuration = async () => {
    try {
      const stored = await AsyncStorage.getItem('defaultTimerDuration');
      if (stored) {
        setDefaultTimerDuration(parseInt(stored, 10));
      }
    } catch (error) {
      console.log('Error loading timer duration:', error);
    }
  };

  const saveTimerDuration = async (duration: number) => {
    try {
      setDefaultTimerDuration(duration);
      await AsyncStorage.setItem('defaultTimerDuration', duration.toString());
      setCustomTimerInput(''); // Clear custom input
      // Don't close modal here, let user close it manually
    } catch (error) {
      console.log('Error saving timer duration:', error);
      Alert.alert('Error', 'Failed to save timer duration');
    }
  };
  
  const saveCustomTimer = async () => {
    const duration = parseInt(customTimerInput);
    if (isNaN(duration) || duration <= 0 || duration > 60) {
      Alert.alert('Invalid Input', 'Please enter a valid duration between 1 and 60 minutes');
      return;
    }
    await saveTimerDuration(duration);
  };

  const fetchQueueData = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      
      setError(null);
      const data = await eyeDropQueueService.fetchEyeDropQueue();
      setPatients(data.patients || []);
      setStats(data.statistics || {
        totalOnHold: 0,
        needingDrops: 0,
        waitingForDilation: 0,
        readyToResume: 0
      });
    } catch (error) {
      console.error('Failed to fetch queue:', error);
      setError('Failed to load queue data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleApplyEyeDrops = async (patient: QueuePatient) => {
    setProcessing(patient.queueEntryId);
    try {
      await eyeDropQueueService.applyEyeDrops(patient.queueEntryId, defaultTimerDuration);
      Alert.alert('Success', `Eye drops applied! Timer set for ${defaultTimerDuration} minutes.`);
      fetchQueueData();
    } catch (error) {
      console.error('Failed to apply eye drops:', error);
      Alert.alert('Error', 'Failed to apply eye drops');
    } finally {
      setProcessing(null);
    }
  };

  const handleRepeatDilation = async (patient: QueuePatient) => {
    setProcessing(patient.queueEntryId);
    try {
      await eyeDropQueueService.repeatDilation(patient.queueEntryId, defaultTimerDuration);
      Alert.alert('Success', `Dilation repeated! Round ${(patient.timing.dilationRound || 1) + 1}/3 started.`);
      fetchQueueData();
    } catch (error) {
      console.error('Failed to repeat dilation:', error);
      Alert.alert('Error', 'Failed to repeat dilation');
    } finally {
      setProcessing(null);
    }
  };

  const handleMarkReady = async (patient: QueuePatient) => {
    setProcessing(patient.queueEntryId);
    try {
      await eyeDropQueueService.markReady(patient.queueEntryId);
      Alert.alert('Success', 'Patient marked as ready for examination!');
      fetchQueueData();
    } catch (error) {
      console.error('Failed to mark ready:', error);
      Alert.alert('Error', 'Failed to mark patient as ready');
    } finally {
      setProcessing(null);
    }
  };

  const showCustomTimerDialog = (patient: QueuePatient) => {
    setSelectedPatient(patient);
    setShowPatientTimer(true);
  };

  if (loading && !refreshing) {
    return (
      <Loading message="Loading eye drop queue..." />
    );
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
          <View className="px-6 pt-4 pb-6">
            <View className="flex-row justify-between items-start">
              <View className="flex-1">
                <Text className="text-white text-3xl font-bold">
                  Eye Drop Queue
                </Text>
                <Text className="text-blue-100 text-sm mt-2">
                  Monitor patient dilation timers and queue status
                </Text>
              </View>
              
              {/* Real-time Connection Status */}
              <View className="flex-row items-center bg-white/20 rounded-full px-3 py-2">
                <View 
                  className={`w-2 h-2 rounded-full mr-2 ${
                    isSocketConnected ? 'bg-green-400' : 'bg-red-400'
                  }`} 
                />
                <Text className="text-white text-xs font-medium">
                  {isSocketConnected ? 'Live' : 'Offline'}
                </Text>
              </View>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      {/* Content */}
      <ScrollView 
        className="flex-1" 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchQueueData(true)}
            tintColor="#0ea5e9"
            title="Pull to refresh"
          />
        }
      >
        <View className="px-4 mt-6">
          
          {/* Dashboard Stats Cards */}
          <View className="flex-row flex-wrap justify-between mb-8">
            {/* Total Patients Card */}
            <View className="bg-white p-5 rounded-2xl shadow-lg w-[48%] mb-4 relative overflow-hidden">
              <View className="absolute -right-6 top-1/2 transform -translate-y-1/2" style={{ opacity: 0.2 }}>
                <Ionicons name="people" size={100} color="#60a5fa" />
              </View>
              <View className="relative z-10">
                <Text className="text-3xl font-bold text-blue-600 mb-2">
                  {stats.totalOnHold.toString().padStart(2, '0')}
                </Text>
                <Text className="text-gray-700 text-base font-semibold">
                  Total
                </Text>
                <Text className="text-gray-500 text-sm">
                  In Queue
                </Text>
              </View>
            </View>
            
            {/* Waiting Patients Card */}
            <View className="bg-white p-5 rounded-2xl shadow-lg w-[48%] mb-4 relative overflow-hidden">
              <View className="absolute -right-6 top-1/2 transform -translate-y-1/2" style={{ opacity: 0.2 }}>
                <Ionicons name="time" size={100} color="#fb923c" />
              </View>
              <View className="relative z-10">
                <Text className="text-3xl font-bold text-orange-600 mb-2">
                  {stats.waitingForDilation.toString().padStart(2, '0')}
                </Text>
                <Text className="text-gray-700 text-base font-semibold">
                  Waiting
                </Text>
                <Text className="text-gray-500 text-sm">
                  From Doctor
                </Text>
              </View>
            </View>
            
            {/* Need Drops Card */}
            <View className="bg-white p-5 rounded-2xl shadow-lg w-[48%] mb-4 relative overflow-hidden">
              <View className="absolute -right-6 top-1/2 transform -translate-y-1/2" style={{ opacity: 0.2 }}>
                <Ionicons name="water" size={100} color="#4ade80" />
              </View>
              <View className="relative z-10">
                <Text className="text-3xl font-bold text-green-600 mb-2">
                  {stats.needingDrops.toString().padStart(2, '0')}
                </Text>
                <Text className="text-gray-700 text-base font-semibold">
                  Need Drops
                </Text>
                <Text className="text-gray-500 text-sm">
                  Eye Drops
                </Text>
              </View>
            </View>
            
            {/* Ready Patients Card */}
            <View className="bg-white p-5 rounded-2xl shadow-lg w-[48%] mb-4 relative overflow-hidden">
              <View className="absolute -right-6 top-1/2 transform -translate-y-1/2" style={{ opacity: 0.2 }}>
                <Ionicons name="checkmark-circle" size={100} color="#34d399" />
              </View>
              <View className="relative z-10">
                <Text className="text-3xl font-bold text-emerald-600 mb-2">
                  {stats.readyToResume.toString().padStart(2, '0')}
                </Text>
                <Text className="text-gray-700 text-base font-semibold">
                  Ready
                </Text>
                <Text className="text-gray-500 text-sm">
                  Marked Ready
                </Text>
              </View>
            </View>
          </View>

          {/* Patient Queue Section */}
          <View className="mb-6">
            <Text className="text-xl font-bold text-gray-900 mb-4">
              Patient Queue
            </Text>
            
            {/* Settings Button */}
            <TouchableOpacity
              onPress={() => setShowTimerSettings(true)}
              className="bg-gray-100 px-4 py-3 rounded-xl flex-row items-center justify-center mb-4"
            >
              <Ionicons name="settings-outline" size={20} color="#6b7280" />
              <Text className="text-gray-700 text-sm ml-2 font-medium">
                Timer Settings ({defaultTimerDuration}m)
              </Text>
            </TouchableOpacity>
          </View>

          {/* Error State */}
          {error && (
            <View className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
              <View className="flex-row items-center">
                <Ionicons name="alert-circle-outline" size={20} color="#DC2626" />
                <Text className="text-red-700 font-semibold ml-2">
                  Error Loading Queue
                </Text>
              </View>
              <Text className="text-red-600 mt-2 text-sm">
                {error}
              </Text>
              <TouchableOpacity
                onPress={() => fetchQueueData()}
                className="bg-red-100 px-4 py-2 rounded-lg mt-3 self-start"
              >
                <Text className="text-red-700 font-medium">
                  Try Again
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Empty State */}
          {!loading && !error && patients.length === 0 && (
            <View className="bg-gray-50 rounded-xl p-8 items-center">
              <Ionicons name="medical-outline" size={48} color="#9CA3AF" />
              <Text className="text-gray-600 text-lg font-medium mt-4">
                No patients in queue
              </Text>
              <Text className="text-gray-500 text-sm mt-2">
                Patients requiring eye drops will appear here
              </Text>
            </View>
          )}

          {/* Patient List */}
          {!loading && !error && patients.map((patient, index) => {
            const estimatedTime = patient.estimatedResumeTime || patient.timing.estimatedResumeTime;
            const isTimerExpired = estimatedTime && new Date(estimatedTime) <= new Date();
            
            return (
              <View key={patient.queueEntryId} className="bg-white rounded-2xl p-5 mb-4 shadow-lg border border-gray-50">
                <View className="flex-row items-start">
                  {/* Avatar Section */}
                  <View className="mr-4">
                    <View className="w-12 h-12 bg-teal-500 rounded-full items-center justify-center">
                      <Text className="text-white text-lg font-bold">
                        {patient.patient.fullName.charAt(0)}
                      </Text>
                    </View>
                    <View className="absolute -top-1 -right-1">
                      <View className="w-5 h-5 bg-blue-600 rounded-full items-center justify-center">
                        <Text className="text-white text-xs font-bold">
                          {Math.max(patient.timing.dilationRound || 1, 1)}
                        </Text>
                      </View>
                    </View>
                  </View>
                  
                  {/* Patient Details */}
                  <View className="flex-1">
                    <Text className="text-lg font-bold text-gray-900 mb-1">
                      {patient.patient.fullName}
                    </Text>
                    
                    <View className="flex-row items-center mb-3">
                      <Text className="text-sm text-gray-600 mr-4">
                        Token: {patient.visit.tokenNumber}
                      </Text>
                      <Text className="text-sm text-gray-500">
                        {patient.patient.age}y • {patient.patient.gender === 'Male' ? 'Male' : 'Female'}
                      </Text>
                    </View>
                    
                    <View className="flex-row items-center justify-between">
                      <View className="flex-row items-center">
                        <View className="bg-blue-100 px-3 py-1 rounded-full mr-3">
                          <Text className="text-blue-700 text-xs font-medium">
                            ROUND {Math.max(patient.timing.dilationRound || 1, 1)}/3
                          </Text>
                        </View>
                        
                        <View className="flex-row items-center">
                          <Ionicons name="time-outline" size={14} color="#6b7280" />
                          <Text className="text-gray-500 text-sm ml-1">
                            {Math.abs(Math.floor(((patient.estimatedResumeTime ? new Date(patient.estimatedResumeTime).getTime() : Date.now()) - Date.now()) / (1000 * 60)))}m
                          </Text>
                        </View>
                      </View>
                      
                      <View className="mt-2">
                        <Text className="text-gray-500 text-xs leading-relaxed" numberOfLines={1} ellipsizeMode="tail">
                          {formatReasons(patient.holdReason)}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
                
                {/* Action Buttons */}
                <View className="mt-4">
                  {/* Initial state: Show Apply buttons when drops are needed */}
                  {patient.timing.needsDrops && (
                    <View className="flex-row space-x-3">
                      <TouchableOpacity
                        onPress={() => handleApplyEyeDrops(patient)}
                        disabled={processing === patient.queueEntryId}
                        className="flex-1 bg-blue-500 px-4 py-3 rounded-xl flex-row items-center justify-center mr-3"
                      >
                        {processing === patient.queueEntryId ? (
                          <ActivityIndicator size="small" color="white" />
                        ) : (
                          <Ionicons name="water-outline" size={18} color="white" />
                        )}
                        <Text className="text-white text-sm font-semibold ml-2">
                          Apply Drops ({defaultTimerDuration}m)
                        </Text>
                      </TouchableOpacity>
                      
                      <TouchableOpacity
                        onPress={() => showCustomTimerDialog(patient)}
                        disabled={processing === patient.queueEntryId}
                        className="bg-gray-200 px-4 py-3 rounded-xl flex-row items-center justify-center"
                      >
                        <Ionicons name="time-outline" size={18} color="#6b7280" />
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* Timer state: Show countdown when drops have been applied and waiting */}
                  {(patient.timing.dropsApplied || patient.timing.waitingForDilation || patient.estimatedResumeTime || patient.timing.estimatedResumeTime) && !patient.timing.readyToResume && !isTimerExpired && (
                    <View className="mt-4">
                      <TimerComponent 
                        patient={patient}
                        onTimerExpire={() => fetchQueueData()}
                      />
                    </View>
                  )}

                  {/* Action Buttons - Show when timer expired */}
                  {isTimerExpired && (
                    <View className="flex-row mt-4 space-x-3">
                      {/* Repeat Button - Show if not at round 3 */}
                      {Math.max(patient.timing.dilationRound || 1, 1) < 3 && (
                        <TouchableOpacity
                          onPress={() => handleRepeatDilation(patient)}
                          disabled={processing === patient.queueEntryId}
                          className="flex-1 bg-blue-500 px-4 py-3 rounded-xl flex-row items-center justify-center mr-3"
                        >
                          {processing === patient.queueEntryId ? (
                            <ActivityIndicator size="small" color="white" />
                          ) : (
                            <Ionicons name="refresh-outline" size={18} color="white" />
                          )}
                          <Text className="text-white text-sm font-semibold ml-2">
                            Repeat
                          </Text>
                        </TouchableOpacity>
                      )}
                      
                      {/* Ready Button */}
                      <TouchableOpacity
                        onPress={() => handleMarkReady(patient)}
                        disabled={processing === patient.queueEntryId}
                        className={`${Math.max(patient.timing.dilationRound || 1, 1) < 3 ? 'flex-1' : 'flex-1'} bg-green-500 px-4 py-3 rounded-xl flex-row items-center justify-center`}
                      >
                        {processing === patient.queueEntryId ? (
                          <ActivityIndicator size="small" color="white" />
                        ) : (
                          <Ionicons name="checkmark-circle-outline" size={18} color="white" />
                        )}
                        <Text className="text-white text-sm font-semibold ml-2">
                          Ready
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                  
                  {/* Final state: Show Mark Ready when patient is ready to resume */}
                  {patient.timing.readyToResume && (
                    <View className="mt-4">
                      <TouchableOpacity
                        onPress={() => handleMarkReady(patient)}
                        disabled={processing === patient.queueEntryId}
                        className="bg-green-500 px-4 py-3 rounded-xl flex-row items-center justify-center"
                      >
                        {processing === patient.queueEntryId ? (
                          <ActivityIndicator size="small" color="white" />
                        ) : (
                          <Ionicons name="checkmark-done-outline" size={18} color="white" />
                        )}
                        <Text className="text-white text-sm font-semibold ml-2">
                          Mark Ready
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* Timer Settings Modal */}
      <Modal
        visible={showTimerSettings}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setShowTimerSettings(false);
          setCustomTimerInput('');
        }}
      >
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white rounded-t-3xl p-6 pb-8">
            {/* Header */}
            <View className="flex-row items-center justify-between mb-6">
              <Text className="text-xl font-bold text-gray-900">
                Timer Settings
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setShowTimerSettings(false);
                  setCustomTimerInput('');
                }}
                className="w-8 h-8 bg-gray-100 rounded-full items-center justify-center"
              >
                <Ionicons name="close" size={18} color="#6b7280" />
              </TouchableOpacity>
            </View>
            
            <Text className="text-sm text-gray-600 mb-6">
              Set the default wait time after applying eye drops to patients
            </Text>
            
            {/* Timer Options */}
            <Text className="text-base font-semibold text-gray-900 mb-4">
              Quick Select
            </Text>
            
            <View className="flex-row flex-wrap mb-6">
              {[5, 10, 15, 20, 30].map((preset, index) => (
                <TouchableOpacity
                  key={preset}
                  onPress={() => saveTimerDuration(preset)}
                  className={`px-6 py-4 rounded-2xl mr-3 mb-3 ${
                    defaultTimerDuration === preset 
                      ? 'bg-blue-500 shadow-lg' 
                      : 'bg-gray-100'
                  }`}
                >
                  <View className="items-center">
                    <Text className={`text-2xl font-bold ${
                      defaultTimerDuration === preset 
                        ? 'text-white' 
                        : 'text-gray-700'
                    }`}>
                      {preset}
                    </Text>
                    <Text className={`text-xs ${
                      defaultTimerDuration === preset 
                        ? 'text-blue-100' 
                        : 'text-gray-500'
                    }`}>
                      minutes
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
            
            {/* Custom Timer Input */}
            <Text className="text-base font-semibold text-gray-900 mb-4">
              Custom Duration
            </Text>
            
            <View className="flex-row items-center mb-6">
              <TextInput
                value={customTimerInput}
                onChangeText={setCustomTimerInput}
                placeholder="Enter minutes (1-60)"
                keyboardType="numeric"
                className="flex-1 bg-gray-100 px-4 py-3 rounded-xl text-gray-900 mr-3"
                maxLength={2}
              />
              <TouchableOpacity
                onPress={saveCustomTimer}
                disabled={!customTimerInput.trim()}
                className={`px-6 py-3 rounded-xl ${
                  customTimerInput.trim() 
                    ? 'bg-blue-500' 
                    : 'bg-gray-300'
                }`}
              >
                <Text className={`font-semibold ${
                  customTimerInput.trim() 
                    ? 'text-white' 
                    : 'text-gray-500'
                }`}>
                  Set
                </Text>
              </TouchableOpacity>
            </View>
            
            {/* Current Selection */}
            <View className="bg-gray-50 p-4 rounded-2xl mb-6">
              <Text className="text-sm text-gray-600 mb-1">
                Current Default
              </Text>
              <Text className="text-lg font-bold text-gray-900">
                {defaultTimerDuration} minutes
              </Text>
            </View>
            
            {/* Done Button */}
            <TouchableOpacity
              onPress={() => {
                setShowTimerSettings(false);
                setCustomTimerInput('');
              }}
              className="bg-blue-500 py-4 rounded-2xl"
            >
              <Text className="text-white text-center font-semibold text-base">
                Done
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}