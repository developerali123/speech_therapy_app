import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, RotateCcw, Award, History, Info } from 'lucide-react';
import { Exercise } from '../../types';
import { usePracticeSession } from '../../hooks/usePracticeSession';
import { SpeechRecorder } from '../audio/SpeechRecorder';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { formatSessionDuration } from '../../utils/dates';

interface PracticeSessionProps {
  exercise: Exercise;
  targetAttempts?: number;
}

export const PracticeSessionComponent: React.FC<PracticeSessionProps> = ({
  exercise,
  targetAttempts = 10
}) => {
  const navigate = useNavigate();

  const {
    session,
    recordings,
    currentAttempt,
    totalAttempts,
    isCompleted,
    saveAttempt,
    completeSessionManually,
    restartSession
  } = usePracticeSession({
    exerciseId: exercise.id,
    targetAttempts
  });

  const handleSaveRecording = async (blob: Blob, duration: number, mimeType: string) => {
    await saveAttempt(blob, duration, mimeType);
  };

  // Review statistics of current session
  const reviewedCount = recordings.filter(r => !!r.therapistResult).length;
  const correctCount = recordings.filter(r => r.therapistResult === 'CORRECT').length;
  const incorrectCount = recordings.filter(r => r.therapistResult === 'INCORRECT').length;
  const uncertainCount = recordings.filter(r => r.therapistResult === 'UNCERTAIN').length;

  return (
    <div className="w-full max-w-xl mx-auto flex flex-col items-center">
      {/* Top Header Navigation */}
      <div className="w-full flex items-center justify-between py-2 mb-4">
        <button
          type="button"
          onClick={() => navigate('/home')}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 px-3 py-1.5 rounded-xl transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>

        <div className="text-center">
          <span className="text-xs font-bold text-teal-700 bg-teal-50 px-2.5 py-1 rounded-full border border-teal-200/50">
            {exercise.name}
          </span>
        </div>

        {/* If session has at least 1 attempt, allow early completion */}
        {totalAttempts > 0 && !isCompleted ? (
          <button
            type="button"
            onClick={completeSessionManually}
            className="text-xs font-medium text-slate-500 hover:text-teal-700 cursor-pointer"
          >
            Finish Early
          </button>
        ) : (
          <div className="w-16" />
        )}
      </div>

      {!isCompleted ? (
        <>
          {/* Practice Session Card */}
          <div className="w-full bg-white rounded-3xl border border-slate-200/90 shadow-sm p-6 sm:p-8 flex flex-col items-center text-center relative overflow-hidden">
            {/* Attempt Count Badge */}
            <div className="flex flex-col items-center gap-1 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Practice Session
              </span>
              <div className="text-sm font-semibold text-slate-900">
                Attempt {Math.min(currentAttempt, targetAttempts)} / {targetAttempts}
              </div>

              {/* Dot Indicators: ● ● ● ○ ○ ○ ○ ○ ○ ○ */}
              <div
                className="flex items-center gap-1.5 mt-2"
                aria-label={`Progress: ${totalAttempts} of ${targetAttempts} completed`}
              >
                {Array.from({ length: targetAttempts }).map((_, i) => (
                  <span
                    key={i}
                    className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                      i < totalAttempts
                        ? 'bg-teal-600 scale-110'
                        : i === totalAttempts
                        ? 'bg-teal-300 animate-pulse'
                        : 'bg-slate-200'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Target Display: LARGE "کا" */}
            <div className="my-6 py-4 px-8 bg-slate-50/70 border border-slate-100 rounded-3xl w-full flex flex-col items-center justify-center">
              <h1
                className="text-7xl sm:text-8xl md:text-9xl font-bold text-slate-900 font-arabic leading-none select-none tracking-normal py-2 text-center"
                dir="rtl"
                aria-label={`Target word: ${exercise.targetText}`}
              >
                {exercise.targetText}
              </h1>
            </div>

            {/* Subtitle / Clinical Instruction */}
            <p className="text-sm sm:text-base text-slate-600 max-w-sm leading-relaxed mb-4">
              Say the target sound as instructed by your speech therapist.
            </p>

            {/* Speech Recorder Component */}
            <SpeechRecorder
              onSaveAttempt={handleSaveRecording}
              targetText={exercise.targetText}
            />

            {/* Clinical Reminder Alert */}
            <div className="mt-6 flex items-start gap-2 text-left bg-teal-50/60 p-3 rounded-2xl border border-teal-100/80 text-[11px] text-teal-900">
              <Info className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
              <span>
                Tip: Speak naturally at your normal volume. Your recording will be stored locally for your review session.
              </span>
            </div>
          </div>
        </>
      ) : (
        /* SESSION COMPLETED SUMMARY */
        <Card className="w-full p-6 sm:p-8 text-center animate-in fade-in zoom-in-95 duration-200">
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-md shadow-emerald-600/10">
              <Award className="w-8 h-8" />
            </div>

            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">
                Well Done!
              </span>
              <h2 className="text-2xl font-bold text-slate-900 mt-2">
                Session Completed
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                {exercise.name} • {formatSessionDuration(session?.startedAt || '', session?.completedAt)}
              </p>
            </div>

            {/* Stats Breakdown */}
            <div className="w-full grid grid-cols-2 sm:grid-cols-4 gap-2.5 my-4">
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                <span className="text-[11px] text-slate-500 block">Total Attempts</span>
                <span className="text-lg font-bold text-slate-900">{totalAttempts}</span>
              </div>
              <div className="p-3 bg-emerald-50/60 rounded-2xl border border-emerald-100">
                <span className="text-[11px] text-emerald-700 block">Correct</span>
                <span className="text-lg font-bold text-emerald-800">{correctCount}</span>
              </div>
              <div className="p-3 bg-rose-50/60 rounded-2xl border border-rose-100">
                <span className="text-[11px] text-rose-700 block">Incorrect</span>
                <span className="text-lg font-bold text-rose-800">{incorrectCount}</span>
              </div>
              <div className="p-3 bg-amber-50/60 rounded-2xl border border-amber-100">
                <span className="text-[11px] text-amber-700 block">Uncertain</span>
                <span className="text-lg font-bold text-amber-800">{uncertainCount}</span>
              </div>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed max-w-sm">
              Reviewed: {reviewedCount} of {totalAttempts} attempts. You and your therapist can review any attempt in the History tab.
            </p>

            {/* Session Action Buttons */}
            <div className="w-full flex flex-col sm:flex-row gap-3 pt-3">
              <Button
                variant="outline"
                size="lg"
                fullWidth
                onClick={restartSession}
                leftIcon={<RotateCcw className="w-4 h-4" />}
              >
                Practice Again
              </Button>

              <Button
                variant="primary"
                size="lg"
                fullWidth
                onClick={() => navigate(session ? `/history/${session.id}` : '/history')}
                leftIcon={<History className="w-4 h-4" />}
              >
                View in History
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};
