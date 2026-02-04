import AsyncStorage from '@react-native-async-storage/async-storage';

export const TIMER_STORAGE_KEY = 'eyeDropTimerDuration';
export const DEFAULT_TIMER_DURATION = 10; // 10 minutes default

export class TimerManager {
  private static instance: TimerManager;
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private listeners: Map<string, Set<() => void>> = new Map();

  static getInstance(): TimerManager {
    if (!TimerManager.instance) {
      TimerManager.instance = new TimerManager();
    }
    return TimerManager.instance;
  }

  // Save timer duration to storage
  async saveDefaultDuration(duration: number): Promise<void> {
    try {
      await AsyncStorage.setItem(TIMER_STORAGE_KEY, duration.toString());
    } catch (error) {
      console.error('Failed to save timer duration:', error);
    }
  }

  // Load timer duration from storage
  async loadDefaultDuration(): Promise<number> {
    try {
      const saved = await AsyncStorage.getItem(TIMER_STORAGE_KEY);
      return saved ? parseInt(saved) : DEFAULT_TIMER_DURATION;
    } catch (error) {
      console.error('Failed to load timer duration:', error);
      return DEFAULT_TIMER_DURATION;
    }
  }

  // Start a timer for a patient
  startTimer(patientId: string, durationMinutes: number, onComplete: () => void): void {
    // Clear existing timer if any
    this.clearTimer(patientId);

    // Start new timer
    const timeoutId = setTimeout(() => {
      onComplete();
      this.clearTimer(patientId);
      this.notifyListeners(patientId);
    }, durationMinutes * 60 * 1000);

    this.timers.set(patientId, timeoutId);
  }

  // Clear a specific timer
  clearTimer(patientId: string): void {
    const timer = this.timers.get(patientId);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(patientId);
    }
  }

  // Clear all timers
  clearAllTimers(): void {
    this.timers.forEach((timer) => clearTimeout(timer));
    this.timers.clear();
  }

  // Check if a timer is running
  isTimerRunning(patientId: string): boolean {
    return this.timers.has(patientId);
  }

  // Subscribe to timer events
  subscribe(patientId: string, callback: () => void): () => void {
    if (!this.listeners.has(patientId)) {
      this.listeners.set(patientId, new Set());
    }
    
    this.listeners.get(patientId)!.add(callback);

    // Return unsubscribe function
    return () => {
      this.listeners.get(patientId)?.delete(callback);
      if (this.listeners.get(patientId)?.size === 0) {
        this.listeners.delete(patientId);
      }
    };
  }

  private notifyListeners(patientId: string): void {
    const callbacks = this.listeners.get(patientId);
    if (callbacks) {
      callbacks.forEach(callback => callback());
    }
  }
}

// Utility functions
export const formatTimeRemaining = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

export const getStatusColor = (status: 'needingDrops' | 'waitingForDilation' | 'readyToResume'): string => {
  switch (status) {
    case 'needingDrops':
      return '#ea580c'; // orange-600
    case 'waitingForDilation':
      return '#2563eb'; // blue-600
    case 'readyToResume':
      return '#16a34a'; // green-600
    default:
      return '#6b7280'; // gray-500
  }
};

export const getStatusText = (status: 'needingDrops' | 'waitingForDilation' | 'readyToResume'): string => {
  switch (status) {
    case 'needingDrops':
      return 'Needs Drops';
    case 'waitingForDilation':
      return 'Waiting for Dilation';
    case 'readyToResume':
      return 'Ready to Resume';
    default:
      return 'Unknown Status';
  }
};

export const calculatePatientStatus = (timing: any): 'needingDrops' | 'waitingForDilation' | 'readyToResume' => {
  if (timing.needsDrops) return 'needingDrops';
  if (timing.readyToResume) return 'readyToResume';
  return 'waitingForDilation';
};

// Export singleton instance
export const timerManager = TimerManager.getInstance();