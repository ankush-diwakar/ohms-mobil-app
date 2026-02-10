import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, FlatList, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFonts, Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold, Poppins_700Bold } from '@expo-google-fonts/poppins';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '../contexts/AuthContext';
import { usePatientsQueueSocket } from '../services/socketService';
import Loading from './Loading';

// Types for queue data
interface Patient {
  id: string;
  patientNumber: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  phone: string;
  gender: string;
  dateOfBirth: string;
}

interface QueueEntry {
  id?: string;
  queueEntryId: string;
  queueNumber: number;
  status: string;
  priority: number;
  joinedAt: string;
  waitingTime: string;
  patient: Patient;
  appointment: {
    tokenNumber: string;
    appointmentTime: string;
    appointmentType: string;
    purpose: string;
  };
  doctor?: {
    id: string;
    name: string;
    firstName: string;
    lastName: string;
  };
  assignedStaff?: {
    id: string;
    name: string;
    staffType: string;
  };
}

interface QueueData {
  queueFor: string;
  statistics: {
    totalPatients: number;
    waitingPatients: number;
    calledPatients: number;
    inProgressPatients: number;
    completedPatients?: number;
  };
  queueEntries: QueueEntry[];
}

interface DoctorQueueData {
  doctorQueues?: Array<{
    doctor: {
      id: string;
      name: string;
      firstName: string;
      lastName: string;
      specialization?: string;
    };
    queueEntries?: QueueEntry[];
    patients?: QueueEntry[];
    statistics?: {
      totalPatients: number;
      waitingPatients: number;
      calledPatients: number;
      inProgressPatients: number;
    };
  }>;
  overallStatistics?: {
    completedPatients: number;
    inProgressPatients: number;
    onHoldPatients: number;
    presentPatients: number;
    totalPatients: number;
    waitingPatients: number;
  };
  queueFor?: string;
  totalDoctors?: number;
}

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || process.env.EXPO_PUBLIC_API_URL;

