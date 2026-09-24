import { useState, useEffect, useCallback } from 'react';
import { Exercise } from '../types';
import { getExercises, seedExercises, getExerciseById } from '../storage/exerciseRepository';

export function useExercises() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadExercises = useCallback(async () => {
    try {
      setLoading(true);
      await seedExercises();
      const list = await getExercises();
      setExercises(list);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load exercises');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadExercises();
  }, [loadExercises]);

  const activeExercise = exercises.find(e => e.isActive) || exercises[0];

  return {
    exercises,
    activeExercise,
    loading,
    error,
    refreshExercises: loadExercises,
    getExerciseById
  };
}
