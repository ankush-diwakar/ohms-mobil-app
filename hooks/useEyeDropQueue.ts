import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import eyeDropQueueService, { EyeDropQueueData } from '../services/eyeDropQueueService';
import { useEffect } from 'react';

export const useEyeDropQueue = (selectedDate?: string) => {
  const queryClient = useQueryClient();

  // Fetch queue data
  const query = useQuery<EyeDropQueueData>({
    queryKey: ['eyeDropQueue', selectedDate],
    queryFn: () => eyeDropQueueService.fetchEyeDropQueue(selectedDate),
    refetchInterval: 30000, // Refetch every 30 seconds as backup
    staleTime: 10000, // Consider data stale after 10 seconds
  });

  // Apply eye drops mutation
  const applyEyeDropsMutation = useMutation({
    mutationFn: ({ queueEntryId, customWaitMinutes }: { queueEntryId: string; customWaitMinutes: number }) =>
      eyeDropQueueService.applyEyeDrops(queueEntryId, customWaitMinutes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['eyeDropQueue'] });
    },
    onError: (error) => {
      console.error('Failed to apply eye drops:', error);
    }
  });

  // Repeat dilation mutation
  const repeatDilationMutation = useMutation({
    mutationFn: ({ queueEntryId, customWaitMinutes }: { queueEntryId: string; customWaitMinutes: number }) =>
      eyeDropQueueService.repeatDilation(queueEntryId, customWaitMinutes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['eyeDropQueue'] });
    },
    onError: (error) => {
      console.error('Failed to repeat dilation:', error);
    }
  });

  // Mark ready mutation
  const markReadyMutation = useMutation({
    mutationFn: (queueEntryId: string) => 
      eyeDropQueueService.markReady(queueEntryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['eyeDropQueue'] });
    },
    onError: (error) => {
      console.error('Failed to mark patient ready:', error);
    }
  });

  return {
    // Query data
    ...query,
    patients: query.data?.patients || [],
    statistics: query.data?.statistics || {
      totalOnHold: 0,
      needingDrops: 0,
      waitingForDilation: 0,
      readyToResume: 0
    },
    
    // Mutations
    applyEyeDrops: applyEyeDropsMutation.mutate,
    repeatDilation: repeatDilationMutation.mutate,
    markReady: markReadyMutation.mutate,
    
    // Loading states
    isApplyingDrops: applyEyeDropsMutation.isPending,
    isRepeatingDilation: repeatDilationMutation.isPending,
    isMarkingReady: markReadyMutation.isPending,
    
    // Manual refetch
    refetchQueue: query.refetch
  };
};

export default useEyeDropQueue;