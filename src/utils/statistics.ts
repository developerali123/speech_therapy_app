import { PracticeSession, Recording, DailyPracticeStats } from '../types';
import { toDateKey, getLastNDaysKeys } from './dates';

export interface AppStatistics {
  totalAttempts: number;
  reviewedAttempts: number;
  correctCount: number;
  incorrectCount: number;
  uncertainCount: number;
  pendingReviewCount: number;
  accuracyRate: number | null; // percentage of reviewed that are correct
  todayAttempts: number;
  currentStreak: number;
  bestStreak: number;
  weeklyStats: (DailyPracticeStats & { dayName: string })[];
}

/**
 * Calculate streaks from completed or active sessions.
 * A day counts when the user completes or practices at least one session on that day.
 */
export function calculateStreaks(sessions: PracticeSession[]): { currentStreak: number; bestStreak: number } {
  if (!sessions || sessions.length === 0) {
    return { currentStreak: 0, bestStreak: 0 };
  }

  // Get unique sorted date keys of days with practice
  const daySet = new Set<string>();
  for (const s of sessions) {
    if (s.attemptCount > 0 || s.status === 'COMPLETED') {
      daySet.add(toDateKey(s.startedAt));
    }
  }

  if (daySet.size === 0) {
    return { currentStreak: 0, bestStreak: 0 };
  }

  // Convert to sorted timestamps (ascending)
  const sortedDates = Array.from(daySet)
    .map(key => {
      const [y, m, d] = key.split('-').map(Number);
      return new Date(y, m - 1, d).getTime();
    })
    .sort((a, b) => a - b);

  const MS_PER_DAY = 24 * 60 * 60 * 1000;

  let bestStreak = 1;
  let streakCounter = 1;

  for (let i = 1; i < sortedDates.length; i++) {
    const diffDays = Math.round((sortedDates[i] - sortedDates[i - 1]) / MS_PER_DAY);
    if (diffDays === 1) {
      streakCounter++;
      if (streakCounter > bestStreak) {
        bestStreak = streakCounter;
      }
    } else if (diffDays > 1) {
      streakCounter = 1;
    }
  }

  // Current streak calculation
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayTime = today.getTime();

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayTime = yesterday.getTime();

  const lastPracticeDate = sortedDates[sortedDates.length - 1];

  let currentStreak = 0;
  // If the last practice was today or yesterday, count backward streak
  if (lastPracticeDate === todayTime || lastPracticeDate === yesterdayTime) {
    currentStreak = 1;
    for (let i = sortedDates.length - 1; i > 0; i--) {
      const diffDays = Math.round((sortedDates[i] - sortedDates[i - 1]) / MS_PER_DAY);
      if (diffDays === 1) {
        currentStreak++;
      } else {
        break;
      }
    }
  }

  return {
    currentStreak,
    bestStreak: Math.max(bestStreak, currentStreak)
  };
}

/**
 * Calculate comprehensive statistics from recordings and sessions
 */
export function calculateStatistics(recordings: Recording[], sessions: PracticeSession[]): AppStatistics {
  const totalAttempts = recordings.length;
  let reviewedAttempts = 0;
  let correctCount = 0;
  let incorrectCount = 0;
  let uncertainCount = 0;
  let pendingReviewCount = 0;

  const todayKey = toDateKey(new Date());
  let todayAttempts = 0;

  for (const rec of recordings) {
    if (toDateKey(rec.createdAt) === todayKey) {
      todayAttempts++;
    }

    if (rec.therapistResult === 'CORRECT') {
      reviewedAttempts++;
      correctCount++;
    } else if (rec.therapistResult === 'INCORRECT') {
      reviewedAttempts++;
      incorrectCount++;
    } else if (rec.therapistResult === 'UNCERTAIN') {
      reviewedAttempts++;
      uncertainCount++;
    } else {
      pendingReviewCount++;
    }
  }

  const accuracyRate = reviewedAttempts > 0 ? Math.round((correctCount / reviewedAttempts) * 100) : null;
  const { currentStreak, bestStreak } = calculateStreaks(sessions);

  // Weekly stats for the last 7 days
  const last7Days = getLastNDaysKeys(7);
  const weeklyStats = last7Days.map(dateKey => {
    const dayRecordings = recordings.filter(r => toDateKey(r.createdAt) === dateKey);
    const dayAttempts = dayRecordings.length;
    let dayCorrect = 0;
    let dayIncorrect = 0;
    let dayUncertain = 0;

    for (const r of dayRecordings) {
      if (r.therapistResult === 'CORRECT') dayCorrect++;
      else if (r.therapistResult === 'INCORRECT') dayIncorrect++;
      else if (r.therapistResult === 'UNCERTAIN') dayUncertain++;
    }

    const dayReviewed = dayCorrect + dayIncorrect + dayUncertain;
    const correctPercentage = dayReviewed > 0 ? Math.round((dayCorrect / dayReviewed) * 100) : 0;

    // Day of week label
    const [y, m, d] = dateKey.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    const dayName = dateKey === todayKey ? 'Today' : dateObj.toLocaleDateString(undefined, { weekday: 'short' });

    return {
      date: dateKey,
      dayName,
      attempts: dayAttempts,
      reviewedAttempts: dayReviewed,
      correctCount: dayCorrect,
      incorrectCount: dayIncorrect,
      uncertainCount: dayUncertain,
      correctPercentage
    };
  });

  return {
    totalAttempts,
    reviewedAttempts,
    correctCount,
    incorrectCount,
    uncertainCount,
    pendingReviewCount,
    accuracyRate,
    todayAttempts,
    currentStreak,
    bestStreak,
    weeklyStats
  };
}
