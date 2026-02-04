import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity, 
  Alert,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFonts, Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold, Poppins_700Bold } from '@expo-google-fonts/poppins';
import AsyncStorage from '@react-native-async-storage/async-storage';

import eyeDropQueueService, { QueuePatient, QueueStats } from '../services/eyeDropQueueService';

// Simple WebSocket hook using native WebSocket for now
const useWebSocket = () => {
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // For now, just return false - we'll implement proper Socket.IO later
    setIsConnected(false);
  }, []);

  const subscribe = (event: string, callback: (data: any) => void) => {
    // Return empty unsubscribe function for now
    return () => {};
  };

  return {
    isConnected,
    subscribe,
  };
};

interface TimerComponentProps {
  patient: QueuePatient;
  onTimerExpire: () => void;
}

const TimerComponent: React.FC<TimerComponentProps> = ({ patient, onTimerExpire }) => {
  const [timeRemaining, setTimeRemaining] = useState(0);

  useEffect(() => {
    if (!patient.timing.timeRemaining || patient.timing.timeRemaining <= 0) {
      return;
    }

    setTimeRemaining(patient.timing.timeRemaining);

    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        const newTime = prev - 1;
        if (newTime <= 0) {
          clearInterval(interval);
          onTimerExpire();
          return 0;
        }
        return newTime;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [patient.timing.timeRemaining, onTimerExpire]);

  if (timeRemaining <= 0) return null;

  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;

  return (
    <View className="flex items-center">
      <View className="bg-blue-100 px-3 py-1 rounded-full flex-row items-center">
        <Ionicons name="timer-outline" size={14} color="#3B82F6" />
        <Text 
          className="text-blue-600 text-xs font-semibold ml-1"
          style={{ fontFamily: 'Poppins_600SemiBold' }}
        >
          {minutes}:{seconds.toString().padStart(2, '0')}
        </Text>
      </View>
    </View>
  );
};

export default function EyeDropQueueScreen() {
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
  const [customTimer, setCustomTimer] = useState('10');

  // WebSocket for real-time updates
  const { isConnected, subscribe } = useWebSocket();

  let [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });

  // Load saved timer duration
  useEffect(() => {
    const loadTimerDuration = async () => {
      try {
        const saved = await AsyncStorage.getItem('eyeDropTimerDuration');
        if (saved) {
          setDefaultTimerDuration(parseInt(saved));
        }
      } catch (error) {
        console.error('Failed to load timer duration:', error);
      }
    };
    loadTimerDuration();
  }, []);

  // Fetch queue data
  const fetchQueueData = useCallback(async (showRefreshIndicator = false) => {
    try {
      console.log('🔄 Fetching queue data...');
      setError(null);
      
      if (showRefreshIndicator) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const data = await eyeDropQueueService.fetchEyeDropQueue();
      console.log('✅ Queue data received:', data);
      
      setPatients(data.patients);
      setStats(data.statistics);
    } catch (error) {
      console.error('❌ Failed to fetch queue data:', error);
      setError(error instanceof Error ? error.message : 'Failed to load queue data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchQueueData();
  }, [fetchQueueData]);

  // WebSocket real-time updates
  useEffect(() => {
    if (!isConnected) return;

    const unsubscribe = subscribe('queue_updated', (data: any) => {
      console.log('🔄 Queue updated via WebSocket:', data);
      fetchQueueData();
    });

    return unsubscribe;
  }, [isConnected, subscribe, fetchQueueData]);

  // Handle timer expiration
  const handleTimerExpire = useCallback(() => {
    Alert.alert(
      'Timer Expired',
      'Eye drop waiting time has expired!',
      [{ text: 'OK' }]
    );
    fetchQueueData();
  }, [fetchQueueData]);

  // Apply eye drops with default timer
  const handleApplyEyeDrops = async (patient: QueuePatient) => {
    try {
      setProcessing(patient.queueEntryId);
      await eyeDropQueueService.applyEyeDrops(patient.queueEntryId, defaultTimerDuration);
      Alert.alert('Success', `Eye drops applied! ${defaultTimerDuration}-minute timer started.`);
      fetchQueueData();
    } catch (error) {
      console.error('Failed to apply eye drops:', error);
      Alert.alert('Error', 'Failed to apply eye drops');
    } finally {
      setProcessing(null);
    }
  };

  // Show custom timer dialog
  const showCustomTimerDialog = (patient: QueuePatient) => {
    setSelectedPatient(patient);
    setCustomTimer(patient.customWaitMinutes?.toString() || defaultTimerDuration.toString());
    setShowPatientTimer(true);
  };

  // Apply eye drops with custom timer
  const handleApplyCustomEyeDrops = async () => {
    if (!selectedPatient) return;

    try {
      const minutes = parseInt(customTimer) || defaultTimerDuration;
      setProcessing(selectedPatient.queueEntryId);
      await eyeDropQueueService.applyEyeDrops(selectedPatient.queueEntryId, minutes);
      Alert.alert('Success', `Eye drops applied! ${minutes}-minute timer started.`);
      setShowPatientTimer(false);
      fetchQueueData();
    } catch (error) {
      console.error('Failed to apply eye drops:', error);
      Alert.alert('Error', 'Failed to apply eye drops');
    } finally {
      setProcessing(null);
    }
  };

  // Repeat dilation
  const handleRepeatDilation = async (patient: QueuePatient) => {
    try {
      setProcessing(patient.queueEntryId);
      const minutes = patient.customWaitMinutes || defaultTimerDuration;
      await eyeDropQueueService.repeatDilation(patient.queueEntryId, minutes);
      Alert.alert('Success', `Dilation repeated! Round ${(patient.timing.dilationRound || 1) + 1}/3 started.`);
      fetchQueueData();
    } catch (error) {
      console.error('Failed to repeat dilation:', error);
      Alert.alert('Error', 'Failed to repeat dilation');
    } finally {
      setProcessing(null);
    }
  };

  // Mark patient ready
  const handleMarkReady = async (patient: QueuePatient) => {
    try {
      setProcessing(patient.queueEntryId);
      await eyeDropQueueService.markReady(patient.queueEntryId);
      Alert.alert('Success', 'Patient marked as ready to resume examination');
      fetchQueueData();
    } catch (error) {
      console.error('Failed to mark ready:', error);
      Alert.alert('Error', 'Failed to mark patient ready');
    } finally {
      setProcessing(null);
    }
  };

  // Save timer duration
  const saveTimerDuration = async (duration: number) => {
    try {
      setDefaultTimerDuration(duration);
      await AsyncStorage.setItem('eyeDropTimerDuration', duration.toString());
    } catch (error) {
      console.error('Failed to save timer duration:', error);
    }
  };

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
            <View className="flex-row items-center justify-between">
              <View className="flex-1">
                <Text 
                  className="text-white text-2xl font-bold"
                  style={{ fontFamily: 'Poppins_700Bold' }}
                >
                  Eye Drop Queue
                </Text>
                <View className="flex-row items-center mt-1">
                  <View className={`w-2 h-2 rounded-full mr-2 ${isConnected ? 'bg-green-400' : 'bg-red-400'}`} />
                  <Text 
                    className="text-blue-100 text-sm"
                    style={{ fontFamily: 'Poppins_400Regular' }}
                  >
                    {isConnected ? 'Live updates active' : 'Connecting...'}
                  </Text>
                </View>
              </View>
              
              {/* Timer Settings Button */}
              <TouchableOpacity
                onPress={() => setShowTimerSettings(true)}
                className="bg-white/20 px-3 py-2 rounded-lg flex-row items-center"
              >
                <Ionicons name="settings-outline" size={16} color="white" />
                <Text 
                  className="text-white text-xs ml-1"
                  style={{ fontFamily: 'Poppins_500Medium' }}
                >
                  {defaultTimerDuration}m
                </Text>
              </TouchableOpacity>
            </View>
            
            {/* Debug Info */}
            {__DEV__ && (
              <View className="mt-2 bg-white/10 p-2 rounded-lg">
                <Text className="text-white text-xs">
                  Debug: Loading: {loading ? 'Yes' : 'No'}, Patients: {patients.length}, Error: {error || 'None'}
                </Text>
              </View>
            )}
          </View>
        </SafeAreaView>
      </LinearGradient>

      {/* Content */}
      <ScrollView 
        className="flex-1" 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 30 }}
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
          
          {/* Quick Stats Cards */}
          <View className="grid grid-cols-2 gap-3 mb-6">
            <View className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
              <Text 
                className="text-2xl font-bold text-[#0ea5e9]"
                style={{ fontFamily: 'Poppins_700Bold' }}
              >
                {stats.totalOnHold}
              </Text>
              <Text 
                className="text-xs font-medium text-[#657786] uppercase tracking-wide"
                style={{ fontFamily: 'Poppins_500Medium' }}
              >
                Total on Hold
              </Text>
            </View>
            
            <View className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
              <Text 
                className="text-2xl font-bold text-orange-600"
                style={{ fontFamily: 'Poppins_700Bold' }}
              >
                {stats.needingDrops}
              </Text>
              <Text 
                className="text-xs font-medium text-[#657786] uppercase tracking-wide"
                style={{ fontFamily: 'Poppins_500Medium' }}
              >
                Need Drops
              </Text>
            </View>
            
            <View className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
              <Text 
                className="text-2xl font-bold text-blue-600"
                style={{ fontFamily: 'Poppins_700Bold' }}
              >
                {stats.waitingForDilation}
              </Text>
              <Text 
                className="text-xs font-medium text-[#657786] uppercase tracking-wide"
                style={{ fontFamily: 'Poppins_500Medium' }}
              >
                Waiting
              </Text>
            </View>
            
            <View className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
              <Text 
                className="text-2xl font-bold text-green-600"
                style={{ fontFamily: 'Poppins_700Bold' }}
              >
                {stats.readyToResume}
              </Text>
              <Text 
                className="text-xs font-medium text-[#657786] uppercase tracking-wide"
                style={{ fontFamily: 'Poppins_500Medium' }}
              >
                Ready
              </Text>
            </View>
          </View>

          {/* Error State */}
          {error && (
            <View className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
              <View className="flex-row items-center">
                <Ionicons name="alert-circle-outline" size={20} color="#DC2626" />
                <Text 
                  className="text-red-700 font-semibold ml-2"
                  style={{ fontFamily: 'Poppins_600SemiBold' }}
                >
                  Error Loading Queue
                </Text>
              </View>
              <Text 
                className="text-red-600 mt-2 text-sm"
                style={{ fontFamily: 'Poppins_400Regular' }}
              >
                {error}
              </Text>
              <TouchableOpacity
                onPress={() => fetchQueueData()}
                className="bg-red-600 mt-3 py-2 px-4 rounded-lg self-start"
              >
                <Text 
                  className="text-white text-sm font-semibold"
                  style={{ fontFamily: 'Poppins_600SemiBold' }}
                >
                  Retry
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Loading State */}
          {loading && (
            <View className="bg-white rounded-xl p-8 items-center">
              <ActivityIndicator size="large" color="#0ea5e9" />
              <Text 
                className="text-gray-500 mt-3"
                style={{ fontFamily: 'Poppins_400Regular' }}
              >
                Loading queue...
              </Text>
            </View>
          )}

          {/* Empty State */}
          {!loading && !error && patients.length === 0 && (
            <View className="bg-white rounded-xl p-8 items-center">
              <View className="w-16 h-16 bg-orange-100 rounded-full items-center justify-center mb-4">
                <Ionicons name="eye-outline" size={32} color="#ea580c" />
              </View>
              <Text 
                className="text-lg font-semibold text-gray-900 mb-2"
                style={{ fontFamily: 'Poppins_600SemiBold' }}
              >
                No patients on hold
              </Text>
              <Text 
                className="text-gray-500 text-center"
                style={{ fontFamily: 'Poppins_400Regular' }}
              >
                Patients requiring eye drops will appear here
              </Text>
            </View>
          )}

          {/* Patient List */}
          {!loading && !error && patients.map((patient, index) => (
            <View key={patient.queueEntryId} className="bg-white rounded-xl p-4 mb-4 shadow-sm border border-gray-100">
              <View className="flex-row items-start justify-between">
                {/* Patient Info */}
                <View className="flex-1 mr-4">
                  <View className="flex-row items-center mb-2">
                    <View className="w-8 h-8 bg-orange-100 rounded-full items-center justify-center mr-3">
                      <Text 
                        className="text-orange-600 text-sm font-bold"
                        style={{ fontFamily: 'Poppins_700Bold' }}
                      >
                        {index + 1}
                      </Text>
                    </View>
                    <View className="flex-1">
                      <Text 
                        className="text-lg font-bold text-gray-900"
                        style={{ fontFamily: 'Poppins_700Bold' }}
                      >
                        {patient.patient.fullName}
                      </Text>
                      <View className="flex-row items-center mt-1">
                        <View className="bg-gray-100 px-2 py-1 rounded-md mr-2">
                          <Text 
                            className="text-xs text-gray-600"
                            style={{ fontFamily: 'Poppins_500Medium' }}
                          >
                            Token: {patient.visit.tokenNumber}
                          </Text>
                        </View>
                        <Text 
                          className="text-xs text-gray-500"
                          style={{ fontFamily: 'Poppins_400Regular' }}
                        >
                          {patient.patient.age}y • {patient.patient.gender?.charAt(0)}
                        </Text>
                      </View>
                    </View>
                  </View>
                  
                  {/* Status & Timer */}
                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center">
                      <Text 
                        className="text-xs text-gray-500 mr-2"
                        style={{ fontFamily: 'Poppins_400Regular' }}
                      >
                        Round {Math.max(patient.timing.dilationRound || 1, 1)}/3
                      </Text>
                      <Text 
                        className="text-xs text-gray-400"
                        style={{ fontFamily: 'Poppins_400Regular' }}
                      >
                        • {patient.timing.waitingSinceMinutes}m waiting
                      </Text>
                    </View>
                    
                    {/* Timer Display */}
                    <TimerComponent 
                      patient={patient} 
                      onTimerExpire={handleTimerExpire}
                    />
                  </View>

                  {patient.holdReason && (
                    <Text 
                      className="text-xs text-gray-500 mt-2"
                      style={{ fontFamily: 'Poppins_400Regular' }}
                    >
                      Reason: {patient.holdReason}
                    </Text>
                  )}
                </View>
              </View>

              {/* Action Buttons */}
              <View className="flex-row justify-end mt-4 space-x-2">
                {patient.timing.needsDrops && (
                  <>
                    <TouchableOpacity
                      onPress={() => handleApplyEyeDrops(patient)}
                      disabled={processing === patient.queueEntryId}
                      className="bg-[#0ea5e9] px-4 py-2 rounded-lg flex-row items-center"
                    >
                      {processing === patient.queueEntryId ? (
                        <ActivityIndicator size="small" color="white" />
                      ) : (
                        <Ionicons name="checkmark-circle-outline" size={16} color="white" />
                      )}
                      <Text 
                        className="text-white text-xs ml-1"
                        style={{ fontFamily: 'Poppins_600SemiBold' }}
                      >
                        Apply ({defaultTimerDuration}m)
                      </Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      onPress={() => showCustomTimerDialog(patient)}
                      disabled={processing === patient.queueEntryId}
                      className="bg-gray-500 px-3 py-2 rounded-lg"
                    >
                      <Ionicons name="timer-outline" size={16} color="white" />
                    </TouchableOpacity>
                  </>
                )}
                
                {patient.timing.waitingForDilation && !patient.timing.readyToResume && patient.timing.dilationRound < 3 && (
                  <TouchableOpacity
                    onPress={() => handleRepeatDilation(patient)}
                    disabled={processing === patient.queueEntryId}
                    className="bg-orange-500 px-4 py-2 rounded-lg flex-row items-center"
                  >
                    {processing === patient.queueEntryId ? (
                      <ActivityIndicator size="small" color="white" />
                    ) : (
                      <Ionicons name="refresh-outline" size={16} color="white" />
                    )}
                    <Text 
                      className="text-white text-xs ml-1"
                      style={{ fontFamily: 'Poppins_600SemiBold' }}
                    >
                      Repeat
                    </Text>
                  </TouchableOpacity>
                )}
                
                {patient.timing.readyToResume && (
                  <TouchableOpacity
                    onPress={() => handleMarkReady(patient)}
                    disabled={processing === patient.queueEntryId}
                    className="bg-green-500 px-4 py-2 rounded-lg flex-row items-center"
                  >
                    {processing === patient.queueEntryId ? (
                      <ActivityIndicator size="small" color="white" />
                    ) : (
                      <Ionicons name="checkmark-done-outline" size={16} color="white" />
                    )}
                    <Text 
                      className="text-white text-xs ml-1"
                      style={{ fontFamily: 'Poppins_600SemiBold' }}
                    >
                      Mark Ready
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Timer Settings Modal */}
      <Modal
        visible={showTimerSettings}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowTimerSettings(false)}
      >
        <View className="flex-1 bg-black/50 justify-center px-6">
          <View className="bg-white rounded-2xl p-6">
            <Text 
              className="text-lg font-bold text-gray-900 mb-4"
              style={{ fontFamily: 'Poppins_700Bold' }}
            >
              Default Timer Settings
            </Text>
            
            <Text 
              className="text-sm text-gray-600 mb-4"
              style={{ fontFamily: 'Poppins_400Regular' }}
            >
              Set the default wait time after applying eye drops
            </Text>
            
            <View className="flex-row flex-wrap gap-2 mb-6">
              {[5, 10, 15, 20, 30].map((preset) => (
                <TouchableOpacity
                  key={preset}
                  onPress={() => saveTimerDuration(preset)}
                  className={`px-4 py-2 rounded-lg ${
                    defaultTimerDuration === preset 
                      ? 'bg-[#0ea5e9]' 
                      : 'bg-gray-100'
                  }`}
                >
                  <Text 
                    className={`text-sm font-semibold ${
                      defaultTimerDuration === preset 
                        ? 'text-white' 
                        : 'text-gray-700'
                    }`}
                    style={{ fontFamily: 'Poppins_600SemiBold' }}
                  >
                    {preset}m
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            
            <TouchableOpacity
              onPress={() => setShowTimerSettings(false)}
              className="bg-[#0ea5e9] py-3 rounded-lg"
            >
              <Text 
                className="text-white text-center font-semibold"
                style={{ fontFamily: 'Poppins_600SemiBold' }}
              >
                Done
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Custom Timer Modal */}
      <Modal
        visible={showPatientTimer}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowPatientTimer(false)}
      >
        <View className="flex-1 bg-black/50 justify-center px-6">
          <View className="bg-white rounded-2xl p-6">
            <Text 
              className="text-lg font-bold text-gray-900 mb-2"
              style={{ fontFamily: 'Poppins_700Bold' }}
            >
              Custom Timer
            </Text>
            
            {selectedPatient && (
              <Text 
                className="text-sm text-gray-600 mb-4"
                style={{ fontFamily: 'Poppins_400Regular' }}
              >
                {selectedPatient.patient.fullName}
              </Text>
            )}
            
            <Text 
              className="text-sm text-gray-700 mb-2"
              style={{ fontFamily: 'Poppins_500Medium' }}
            >
              Wait time (minutes):
            </Text>
            
            <TextInput
              value={customTimer}
              onChangeText={setCustomTimer}
              keyboardType="numeric"
              className="border border-gray-300 rounded-lg px-4 py-3 mb-4 text-base"
              style={{ fontFamily: 'Poppins_400Regular' }}
              placeholder="Enter minutes"
            />
            
            <View className="flex-row space-x-3">
              <TouchableOpacity
                onPress={() => setShowPatientTimer(false)}
                className="flex-1 bg-gray-200 py-3 rounded-lg"
              >
                <Text 
                  className="text-gray-700 text-center font-semibold"
                  style={{ fontFamily: 'Poppins_600SemiBold' }}
                >
                  Cancel
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                onPress={handleApplyCustomEyeDrops}
                disabled={processing === selectedPatient?.queueEntryId}
                className="flex-1 bg-[#0ea5e9] py-3 rounded-lg"
              >
                {processing === selectedPatient?.queueEntryId ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text 
                    className="text-white text-center font-semibold"
                    style={{ fontFamily: 'Poppins_600SemiBold' }}
                  >
                    Apply Drops
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}