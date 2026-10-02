import { useState, useEffect, useCallback } from 'react';
import { PracticeSession, Recording, Exercise } from '../types';
import {
  createSession,
  updateSession,
  getLatestInProgressSession
} from '../storage/sessionRepository';
import {
  createRecording,
  getRecordingsBySession
} from '../storage/recordingRepository';
import { getExerciseById } from '../storage/exerciseRepository';

interface UsePracticeSessionOptions {
  exerciseId: string;
  exercise?: Exercise;
  targetAttempts?: number;
  targetRepetitions?: number;
}

export function usePracticeSession({
  exerciseId,
  exercise: initialExercise,
  targetAttempts = 10,
  targetRepetitions
}: UsePracticeSessionOptions) {
  const [exercise, setExercise] = useState<Exercise | null>(initialExercise || null);
  const [session, setSession] = useState<PracticeSession | null>(null);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  const effectiveTargetReps = targetRepetitions ?? targetAttempts ?? 10;

  // Resolve exercise targetUnits
  useEffect(() => {
    if (initialExercise) {
      setExercise(initialExercise);
      return;
    }
    let isMounted = true;
    getExerciseById(exerciseId).then((found) => {
      if (isMounted && found) {
        setExercise(found);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [exerciseId, initialExercise]);

  // Initialize or resume session from IndexedDB
  const initSession = useCallback(
    async (forceNew = false) => {
      setLoading(true);
      try {
        const loadedExercise = exercise || (await getExerciseById(exerciseId));
        if (loadedExercise) {
          setExercise(loadedExercise);
        }

        const targetUnits = loadedExercise?.targetUnits && loadedExercise.targetUnits.length > 0
          ? loadedExercise.targetUnits
          : [loadedExercise?.targetText || 'کا'];
        const totalTargetUnits = targetUnits.length;

        if (!forceNew) {
          const inProgress = await getLatestInProgressSession(exerciseId);
          if (inProgress) {
            const existingRecs = await getRecordingsBySession(inProgress.id);
            const normalizedSession: PracticeSession = {
              ...inProgress,
              targetUnits: inProgress.targetUnits || targetUnits,
              totalTargetUnits: inProgress.totalTargetUnits || totalTargetUnits,
              currentUnitIndex: inProgress.currentUnitIndex ?? 0,
              currentRepetition: inProgress.currentRepetition ?? ((inProgress.attemptCount || 0) + 1),
              targetRepetitions: inProgress.targetRepetitions ?? inProgress.targetAttempts ?? effectiveTargetReps,
              completedRepetitions: inProgress.completedRepetitions ?? inProgress.attemptCount ?? 0,
              attemptCount: inProgress.attemptCount ?? 0,
              targetAttempts: inProgress.targetAttempts ?? effectiveTargetReps
            };
            setSession(normalizedSession);
            setRecordings(existingRecs);
            setIsCompleted(inProgress.status === 'COMPLETED');
            setLoading(false);
            return normalizedSession;
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
          targetUnits,
          totalTargetUnits,
          currentUnitIndex: 0,
          currentRepetition: 1,
          targetRepetitions: effectiveTargetReps,
          completedRepetitions: 0,
          startedAt: new Date().toISOString(),
          status: 'IN_PROGRESS',
          attemptCount: 0,
          targetAttempts: effectiveTargetReps
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
    },
    [exerciseId, exercise, effectiveTargetReps]
  );

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

      const currentCompleted = session.completedRepetitions ?? session.attemptCount ?? 0;
      const nextRepetitionNumber = currentCompleted + 1;
      const targetReps = session.targetRepetitions || session.targetAttempts || effectiveTargetReps;

      const newRecording: Recording = {
        id: `rec-${Date.now()}-${nextRepetitionNumber}`,
        sessionId: session.id,
        exerciseId: session.exerciseId,
        blob: audioBlob,
        duration,
        mimeType,
        createdAt: new Date().toISOString(),
        attemptNumber: nextRepetitionNumber,
        autoResult: analysis?.result,
        similarity: analysis?.similarity,
        analysisReason: analysis?.reason,
        assessmentMethod: analysis?.assessmentMethod ?? 'ML',
        modelVersion: analysis?.modelVersion,
        pronunciationScore: analysis?.pronunciationScore,
        confidence: analysis?.confidence ?? analysis?.similarity,
        unitResults: analysis?.unitResults
      };

      await createRecording(newRecording);

      const isFinished = nextRepetitionNumber >= targetReps;
      const updatedSession: PracticeSession = {
        ...session,
        attemptCount: nextRepetitionNumber,
        completedRepetitions: nextRepetitionNumber,
        currentRepetition: isFinished ? nextRepetitionNumber : nextRepetitionNumber + 1,
        targetRepetitions: targetReps,
        targetAttempts: targetReps,
        status: isFinished ? 'COMPLETED' : 'IN_PROGRESS',
        completedAt: isFinished ? new Date().toISOString() : undefined
      };

      await updateSession(updatedSession);

      setSession(updatedSession);
      setRecordings((prev) => [...prev, newRecording]);

      if (isFinished) {
        setIsCompleted(true);
      }

      return newRecording;
    },
    [session, effectiveTargetReps]
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

  const audioCorrectCount = recordings.filter((r) => r.autoResult === 'CORRECT').length;
  const audioIncorrectCount = recordings.filter((r) => r.autoResult === 'INCORRECT' || r.autoResult === 'NEEDS_PRACTICE').length;
  const audioUncertainCount = recordings.filter((r) => r.autoResult === 'UNCERTAIN').length;

  const targetUnits = session?.targetUnits || exercise?.targetUnits || [exercise?.targetText || 'کا'];
  const totalTargetUnits = session?.totalTargetUnits || targetUnits.length;
  const completedRepetitions = session?.completedRepetitions ?? session?.attemptCount ?? 0;
  const currentRepetition = Math.min(completedRepetitions + 1, session?.targetRepetitions || effectiveTargetReps);
  const targetReps = session?.targetRepetitions || session?.targetAttempts || effectiveTargetReps;

  return {
    session,
    recordings,
    exercise,
    targetUnits,
    totalTargetUnits,
    currentUnitIndex: session?.currentUnitIndex ?? 0,
    currentRepetition,
    completedRepetitions,
    targetRepetitions: targetReps,
    currentAttempt: completedRepetitions + 1,
    totalAttempts: completedRepetitions,
    targetAttempts: targetReps,
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
