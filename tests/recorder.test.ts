import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRecorder } from '../src/hooks/useRecorder';

describe('useRecorder hook', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('starts in idle state with duration 0 and null blob', () => {
    const { result } = renderHook(() => useRecorder());
    expect(result.current.state).toBe('idle');
    expect(result.current.duration).toBe(0);
    expect(result.current.audioBlob).toBeNull();
    expect(result.current.errorMessage).toBeNull();
  });

  it('handles permission denied with friendly message', async () => {
    // Mock getUserMedia rejection with NotAllowedError
    const permissionError = new DOMException('Permission denied', 'NotAllowedError');
    const getUserMediaMock = vi.fn().mockRejectedValue(permissionError);

    Object.defineProperty(global.navigator, 'mediaDevices', {
      value: { getUserMedia: getUserMediaMock },
      configurable: true
    });
    // @ts-expect-error Mock MediaRecorder on window
    global.window.MediaRecorder = class {};

    const { result } = renderHook(() => useRecorder());

    await act(async () => {
      await result.current.startRecording();
    });

    expect(result.current.state).toBe('error');
    expect(result.current.errorMessage).toBe('Microphone permission is required to record your practice.');
  });

  it('handles missing microphone with friendly message', async () => {
    const notFoundError = new DOMException('Requested device not found', 'NotFoundError');
    const getUserMediaMock = vi.fn().mockRejectedValue(notFoundError);

    Object.defineProperty(global.navigator, 'mediaDevices', {
      value: { getUserMedia: getUserMediaMock },
      configurable: true
    });
    // @ts-expect-error Mock MediaRecorder on window
    global.window.MediaRecorder = class {};

    const { result } = renderHook(() => useRecorder());

    await act(async () => {
      await result.current.startRecording();
    });

    expect(result.current.state).toBe('error');
    expect(result.current.errorMessage).toBe('No microphone was found on this device. Please connect an audio input.');
  });

  it('handles unsupported MediaRecorder gracefully', async () => {
    // Delete MediaRecorder from window
    const originalMediaRecorder = global.window.MediaRecorder;
    // @ts-expect-error test unsupported case
    delete global.window.MediaRecorder;

    const { result } = renderHook(() => useRecorder());

    await act(async () => {
      await result.current.startRecording();
    });

    expect(result.current.state).toBe('error');
    expect(result.current.errorMessage).toContain('Audio recording is not supported');

    global.window.MediaRecorder = originalMediaRecorder;
  });

  it('completes a full recording lifecycle: start -> record -> stop -> recorded -> reset', async () => {
    const mockTrack = { stop: vi.fn() };
    const mockStream = {
      getTracks: () => [mockTrack],
      getAudioTracks: () => [mockTrack]
    };

    const getUserMediaMock = vi.fn().mockResolvedValue(mockStream);
    Object.defineProperty(global.navigator, 'mediaDevices', {
      value: { getUserMedia: getUserMediaMock },
      configurable: true
    });

    let onDataAvailableHandler: ((e: { data: Blob }) => void) | null = null;
    let onStopHandler: (() => void) | null = null;

    class MockMediaRecorder {
      state = 'inactive';
      mimeType = 'audio/webm;codecs=opus';
      static isTypeSupported = vi.fn().mockReturnValue(true);

      start() {
        this.state = 'recording';
      }
      stop() {
        this.state = 'inactive';
        if (onDataAvailableHandler) {
          onDataAvailableHandler({ data: new Blob(['fake-audio-bytes'], { type: 'audio/webm' }) });
        }
        if (onStopHandler) {
          onStopHandler();
        }
      }
      set ondataavailable(fn: (e: { data: Blob }) => void) {
        onDataAvailableHandler = fn;
      }
      set onstop(fn: () => void) {
        onStopHandler = fn;
      }
      set onerror(_fn: unknown) {
        // no-op
      }
    }

    // @ts-expect-error Mock MediaRecorder
    global.window.MediaRecorder = MockMediaRecorder;

    const { result } = renderHook(() => useRecorder());

    // 1. Start recording
    await act(async () => {
      await result.current.startRecording();
    });

    expect(result.current.state).toBe('recording');

    // 2. Stop recording
    act(() => {
      result.current.stopRecording();
    });

    expect(result.current.state).toBe('recorded');
    expect(result.current.audioBlob).not.toBeNull();
    expect(result.current.duration).toBeGreaterThan(0);

    // 3. Reset / Record Again
    act(() => {
      result.current.resetRecorder();
    });

    expect(result.current.state).toBe('idle');
    expect(result.current.audioBlob).toBeNull();
    expect(result.current.duration).toBe(0);
  });
});
