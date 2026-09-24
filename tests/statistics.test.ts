import { describe, it, expect } from 'vitest';
import { calculateStatistics, calculateStreaks } from '../src/utils/statistics';
import { PracticeSession, Recording } from '../src/types';

describe('Statistics and Streak Calculations', () => {
  it('correctly aggregates attempts and therapist review results', () => {
    const mockBlob = new Blob([''], { type: 'audio/webm' });
    const now = new Date().toISOString();

    const recordings: Recording[] = [
      {
        id: 'r1',
        sessionId: 's1',
        exerciseId: 'ex1',
        blob: mockBlob,
        duration: 0.8,
        mimeType: 'audio/webm',
        createdAt: now,
        therapistResult: 'CORRECT'
      },
      {
        id: 'r2',
        sessionId: 's1',
        exerciseId: 'ex1',
        blob: mockBlob,
        duration: 0.9,
        mimeType: 'audio/webm',
        createdAt: now,
        therapistResult: 'INCORRECT'
      },
      {
        id: 'r3',
        sessionId: 's1',
        exerciseId: 'ex1',
        blob: mockBlob,
        duration: 0.75,
        mimeType: 'audio/webm',
        createdAt: now,
        therapistResult: 'UNCERTAIN'
      },
      {
        id: 'r4',
        sessionId: 's1',
        exerciseId: 'ex1',
        blob: mockBlob,
        duration: 0.82,
        mimeType: 'audio/webm',
        createdAt: now
        // Pending review
      }
    ];

    const sessions: PracticeSession[] = [
      {
        id: 's1',
        exerciseId: 'ex1',
        startedAt: now,
        status: 'COMPLETED',
        attemptCount: 4
      }
    ];

    const stats = calculateStatistics(recordings, sessions);

    expect(stats.totalAttempts).toBe(4);
    expect(stats.reviewedAttempts).toBe(3);
    expect(stats.correctCount).toBe(1);
    expect(stats.incorrectCount).toBe(1);
    expect(stats.uncertainCount).toBe(1);
    expect(stats.pendingReviewCount).toBe(1);

    // Only reviewed count contributes: 1 / 3 = 33%
    expect(stats.accuracyRate).toBe(33);
  });

  it('handles unreviewed recordings without treating them as correct', () => {
    const mockBlob = new Blob([''], { type: 'audio/webm' });
    const recordings: Recording[] = [
      {
        id: 'r1',
        sessionId: 's1',
        exerciseId: 'ex1',
        blob: mockBlob,
        duration: 0.8,
        mimeType: 'audio/webm',
        createdAt: new Date().toISOString()
      }
    ];

    const stats = calculateStatistics(recordings, []);
    expect(stats.reviewedAttempts).toBe(0);
    expect(stats.correctCount).toBe(0);
    expect(stats.accuracyRate).toBeNull();
    expect(stats.pendingReviewCount).toBe(1);
  });

  describe('Streak Tracking', () => {
    it('returns 0 streak for empty sessions', () => {
      const { currentStreak, bestStreak } = calculateStreaks([]);
      expect(currentStreak).toBe(0);
      expect(bestStreak).toBe(0);
    });

    it('calculates current streak when practice was today', () => {
      const today = new Date();
      const yesterday = new Date();
      yesterday.setDate(today.getDate() - 1);
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(today.getDate() - 2);

      const sessions: PracticeSession[] = [
        { id: '1', exerciseId: 'e', startedAt: today.toISOString(), status: 'COMPLETED', attemptCount: 10 },
        { id: '2', exerciseId: 'e', startedAt: yesterday.toISOString(), status: 'COMPLETED', attemptCount: 10 },
        { id: '3', exerciseId: 'e', startedAt: twoDaysAgo.toISOString(), status: 'COMPLETED', attemptCount: 10 }
      ];

      const { currentStreak, bestStreak } = calculateStreaks(sessions);
      expect(currentStreak).toBe(3);
      expect(bestStreak).toBe(3);
    });

    it('tracks best streak even if current streak is broken', () => {
      const today = new Date();
      const tenDaysAgo = new Date();
      tenDaysAgo.setDate(today.getDate() - 10);
      const elevenDaysAgo = new Date();
      elevenDaysAgo.setDate(today.getDate() - 11);
      const twelveDaysAgo = new Date();
      twelveDaysAgo.setDate(today.getDate() - 12);
      const thirteenDaysAgo = new Date();
      thirteenDaysAgo.setDate(today.getDate() - 13);

      const sessions: PracticeSession[] = [
        { id: '1', exerciseId: 'e', startedAt: today.toISOString(), status: 'COMPLETED', attemptCount: 5 },
        // Past 4-day streak
        { id: '2', exerciseId: 'e', startedAt: tenDaysAgo.toISOString(), status: 'COMPLETED', attemptCount: 5 },
        { id: '3', exerciseId: 'e', startedAt: elevenDaysAgo.toISOString(), status: 'COMPLETED', attemptCount: 5 },
        { id: '4', exerciseId: 'e', startedAt: twelveDaysAgo.toISOString(), status: 'COMPLETED', attemptCount: 5 },
        { id: '5', exerciseId: 'e', startedAt: thirteenDaysAgo.toISOString(), status: 'COMPLETED', attemptCount: 5 }
      ];

      const { currentStreak, bestStreak } = calculateStreaks(sessions);
      expect(currentStreak).toBe(1);
      expect(bestStreak).toBe(4);
    });
  });
});
