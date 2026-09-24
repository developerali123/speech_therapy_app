import React from 'react';
import { formatTimeCode } from '../../utils/audio';

interface RecordingTimerProps {
  seconds: number;
  isRecording?: boolean;
}

export const RecordingTimer: React.FC<RecordingTimerProps> = ({ seconds, isRecording = false }) => {
  return (
    <div className="flex items-center gap-2 font-mono text-lg font-bold text-slate-800">
      {isRecording && (
        <span className="w-3 h-3 rounded-full bg-rose-500 animate-pulse" aria-hidden="true" />
      )}
      <span aria-live="polite" aria-label={`Recording duration: ${seconds.toFixed(1)} seconds`}>
        {formatTimeCode(seconds)}
      </span>
    </div>
  );
};
