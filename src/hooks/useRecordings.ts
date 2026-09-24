import { useState, useEffect, useCallback } from 'react';
import { Recording, TherapistResult } from '../types';
import {
  getAllRecordings,
  getRecordingsBySession,
  updateRecording,
  deleteRecording
} from '../storage/recordingRepository';

export function useRecordings(sessionId?: string) {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadRecordings = useCallback(async () => {
    try {
      setLoading(true);
      const list = sessionId
        ? await getRecordingsBySession(sessionId)
        : await getAllRecordings();
      setRecordings(list);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load recordings');
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    loadRecordings();
  }, [loadRecordings]);

  const saveTherapistReview = useCallback(
    async (
      recordingId: string,
      result: TherapistResult,
      remarks?: string
    ) => {
      const rec = recordings.find(r => r.id === recordingId);
      if (!rec) return;

      const updated: Recording = {
        ...rec,
        therapistResult: result,
        therapistRemarks: remarks?.trim() || '',
        therapistReviewedAt: new Date().toISOString()
      };

      await updateRecording(updated);
      setRecordings(prev => prev.map(r => (r.id === recordingId ? updated : r)));
    },
    [recordings]
  );

  const removeRecording = useCallback(
    async (recordingId: string) => {
      await deleteRecording(recordingId);
      setRecordings(prev => prev.filter(r => r.id !== recordingId));
    },
    []
  );

  return {
    recordings,
    loading,
    error,
    refreshRecordings: loadRecordings,
    saveTherapistReview,
    removeRecording
  };
}
