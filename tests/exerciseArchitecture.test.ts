import { describe, it, expect, beforeEach } from 'vitest';
import {
  createSpeechExercise,
  INITIAL_EXERCISES
} from '../src/data/initialExercises';
import {
  saveExercise,
  getExerciseById,
  getExercises,
  seedExercises,
  normalizeExercise
} from '../src/storage/exerciseRepository';
import {
  createSession,
  getSession,
  updateSession,
  getAllSessions,
  deleteAllSessions
} from '../src/storage/sessionRepository';
import {
  createRecording,
  getAllRecordings,
  getRecordingsBySession,
  deleteAllRecordings
} from '../src/storage/recordingRepository';
import {
  calculateStatistics,
  getStatisticsForExercise,
  groupProgressByExercise
} from '../src/utils/statistics';
import { Exercise, PracticeSession, Recording } from '../src/types';

describe('Exercise Architecture & Sequence Practice (Phase 8 Extension)', () => {
  beforeEach(async () => {
    await deleteAllRecordings();
    await deleteAllSessions();
  });

  describe('1. Individual Exercise Creation', () => {
    it('creates single target exercises with correct properties and targetUnits', () => {
      const ka = createSpeechExercise({
        id: 'test-ka',
        name: 'Ka Practice',
        targetUnits: ['کا'],
        difficulty: 'single',
        phonemeTarget: 'k / a'
      });

      expect(ka.id).toBe('test-ka');
      expect(ka.name).toBe('Ka Practice');
      expect(ka.targetText).toBe('کا');
      expect(ka.targetUnits).toEqual(['کا']);
      expect(ka.difficulty).toBe('single');
      expect(ka.repetitions).toBe(1);
      expect(ka.isActive).toBe(true);

      const ki = createSpeechExercise({
        id: 'test-ki',
        name: 'Ki Practice',
        targetUnits: ['کی'],
        difficulty: 'single',
        phonemeTarget: 'k / i'
      });
      expect(ki.targetUnits).toEqual(['کی']);
      expect(ki.difficulty).toBe('single');

      const ke = createSpeechExercise({
        id: 'test-ke',
        name: 'Ke Practice',
        targetUnits: ['کے'],
        difficulty: 'single'
      });
      expect(ke.targetUnits).toEqual(['کے']);

      const ko = createSpeechExercise({
        id: 'test-ko',
        name: 'Ko Practice',
        targetUnits: ['کو'],
        difficulty: 'single'
      });
      expect(ko.targetUnits).toEqual(['کو']);
    });

    it('contains all 4 canonical individual exercises in seed data', () => {
      const targets = ['کا', 'کی', 'کے', 'کو'];
      for (const t of targets) {
        const found = INITIAL_EXERCISES.find(
          (e) => e.difficulty === 'single' && e.targetUnits.length === 1 && e.targetUnits[0] === t
        );
        expect(found).toBeDefined();
        expect(found?.targetText).toBe(t);
      }
    });
  });

  describe('2. Sequence Exercise Creation', () => {
    it('creates 2, 3, and 4 unit sequence exercises in exact ordered sequence', () => {
      const kaKi = createSpeechExercise({
        id: 'ka-ki',
        name: 'Ka + Ki',
        targetUnits: ['کا', 'کی'],
        difficulty: 'sequence'
      });
      expect(kaKi.targetUnits).toEqual(['کا', 'کی']);
      expect(kaKi.targetText).toBe('کا، کی');
      expect(kaKi.difficulty).toBe('sequence');

      const kaKiKe = createSpeechExercise({
        id: 'ka-ki-ke',
        name: 'Ka + Ki + Ke',
        targetUnits: ['کا', 'کی', 'کے'],
        difficulty: 'sequence'
      });
      expect(kaKiKe.targetUnits).toEqual(['کا', 'کی', 'کے']);
      expect(kaKiKe.targetText).toBe('کا، کی، کے');
      expect(kaKiKe.difficulty).toBe('sequence');

      const kaKiKeKo = createSpeechExercise({
        id: 'ka-ki-ke-ko',
        name: 'Ka + Ki + Ke + Ko',
        targetUnits: ['کا', 'کی', 'کے', 'کو'],
        difficulty: 'sequence'
      });
      expect(kaKiKeKo.targetUnits).toEqual(['کا', 'کی', 'کے', 'کو']);
      expect(kaKiKeKo.targetText).toBe('کا، کی، کے، کو');
      expect(kaKiKeKo.difficulty).toBe('sequence');
    });

    it('supports arbitrary future ordered sequences without hardcoded combination constraints', () => {
      const arbitrary = createSpeechExercise({
        id: 'custom-combo-5',
        name: 'Arbitrary 5-Sound Sequence',
        targetUnits: ['کا', 'کو', 'کی', 'کے', 'کا']
      });

      expect(arbitrary.difficulty).toBe('sequence');
      expect(arbitrary.targetUnits).toHaveLength(5);
      expect(arbitrary.targetUnits).toEqual(['کا', 'کو', 'کی', 'کے', 'کا']);
      expect(arbitrary.targetText).toBe('کا، کو، کی، کے، کا');
    });
  });

  describe('3. TargetUnits Persistence & Database Seeding', () => {
    it('persists and retrieves exercises with targetUnits from IndexedDB', async () => {
      const testEx: Exercise = {
        id: 'test-persist-seq',
        name: 'Persistence Test Sequence',
        targetText: 'کا، کی، کے',
        targetUnits: ['کا', 'کی', 'کے'],
        difficulty: 'sequence',
        repetitions: 5,
        description: 'Test sequence persistence',
        isActive: true,
        createdAt: new Date().toISOString()
      };

      await saveExercise(testEx);
      const fetched = await getExerciseById('test-persist-seq');

      expect(fetched).toBeDefined();
      expect(fetched?.targetUnits).toEqual(['کا', 'کی', 'کے']);
      expect(fetched?.difficulty).toBe('sequence');
      expect(fetched?.repetitions).toBe(5);
    });

    it('seeds all initial exercises without duplication upon multiple seed invocations', async () => {
      await seedExercises();
      const firstRun = await getExercises();
      expect(firstRun.length).toBeGreaterThanOrEqual(7);

      // Verify each individual and sequence exercise exists
      expect(firstRun.some((e) => e.id === 'ka')).toBe(true);
      expect(firstRun.some((e) => e.id === 'ki')).toBe(true);
      expect(firstRun.some((e) => e.id === 'ke')).toBe(true);
      expect(firstRun.some((e) => e.id === 'ko')).toBe(true);
      expect(firstRun.some((e) => e.id === 'ka-ki')).toBe(true);
      expect(firstRun.some((e) => e.id === 'ka-ki-ke')).toBe(true);
      expect(firstRun.some((e) => e.id === 'ka-ki-ke-ko')).toBe(true);

      // Re-run seedExercises to verify idempotence
      await seedExercises();
      const secondRun = await getExercises();
      expect(secondRun.length).toBe(firstRun.length);
    });
  });

  describe('4. Session Initialization for Sequences', () => {
    it('initializes session with exerciseId, targetUnits, totalTargetUnits, and repetition counts', async () => {
      const seqSession: PracticeSession = {
        id: 'sess-seq-init-1',
        exerciseId: 'ka-ki-ke',
        targetUnits: ['کا', 'کی', 'کے'],
        totalTargetUnits: 3,
        currentUnitIndex: 0,
        currentRepetition: 1,
        targetRepetitions: 10,
        completedRepetitions: 0,
        startedAt: new Date().toISOString(),
        status: 'IN_PROGRESS',
        attemptCount: 0,
        targetAttempts: 10
      };

      await createSession(seqSession);
      const fetched = await getSession('sess-seq-init-1');

      expect(fetched).toBeDefined();
      expect(fetched?.exerciseId).toBe('ka-ki-ke');
      expect(fetched?.targetUnits).toEqual(['کا', 'کی', 'کے']);
      expect(fetched?.totalTargetUnits).toBe(3);
      expect(fetched?.currentRepetition).toBe(1);
      expect(fetched?.completedRepetitions).toBe(0);
      expect(fetched?.targetRepetitions).toBe(10);
    });
  });

  describe('5. Repetition Counting vs Target Units', () => {
    it('counts 1 repetition as performing the complete multi-unit sequence once', async () => {
      // Exercise: کا → کی → کے → کو (4 units in 1 exercise)
      const targetUnits = ['کا', 'کی', 'کے', 'کو'];
      let session: PracticeSession = {
        id: 'sess-rep-count-1',
        exerciseId: 'ka-ki-ke-ko',
        targetUnits,
        totalTargetUnits: 4,
        currentRepetition: 1,
        completedRepetitions: 0,
        targetRepetitions: 3,
        startedAt: new Date().toISOString(),
        status: 'IN_PROGRESS',
        attemptCount: 0,
        targetAttempts: 3
      };
      await createSession(session);

      // Perform Repetition 1: User says entire sequence "کا → کی → کے → کو"
      const rec1: Recording = {
        id: 'rec-rep-1',
        sessionId: session.id,
        exerciseId: session.exerciseId,
        blob: new Blob(['audio-rep-1'], { type: 'audio/webm' }),
        duration: 2.1,
        mimeType: 'audio/webm',
        createdAt: new Date().toISOString(),
        attemptNumber: 1,
        autoResult: 'CORRECT'
      };
      await createRecording(rec1);

      session = {
        ...session,
        attemptCount: 1,
        completedRepetitions: 1,
        currentRepetition: 2,
        status: 'IN_PROGRESS'
      };
      await updateSession(session);

      let loaded = await getSession('sess-rep-count-1');
      // Verify: 1 completed repetition, NOT 4 attempts!
      expect(loaded?.completedRepetitions).toBe(1);
      expect(loaded?.totalTargetUnits).toBe(4);
      expect(loaded?.currentRepetition).toBe(2);

      // Perform Repetitions 2 and 3
      for (let rep = 2; rep <= 3; rep++) {
        await createRecording({
          id: `rec-rep-${rep}`,
          sessionId: session.id,
          exerciseId: session.exerciseId,
          blob: new Blob([`audio-rep-${rep}`], { type: 'audio/webm' }),
          duration: 1.9,
          mimeType: 'audio/webm',
          createdAt: new Date().toISOString(),
          attemptNumber: rep,
          autoResult: 'CORRECT'
        });

        const isFinished = rep >= (session.targetRepetitions || 3);
        session = {
          ...session,
          attemptCount: rep,
          completedRepetitions: rep,
          currentRepetition: isFinished ? rep : rep + 1,
          status: isFinished ? 'COMPLETED' : 'IN_PROGRESS',
          completedAt: isFinished ? new Date().toISOString() : undefined
        };
        await updateSession(session);
      }

      loaded = await getSession('sess-rep-count-1');
      expect(loaded?.status).toBe('COMPLETED');
      expect(loaded?.completedRepetitions).toBe(3);
      expect(loaded?.attemptCount).toBe(3);
      const recs = await getRecordingsBySession('sess-rep-count-1');
      expect(recs).toHaveLength(3);
    });
  });

  describe('6. Exercise History Dynamic Display', () => {
    it('associates recordings and sessions with distinct sequence targets', async () => {
      const sessSeq: PracticeSession = {
        id: 'sess-hist-seq-1',
        exerciseId: 'ka-ki-ke',
        targetUnits: ['کا', 'کی', 'کے'],
        totalTargetUnits: 3,
        currentRepetition: 2,
        completedRepetitions: 1,
        targetRepetitions: 5,
        startedAt: '2026-10-01T10:00:00.000Z',
        completedAt: '2026-10-01T10:05:00.000Z',
        status: 'COMPLETED',
        attemptCount: 1,
        targetAttempts: 5
      };
      await createSession(sessSeq);

      await createRecording({
        id: 'rec-seq-hist-1',
        sessionId: 'sess-hist-seq-1',
        exerciseId: 'ka-ki-ke',
        blob: new Blob(['seq-audio'], { type: 'audio/webm' }),
        duration: 1.8,
        mimeType: 'audio/webm',
        createdAt: '2026-10-01T10:01:00.000Z',
        attemptNumber: 1,
        autoResult: 'CORRECT'
      });

      const allSessions = await getAllSessions();
      const targetSess = allSessions.find((s) => s.id === 'sess-hist-seq-1');
      expect(targetSess).toBeDefined();
      expect(targetSess?.exerciseId).toBe('ka-ki-ke');
      expect(targetSess?.targetUnits).toEqual(['کا', 'کی', 'کے']);

      const recs = await getRecordingsBySession('sess-hist-seq-1');
      expect(recs[0].exerciseId).toBe('ka-ki-ke');
    });
  });

  describe('7. Progress Aggregation Grouped by Exercise', () => {
    it('aggregates attempts correctly per exercise (Ka: 20, Ki: 15, Ke: 12, Ka+Ki: 8)', () => {
      const today = new Date().toISOString();
      const mockRecordings: Recording[] = [];

      // 20 attempts for Ka
      for (let i = 1; i <= 20; i++) {
        mockRecordings.push({
          id: `ka-${i}`,
          sessionId: 's-ka',
          exerciseId: 'ka',
          duration: 0.8,
          mimeType: 'audio/webm',
          createdAt: today,
          autoResult: i % 2 === 0 ? 'CORRECT' : 'INCORRECT'
        });
      }

      // 15 attempts for Ki
      for (let i = 1; i <= 15; i++) {
        mockRecordings.push({
          id: `ki-${i}`,
          sessionId: 's-ki',
          exerciseId: 'ki',
          duration: 0.7,
          mimeType: 'audio/webm',
          createdAt: today,
          autoResult: 'CORRECT'
        });
      }

      // 12 attempts for Ke
      for (let i = 1; i <= 12; i++) {
        mockRecordings.push({
          id: `ke-${i}`,
          sessionId: 's-ke',
          exerciseId: 'ke',
          duration: 0.6,
          mimeType: 'audio/webm',
          createdAt: today,
          autoResult: 'CORRECT'
        });
      }

      // 8 attempts for Ka + Ki
      for (let i = 1; i <= 8; i++) {
        mockRecordings.push({
          id: `ka-ki-${i}`,
          sessionId: 's-ka-ki',
          exerciseId: 'ka-ki',
          duration: 1.5,
          mimeType: 'audio/webm',
          createdAt: today,
          autoResult: 'CORRECT'
        });
      }

      const stats = calculateStatistics(mockRecordings, [], INITIAL_EXERCISES);

      // Verify overall counts
      expect(stats.totalAttempts).toBe(20 + 15 + 12 + 8); // 55

      // Verify individual exercise breakdown
      const kaStats = stats.exerciseStatsMap['ka'];
      expect(kaStats).toBeDefined();
      expect(kaStats.attempts).toBe(20);
      expect(kaStats.audioCorrect).toBe(10);
      expect(kaStats.audioIncorrect).toBe(10);
      expect(kaStats.audioRate).toBe(50);

      const kiStats = stats.exerciseStatsMap['ki'];
      expect(kiStats).toBeDefined();
      expect(kiStats.attempts).toBe(15);
      expect(kiStats.audioCorrect).toBe(15);
      expect(kiStats.audioRate).toBe(100);

      const keStats = stats.exerciseStatsMap['ke'];
      expect(keStats).toBeDefined();
      expect(keStats.attempts).toBe(12);

      const kaKiStats = stats.exerciseStatsMap['ka-ki'];
      expect(kaKiStats).toBeDefined();
      expect(kaKiStats.attempts).toBe(8);
      expect(kaKiStats.difficulty).toBe('sequence');
    });
  });

  describe('8. Backward Compatibility with Existing Data', () => {
    it('preserves canonical ex-qaf-ka-01 exercise and aliases it seamlessly', async () => {
      await seedExercises();
      const legacyEx = await getExerciseById('ex-qaf-ka-01');
      expect(legacyEx).toBeDefined();
      expect(legacyEx?.name).toBe('Qaf — Ka Practice');
      expect(legacyEx?.targetText).toBe('کا');
      expect(legacyEx?.targetUnits).toEqual(['کا']);
    });

    it('normalizes legacy exercise records missing targetUnits and difficulty', () => {
      const legacyRecord = {
        id: 'legacy-1',
        name: 'Legacy Exercise',
        targetText: 'کا',
        description: 'Legacy format without targetUnits',
        isActive: true,
        createdAt: '2026-09-01T00:00:00.000Z'
      } as unknown as Exercise;

      const normalized = normalizeExercise(legacyRecord);
      expect(normalized.targetUnits).toEqual(['کا']);
      expect(normalized.difficulty).toBe('single');
      expect(normalized.repetitions).toBe(1);
    });

    it('handles legacy recordings without exerciseId by attributing them to canonical Ka', () => {
      const legacyRecs: Recording[] = [
        {
          id: 'rec-legacy-no-ex',
          sessionId: 's-legacy',
          exerciseId: '', // legacy recording without exerciseId
          blob: new Blob([''], { type: 'audio/webm' }),
          duration: 0.9,
          mimeType: 'audio/webm',
          createdAt: new Date().toISOString(),
          autoResult: 'CORRECT'
        }
      ];

      const stats = calculateStatistics(legacyRecs, []);
      expect(stats.totalAttempts).toBe(1);
      expect(stats.exerciseTotalAttempts).toBe(1);
      expect(stats.exerciseAudioCorrect).toBe(1);
    });
  });
});
