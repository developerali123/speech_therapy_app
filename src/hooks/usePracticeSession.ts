import { useState, useEffect, useCallback } from 'react';
import { PracticeSession, Recording } from '../types';
import {
  createSession,
  updateSession,
  getLatestInProgressSession
} from '../storage/sessionRepository';
import {
  createRecording,
  getRecordingsBySession
} from '../storage/recordingRepository';

interface UsePracticeSessionOptions {
  exerciseId: string;
  targetAttempts?: number;
}

export function usePracticeSession({
  exerciseId,
  targetAttempts = 10
}: UsePracticeSessionOptions) {
  const [session, setSession] = useState<PracticeSession | null>(null);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  // Initialize or resume session from IndexedDB
  const initSession = useCallback(async (forceNew = false) => {
    setLoading(true);
    try {
      if (!forceNew) {
        const inProgress = await getLatestInProgressSession(exerciseId);
        if (inProgress) {
          const existingRecs = await getRecordingsBySession(inProgress.id);
          setSession(inProgress);
          setRecordings(existingRecs);
          setIsCompleted(inProgress.status === 'COMPLETED');
          setLoading(false);
          return inProgress;
        }
      }

      // If forceNew and there was an inProgress session, mark it completed/abandoned
      if (forceNew) {
        const inProgress = await getLatestInProgressSession(exerciseId);
        if (inProgress) {
          await updateSession({
            ...inProgress,
            status: inProgress.attemptCount > 0 ? 'COMPLETED' : 'ABANDONED',
            completedAt: new Date().toISOString()
          });
        }
      }

      const newSession: PracticeSession = {
        id: `session-${Date.now()}`,
        exerciseId,
        startedAt: new Date().toISOString(),
        status: 'IN_PROGRESS',
        attemptCount: 0,
        targetAttempts
      };
      await createSession(newSession);
      setSession(newSession);
      setRecordings([]);
      setIsCompleted(false);
      setLoading(false);
      return newSession;
    } catch (err) {
      console.error('Failed to init practice session:', err);
      setLoading(false);
      return null;
    }
  }, [exerciseId, targetAttempts]);

  useEffect(() => {
    initSession();
  }, [initSession]);

  const saveAttempt = useCallback(
    async (
      audioBlob: Blob,
      duration: number,
      mimeType: string,
      analysis?: import('../types').PronunciationResult
    ): Promise<Recording | null> => {
      if (!session) return null;

      const nextAttemptNumber = session.attemptCount + 1;
      const newRecording: Recording = {
        id: `rec-${Date.now()}-${nextAttemptNumber}`,
        sessionId: session.id,
        exerciseId: session.exerciseId,
        blob: audioBlob,
        duration,
        mimeType,
        createdAt: new Date().toISOString(),
        attemptNumber: nextAttemptNumber,
        autoResult: analysis?.result,
        similarity: analysis?.similarity,
        analysisReason: analysis?.reason
      };

      await createRecording(newRecording);

      const isFinished = nextAttemptNumber >= (session.targetAttempts || targetAttempts);
      const updatedSession: PracticeSession = {
        ...session,
        attemptCount: nextAttemptNumber,
        status: isFinished ? 'COMPLETED' : 'IN_PROGRESS',
        completedAt: isFinished ? new Date().toISOString() : undefined
      };

      await updateSession(updatedSession);

      setSession(updatedSession);
      setRecordings(prev => [...prev, newRecording]);

      if (isFinished) {
        setIsCompleted(true);
      }

      return newRecording;
    },
    [session, targetAttempts]
  );

  const completeSessionManually = useCallback(async () => {
    if (!session) return;
    const updated: PracticeSession = {
      ...session,
      status: 'COMPLETED',
      completedAt: new Date().toISOString()
    };
    await updateSession(updated);
    setSession(updated);
    setIsCompleted(true);
  }, [session]);

  const restartSession = useCallback(async () => {
    return await initSession(true);
  }, [initSession]);

  const audioCorrectCount = recordings.filter(r => r.autoResult === 'CORRECT').length;
  const audioIncorrectCount = recordings.filter(r => r.autoResult === 'INCORRECT').length;
  const audioUncertainCount = recordings.filter(r => r.autoResult === 'UNCERTAIN').length;

  return {
    session,
    recordings,
    currentAttempt: (session?.attemptCount || 0) + 1,
    totalAttempts: session?.attemptCount || 0,
    targetAttempts: session?.targetAttempts || targetAttempts,
    isCompleted,
    loading,
    audioCorrectCount,
    audioIncorrectCount,
    audioUncertainCount,
    saveAttempt,
    completeSessionManually,
    restartSession
  };
}
