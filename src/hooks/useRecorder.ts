import { useState, useRef, useCallback, useEffect } from 'react';
import { getSupportedMimeType } from '../utils/audio';

export type RecorderState =
  | 'idle'
  | 'requesting_permission'
  | 'recording'
  | 'stopping'
  | 'recorded'
  | 'error';

export interface RecorderHookResult {
  state: RecorderState;
  duration: number; // in seconds
  audioBlob: Blob | null;
  mimeType: string;
  errorMessage: string | null;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  resetRecorder: () => void;
  isSupported: boolean;
}

export function useRecorder(): RecorderHookResult {
  const [state, setState] = useState<RecorderState>('idle');
  const [duration, setDuration] = useState<number>(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [mimeType, setMimeType] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);

  const isSupported = typeof window !== 'undefined' &&
    !!(navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function' && window.MediaRecorder);

  const stopTracks = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
  }, []);

  const clearTimer = useCallback(() => {
    if (timerIntervalRef.current !== null) {
      window.clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  }, []);

  const resetRecorder = useCallback(() => {
    clearTimer();
    stopTracks();
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // ignore
      }
    }
    mediaRecorderRef.current = null;
    audioChunksRef.current = [];
    setAudioBlob(null);
    setDuration(0);
    setErrorMessage(null);
    setState('idle');
  }, [clearTimer, stopTracks]);

  const startRecording = useCallback(async () => {
    if (!isSupported) {
      setState('error');
      setErrorMessage('Audio recording is not supported in this browser. Please use Chrome, Safari, Edge, or Firefox.');
      return;
    }

    try {
      resetRecorder();
      setState('requesting_permission');
      setErrorMessage(null);

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      // Verify that at least one audio track exists
      if (!stream.getAudioTracks() || stream.getAudioTracks().length === 0) {
        throw new DOMException('No audio tracks found', 'NotFoundError');
      }

      mediaStreamRef.current = stream;

      const chosenMime = getSupportedMimeType();
      let recorder: MediaRecorder;
      try {
        const options: MediaRecorderOptions = chosenMime ? { mimeType: chosenMime } : {};
        recorder = new MediaRecorder(stream, options);
      } catch {
        // Fallback without explicit mimeType if specific codec parameter is rejected by browser engine
        recorder = new MediaRecorder(stream);
      }

      mediaRecorderRef.current = recorder;
      setMimeType(recorder.mimeType || chosenMime || 'audio/webm');
      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        clearTimer();
        stopTracks();

        const actualDuration = (Date.now() - startTimeRef.current) / 1000;
        const finalDuration = Math.max(0.1, Number(actualDuration.toFixed(2)));
        setDuration(finalDuration);

        // Check for captured audio
        if (audioChunksRef.current.length === 0) {
          setState('error');
          setErrorMessage('Recording failure: No audio data was captured. Please speak into your microphone and try again.');
          return;
        }

        const finalBlob = new Blob(audioChunksRef.current, {
          type: recorder.mimeType || chosenMime || 'audio/webm'
        });

        setAudioBlob(finalBlob);
        setState('recorded');
      };

      recorder.onerror = () => {
        clearTimer();
        stopTracks();
        setState('error');
        setErrorMessage('Recording failure: could not capture audio. Please try again.');
      };

      recorder.start(100); // 100ms timeslices for reliable collection
      startTimeRef.current = Date.now();
      setState('recording');

      // High-precision live duration timer
      timerIntervalRef.current = window.setInterval(() => {
        const elapsed = (Date.now() - startTimeRef.current) / 1000;
        setDuration(elapsed);
      }, 50);

    } catch (err: unknown) {
      clearTimer();
      stopTracks();
      setState('error');

      if (err instanceof DOMException) {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setErrorMessage('Microphone permission is required to record your practice.');
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          setErrorMessage('No microphone was found on this device. Please connect an audio input.');
        } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
          setErrorMessage('Microphone is busy or already in use by another application.');
        } else if (err.name === 'NotSupportedError') {
          setErrorMessage('MediaRecorder is unsupported or the selected audio format is not supported in this browser.');
        } else if (err.name === 'SecurityError') {
          setErrorMessage('Microphone access blocked due to security restrictions.');
        } else {
          setErrorMessage('Could not access microphone. Please check your browser audio settings.');
        }
      } else if (err instanceof Error && err.name === 'NotSupportedError') {
        setErrorMessage('MediaRecorder is unsupported or the selected audio format is not supported in this browser.');
      } else {
        setErrorMessage('Could not start recording. Please try again.');
      }
    }
  }, [isSupported, resetRecorder, clearTimer, stopTracks]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      setState('stopping');
      try {
        mediaRecorderRef.current.stop();
      } catch {
        clearTimer();
        stopTracks();
        setState('error');
        setErrorMessage('Recording failure while stopping. Please try again.');
      }
    }
  }, [clearTimer, stopTracks]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimer();
      stopTracks();
    };
  }, [clearTimer, stopTracks]);

  return {
    state,
    duration,
    audioBlob,
    mimeType,
    errorMessage,
    startRecording,
    stopRecording,
    resetRecorder,
    isSupported
  };
}
