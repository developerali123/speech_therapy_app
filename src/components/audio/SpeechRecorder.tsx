import React, { useState } from 'react';
import { Mic, Square, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import { useRecorder } from '../../hooks/useRecorder';
import { AudioPlayer } from './AudioPlayer';
import { RecordingTimer } from './RecordingTimer';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { formatDurationSeconds } from '../../utils/audio';

interface SpeechRecorderProps {
  onSaveAttempt: (blob: Blob, duration: number, mimeType: string) => Promise<void>;
  targetText?: string;
  isSavingAttempt?: boolean;
}

export const SpeechRecorder: React.FC<SpeechRecorderProps> = ({
  onSaveAttempt,
  isSavingAttempt = false
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

  const [saveSuccessNotice, setSaveSuccessNotice] = useState<boolean>(false);

  const handleSave = async () => {
    if (!audioBlob) return;
    try {
      await onSaveAttempt(audioBlob, duration, mimeType);
      setSaveSuccessNotice(true);
      setTimeout(() => {
        setSaveSuccessNotice(false);
        resetRecorder();
      }, 700);
    } catch (err) {
      console.error('Failed to save attempt:', err);
    }
  };

  const handleRecordAgain = () => {
    resetRecorder();
  };

  return (
    <div className="w-full flex flex-col items-center">
      {/* 1. IDLE STATE */}
      {state === 'idle' && (
        <div className="flex flex-col items-center gap-5 my-4">
          <button
            type="button"
            onClick={startRecording}
            className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-teal-600 hover:bg-teal-700 active:scale-95 text-white flex flex-col items-center justify-center shadow-lg shadow-teal-700/25 transition-all duration-200 cursor-pointer group focus:outline-none focus:ring-4 focus:ring-teal-400/40"
            aria-label="Start recording"
          >
            <Mic className="w-10 h-10 sm:w-12 sm:h-12 group-hover:scale-110 transition-transform" />
          </button>
          <div className="text-center">
            <span className="inline-block text-xs font-bold uppercase tracking-wider text-teal-800 bg-teal-50 px-3.5 py-1.5 rounded-full border border-teal-200/60">
              Tap to Record
            </span>
          </div>
        </div>
      )}

      {/* 2. REQUESTING PERMISSION */}
      {state === 'requesting_permission' && (
        <Card className="w-full max-w-sm text-center p-6 my-4 border-teal-200 bg-teal-50/50">
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 animate-pulse">
              <Mic className="w-6 h-6" />
            </div>
            <h3 className="font-semibold text-slate-800 text-sm">Requesting Microphone Access</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Please tap &quot;Allow&quot; in your browser prompt so the assistant can record your practice attempt.
            </p>
          </div>
        </Card>
      )}

      {/* 3. RECORDING STATE */}
      {state === 'recording' && (
        <div className="flex flex-col items-center gap-6 my-4 w-full">
          {/* Animated Glowing Mic Button */}
          <div className="relative flex items-center justify-center">
            <div className="absolute w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-rose-500/20 animate-pulse-ring" />
            <button
              type="button"
              onClick={stopRecording}
              className="relative z-10 w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-rose-600 hover:bg-rose-700 active:scale-95 text-white flex flex-col items-center justify-center shadow-lg shadow-rose-700/30 transition-all duration-200 cursor-pointer focus:outline-none focus:ring-4 focus:ring-rose-400/40"
              aria-label="Stop recording"
            >
              <Square className="w-8 h-8 fill-current" />
            </button>
          </div>

          <div className="flex flex-col items-center gap-1.5">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-600 animate-ping" />
              <span className="text-xs font-bold uppercase tracking-wider text-rose-600">
                Recording...
              </span>
            </div>
            <RecordingTimer seconds={duration} isRecording={true} />
            <span className="text-xs text-slate-500 mt-1">Tap the red square to stop</span>
          </div>
        </div>
      )}

      {/* 4. STOPPING / FINALIZING */}
      {state === 'stopping' && (
        <div className="flex flex-col items-center gap-3 my-6">
          <div className="w-10 h-10 border-3 border-teal-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-600 font-medium">Processing audio...</p>
        </div>
      )}

      {/* 5. RECORDED STATE */}
      {state === 'recorded' && audioBlob && (
        <div className="w-full max-w-md flex flex-col gap-4 my-3 animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-teal-600" />
              <h3 className="text-sm font-bold text-slate-800">Your Recording</h3>
            </div>
            <span className="text-xs font-medium text-slate-500">
              Duration: {formatDurationSeconds(duration)}
            </span>
          </div>

          {/* Audio Playback Controls */}
          <AudioPlayer blob={audioBlob} />

          {/* Action buttons: Record Again vs Save Attempt */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={handleRecordAgain}
              disabled={isSavingAttempt}
              leftIcon={<RefreshCw className="w-4 h-4" />}
            >
              Record Again
            </Button>

            <Button
              type="button"
              variant="primary"
              size="lg"
              onClick={handleSave}
              isLoading={isSavingAttempt}
              leftIcon={<CheckCircle className="w-4 h-4" />}
            >
              Save Attempt
            </Button>
          </div>

          {saveSuccessNotice && (
            <div className="flex items-center justify-center gap-2 p-2.5 bg-emerald-50 text-emerald-800 rounded-xl text-xs font-medium animate-in fade-in">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              Attempt saved! Continuing session...
            </div>
          )}
        </div>
      )}

      {/* 6. ERROR STATE */}
      {state === 'error' && (
        <Card className="w-full max-w-md p-5 border-rose-200 bg-rose-50/50 my-4 text-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center text-rose-600">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="font-semibold text-rose-900 text-sm">Microphone Notice</h3>
            <p className="text-xs text-rose-700 leading-relaxed max-w-xs">
              {errorMessage || 'Microphone permission is required to record your practice.'}
            </p>
            <div className="pt-2 flex gap-2">
              <Button
                variant="outline"
                size="md"
                onClick={resetRecorder}
              >
                Dismiss
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={startRecording}
              >
                Try Again
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};
