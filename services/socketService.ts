import { useEffect, useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { io, Socket } from 'socket.io-client';
import * as Notifications from 'expo-notifications';
import * as Haptics from 'expo-haptics';

// Helper function to fetch patient details by ID
const fetchPatientDetails = async (patientId: string): Promise<any> => {
  try {
    // Import the API client
    const { default: apiClient } = await import('./apiClient');
    
    // Fetch patient details from the API
    const response = await apiClient.get(`/patients/${patientId}`);
    return response.data;
  } catch (error) {
    console.error('❌ Failed to fetch patient details:', error);
    return null;
  }
};

// Helper function to send local notification
const sendPatientNotification = async (patientData: any, action: 'added' | 'removed') => {
  try {
    // Check notification permissions
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      console.log('📱 Notification permissions not granted');
      return;
    }

    const isAdded = action === 'added';
    
    // Extract patient name from data or use fallback
    let patientName = 'Unknown Patient';
    
    // Try different possible patient name fields from WebSocket data
    if (patientData.patient) {
      if (patientData.patient.fullName) {
        patientName = patientData.patient.fullName;
      } else if (patientData.patient.firstName && patientData.patient.lastName) {
        patientName = `${patientData.patient.firstName} ${patientData.patient.lastName}`;
      } else if (patientData.patient.name) {
        patientName = patientData.patient.name;
      }
    } else if (patientData.fullName) {
      patientName = patientData.fullName;
    } else if (patientData.patientName) {
      patientName = patientData.patientName;
    } else if (patientData.firstName && patientData.lastName) {
      patientName = `${patientData.firstName} ${patientData.lastName}`;
    } else if (patientData.queueEntryId) {
      // Use last 4 characters of queue ID as fallback
      patientName = `Patient #${patientData.queueEntryId.slice(-4)}`;
    }

    // Get the actual reasons or use fallback
    const reasons = patientData.reasons && Array.isArray(patientData.reasons) 
      ? patientData.reasons.join(', ') 
      : 'Eye examination preparation';

    const title = isAdded ? '👁️ New Patient in Queue' : '✅ Patient Ready for Examination';
    const body = isAdded 
      ? `${patientName} needs: ${reasons}` 
      : `${patientName} is ready to resume examination`;

    // Trigger haptic feedback
    if (isAdded) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    // Schedule the notification
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
        data: {
          queueEntryId: patientData.queueEntryId,
          action: action,
          timestamp: new Date().toISOString(),
          patientName: patientName,
          reasons: reasons,
        },
      },
      trigger: null, // Show immediately
    });

    console.log(`📱 Sent ${action} notification for patient:`, patientName, 'Reasons:', reasons);
  } catch (error) {
    console.error('❌ Failed to send notification:', error);
  }
};

// Helper function to get patient name from queue data
const getPatientName = async (queueEntryId: string): Promise<string> => {
  try {
    // This would ideally fetch from your API, but for now we'll use a placeholder
    // You can enhance this to call your API to get patient details
    return 'New Patient'; // Fallback name
  } catch (error) {
    console.error('❌ Failed to get patient name:', error);
    return 'Unknown Patient';
  }
};
class SocketManager {
  private static instance: SocketManager;
  private socket: Socket | null = null;
  private isConnected: boolean = false;

  private constructor() {}

  static getInstance(): SocketManager {
    if (!SocketManager.instance) {
      SocketManager.instance = new SocketManager();
    }
    return SocketManager.instance;
  }

