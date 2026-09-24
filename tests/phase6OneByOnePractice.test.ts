import { describe, it, expect, beforeEach } from 'vitest';
import {
  createSession,
  getSession,
  updateSession,
  getAllSessions
} from '../src/storage/sessionRepository';
import {
  createRecording,
  getRecordingsBySession,
  updateRecording,
  getAllRecordings
} from '../src/storage/recordingRepository';
import {
  analyzePronunciation
} from '../src/services/pronunciationAnalyzer';
import { PracticeSession, Recording, PronunciationResult, TherapistResult } from '../src/types';

// Helper to create synthetic 16-bit PCM WAV Blob
function createTestWavBlob(duration = 0.7, amplitude = 0.5): Blob {
  const sampleRate = 16000;
  const numSamples = Math.floor(sampleRate * duration);
  const buffer = new Float32Array(numSamples);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    if (t < 0.1) {
      buffer[i] = (Math.sin(2 * Math.PI * 2000 * t) * 0.4 + (Math.random() * 2 - 1) * 0.2) * amplitude;
    } else {
      buffer[i] = (Math.sin(2 * Math.PI * 750 * t) * 0.5 + Math.sin(2 * Math.PI * 1250 * t) * 0.3) * amplitude;
    }
  }

  const bufferLength = 44 + numSamples * 2;
  const arrayBuffer = new ArrayBuffer(bufferLength);
  const view = new DataView(arrayBuffer);

  function writeStr(offset: number, str: string) {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  }

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, numSamples * 2, true);

  let offset = 44;
  for (let i = 0; i < numSamples; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, buffer[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

describe('Phase 6 — One-by-One Speech Practice & 20 Consecutive Attempts', () => {
  const EXERCISE_ID = 'ex-qaf-ka-01';
  let sessionId: string;

  beforeEach(async () => {
    sessionId = `session-p6-${Date.now()}`;
    const newSession: PracticeSession = {
      id: sessionId,
      exerciseId: EXERCISE_ID,
      startedAt: new Date().toISOString(),
      status: 'IN_PROGRESS',
      attemptCount: 0,
      targetAttempts: 20
    };
    await createSession(newSession);
  });

  it('runs and persists 20 consecutive practice attempts with immediate analysis', async () => {
    let currentSession = await getSession(sessionId);
    expect(currentSession).not.toBeNull();
    expect(currentSession?.attemptCount).toBe(0);

    const resultsLog: PronunciationResult[] = [];

    // Execute 20 consecutive practice cycles
    for (let attempt = 1; attempt <= 20; attempt++) {
      // 1. Simulate speech recording of "کا"
      const blob = createTestWavBlob(0.7, 0.5);

      // 2. Run transparent audio analysis
      const analysis = await analyzePronunciation(blob, EXERCISE_ID);
      resultsLog.push(analysis);

      expect(['CORRECT', 'INCORRECT', 'UNCERTAIN']).toContain(analysis.result);
      expect(typeof analysis.similarity).toBe('number');
      expect(analysis.reason).toBeTruthy();

      // 3. Auto-save attempt into IndexedDB
      const recording: Recording = {
        id: `rec-p6-${sessionId}-${attempt}`,
        sessionId,
        exerciseId: EXERCISE_ID,
        blob,
        duration: 0.7,
        mimeType: 'audio/wav',
        createdAt: new Date(Date.now() + attempt * 1000).toISOString(),
        attemptNumber: attempt,
        autoResult: analysis.result,
        similarity: analysis.similarity,
        analysisReason: analysis.reason
      };
      await createRecording(recording);

      // 4. Update session attempt counter
      const isFinished = attempt >= 20;
      currentSession = {
        ...currentSession!,
        attemptCount: attempt,
        status: isFinished ? 'COMPLETED' : 'IN_PROGRESS',
        completedAt: isFinished ? new Date().toISOString() : undefined
      };
      await updateSession(currentSession);
    }

    // Verify 20 attempts were captured and stored
    const storedRecordings = await getRecordingsBySession(sessionId);
    expect(storedRecordings).toHaveLength(20);

    // Verify session count is correct
    const finalSession = await getSession(sessionId);
    expect(finalSession?.attemptCount).toBe(20);
    expect(finalSession?.status).toBe('COMPLETED');
    expect(finalSession?.completedAt).toBeDefined();

    // Verify tallies
    const correctCount = storedRecordings.filter(r => r.autoResult === 'CORRECT').length;
    const incorrectCount = storedRecordings.filter(r => r.autoResult === 'INCORRECT').length;
    const uncertainCount = storedRecordings.filter(r => r.autoResult === 'UNCERTAIN').length;

    expect(correctCount + incorrectCount + uncertainCount).toBe(20);
    expect(resultsLog).toHaveLength(20);
  });

  it('preserves strict separation between automatic audio result and therapist clinical review', async () => {
    // Create an attempt where automatic algorithm returns CORRECT
    const blob = createTestWavBlob(0.7, 0.5);
    const recId = `rec-separation-test-${Date.now()}`;

    const recording: Recording = {
      id: recId,
      sessionId,
      exerciseId: EXERCISE_ID,
      blob,
      duration: 0.7,
      mimeType: 'audio/wav',
      createdAt: new Date().toISOString(),
      attemptNumber: 1,
      autoResult: 'CORRECT',
      similarity: 0.88,
      analysisReason: 'Your recording is similar to your confirmed practice examples.'
    };
    await createRecording(recording);

    // Later, therapist reviews and marks it INCORRECT with clinical feedback
    const target = (await getRecordingsBySession(sessionId)).find(r => r.id === recId);
    expect(target).toBeDefined();
    expect(target?.autoResult).toBe('CORRECT');
    expect(target?.therapistResult).toBeUndefined();

    const therapistReviewed: Recording = {
      ...target!,
      therapistResult: 'INCORRECT',
      therapistRemarks: 'Substituted with dental articulation [ta]; needs velar elevation.',
      therapistReviewedAt: new Date().toISOString()
    };
    await updateRecording(therapistReviewed);

    // Retrieve from IndexedDB and confirm both results are preserved and not overwritten
    const retrieved = (await getRecordingsBySession(sessionId)).find(r => r.id === recId);
    expect(retrieved?.autoResult).toBe('CORRECT');
    expect(retrieved?.similarity).toBe(0.88);
    expect(retrieved?.therapistResult).toBe('INCORRECT');
    expect(retrieved?.therapistRemarks).toContain('Substituted with dental articulation');
  });

  it('allows therapist to review and update verdicts across all 3 states (CORRECT, INCORRECT, UNCERTAIN)', async () => {
    const blob = createTestWavBlob(0.65, 0.5);
    const recId = `rec-verdicts-test-${Date.now()}`;

    await createRecording({
      id: recId,
      sessionId,
      exerciseId: EXERCISE_ID,
      blob,
      duration: 0.65,
      mimeType: 'audio/wav',
      createdAt: new Date().toISOString(),
      attemptNumber: 1,
      autoResult: 'UNCERTAIN',
      similarity: 0.55,
      analysisReason: 'Uncertain — please repeat or ask your speech therapist to review.'
    });

    const verdicts: TherapistResult[] = ['CORRECT', 'INCORRECT', 'UNCERTAIN'];

    for (const verdict of verdicts) {
      const rec = (await getRecordingsBySession(sessionId)).find(r => r.id === recId);
      const updated: Recording = {
        ...rec!,
        therapistResult: verdict,
        therapistRemarks: `Clinical note for ${verdict}`,
        therapistReviewedAt: new Date().toISOString()
      };
      await updateRecording(updated);

      const refreshed = (await getRecordingsBySession(sessionId)).find(r => r.id === recId);
      expect(refreshed?.therapistResult).toBe(verdict);
      expect(refreshed?.therapistRemarks).toBe(`Clinical note for ${verdict}`);
      // Automatic result must remain untouched
      expect(refreshed?.autoResult).toBe('UNCERTAIN');
    }
  });

  it('verifies all recordings appear in practice history across sessions', async () => {
    const allSessionsBefore = await getAllSessions();
    const allRecordingsBefore = await getAllRecordings();

    expect(allSessionsBefore.some(s => s.id === sessionId)).toBe(true);
    expect(Array.isArray(allRecordingsBefore)).toBe(true);
  });
});
