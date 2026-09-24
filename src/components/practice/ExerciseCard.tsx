import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Sparkles } from 'lucide-react';
import { Exercise } from '../../types';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';

interface ExerciseCardProps {
  exercise: Exercise;
  className?: string;
}

export const ExerciseCard: React.FC<ExerciseCardProps> = ({ exercise, className = '' }) => {
  const navigate = useNavigate();

  return (
    <Card
      variant="default"
      padding="lg"
      className={`border-teal-100 bg-gradient-to-br from-white via-teal-50/20 to-teal-50/40 relative overflow-hidden ${className}`}
    >
      {/* Background soft ambient accent */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-teal-100/40 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />

      <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div className="flex-1 space-y-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-teal-700 bg-teal-100/70 px-2.5 py-0.5 rounded-full">
              <Sparkles className="w-3 h-3" /> Target Exercise
            </span>
            {exercise.phonemeTarget && (
              <span className="text-xs font-semibold text-slate-400">
                Phoneme: {exercise.phonemeTarget}
              </span>
            )}
          </div>

          <div>
            <h3 className="text-xl font-bold text-slate-900 leading-snug">
              {exercise.name}
            </h3>
            <p className="text-sm text-slate-600 mt-1 leading-relaxed">
              {exercise.description}
            </p>
          </div>

          <div className="pt-1">
            <Button
              variant="primary"
              size="lg"
              onClick={() => navigate(`/practice/${exercise.id}`)}
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              Practice Now
            </Button>
          </div>
        </div>

        {/* Large Target Badge for Mobile and Desktop */}
        <div className="w-full sm:w-auto flex sm:flex-col items-center justify-center p-4 bg-white/90 border border-teal-200/80 rounded-2xl shadow-xs shrink-0 self-center">
          <span className="text-xs text-slate-400 font-medium mb-1">Target</span>
          <div
            className="text-5xl sm:text-6xl font-bold text-teal-900 font-arabic px-4 py-1 leading-none select-none"
            dir="rtl"
            aria-label={`Target sound: ${exercise.targetText}`}
          >
            {exercise.targetText}
          </div>
        </div>
      </div>
    </Card>
  );
};
