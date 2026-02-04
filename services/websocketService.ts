import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

class WebSocketService {
  private socket: Socket | null = null;
  private listeners: Map<string, Set<(data: any) => void>> = new Map();

  connect() {
    try {
      // Get base URL and convert to Socket.IO format
      const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.replace('/api/v1', '') || 'http://localhost:3000';
      
      console.log('🔌 Connecting to Socket.IO server:', baseUrl);

      // Create Socket.IO connection
      this.socket = io(baseUrl, {
        transports: ['websocket', 'polling'], // Allow fallback to polling
        withCredentials: true, // Send cookies for authentication
        timeout: 20000,
        forceNew: true,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 3000,
        reconnectionDelayMax: 10000,
      });

      // Connection successful
      this.socket.on('connect', () => {
        console.log('✅ Socket.IO connected:', this.socket?.id);
        
        // Join receptionist2 queue room for updates
        this.socket?.emit('join_room', { room: 'receptionist2_queue' });
        console.log('📡 Joined receptionist2_queue room');
      });

      // Handle connection errors
      this.socket.on('connect_error', (error) => {
        console.error('❌ Socket.IO connection error:', error.message);
      });

      // Handle disconnection
      this.socket.on('disconnect', (reason) => {
        console.log('💔 Socket.IO disconnected:', reason);
      });

      // Handle reconnection
      this.socket.on('reconnect', (attemptNumber) => {
        console.log('🔄 Socket.IO reconnected after', attemptNumber, 'attempts');
      });

      // Handle reconnection attempts
      this.socket.on('reconnect_attempt', (attemptNumber) => {
        console.log('🔄 Socket.IO reconnection attempt:', attemptNumber);
      });

      // Handle queue updates
      this.socket.on('queue_updated', (data) => {
        console.log('📮 Queue updated:', data);
        this.handleMessage('queue_updated', data);
      });

      // Handle eye drop updates
      this.socket.on('eyedrop_applied', (data) => {
        console.log('💧 Eye drop applied:', data);
        this.handleMessage('eyedrop_applied', data);
      });

      // Handle timer updates
      this.socket.on('timer_updated', (data) => {
        console.log('⏰ Timer updated:', data);
        this.handleMessage('timer_updated', data);
      });

    } catch (error) {
      console.error('Failed to connect Socket.IO:', error);
    }
  }

  disconnect() {
    if (this.socket) {
      console.log('🔌 Disconnecting Socket.IO...');
      this.socket.disconnect();
      this.socket = null;
      this.listeners.clear();
    }
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  send(event: string, data?: any) {
    if (this.socket && this.socket.connected) {
      this.socket.emit(event, data);
    } else {
      console.warn('Socket.IO not connected, cannot send:', event, data);
    }
  }

  private handleMessage(event: string, data: any) {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('Error in Socket.IO event callback:', error);
        }
      });
    }
  }

  subscribe(event: string, callback: (data: any) => void): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    
    this.listeners.get(event)!.add(callback);
    
    // Return unsubscribe function
    return () => {
      const eventListeners = this.listeners.get(event);
      if (eventListeners) {
        eventListeners.delete(callback);
        if (eventListeners.size === 0) {
          this.listeners.delete(event);
        }
      }
    };
  }

  unsubscribe(event: string, callback?: (data: any) => void) {
    if (callback) {
      this.listeners.get(event)?.delete(callback);
    } else {
      this.listeners.delete(event);
    }
  }
}

// Create singleton instance
const websocketService = new WebSocketService();

// React Hook for using WebSocket in components
export const useWebSocket = () => {
  const [isConnected, setIsConnected] = useState(false);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Monitor connection status
    const checkConnection = () => {
      setIsConnected(websocketService.isConnected());
    };

    // Check immediately
    checkConnection();

    // Set up interval to check connection status
    const interval = setInterval(checkConnection, 1000);

    return () => {
      clearInterval(interval);
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, []);

  const subscribe = (event: string, callback: (data: any) => void) => {
    return websocketService.subscribe(event, callback);
  };

  const send = (event: string, data?: any) => {
    websocketService.send(event, data);
  };

  return {
    isConnected,
    subscribe,
    send,
    connect: () => websocketService.connect(),
    disconnect: () => websocketService.disconnect(),
  };
};

export default websocketService;