  connect(serverUrl: string): Socket {
    if (!this.socket || !this.isConnected) {
      console.log('🔌 Connecting to WebSocket server:', serverUrl);
      
      this.socket = io(serverUrl, {
        withCredentials: true,
        transports: ['polling', 'websocket'], // Start with polling, then upgrade
        autoConnect: true,
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 5,
        timeout: 20000,
        forceNew: false,
        upgrade: true,
        rememberUpgrade: true
      });

      this.socket.on('connect', () => {
        console.log('✅ WebSocket connected successfully');
        this.isConnected = true;
      });

      this.socket.on('disconnect', (reason) => {
        console.log('⚠️ WebSocket disconnected:', reason);
        this.isConnected = false;
      });

      this.socket.on('connect_error', (error) => {
        console.error('❌ WebSocket connection error:', error.message);
        this.isConnected = false;
        
        // Try to reconnect with polling only if WebSocket fails
        if (this.socket && !this.socket.connected) {
          console.log('🔄 Retrying with polling transport only...');
          this.socket.io.opts.transports = ['polling'];
        }
      });

      this.socket.on('reconnect', (attemptNumber) => {
        console.log('🔄 WebSocket reconnected after', attemptNumber, 'attempts');
        this.isConnected = true;
      });

      this.socket.on('reconnect_error', (error) => {
        console.error('❌ WebSocket reconnection error:', error.message);
      });

      this.socket.on('reconnect_failed', () => {
        console.error('❌ WebSocket reconnection failed - max attempts reached');
      });
    }

    return this.socket;
  }

  getSocket(): Socket | null {
    return this.socket;
  }

  isSocketConnected(): boolean {
    return this.isConnected && this.socket?.connected === true;
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }
}

// Hook for eye drop queue real-time updates
export const useEyeDropQueueSocket = (onDataUpdate?: () => void) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    // Skip WebSocket in development if server is not running
    const isDevelopment = __DEV__;
    
    const serverUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.replace('/api/v1', '') || 
                     process.env.EXPO_PUBLIC_API_URL?.replace('/api/v1', '') || 
                     'http://localhost:3000';

    console.log('🔌 Attempting WebSocket connection to:', serverUrl);

    try {
      const socketManager = SocketManager.getInstance();
      const socket = socketManager.connect(serverUrl);

      // Join the receptionist2 queue room to receive eye drop queue updates
      const joinEyeDropRoom = () => {
        if (socketManager.isSocketConnected()) {
          socket.emit('queue:join-receptionist2');
          console.log('🔌 Joined eye drop queue room');
        } else {
          console.log('⚠️ Socket not connected, cannot join room');
        }
      };

      // Initial room join with delay
      socket.on('connect', () => {
        // Small delay to ensure connection is fully established
        setTimeout(() => {
          joinEyeDropRoom();
        }, 100);
      });
      
      // Rejoin rooms on reconnection
      socket.on('reconnect', () => {
        console.log('🔄 WebSocket reconnected, rejoining rooms...');
        setTimeout(() => {
          joinEyeDropRoom();
          // Refresh eye drop queue data
          queryClient.invalidateQueries({ queryKey: ['eyeDropQueue'] });
          // Also call the callback for immediate UI update
          if (onDataUpdate) {
            onDataUpdate();
          }
        }, 100);
      });

      // Listen for new patient added to eye drop queue
      const handlePatientOnHold = async (data: any) => {
        console.log('📡 Patient added to eye drop queue - Full data:', JSON.stringify(data, null, 2));
        
        // Try to fetch patient details if we have a patientId
        let enrichedData = { ...data };
        if (data.patientId) {
          console.log('🔍 Fetching patient details for ID:', data.patientId);
          const patientDetails = await fetchPatientDetails(data.patientId);
          if (patientDetails) {
            enrichedData.patient = patientDetails;
            console.log('✅ Patient details fetched:', patientDetails.fullName || patientDetails.firstName + ' ' + patientDetails.lastName);
          }
        }
        
        // Send notification with enriched data
        await sendPatientNotification(enrichedData, 'added');
        
        queryClient.invalidateQueries({ queryKey: ['eyeDropQueue'] });
        
        // Trigger immediate UI update
        if (onDataUpdate) {
          console.log('🔄 Triggering UI update for new patient');
          onDataUpdate();
        }
      };

      // Listen for patient removed from eye drop queue (eye drops applied)
      const handlePatientRemoved = async (data: any) => {
        console.log('📡 Patient removed from eye drop queue:', data);
        
        // Send notification for patient removal
        await sendPatientNotification(data, 'removed');
        
        queryClient.invalidateQueries({ queryKey: ['eyeDropQueue'] });
        
        // Trigger immediate UI update
        if (onDataUpdate) {
          console.log('🔄 Triggering UI update for patient removal');
          onDataUpdate();
        }
      };

      // Listen for general queue updates
      const handleQueueUpdate = (data: any) => {
        console.log('📡 Eye drop queue updated:', data);
        queryClient.invalidateQueries({ queryKey: ['eyeDropQueue'] });
        
        // Trigger immediate UI update
        if (onDataUpdate) {
          console.log('🔄 Triggering UI update for queue change');
          onDataUpdate();
        }
      };

      // Set up event listeners
      socket.on('queue:patient-on-hold', handlePatientOnHold);
      socket.on('queue:patient-removed', handlePatientRemoved);
      socket.on('queue:updated', handleQueueUpdate);

      // Cleanup on unmount
      return () => {
        socket.off('queue:patient-on-hold', handlePatientOnHold);
        socket.off('queue:patient-removed', handlePatientRemoved);
        socket.off('queue:updated', handleQueueUpdate);
        socket.off('connect');
        socket.off('reconnect');
      };
    } catch (error) {
      console.error('❌ Failed to initialize WebSocket:', error);
      // App continues to work without real-time updates
      return () => {}; // Empty cleanup function
    }
  }, [queryClient]);
};

