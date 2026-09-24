import { describe, it, expect, beforeEach } from 'vitest';
import {
  calculateStatistics,
  calculateStreaks
} from '../src/utils/statistics';
import {
  createSession,
  getAllSessions,
  deleteAllSessions
} from '../src/storage/sessionRepository';
import {
  createRecording,
  getAllRecordings,
  deleteRecording,
  deleteAllRecordings
} from '../src/storage/recordingRepository';
import { importPracticeData } from '../src/utils/import';
import { generateExportData } from '../src/utils/export';
import { Recording, PracticeSession } from '../src/types';
import { toDateKey } from '../src/utils/dates';

describe('Phase 7 — Progress and Speech Practice Improvement Tracking', () => {
  beforeEach(async () => {
    await deleteAllRecordings();
    await deleteAllSessions();
  });

  describe('Mathematical Correctness & Separation of Metrics', () => {
    it('calculates mathematically correct dashboard metrics with strict separation of audio and therapist results', () => {
      const today = new Date().toISOString();
      const mockRecordings: Recording[] = [
        // 1. Audio: CORRECT, Therapist: pending
        {
          id: 'r1',
          sessionId: 's1',
          exerciseId: 'ex-qaf-ka-01',
          duration: 0.8,
          mimeType: 'audio/wav',
          createdAt: today,
          autoResult: 'CORRECT',
          similarity: 0.85
        },
        // 2. Audio: CORRECT, Therapist: CORRECT
        {
          id: 'r2',
          sessionId: 's1',
          exerciseId: 'ex-qaf-ka-01',
          duration: 0.7,
          mimeType: 'audio/wav',
          createdAt: today,
          autoResult: 'CORRECT',
          similarity: 0.90,
          therapistResult: 'CORRECT',
          therapistRemarks: 'Good velar closure'
        },
        // 3. Audio: CORRECT, Therapist: INCORRECT (separation test)
        {
          id: 'r3',
          sessionId: 's1',
          exerciseId: 'ex-qaf-ka-01',
          duration: 0.6,
          mimeType: 'audio/wav',
          createdAt: today,
          autoResult: 'CORRECT',
          similarity: 0.75,
          therapistResult: 'INCORRECT',
          therapistRemarks: 'Substituted with dental [ta]'
        },
        // 4. Audio: INCORRECT, Therapist: pending
        {
          id: 'r4',
          sessionId: 's1',
          exerciseId: 'ex-qaf-ka-01',
          duration: 0.7,
          mimeType: 'audio/wav',
          createdAt: today,
          autoResult: 'INCORRECT',
          similarity: 0.40
        },
        // 5. Audio: UNCERTAIN, Therapist: UNCERTAIN
        {
          id: 'r5',
          sessionId: 's1',
          exerciseId: 'ex-qaf-ka-01',
          duration: 0.9,
          mimeType: 'audio/wav',
          createdAt: today,
          autoResult: 'UNCERTAIN',
          similarity: 0.50,
          therapistResult: 'UNCERTAIN',
          therapistRemarks: 'Repeat in clinic'
        }
      ];

      const mockSessions: PracticeSession[] = [
        {
          id: 's1',
          exerciseId: 'ex-qaf-ka-01',
          startedAt: today,
          status: 'COMPLETED',
          attemptCount: 5
        }
      ];

      const stats = calculateStatistics(mockRecordings, mockSessions);

      // 1. Dashboard counts
      expect(stats.totalAttempts).toBe(5);
      expect(stats.audioCorrectCount).toBe(3);   // r1, r2, r3
      expect(stats.audioIncorrectCount).toBe(1); // r4
      expect(stats.audioUncertainCount).toBe(1); // r5

      // 2. Therapist review counts (strictly only therapist reviews!)
      expect(stats.therapistReviewedCount).toBe(3); // r2, r3, r5
      expect(stats.therapistPendingCount).toBe(2);  // r1, r4
      expect(stats.totalTherapistCorrect).toBe(1);  // r2
      expect(stats.totalTherapistIncorrect).toBe(1);// r3
      expect(stats.totalTherapistUncertain).toBe(1);// r5

      // Rate: 1 / 3 = 33%
      expect(stats.therapistConfirmedRate).toBe(33);

      // 3. Daily progress (Audio-based)
      expect(stats.todayAttempts).toBe(5);
      expect(stats.todayAudioCorrect).toBe(3);
      // Audio rate: 3 / 5 = 60%
      expect(stats.todayAudioRate).toBe(60);

      // 4. Exercise statistics for "Qaf — Ka Practice"
      expect(stats.exerciseTotalAttempts).toBe(5);
      expect(stats.exerciseTotalReviewed).toBe(3);
      expect(stats.exerciseAudioCorrect).toBe(3);
      expect(stats.exerciseAudioIncorrect).toBe(1);
      expect(stats.exerciseAudioUncertain).toBe(1);
      expect(stats.exerciseTherapistCorrect).toBe(1);
      expect(stats.exerciseTherapistIncorrect).toBe(1);
    });

    it('calculates streaks correctly where a day counts when at least one attempt is made', () => {
      const now = new Date();

      // Today
      const today = new Date(now).toISOString();

      // Yesterday
      const yDate = new Date(now);
      yDate.setDate(yDate.getDate() - 1);
      const yesterday = yDate.toISOString();

      // 2 days ago
      const day2Date = new Date(now);
      day2Date.setDate(day2Date.getDate() - 2);
      const twoDaysAgo = day2Date.toISOString();

      const recordings: Recording[] = [
        { id: '1', sessionId: 's1', exerciseId: 'ex1', duration: 1, mimeType: 'audio/wav', createdAt: today },
        { id: '2', sessionId: 's2', exerciseId: 'ex1', duration: 1, mimeType: 'audio/wav', createdAt: yesterday },
        { id: '3', sessionId: 's3', exerciseId: 'ex1', duration: 1, mimeType: 'audio/wav', createdAt: twoDaysAgo }
      ];

      const { currentStreak, bestStreak } = calculateStreaks([], recordings);
      expect(currentStreak).toBe(3);
      expect(bestStreak).toBe(3);
    });
  });

  describe('Dynamic Storage Updates, Deletions, and Backup Restores', () => {
    it('removes deleted recordings dynamically from statistics', async () => {
      const today = new Date().toISOString();
      const rec1: Recording = {
        id: 'rec-del-1',
        sessionId: 'sess-1',
        exerciseId: 'ex-qaf-ka-01',
        duration: 0.7,
        mimeType: 'audio/wav',
        createdAt: today,
        autoResult: 'CORRECT'
      };
      const rec2: Recording = {
        id: 'rec-del-2',
        sessionId: 'sess-1',
        exerciseId: 'ex-qaf-ka-01',
        duration: 0.8,
        mimeType: 'audio/wav',
        createdAt: today,
        autoResult: 'INCORRECT'
      };

      await createRecording(rec1);
      await createRecording(rec2);

      let allRecs = await getAllRecordings();
      expect(allRecs).toHaveLength(2);
      let stats = calculateStatistics(allRecs, []);
      expect(stats.totalAttempts).toBe(2);
      expect(stats.audioCorrectCount).toBe(1);
      expect(stats.audioIncorrectCount).toBe(1);

      // Delete rec2
      await deleteRecording('rec-del-2');

      allRecs = await getAllRecordings();
      expect(allRecs).toHaveLength(1);
      stats = calculateStatistics(allRecs, []);
      expect(stats.totalAttempts).toBe(1);
      expect(stats.audioCorrectCount).toBe(1);
      expect(stats.audioIncorrectCount).toBe(0);
    });

    it('exports and restores progress statistics without loss', async () => {
      const today = new Date().toISOString();
      const sess: PracticeSession = {
        id: 'sess-export-p7',
        exerciseId: 'ex-qaf-ka-01',
        startedAt: today,
        status: 'COMPLETED',
        attemptCount: 1
      };
      await createSession(sess);

      const rec: Recording = {
        id: 'rec-export-p7',
        sessionId: 'sess-export-p7',
        exerciseId: 'ex-qaf-ka-01',
        blob: new Blob(['synthetic-audio-data'], { type: 'audio/wav' }),
        duration: 0.8,
        mimeType: 'audio/wav',
        createdAt: today,
        autoResult: 'CORRECT',
        similarity: 0.92,
        analysisReason: 'Clear match',
        therapistResult: 'CORRECT',
        therapistRemarks: 'Clinically verified'
      };
      await createRecording(rec);

      // Generate export backup
      const exportData = await generateExportData();
      expect(exportData.recordings).toHaveLength(1);
      expect(exportData.recordings[0].autoResult).toBe('CORRECT');
      expect(exportData.recordings[0].therapistResult).toBe('CORRECT');
      expect(exportData.recordings[0].similarity).toBe(0.92);

      // Clear IndexedDB
      await deleteAllRecordings();
      await deleteAllSessions();
      expect(await getAllRecordings()).toHaveLength(0);

      // Import backup back
      const importResult = await importPracticeData(JSON.stringify(exportData), true);
      expect(importResult.success).toBe(true);

      // Verify restored statistics
      const restoredRecs = await getAllRecordings();
      const restoredSessions = await getAllSessions();
      expect(restoredRecs).toHaveLength(1);
      expect(restoredSessions).toHaveLength(1);

      const restoredStats = calculateStatistics(restoredRecs, restoredSessions);
      expect(restoredStats.totalAttempts).toBe(1);
      expect(restoredStats.audioCorrectCount).toBe(1);
      expect(restoredStats.totalTherapistReviewed).toBe(1);
      expect(restoredStats.totalTherapistCorrect).toBe(1);
      expect(restoredStats.therapistConfirmedRate).toBe(100);
    });
  });
});
