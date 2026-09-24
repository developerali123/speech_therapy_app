import { describe, it, expect, beforeEach } from 'vitest';
import { getExercises, seedExercises, getExerciseById, saveExercise } from '../src/storage/exerciseRepository';
import { createSession, getSession, getAllSessions, updateSession, deleteSession, deleteAllSessions } from '../src/storage/sessionRepository';
import { createRecording, getRecording, getRecordingsBySession, updateRecording, deleteRecording, deleteAllRecordings } from '../src/storage/recordingRepository';
import { getSettings, saveSettings } from '../src/storage/settingsRepository';
import { PracticeSession, Recording, Exercise } from '../src/types';

describe('IndexedDB Repositories', () => {
  beforeEach(async () => {
    await deleteAllRecordings();
    await deleteAllSessions();
  });

  describe('Exercise Repository', () => {
    it('seeds initial exercise with target "کا" if empty', async () => {
      await seedExercises();
      const exercises = await getExercises();
      expect(exercises.length).toBeGreaterThan(0);
      const kaExercise = exercises.find(e => e.targetText === 'کا');
      expect(kaExercise).toBeDefined();
      expect(kaExercise?.name).toBe('Qaf — Ka Practice');
    });

    it('can retrieve an exercise by id', async () => {
      const custom: Exercise = {
        id: 'test-ex-1',
        name: 'Test Ka Exercise',
        targetText: 'کا',
        description: 'Test description',
        isActive: true,
        createdAt: new Date().toISOString()
      };
      await saveExercise(custom);
      const retrieved = await getExerciseById('test-ex-1');
      expect(retrieved).toBeDefined();
      expect(retrieved?.targetText).toBe('کا');
    });
  });

  describe('Session Repository', () => {
    it('creates, retrieves, and updates practice sessions', async () => {
      const session: PracticeSession = {
        id: 'sess-001',
        exerciseId: 'ex-qaf-ka-01',
        startedAt: new Date().toISOString(),
        status: 'IN_PROGRESS',
        attemptCount: 1,
        targetAttempts: 10
      };

      await createSession(session);
      const fetched = await getSession('sess-001');
      expect(fetched).toBeDefined();
      expect(fetched?.attemptCount).toBe(1);

      // Update session
      const updated: PracticeSession = {
        ...session,
        attemptCount: 10,
        status: 'COMPLETED',
        completedAt: new Date().toISOString()
      };
      await updateSession(updated);

      const fetchedUpdated = await getSession('sess-001');
      expect(fetchedUpdated?.status).toBe('COMPLETED');
      expect(fetchedUpdated?.attemptCount).toBe(10);
    });

    it('lists and deletes sessions', async () => {
      const s1: PracticeSession = {
        id: 'sess-a',
        exerciseId: 'ex-1',
        startedAt: new Date().toISOString(),
        status: 'IN_PROGRESS',
        attemptCount: 2
      };
      await createSession(s1);

      const all = await getAllSessions();
      expect(all.some(s => s.id === 'sess-a')).toBe(true);

      await deleteSession('sess-a');
      const allAfter = await getAllSessions();
      expect(allAfter.some(s => s.id === 'sess-a')).toBe(false);
    });
  });

  describe('Recording Repository & Therapist Review Persistence', () => {
    it('stores, retrieves, updates therapist review, and deletes recordings', async () => {
      const dummyBlob = new Blob(['mock-audio-bytes'], { type: 'audio/webm' });
      const rec: Recording = {
        id: 'rec-001',
        sessionId: 'sess-100',
        exerciseId: 'ex-qaf-ka-01',
        blob: dummyBlob,
        duration: 0.85,
        mimeType: 'audio/webm',
        createdAt: new Date().toISOString(),
        attemptNumber: 1
      };

      await createRecording(rec);

      const fetched = await getRecording('rec-001');
      expect(fetched).toBeDefined();
      expect(fetched?.duration).toBe(0.85);
      expect(fetched?.therapistResult).toBeUndefined();

      // Therapist review
      const reviewed: Recording = {
        ...rec,
        therapistResult: 'CORRECT',
        therapistRemarks: 'Excellent velar closure'
      };
      await updateRecording(reviewed);

      const fetchedReviewed = await getRecording('rec-001');
      expect(fetchedReviewed?.therapistResult).toBe('CORRECT');
      expect(fetchedReviewed?.therapistRemarks).toBe('Excellent velar closure');

      // Retrieve by session
      const sessionRecs = await getRecordingsBySession('sess-100');
      expect(sessionRecs.length).toBe(1);
      expect(sessionRecs[0].id).toBe('rec-001');

      // Delete recording
      await deleteRecording('rec-001');
      const deleted = await getRecording('rec-001');
      expect(deleted).toBeUndefined();
    });
  });

  describe('Settings Repository', () => {
    it('saves and retrieves user settings', async () => {
      await saveSettings({ dailyGoal: 15, userName: 'Fatima' });
      const settings = await getSettings();
      expect(settings.dailyGoal).toBe(15);
      expect(settings.userName).toBe('Fatima');
    });
  });
});
