import { apiClient } from './authService';

export interface Patient {
  id: string;
  fullName: string;
  age: number;
  gender: string;
  phone: string;
}

export interface Visit {
  tokenNumber: string;
  appointmentType: string;
}

export interface Timing {
  needsDrops: boolean;
  waitingForDilation: boolean;
  readyToResume: boolean;
  dilationRound: number;
  waitingSinceMinutes: number;
  timeRemaining?: number;
}

export interface QueuePatient {
  queueEntryId: string;
  patient: Patient;
  visit: Visit;
  timing: Timing;
  holdReason?: string;
  customWaitMinutes?: number;
}

export interface QueueStats {
  totalOnHold: number;
  needingDrops: number;
  waitingForDilation: number;
  readyToResume: number;
}

export interface EyeDropQueueData {
  patients: QueuePatient[];
  statistics: QueueStats;
}

export const eyeDropQueueService = {
  // Fetch eye drop queue
  async fetchEyeDropQueue(selectedDate?: string): Promise<EyeDropQueueData> {
    const params = new URLSearchParams();
    if (selectedDate) {
      params.append('date', selectedDate);
    }

    const response = await apiClient.get(
      `/receptionist2/patients/on-hold-queue?${params}`
    );

    return {
      patients: (response.data as any)?.patients || [],
      statistics: (response.data as any)?.statistics || {
        totalOnHold: 0,
        needingDrops: 0,
        waitingForDilation: 0,
        readyToResume: 0
      }
    };
  },

  // Apply eye drops with custom timer
  async applyEyeDrops(queueEntryId: string, customWaitMinutes: number): Promise<any> {
    const response = await apiClient.post('/ophthalmologist/queue/confirm-drops-applied', {
      queueEntryId,
      customWaitMinutes
    });
    return response.data;
  },

  // Repeat dilation
  async repeatDilation(queueEntryId: string, customWaitMinutes: number): Promise<any> {
    const response = await apiClient.post('/ophthalmologist/queue/repeat-dilation', {
      queueEntryId,
      customWaitMinutes
    });
    return response.data;
  },

  // Mark patient as ready
  async markReady(queueEntryId: string): Promise<any> {
    const response = await apiClient.post('/ophthalmologist/queue/mark-ready', {
      queueEntryId
    });
    return response.data;
  }
};

export default eyeDropQueueService;