// Hook for doctor queue updates (if implementing doctor features in mobile)
export const useDoctorQueueSocket = (doctorId?: string) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!doctorId) return;

    const serverUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.replace('/api/v1', '') || 
                     process.env.EXPO_PUBLIC_API_URL?.replace('/api/v1', '') || 
                     'http://localhost:3000';

    const socketManager = SocketManager.getInstance();
    const socket = socketManager.connect(serverUrl);

    // Join doctor-specific room
    const joinDoctorRoom = () => {
      if (socketManager.isSocketConnected()) {
        socket.emit('queue:join-doctor', doctorId);
        socket.emit('queue:join-ophthalmologist');
        console.log('🔌 Joined doctor queue room:', doctorId);
      }
    };

    socket.on('connect', joinDoctorRoom);
    socket.on('reconnect', joinDoctorRoom);

    // Listen for patient events
    const handlePatientAssigned = (data: any) => {
      console.log('📡 Patient assigned to doctor:', data);
      queryClient.invalidateQueries({ queryKey: ['doctorQueue', doctorId] });
    };

    const handlePatientRemoved = (data: any) => {
      console.log('📡 Patient removed from doctor queue:', data);
      queryClient.invalidateQueries({ queryKey: ['doctorQueue', doctorId] });
    };

    const handlePatientAvailable = (data: any) => {
      console.log('📡 Patient available after eye drops:', data);
      queryClient.invalidateQueries({ queryKey: ['doctorQueue', doctorId] });
    };

    const handlePatientProcessed = (data: any) => {
      console.log('📡 Patient consultation completed:', data);
      queryClient.invalidateQueries({ queryKey: ['doctorQueue', doctorId] });
    };

    socket.on('queue:patient-assigned', handlePatientAssigned);
    socket.on('queue:patient-removed', handlePatientRemoved);
    socket.on('queue:patient-available', handlePatientAvailable);
    socket.on('queue:patient-processed', handlePatientProcessed);

    return () => {
      socket.off('queue:patient-assigned', handlePatientAssigned);
      socket.off('queue:patient-removed', handlePatientRemoved);
      socket.off('queue:patient-available', handlePatientAvailable);
      socket.off('queue:patient-processed', handlePatientProcessed);
      socket.off('connect', joinDoctorRoom);
      socket.off('reconnect', joinDoctorRoom);
    };
  }, [doctorId, queryClient]);
};

// Connection status hook
export const useSocketConnectionStatus = () => {
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const socketManager = SocketManager.getInstance();
    
    const checkConnection = () => {
      setIsConnected(socketManager.isSocketConnected());
    };

    const interval = setInterval(checkConnection, 1000);
    checkConnection(); // Initial check

    return () => clearInterval(interval);
  }, []);

  return isConnected;
};

// Export socket manager for manual operations
export const getSocketManager = () => SocketManager.getInstance();