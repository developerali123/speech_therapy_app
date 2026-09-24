import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Mic,
  Square,
  RefreshCw,
  ArrowRight,
  Check,
  X,
  HelpCircle,
  Activity,
  AlertCircle,
  Pause,
  Play
} from 'lucide-react';
import { useRecorder } from '../../hooks/useRecorder';
import { RecordingTimer } from './RecordingTimer';
import { analyzePronunciation } from '../../services/pronunciationAnalyzer';
import { PronunciationResult } from '../../types';
import { formatDurationSeconds } from '../../utils/audio';

interface SpeechRecorderProps {
  onSaveAttempt: (
    blob: Blob,
    duration: number,
    mimeType: string,
    analysis?: PronunciationResult
  ) => Promise<void>;
  targetText?: string;
  exerciseId?: string;
  isSavingAttempt?: boolean;
  onNextAttempt?: () => void;
  isSessionFinished?: boolean;
}

export const SpeechRecorder: React.FC<SpeechRecorderProps> = ({
  onSaveAttempt,
  targetText = 'کا',
  exerciseId = 'ex-qaf-ka-01',
  isSavingAttempt = false,
  onNextAttempt,
  isSessionFinished = false
}) => {
  const {
    state,
    duration,
    audioBlob,
    mimeType,
    errorMessage,
    startRecording,
    stopRecording,
    resetRecorder
  } = useRecorder();

  const [analysisResult, setAnalysisResult] = useState<PronunciationResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState<boolean>(false);
  const [hasSavedCurrentTake, setHasSavedCurrentTake] = useState<boolean>(false);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);

  // Clean audio URL helper
  const cleanAudioUrl = useCallback(() => {
    if (audioUrlRef.current) {
      try {
        URL.revokeObjectURL(audioUrlRef.current);
      } catch {
        // ignore
      }
      audioUrlRef.current = null;
    }
  }, []);

  // Trigger immediate analysis and auto-save attempt to IndexedDB
  useEffect(() => {
    let isMounted = true;

    if (state === 'recorded' && audioBlob && !hasSavedCurrentTake) {
      setIsAnalyzing(true);
      setAnalysisResult(null);

      // Create playback URL for the [ Listen ] button
      cleanAudioUrl();
      if (typeof window !== 'undefined' && window.URL && typeof window.URL.createObjectURL === 'function') {
        try {
          audioUrlRef.current = window.URL.createObjectURL(audioBlob);
        } catch {
          audioUrlRef.current = null;
        }
      }

      analyzePronunciation(audioBlob, exerciseId)
        .then(async (res) => {
          if (!isMounted) return;
          setAnalysisResult(res);
          setIsAnalyzing(false);
          setHasSavedCurrentTake(true);
          try {
            await onSaveAttempt(audioBlob, duration, mimeType, res);
          } catch (err) {
            console.error('Failed to auto-save practice attempt:', err);
          }
        })
        .catch(async (err) => {
          console.error('Audio analysis error:', err);
          if (!isMounted) return;
          const fallbackRes: PronunciationResult = {
            result: 'UNCERTAIN',
            similarity: 0,
            reason: 'Uncertain — please repeat or ask your speech therapist to review.'
          };
          setAnalysisResult(fallbackRes);
          setIsAnalyzing(false);
          setHasSavedCurrentTake(true);
          try {
            await onSaveAttempt(audioBlob, duration, mimeType, fallbackRes);
          } catch (saveErr) {
            console.error('Failed to save fallback attempt:', saveErr);
          }
        });
    } else if (state === 'idle') {
      setAnalysisResult(null);
      setIsAnalyzing(false);
      setHasSavedCurrentTake(false);
      setIsPlayingAudio(false);
      cleanAudioUrl();
    }

    return () => {
      isMounted = false;
    };
  }, [state, audioBlob, exerciseId, hasSavedCurrentTake, onSaveAttempt, duration, mimeType, cleanAudioUrl]);

  // Handle [ Listen ] toggle
  const handleToggleListen = () => {
    if (!audioPlayerRef.current && audioUrlRef.current) {
      audioPlayerRef.current = new Audio(audioUrlRef.current);
      audioPlayerRef.current.onended = () => setIsPlayingAudio(false);
      audioPlayerRef.current.onerror = () => setIsPlayingAudio(false);
    }

    if (audioPlayerRef.current) {
      if (isPlayingAudio) {
        audioPlayerRef.current.pause();
        setIsPlayingAudio(false);
      } else {
        audioPlayerRef.current.currentTime = 0;
        audioPlayerRef.current
          .play()
          .then(() => setIsPlayingAudio(true))
          .catch((e) => {
            console.warn('Audio play failed:', e);
            setIsPlayingAudio(false);
          });
      }
    }
  };

  // Next Attempt action
  const handleNextAttempt = () => {
    if (isPlayingAudio && audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      setIsPlayingAudio(false);
    }
    cleanAudioUrl();
    resetRecorder();
    if (onNextAttempt) {
      onNextAttempt();
    }
  };

  // Try Again action
  const handleTryAgain = () => {
    if (isPlayingAudio && audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      setIsPlayingAudio(false);
    }
    cleanAudioUrl();
    resetRecorder();
  };

  return (
    <div className="w-full flex flex-col items-center">
      {/* 1. IDLE STATE: Large [ 🎙 SPEAK ] Button */}
      {state === 'idle' && (
        <div className="flex flex-col items-center gap-4 my-4 w-full">
          <button
            type="button"
            onClick={startRecording}
            id="start-speak-btn"
            className="w-full max-w-xs sm:max-w-sm py-5 px-8 rounded-3xl bg-teal-600 hover:bg-teal-700 active:scale-95 text-white flex items-center justify-center gap-3 shadow-lg shadow-teal-700/25 transition-all duration-200 cursor-pointer group focus:outline-none focus:ring-4 focus:ring-teal-400/50 touch-manipulation"
            aria-label="Start recording"
          >
            <Mic className="w-8 h-8 sm:w-9 sm:h-9 group-hover:scale-110 transition-transform stroke-[2.5]" />
            <span className="sr-only">Start</span>
            <span className="text-xl sm:text-2xl font-extrabold tracking-wide uppercase">
              🎙 SPEAK
            </span>
          </button>
          <span className="text-xs sm:text-sm font-semibold text-slate-500">
            Tap button and say &ldquo;{targetText}&rdquo; clearly
          </span>
        </div>
      )}

      {/* 2. REQUESTING PERMISSION */}
      {state === 'requesting_permission' && (
        <div className="w-full max-w-sm text-center p-5 my-3 border border-teal-200 bg-teal-50/70 rounded-2xl shadow-xs animate-in fade-in">
          <div className="flex flex-col items-center gap-2.5">
            <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 animate-pulse">
              <Mic className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-slate-800 text-sm">Microphone Access Required</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Please tap &ldquo;Allow&rdquo; in your browser so the assistant can record your voice.
            </p>
          </div>
        </div>
      )}

      {/* 3. RECORDING STATE */}
      {state === 'recording' && (
        <div className="flex flex-col items-center gap-4 my-4 w-full animate-in fade-in duration-150">
          {/* Status Header: 🔴 Recording */}
          <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-rose-50 border border-rose-200 text-rose-700 font-semibold text-sm shadow-xs">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-600 animate-pulse" aria-hidden="true" />
            <span className="tracking-wide font-bold">🔴 Recording</span>
          </div>

          {/* Elapsed Time Counter */}
          <div
            className="text-4xl sm:text-5xl font-mono font-bold text-slate-900 tracking-wider py-1 select-none"
            aria-live="polite"
            aria-label={`Recording duration: ${duration.toFixed(1)} seconds`}
          >
            <RecordingTimer seconds={duration} isRecording={false} />
          </div>

          {/* Large Stop Button */}
          <button
            type="button"
            onClick={stopRecording}
            id="stop-recording-btn"
            className="w-full max-w-xs sm:max-w-sm py-4 px-8 rounded-3xl bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-bold text-lg sm:text-xl flex items-center justify-center gap-3 shadow-lg shadow-rose-600/30 transition-all duration-150 cursor-pointer focus:outline-none focus:ring-4 focus:ring-rose-400/50 touch-manipulation"
            aria-label="Stop recording"
          >
            <Square className="w-6 h-6 fill-current" />
            <span>Stop Recording</span>
          </button>
        </div>
      )}

      {/* 4. STOPPING / PROCESSING */}
      {state === 'stopping' && (
        <div className="flex flex-col items-center gap-3 my-6 animate-in fade-in">
          <div className="w-10 h-10 border-3 border-teal-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-semibold text-slate-600">Finalizing recording...</p>
        </div>
      )}

      {/* 5. RECORDED / ANALYZING / IMMEDIATE RESULT STATE */}
      {state === 'recorded' && audioBlob && (
        <div className="w-full max-w-md flex flex-col gap-4 my-2 animate-in fade-in zoom-in-95 duration-200">
          {/* A. ANALYZING IN PROGRESS */}
          {isAnalyzing ? (
            <div className="py-8 px-6 flex flex-col items-center justify-center text-center gap-3 bg-slate-50/90 rounded-3xl border border-slate-200/90">
              <div className="w-10 h-10 border-3 border-teal-600 border-t-transparent rounded-full animate-spin" />
              <div className="space-y-1">
                <p className="text-base font-bold text-slate-900 tracking-wide animate-pulse">
                  Analyzing...
                </p>
                <p className="text-xs text-slate-500 font-medium">
                  Evaluating sound characteristics against confirmed reference recordings
                </p>
              </div>
            </div>
          ) : (
            /* B. IMMEDIATE ANALYSIS FEEDBACK CARD */
            analysisResult && (
              <div
                className={`p-5 sm:p-6 rounded-3xl border text-center flex flex-col items-center gap-3.5 transition-all shadow-xs ${
                  analysisResult.result === 'CORRECT'
                    ? 'bg-emerald-50/90 border-emerald-200 text-emerald-950'
                    : analysisResult.result === 'INCORRECT'
                    ? 'bg-rose-50/90 border-rose-200 text-rose-950'
                    : 'bg-amber-50/90 border-amber-200 text-amber-950'
                }`}
                role="status"
                aria-live="polite"
              >
                {/* Result Tag & Sound Badge */}
                <div className="flex items-center gap-2.5 flex-wrap justify-center">
                  <span className="text-2xl font-arabic font-bold text-slate-900" aria-label={`Target: ${targetText}`}>
                    {targetText}
                  </span>

                  {analysisResult.result === 'CORRECT' && (
                    <div className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-emerald-100 text-emerald-800 font-extrabold text-sm sm:text-base shadow-2xs">
                      <Check className="w-5 h-5 stroke-[3]" />
                      <span>✓ CORRECT</span>
                    </div>
                  )}

                  {analysisResult.result === 'INCORRECT' && (
                    <div className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-rose-100 text-rose-800 font-extrabold text-sm sm:text-base shadow-2xs">
                      <X className="w-5 h-5 stroke-[3]" />
                      <span>✗ INCORRECT</span>
                    </div>
                  )}

                  {analysisResult.result === 'UNCERTAIN' && (
                    <div className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-amber-100 text-amber-900 font-extrabold text-sm sm:text-base shadow-2xs">
                      <HelpCircle className="w-5 h-5 stroke-[2.5]" />
                      <span>? UNCERTAIN</span>
                    </div>
                  )}

                  <span className="text-xs font-mono font-semibold text-slate-600 bg-white/90 px-2.5 py-1 rounded-lg border border-slate-200/70">
                    Audio-based result: {Math.round(analysisResult.similarity * 100)}% match
                  </span>
                </div>

                {/* Clear Feedback Message */}
                <p className="text-sm sm:text-base font-semibold leading-relaxed max-w-sm">
                  {analysisResult.reason}
                </p>

                {/* Required Clinical Limitation Notice */}
                <div className="flex items-start gap-1.5 text-[11px] text-slate-500 font-medium bg-white/80 p-2.5 rounded-xl border border-slate-200/60 text-left">
                  <Activity className="w-3.5 h-3.5 text-teal-600 shrink-0 mt-0.5" />
                  <span>Audio-based practice feedback. Confirm pronunciation with your speech therapist.</span>
                </div>

                {/* UX: Action Buttons with Obvious Next Action */}
                <div className="w-full flex flex-col gap-2.5 pt-2">
                  {/* Primary & Secondary Action based on Result */}
                  {analysisResult.result === 'CORRECT' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={handleNextAttempt}
                        disabled={isSavingAttempt}
                        id="next-attempt-btn"
                        className="py-3.5 px-5 rounded-2xl bg-teal-600 hover:bg-teal-700 active:scale-95 text-white font-bold text-sm sm:text-base flex items-center justify-center gap-2 shadow-md shadow-teal-700/20 transition cursor-pointer"
                      >
                        <span>{isSessionFinished ? 'Complete Session' : 'Next Attempt'}</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={handleTryAgain}
                        disabled={isSavingAttempt}
                        id="try-again-btn"
                        className="py-3.5 px-4 rounded-2xl bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold text-sm flex items-center justify-center gap-1.5 transition cursor-pointer"
                      >
                        <RefreshCw className="w-4 h-4 text-slate-500" />
                        <span>Try Again</span>
                      </button>
                    </div>
                  ) : (
                    /* INCORRECT or UNCERTAIN: [ Try Again ] is primary */
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={handleTryAgain}
                        disabled={isSavingAttempt}
                        id="try-again-btn"
                        className="py-3.5 px-5 rounded-2xl bg-teal-600 hover:bg-teal-700 active:scale-95 text-white font-bold text-sm sm:text-base flex items-center justify-center gap-2 shadow-md shadow-teal-700/20 transition cursor-pointer"
                      >
                        <RefreshCw className="w-4 h-4" />
                        <span>Try Again</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleNextAttempt}
                        disabled={isSavingAttempt}
                        id="next-attempt-btn"
                        className="py-3.5 px-4 rounded-2xl bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold text-sm flex items-center justify-center gap-1.5 transition cursor-pointer"
                      >
                        <span>Next Attempt</span>
                        <ArrowRight className="w-4 h-4 text-slate-500" />
                      </button>
                    </div>
                  )}

                  {/* Also Allow: [ Listen ] to Playback */}
                  <button
                    type="button"
                    onClick={handleToggleListen}
                    className="w-full py-2.5 px-4 rounded-xl bg-white/90 border border-slate-200 text-slate-700 hover:bg-white font-medium text-xs flex items-center justify-center gap-2 transition cursor-pointer"
                    id="listen-recording-btn"
                  >
                    {isPlayingAudio ? (
                      <>
                        <Pause className="w-3.5 h-3.5 fill-current text-teal-600" />
                        <span>Pause Playback</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5 fill-current text-teal-600" />
                        <span>Listen to Your Attempt ({formatDurationSeconds(duration)})</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )
          )}
        </div>
      )}

      {/* 6. ERROR STATE */}
      {state === 'error' && (
        <div className="w-full max-w-md p-5 border border-rose-200 bg-rose-50/70 rounded-2xl my-4 text-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-rose-100 flex items-center justify-center text-rose-600">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="font-semibold text-rose-900 text-sm">Microphone Notice</h3>
            <p className="text-xs text-rose-700 leading-relaxed max-w-xs">
              {errorMessage || 'Microphone permission is required to record your practice.'}
            </p>
            <div className="pt-2 flex gap-2">
              <button
                type="button"
                onClick={resetRecorder}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 cursor-pointer"
              >
                Dismiss
              </button>
              <button
                type="button"
                onClick={startRecording}
                className="px-4 py-1.5 text-xs font-bold text-white bg-teal-600 rounded-xl hover:bg-teal-700 shadow-xs cursor-pointer"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
