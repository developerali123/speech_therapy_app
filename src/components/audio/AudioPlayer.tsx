import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, RotateCcw, Volume2 } from 'lucide-react';
import { formatDurationSeconds } from '../../utils/audio';

interface AudioPlayerProps {
  blob?: Blob | null;
  src?: string;
  autoPlay?: boolean;
  className?: string;
  recordedDuration?: number;
  onEnded?: () => void;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  blob,
  src,
  autoPlay = false,
  className = '',
  recordedDuration,
  onEnded
}) => {
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [audioUrl, setAudioUrl] = useState<string>('');

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Manage safe Object URL lifecycle
  useEffect(() => {
    let createdUrl = '';

    if (blob) {
      try {
        if (typeof window !== 'undefined' && window.URL && typeof window.URL.createObjectURL === 'function') {
          createdUrl = window.URL.createObjectURL(blob);
          setAudioUrl(createdUrl);
        } else if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
          createdUrl = URL.createObjectURL(blob);
          setAudioUrl(createdUrl);
        }
      } catch (err) {
        console.warn('Audio createObjectURL error:', err);
      }
    } else if (src) {
      setAudioUrl(src);
    } else {
      setAudioUrl('');
    }

    return () => {
      if (createdUrl) {
        try {
          URL.revokeObjectURL(createdUrl);
        } catch {
          // ignore
        }
      }
    };
  }, [blob, src]);

  const togglePlay = useCallback(() => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch((err) => {
          console.warn('Audio play failed:', err);
          setIsPlaying(false);
        });
    }
  }, [isPlaying]);

  const handleReplay = useCallback(() => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = 0;
    audioRef.current
      .play()
      .then(() => setIsPlaying(true))
      .catch(() => setIsPlaying(false));
  }, []);

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      const dur = audioRef.current.duration;
      if (!isNaN(dur) && isFinite(dur)) {
        setDuration(dur);
      }
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const targetTime = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = targetTime;
      setCurrentTime(targetTime);
    }
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
    if (onEnded) onEnded();
  };


  const effectiveDuration = (duration > 0 && isFinite(duration)) ? duration : (recordedDuration && recordedDuration > 0 ? recordedDuration : 0);

  return (
    <div
      className={`bg-slate-50 border border-slate-200/90 rounded-2xl p-3 sm:p-4 flex flex-col gap-2.5 ${className}`}
      role="region"
      aria-label="Audio playback controls"
    >
      <audio
        ref={audioRef}
        src={audioUrl || undefined}
        autoPlay={autoPlay}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={handleAudioEnded}
      />

      <div className="flex items-center gap-2.5 sm:gap-3">
        {/* Play/Pause Button */}
        <button
          type="button"
          onClick={togglePlay}
          id="play-recording-btn"
          className="h-11 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white flex items-center justify-center gap-2 transition-all duration-150 active:scale-95 shadow-sm shadow-teal-700/20 cursor-pointer shrink-0 font-semibold text-sm touch-manipulation focus:outline-none focus:ring-2 focus:ring-teal-400"
          aria-label={isPlaying ? 'Pause recording' : 'Play recording'}
        >
          {isPlaying ? (
            <>
              <Pause className="w-4 h-4 fill-current" />
              <span>Pause</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-current ml-0.5" />
              <span>Play</span>
            </>
          )}
        </button>

        {/* Replay Button */}
        <button
          type="button"
          onClick={handleReplay}
          className="w-10 h-10 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors active:scale-95 cursor-pointer shrink-0"
          aria-label="Replay recording from start"
          title="Replay from start"
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        {/* Progress Slider */}
        <div className="flex-1 flex flex-col justify-center min-w-0">
          <div className="relative flex items-center w-full">
            <input
              type="range"
              min="0"
              max={effectiveDuration || 1}
              step="0.01"
              value={currentTime}
              onChange={handleSeek}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-teal-600 focus:outline-none"
              aria-label="Seek audio position"
            />
          </div>
          <div className="flex justify-between items-center text-[11px] font-mono text-slate-500 mt-1">
            <span>{formatDurationSeconds(currentTime)}</span>
            <span>{formatDurationSeconds(effectiveDuration)}</span>
          </div>
        </div>

        <div className="hidden sm:flex items-center text-slate-400 pl-1">
          <Volume2 className="w-4 h-4" />
        </div>
      </div>
    </div>
  );
};
