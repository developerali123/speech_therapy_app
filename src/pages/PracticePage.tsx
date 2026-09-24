import React from 'react';
import { useParams } from 'react-router-dom';
import { useExercises } from '../hooks/useExercises';
import { useSettings } from '../hooks/useSettings';
import { PracticeSessionComponent } from '../components/practice/PracticeSession';
import { Card } from '../components/ui/Card';

export const PracticePage: React.FC = () => {
  const { exerciseId } = useParams<{ exerciseId?: string }>();
  const { exercises, activeExercise, loading } = useExercises();
  const { settings } = useSettings();

  const currentExercise = exerciseId
    ? exercises.find((e) => e.id === exerciseId) || activeExercise
    : activeExercise;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-10 h-10 border-3 border-teal-600 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-medium text-slate-500">Preparing practice session...</p>
      </div>
    );
  }

  if (!currentExercise) {
    return (
      <Card className="p-8 text-center max-w-md mx-auto my-12">
        <h3 className="text-base font-bold text-slate-900">Exercise Not Found</h3>
        <p className="text-xs text-slate-500 mt-2">
          Could not locate the requested exercise. Please return to the home screen.
        </p>
      </Card>
    );
  }

  return (
    <div className="w-full flex justify-center py-2">
      <PracticeSessionComponent
        exercise={currentExercise}
        targetAttempts={settings.dailyGoal || 10}
      />
    </div>
  );
};
