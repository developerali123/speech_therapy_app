import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, RotateCcw, Award, History, CheckCircle2, XCircle, HelpCircle, Activity } from 'lucide-react';
import { Exercise } from '../../types';
import { usePracticeSession } from '../../hooks/usePracticeSession';
import { SpeechRecorder } from '../audio/SpeechRecorder';
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
    currentAttempt,
    totalAttempts,
    isCompleted,
    audioCorrectCount,
    audioIncorrectCount,
    audioUncertainCount,
    saveAttempt,
    completeSessionManually,
    restartSession
  } = usePracticeSession({
    exerciseId: exercise.id,
    targetAttempts
  });

  const handleSaveRecording = async (
    blob: Blob,
    duration: number,
    mimeType: string,
    analysis?: import('../../types').PronunciationResult
  ) => {
    await saveAttempt(blob, duration, mimeType, analysis);
  };

  // Percentage correct from automatic audio results
  const audioPercentage = totalAttempts > 0
    ? Math.round((audioCorrectCount / totalAttempts) * 100)
    : 0;

  // Active attempt indicator
  const displayAttempt = Math.min(Math.max(1, currentAttempt), targetAttempts);

  return (
    <div className="w-full max-w-xl mx-auto flex flex-col items-center px-2 sm:px-0">
      {/* Top Header Navigation */}
      <div className="w-full flex items-center justify-between py-2 mb-3">
        <button
          type="button"
          onClick={() => navigate('/home')}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 px-3 py-1.5 rounded-xl transition-colors cursor-pointer shadow-2xs"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>

        <span className="text-xs font-bold text-teal-800 bg-teal-50 px-3 py-1 rounded-full border border-teal-200/60">
          {exercise.name}
        </span>

        {!isCompleted ? (
          <button
            type="button"
            onClick={completeSessionManually}
            id="finish-early-btn"
            className="text-xs font-semibold text-slate-600 hover:text-teal-700 bg-white border border-slate-200 hover:border-teal-300 px-3 py-1.5 rounded-xl transition-all cursor-pointer shadow-2xs"
          >
            Finish Early
          </button>
        ) : (
          <div className="w-16" />
        )}
      </div>

      {!isCompleted ? (
        /* ACTIVE ONE-BY-ONE PRACTICE VIEW */
        <div className="w-full bg-white rounded-3xl border border-slate-200/90 shadow-sm p-5 sm:p-8 flex flex-col items-center text-center relative overflow-hidden">
          {/* PRACTICE COUNTER */}
          <div className="w-full flex flex-col items-center gap-2 mb-2">
            <div className="flex items-center justify-between w-full max-w-xs text-xs font-bold uppercase tracking-wider text-slate-500">
              <span>Practice Counter</span>
              <span className="font-mono text-slate-800 text-sm font-extrabold">
                Attempt: {displayAttempt} / {targetAttempts}
              </span>
            </div>

            {/* Live Tallies After Each Result */}
            <div className="flex items-center justify-center gap-3 sm:gap-4 py-1.5 px-3 bg-slate-50 rounded-2xl border border-slate-100 text-xs font-semibold w-full max-w-sm">
              <span className="inline-flex items-center gap-1 text-emerald-700">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Correct: <strong className="font-mono font-bold text-emerald-800">{audioCorrectCount}</strong>
              </span>
              <span className="text-slate-200">•</span>
              <span className="inline-flex items-center gap-1 text-rose-700">
                <XCircle className="w-3.5 h-3.5" />
                Incorrect: <strong className="font-mono font-bold text-rose-800">{audioIncorrectCount}</strong>
              </span>
              <span className="text-slate-200">•</span>
              <span className="inline-flex items-center gap-1 text-amber-700">
                <HelpCircle className="w-3.5 h-3.5" />
                Uncertain: <strong className="font-mono font-bold text-amber-800">{audioUncertainCount}</strong>
              </span>
            </div>

            {/* Visual Dot Progress Bar */}
            <div
              className="flex items-center gap-1.5 mt-1"
              aria-label={`Progress: ${totalAttempts} of ${targetAttempts} completed`}
            >
              {Array.from({ length: targetAttempts }).map((_, i) => (
                <span
                  key={i}
                  className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                    i < totalAttempts
                      ? 'bg-teal-600 scale-105'
                      : i === totalAttempts
                      ? 'bg-teal-400 animate-pulse'
                      : 'bg-slate-200'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* LARGE TARGET DISPLAY: "کا" */}
          <div className="my-4 py-6 px-8 bg-slate-50/90 border border-slate-100 rounded-3xl w-full flex flex-col items-center justify-center shadow-inner">
            <h1
              className="text-7xl sm:text-8xl md:text-9xl font-bold text-slate-900 font-arabic leading-none select-none tracking-normal py-2 text-center"
              dir="rtl"
              aria-label={`Target word: ${exercise.targetText}`}
            >
              {exercise.targetText}
            </h1>
            <span className="text-xs sm:text-sm font-semibold text-slate-500 mt-1">
              Qaf Practice • [kaː]
            </span>
          </div>

          <p className="text-xs sm:text-sm text-slate-600 max-w-sm leading-relaxed mb-3 text-center font-medium">
            Say the target sound as instructed by your speech therapist.
          </p>

          {/* STREAMLINED ONE-BY-ONE SPEECH RECORDER */}
          <SpeechRecorder
            onSaveAttempt={handleSaveRecording}
            targetText={exercise.targetText}
            exerciseId={exercise.id}
            onNextAttempt={() => {
              if (totalAttempts >= targetAttempts) {
                completeSessionManually();
              }
            }}
            isSessionFinished={totalAttempts >= targetAttempts}
          />
        </div>
      ) : (
        /* SESSION SUMMARY SCREEN */
        <div className="w-full bg-white rounded-3xl border border-slate-200/90 shadow-sm p-6 sm:p-8 text-center animate-in fade-in zoom-in-95 duration-200">
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-md shadow-emerald-600/15">
              <Award className="w-8 h-8" />
            </div>

            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200/60">
                Session Completed
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-2">
                Today&apos;s Practice
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {exercise.name} • {formatSessionDuration(session?.startedAt || '', session?.completedAt)}
              </p>
            </div>

            {/* Total Attempts and Breakdown */}
            <div className="w-full max-w-md p-4 bg-slate-50 rounded-2xl border border-slate-200/70 space-y-3">
              <div className="flex justify-between items-baseline border-b border-slate-200/70 pb-2.5">
                <span className="text-sm font-semibold text-slate-600">Total Attempts</span>
                <span className="text-xl font-extrabold text-slate-900 font-mono">
                  {totalAttempts} attempts
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="p-3 bg-white rounded-xl border border-emerald-200 text-center">
                  <span className="text-xs text-emerald-700 font-bold block">Correct</span>
                  <span className="text-xl font-extrabold text-emerald-700 font-mono">{audioCorrectCount}</span>
                </div>
                <div className="p-3 bg-white rounded-xl border border-rose-200 text-center">
                  <span className="text-xs text-rose-700 font-bold block">Incorrect</span>
                  <span className="text-xl font-extrabold text-rose-700 font-mono">{audioIncorrectCount}</span>
                </div>
                <div className="p-3 bg-white rounded-xl border border-amber-200 text-center">
                  <span className="text-xs text-amber-700 font-bold block">Uncertain</span>
                  <span className="text-xl font-extrabold text-amber-700 font-mono">{audioUncertainCount}</span>
                </div>
              </div>

              {/* Accuracy Percentage */}
              <div className="pt-2 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">Audio-based Correct Rate:</span>
                <span className="text-lg font-extrabold text-teal-700 font-mono">
                  {audioPercentage}%
                </span>
              </div>

              {/* Visual Split Progress Bar */}
              <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden flex">
                {audioCorrectCount > 0 && (
                  <div
                    style={{ width: `${(audioCorrectCount / totalAttempts) * 100}%` }}
                    className="bg-emerald-500 h-full transition-all"
                    title={`Correct: ${audioCorrectCount}`}
                  />
                )}
                {audioIncorrectCount > 0 && (
                  <div
                    style={{ width: `${(audioIncorrectCount / totalAttempts) * 100}%` }}
                    className="bg-rose-500 h-full transition-all"
                    title={`Incorrect: ${audioIncorrectCount}`}
                  />
                )}
                {audioUncertainCount > 0 && (
                  <div
                    style={{ width: `${(audioUncertainCount / totalAttempts) * 100}%` }}
                    className="bg-amber-400 h-full transition-all"
                    title={`Uncertain: ${audioUncertainCount}`}
                  />
                )}
              </div>
            </div>

            {/* MANDATORY NOTICE: Automatic result clearly labeled */}
            <div className="w-full max-w-md p-3 rounded-2xl bg-amber-50/80 border border-amber-200 text-left flex items-start gap-2.5 text-xs text-amber-950">
              <Activity className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">Audio-based result</span>
                <p className="text-amber-900/90 text-[11px] leading-relaxed">
                  These statistics represent automated audio comparisons. They are not therapist-confirmed. Confirm pronunciation with your speech therapist.
                </p>
              </div>
            </div>

            {/* Action Buttons: Practice Again vs View in History */}
            <div className="w-full max-w-md flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="button"
                onClick={restartSession}
                className="flex-1 py-3.5 px-5 rounded-2xl bg-white border border-slate-300 text-slate-800 hover:bg-slate-50 font-bold text-sm flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <RotateCcw className="w-4 h-4 text-slate-500" />
                <span>Practice Again</span>
              </button>

              <button
                type="button"
                onClick={() => navigate(session ? `/history/${session.id}` : '/history')}
                className="flex-1 py-3.5 px-5 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md shadow-teal-700/20 transition cursor-pointer"
              >
                <History className="w-4 h-4" />
                <span>View in History</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