function PatientsQueue() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const [activeTab, setActiveTab] = useState('optometrist');
  const [selectedDoctor, setSelectedDoctor] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showAllPatients, setShowAllPatients] = useState(false);

  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });

  // Enable socket for real-time updates
  usePatientsQueueSocket();

  // Fetch Optometrist Queue
  const { data: optometristQueueData, isLoading: optometristLoading, error: optometristError, refetch: refetchOptometrist } = useQuery<QueueData>({
    queryKey: ['optometrist-queue'],
    queryFn: async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/optometrist/queue`, {
          method: 'GET',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' }
        });
        
        if (!response.ok) {
          throw new Error(`Failed to fetch optometrist queue: ${response.status}`);
        }
        
        const data = await response.json();
        const responseData = data.data || { queueFor: 'OPTOMETRIST', statistics: { totalPatients: 0, waitingPatients: 0, calledPatients: 0, inProgressPatients: 0 }, queueEntries: [] };
        // Ensure completedPatients is included
        if (responseData.statistics && responseData.statistics.completedPatients === undefined) {
          responseData.statistics.completedPatients = 0;
        }
        return responseData;
      } catch (error) {
        console.error('❌ Error fetching optometrist queue:', error);
        console.error('❌ API_BASE_URL:', API_BASE_URL);
        throw error;
      }
    },
    staleTime: 0,
    refetchInterval: 30000,
    retry: 1,
  });

  // Fetch Doctor Specific Queues  
  const { data: doctorQueueData, isLoading: doctorLoading, error: doctorError, refetch: refetchDoctor } = useQuery<DoctorQueueData>({
    queryKey: ['doctor-queues'],
    queryFn: async () => {
      try {
        const today = new Date().toISOString().split('T')[0];
        
        // Try the receptionist2 endpoint first (for backward compatibility)
        let response = await fetch(`${API_BASE_URL}/receptionist2/patients/ophthalmology-queue/doctor-specific?date=${today}`, {
          method: 'GET',
          credentials: 'include', 
          headers: { 'Content-Type': 'application/json' }
        });
        
        // If 403 error, try the staff-accessible endpoint
        if (response.status === 403) {
          response = await fetch(`${API_BASE_URL}/staff/queue/doctor-specific?date=${today}`, {
            method: 'GET',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' }
          });
        }
        
        if (!response.ok) {
          throw new Error(`Failed to fetch doctor queues: ${response.status}`);
        }
        
        const data = await response.json();
        
        const apiData = data.data || {};
        
        return apiData;
      } catch (error) {
        console.error('❌ Error fetching doctor queues:', error);
        console.error('❌ API_BASE_URL:', API_BASE_URL);
        throw error;
      }
    },
    staleTime: 0,
    refetchInterval: 30000,
    retry: 1,
  });

  // Set first doctor as selected when data loads
  useEffect(() => {
    if (doctorQueueData?.doctorQueues && doctorQueueData.doctorQueues.length > 0 && !selectedDoctor) {
      const firstDoctor = doctorQueueData.doctorQueues[0];
      if (firstDoctor?.doctor?.id) {
        setSelectedDoctor(firstDoctor.doctor.id);
      }
    }
  }, [doctorQueueData, selectedDoctor]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([refetchOptometrist(), refetchDoctor()]);
    } catch (error) {
      Alert.alert('Error', 'Failed to refresh queue data');
    } finally {
      setRefreshing(false);
    }
  };

  if (!fontsLoaded) {
    return <Loading message="Loading..." />;
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'WAITING':
        return '#3b82f6';
      case 'CALLED':
        return '#f59e0b';
      case 'IN_PROGRESS':
        return '#10b981';
      case 'COMPLETED':
        return '#6b7280';
      default:
        return '#6b7280';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'WAITING':
        return 'Waiting';
      case 'CALLED':
        return 'Called';
      case 'IN_PROGRESS':
        return 'In Progress';
      case 'COMPLETED':
        return 'Completed';
      default:
        return status;
    }
  };

  const formatTime = (timeString: string) => {
    return new Date(timeString).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };
  const calculateWaitingTime = (joinedAt: string) => {
    const joinTime = new Date(joinedAt);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - joinTime.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 60) {
      return `${diffInMinutes}m`;
    } else {
      const hours = Math.floor(diffInMinutes / 60);
      const minutes = diffInMinutes % 60;
      return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
    }
  };
  const renderQueueEntry = ({ item }: { item: QueueEntry }) => (
    <View className="bg-white rounded-xl p-3 mb-2 shadow-sm border border-gray-100">
      <View className="flex-row items-center">
        {/* Avatar with Patient Initials */}
        <View className="w-12 h-12 bg-blue-100 rounded-full justify-center items-center mr-3 relative">
          <Text className="text-xs font-bold text-blue-600" style={{ fontFamily: 'Poppins_700Bold' }}>
            {getPatientInitials(item.patient.firstName, item.patient.lastName)}
          </Text>
          <View className="absolute -bottom-0.5 -right-0.5 w-5 h-5 bg-blue-600 rounded-full justify-center items-center">
            <Text className="text-white text-xs font-bold" style={{ fontFamily: 'Poppins_600SemiBold' }}>
              {item.queueNumber}
            </Text>
          </View>
        </View>

        {/* Patient Info */}
        <View className="flex-1 mr-3">
          <Text className="text-base font-semibold text-gray-900 mb-1" style={{ fontFamily: 'Poppins_600SemiBold' }}>
            {item.patient.firstName} {item.patient.lastName}
          </Text>
          <Text className="text-sm text-gray-600" style={{ fontFamily: 'Poppins_400Regular' }}>
            Token: {item.appointment.tokenNumber} • {item.appointment.purpose}
          </Text>
        </View>

        {/* Status and Time */}
        <View className="items-end">
          <View 
            className="px-2 py-1 rounded-md mb-1"
            style={{ backgroundColor: getStatusColor(item.status) + '20' }}
          >
            <Text 
              className="text-xs font-medium"
              style={{
                color: getStatusColor(item.status),
                fontFamily: 'Poppins_500Medium'
              }}
            >
              {getStatusText(item.status)}
            </Text>
          </View>
          <Text className="text-sm font-bold text-blue-600" style={{ fontFamily: 'Poppins_700Bold' }}>
            {item.waitingTime || calculateWaitingTime(item.joinedAt)}
          </Text>
        </View>
      </View>
    </View>
  );

  const renderDoctorTab = ({ item }: { item: any }) => {
    if (!item || !item.doctor) return null;
    
    const isSelected = selectedDoctor === item.doctor.id;
    
    return (
      <TouchableOpacity
        onPress={() => setSelectedDoctor(item.doctor.id)}
        activeOpacity={0.8}
        style={[
          {
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderRadius: 12,
            marginRight: 12,
          },
          isSelected 
            ? { backgroundColor: '#3b82f6' } 
            : { backgroundColor: '#f3f4f6' }
        ]}
      >
        <Text 
          style={[
            {
              fontWeight: '600',
              textAlign: 'center',
              fontFamily: 'Poppins_600SemiBold'
            },
            isSelected 
              ? { color: '#ffffff' }
              : { color: '#374151' }
          ]}
        >
          {item.doctor.firstName} {item.doctor.lastName}
        </Text>
        <Text 
          style={[
            {
              fontSize: 12,
              textAlign: 'center',
              marginTop: 4,
              fontFamily: 'Poppins_400Regular'
            },
            isSelected 
              ? { color: '#dbeafe' }
              : { color: '#6b7280' }
          ]}
        >
          {item.statistics?.totalPatients || 0} Patients
        </Text>
      </TouchableOpacity>
    );
  };

  // Helper function to get patient initials
  const getPatientInitials = (firstName: string, lastName: string) => {
    const firstInitial = firstName?.charAt(0)?.toUpperCase() || '';
    const lastInitial = lastName?.charAt(0)?.toUpperCase() || '';
    return `${firstInitial}${lastInitial}`.slice(0, 2);
  };

  const renderStatisticsCard = (data: QueueData | undefined) => {
    if (!data || !data.statistics) return null;

    return (
      <View className="mb-4">
        {/* Live Status Header */}
        <View className="flex-row justify-between items-center mb-3">
          <Text className="text-lg font-semibold text-gray-900" style={{ fontFamily: 'Poppins_600SemiBold' }}>
            Live Status Queue
          </Text>
          <View className="bg-blue-50 px-3 py-1.5 rounded-lg">
            <Text className="text-sm text-blue-600 font-medium" style={{ fontFamily: 'Poppins_500Medium' }}>
              {data.statistics?.totalPatients || 0} Patients
            </Text>
          </View>
        </View>

        {/* 2x2 Statistics Grid */}
        <View className="flex-row flex-wrap justify-between">
          {/* Total In Queue */}
          <View className="bg-white rounded-2xl p-4 shadow-sm mb-3 w-[48%]">
            <View className="flex-row items-center justify-between">
              <View>
                <Text className="text-2xl font-bold text-blue-600" style={{ fontFamily: 'Poppins_700Bold' }}>
                  {String(data.statistics?.totalPatients || 0).padStart(2, '0')}
                </Text>
                <Text className="text-gray-900 font-semibold text-sm" style={{ fontFamily: 'Poppins_600SemiBold' }}>
                  Total
                </Text>
                <Text className="text-gray-400 text-xs" style={{ fontFamily: 'Poppins_400Regular' }}>
                  In Queue
                </Text>
              </View>
              <View className="w-12 h-12 bg-blue-100 rounded-full items-center justify-center">
                <Ionicons name="people-outline" size={20} color="#2563eb" />
              </View>
            </View>
          </View>

          {/* Waiting From Doctor */}
          <View className="bg-white rounded-2xl p-4 shadow-sm mb-3 w-[48%]">
            <View className="flex-row items-center justify-between">
              <View>
                <Text className="text-2xl font-bold text-orange-600" style={{ fontFamily: 'Poppins_700Bold' }}>
                  {String(data.statistics?.waitingPatients || 0).padStart(2, '0')}
                </Text>
                <Text className="text-gray-900 font-semibold text-sm" style={{ fontFamily: 'Poppins_600SemiBold' }}>
                  Waiting
                </Text>
                <Text className="text-gray-400 text-xs" style={{ fontFamily: 'Poppins_400Regular' }}>
                  From Doctor
                </Text>
              </View>
              <View className="w-12 h-12 bg-orange-100 rounded-full items-center justify-center">
                <Ionicons name="time-outline" size={20} color="#ea580c" />
              </View>
            </View>
          </View>

          {/* Active */}
          <View className="bg-white rounded-2xl p-4 shadow-sm w-[48%]">
            <View className="flex-row items-center justify-between">
              <View>
                <Text className="text-2xl font-bold text-green-600" style={{ fontFamily: 'Poppins_700Bold' }}>
                  {String(data.statistics?.inProgressPatients || 0).padStart(2, '0')}
                </Text>
                <Text className="text-gray-900 font-semibold text-sm" style={{ fontFamily: 'Poppins_600SemiBold' }}>
                  Active
                </Text>
                <Text className="text-gray-400 text-xs" style={{ fontFamily: 'Poppins_400Regular' }}>
                  In Progress
                </Text>
              </View>
              <View className="w-12 h-12 bg-green-100 rounded-full items-center justify-center">
                <Ionicons name="play-circle-outline" size={20} color="#16a34a" />
              </View>
            </View>
          </View>

          {/* Completed */}
          <View className="bg-white rounded-2xl p-4 shadow-sm w-[48%]">
            <View className="flex-row items-center justify-between">
              <View>
                <Text className="text-2xl font-bold text-gray-600" style={{ fontFamily: 'Poppins_700Bold' }}>
                  {String(data.statistics?.completedPatients || 0).padStart(2, '0')}
                </Text>
                <Text className="text-gray-900 font-semibold text-sm" style={{ fontFamily: 'Poppins_600SemiBold' }}>
                  Completed
                </Text>
                <Text className="text-gray-400 text-xs" style={{ fontFamily: 'Poppins_400Regular' }}>
                  Done
                </Text>
              </View>
              <View className="w-12 h-12 bg-gray-100 rounded-full items-center justify-center">
                <Ionicons name="checkmark-circle-outline" size={20} color="#6b7280" />
              </View>
            </View>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View className="flex-1 bg-gray-50">
      <StatusBar style="light" backgroundColor="#0ea5e9" />
      
      {/* Header */}
      <LinearGradient
        colors={['#0ea5e9', '#38bdf8', '#7dd3fc']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        className="pb-4"
      >
        <SafeAreaView>
          <View className="px-4 pt-4">
            <Text className="text-white text-2xl font-bold mb-2" style={{ fontFamily: 'Poppins_700Bold' }}>
              Patients Queue
            </Text>
            <Text className="text-blue-100 text-sm" style={{ fontFamily: 'Poppins_400Regular' }}>
              Real-time patient queue monitoring
            </Text>
          </View>
        </SafeAreaView>
      </LinearGradient>

      {/* Tab Selector */}
      <View className="px-4 py-4">
        <View className="flex-row bg-gray-200 rounded-2xl p-1">
          <TouchableOpacity
            onPress={() => setActiveTab('optometrist')}
            activeOpacity={0.8}
            className={`flex-1 py-3 rounded-xl`}
            style={{
              backgroundColor: activeTab === 'optometrist' ? '#0ea5e9' : 'transparent'
            }}
          >
            <Text 
              className={`text-center font-semibold ${
                activeTab === 'optometrist' ? 'text-white' : 'text-gray-600'
              }`}
              style={{ fontFamily: 'Poppins_600SemiBold' }}
            >
              Optometrist
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            onPress={() => setActiveTab('doctor')}
            activeOpacity={0.8}
            className={`flex-1 py-3 rounded-xl`}
            style={{
              backgroundColor: activeTab === 'doctor' ? '#0ea5e9' : 'transparent'
            }}
          >
            <Text 
              className={`text-center font-semibold ${
                activeTab === 'doctor' ? 'text-white' : 'text-gray-600'
              }`}
              style={{ fontFamily: 'Poppins_600SemiBold' }}
            >
              Doctor
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Content */}
      <ScrollView 
        className="flex-1 px-4"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#0ea5e9']}
            tintColor="#0ea5e9"
          />
        }
      >
        {/* Optometrist Queue */}
        {activeTab === 'optometrist' && (
          <View>
            {renderStatisticsCard(optometristQueueData)}
            
            {/* Patient Queue List */}
            <View className="mb-4">
              <View className="flex-row justify-between items-center mb-3">
                <Text className="text-lg font-semibold text-gray-900" style={{ fontFamily: 'Poppins_600SemiBold' }}>
                  Patient Queue
                </Text>
                {optometristQueueData?.queueEntries && optometristQueueData.queueEntries.length > 0 && (
                  <Text className="text-sm text-gray-500" style={{ fontFamily: 'Poppins_400Regular' }}>
                    {optometristQueueData.queueEntries.length} patients
                  </Text>
                )}
              </View>

              {optometristLoading ? (
                <Loading message="Loading optometrist queue..." animationSize={100} />
              ) : optometristQueueData?.queueEntries && optometristQueueData.queueEntries.length > 0 ? (
                <>
                  <FlatList
                    data={showAllPatients ? optometristQueueData.queueEntries : optometristQueueData.queueEntries.slice(0, 5)}
                    renderItem={renderQueueEntry}
                    keyExtractor={(item) => item.queueEntryId}
                    scrollEnabled={false}
                    showsVerticalScrollIndicator={false}
                  />
                  
                  {/* Show More Button */}
                  {!showAllPatients && optometristQueueData.queueEntries.length > 5 && (
                    <TouchableOpacity
                      onPress={() => setShowAllPatients(true)}
                      className="bg-blue-50 border-2 border-blue-200 border-dashed rounded-xl p-4 mt-2 items-center"
                      activeOpacity={0.7}
                    >
                      <Text className="text-blue-600 font-semibold" style={{ fontFamily: 'Poppins_600SemiBold' }}>
                        Show {optometristQueueData.queueEntries.length - 5} more patients
                      </Text>
                    </TouchableOpacity>
                  )}
                  
                  {/* Show Less Button */}
                  {showAllPatients && optometristQueueData.queueEntries.length > 5 && (
                    <TouchableOpacity
                      onPress={() => setShowAllPatients(false)}
                      className="bg-gray-50 rounded-xl p-4 mt-2 items-center"
                      activeOpacity={0.7}
                    >
                      <Text className="text-gray-600 font-semibold" style={{ fontFamily: 'Poppins_600SemiBold' }}>
                        Show less
                      </Text>
                    </TouchableOpacity>
                  )}
                </>
              ) : (
                <View className="bg-white rounded-xl p-8 items-center">
                  <View className="bg-gray-100 rounded-full p-4 mb-4">
                    <Ionicons name="people-outline" size={48} color="#9ca3af" />
                  </View>
                  <Text className="text-gray-600 text-lg font-semibold mb-2" style={{ fontFamily: 'Poppins_600SemiBold' }}>
                    No patients in the queue!
                  </Text>
                  <Text className="text-gray-400 text-sm text-center" style={{ fontFamily: 'Poppins_400Regular' }}>
                    No patients waiting for optometrist
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Doctor Queue */}
        {activeTab === 'doctor' && (
          <View>
            {/* Doctor Selection */}
            {doctorQueueData?.doctorQueues && doctorQueueData.doctorQueues.length > 0 && (
              <View className="mb-4">
                <Text className="text-lg font-semibold text-gray-900 mb-3" style={{ fontFamily: 'Poppins_600SemiBold' }}>
                  Select Doctor ({doctorQueueData.totalDoctors || doctorQueueData.doctorQueues.length})
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
                  {doctorQueueData.doctorQueues.map((doctorQueue) => (
                    <TouchableOpacity
                      key={doctorQueue.doctor.id}
                      onPress={() => setSelectedDoctor(doctorQueue.doctor.id)}
                      className={`mr-3 px-4 py-2 rounded-2xl border ${
                        selectedDoctor === doctorQueue.doctor.id
                          ? 'border-blue-600'
                          : 'border-gray-300'
                      }`}
                      style={{
                        backgroundColor: selectedDoctor === doctorQueue.doctor.id ? '#0ea5e9' : '#ffffff'
                      }}
                    >
                      <Text
                        className={`font-medium ${
                          selectedDoctor === doctorQueue.doctor.id
                            ? 'text-white'
                            : 'text-gray-700'
                        }`}
                        style={{ fontFamily: 'Poppins_500Medium' }}
                      >
                        Dr. {doctorQueue.doctor.firstName} {doctorQueue.doctor.lastName}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Selected Doctor's Queue */}
            {selectedDoctor && doctorQueueData?.doctorQueues && (
              (() => {
                const selectedDoctorData = doctorQueueData.doctorQueues.find(dq => dq.doctor.id === selectedDoctor);
                
                if (!selectedDoctorData) {
                  return null;
                }
                
                const queueEntries = selectedDoctorData.queueEntries || selectedDoctorData.patients || [];
                
                return (
                  <View>
                    {renderStatisticsCard({
                      queueFor: 'DOCTOR',
                      statistics: selectedDoctorData.statistics || { 
                        totalPatients: 0, 
                        waitingPatients: 0, 
                        calledPatients: 0, 
                        inProgressPatients: 0 
                      },
                      queueEntries: queueEntries
                    })}
                    
                    {/* Patient List with 5-item limit */}
                    <View className="mb-4">
                      <View className="flex-row justify-between items-center mb-3">
                        <Text className="text-lg font-semibold text-gray-900" style={{ fontFamily: 'Poppins_600SemiBold' }}>
                          Dr. {selectedDoctorData.doctor.firstName}'s Queue
                        </Text>
                        {queueEntries.length > 0 && (
                          <Text className="text-sm text-gray-500" style={{ fontFamily: 'Poppins_400Regular' }}>
                            {queueEntries.length} patients
                          </Text>
                        )}
                      </View>

                      {queueEntries.length > 0 ? (
                        <>
                          <FlatList
                            data={showAllPatients ? queueEntries : queueEntries.slice(0, 5)}
                            renderItem={renderQueueEntry}
                            keyExtractor={(item, index) => {
                              return item.queueEntryId || item.id || item.queueNumber?.toString() || index.toString();
                            }}
                            scrollEnabled={false}
                            showsVerticalScrollIndicator={false}
                          />
                          
                          {/* Show More Button */}
                          {!showAllPatients && queueEntries.length > 5 && (
                            <TouchableOpacity
                              onPress={() => setShowAllPatients(true)}
                              className="bg-blue-50 border-2 border-blue-200 border-dashed rounded-xl p-4 mt-2 items-center"
                              activeOpacity={0.7}
                            >
                              <Text className="text-blue-600 font-semibold" style={{ fontFamily: 'Poppins_600SemiBold' }}>
                                Show {queueEntries.length - 5} more patients
                              </Text>
                            </TouchableOpacity>
                          )}
                          
                          {/* Show Less Button */}
                          {showAllPatients && queueEntries.length > 5 && (
                            <TouchableOpacity
                              onPress={() => setShowAllPatients(false)}
                              className="bg-gray-50 rounded-xl p-4 mt-2 items-center"
                              activeOpacity={0.7}
                            >
                              <Text className="text-gray-600 font-semibold" style={{ fontFamily: 'Poppins_600SemiBold' }}>
                                Show less
                              </Text>
                            </TouchableOpacity>
                          )}
                        </>
                      ) : (
                        <View className="bg-white rounded-xl p-8 items-center">
                          <View className="bg-gray-100 rounded-full p-4 mb-4">
                            <Ionicons name="people-outline" size={48} color="#9ca3af" />
                          </View>
                          <Text className="text-gray-600 text-lg font-semibold mb-2" style={{ fontFamily: 'Poppins_600SemiBold' }}>
                            No patients in the queue!
                          </Text>
                          <Text className="text-gray-400 text-sm text-center" style={{ fontFamily: 'Poppins_400Regular' }}>
                            No patients assigned to this doctor
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                );
              })()
            )}

            {doctorLoading && (
              <Loading message="Loading doctor queues..." animationSize={100} />
            )}

            {/* Empty state when no doctors available */}
            {!doctorLoading && (!doctorQueueData?.doctorQueues || doctorQueueData.doctorQueues.length === 0) && (
              <View className="bg-white rounded-xl p-8 items-center">
                <View className="bg-gray-100 rounded-full p-4 mb-4">
                  <Ionicons name="medical-outline" size={48} color="#9ca3af" />
                </View>
                <Text className="text-gray-600 text-lg font-semibold mb-2" style={{ fontFamily: 'Poppins_600SemiBold' }}>
                  Queue is Empty!
                </Text>
                <Text className="text-gray-400 text-sm text-center" style={{ fontFamily: 'Poppins_400Regular' }}>
                  No patients found for doctors consultation!
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Bottom spacing */}
        <View className="h-20" />
      </ScrollView>
    </View>
  );
}

export default PatientsQueue;