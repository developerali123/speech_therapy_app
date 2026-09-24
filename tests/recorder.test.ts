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
});
