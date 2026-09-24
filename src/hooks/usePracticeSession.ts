import { useState, useEffect, useCallback } from 'react';
import { PracticeSession, Recording } from '../types';
import {
  createSession,
  updateSession
} from '../storage/sessionRepository';
import {
  createRecording
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

  // Initialize or resume session
  const initSession = useCallback(async () => {
    setLoading(true);
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
  }, [exerciseId, targetAttempts]);

  useEffect(() => {
    initSession();
  }, [initSession]);

  const saveAttempt = useCallback(
    async (audioBlob: Blob, duration: number, mimeType: string): Promise<Recording | null> => {
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
        attemptNumber: nextAttemptNumber
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
    return await initSession();
  }, [initSession]);

  return {
    session,
    recordings,
    currentAttempt: (session?.attemptCount || 0) + 1,
    totalAttempts: session?.attemptCount || 0,
    targetAttempts: session?.targetAttempts || targetAttempts,
    isCompleted,
    loading,
    saveAttempt,
    completeSessionManually,
    restartSession
  };
}
