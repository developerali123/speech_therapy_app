import { PracticeSession, Recording, DailyPracticeStats, Exercise } from '../types';
import { toDateKey, getLastNDaysKeys, formatDateLabel } from './dates';

export interface DailyChartPoint {
  date: string;
  fullDate: string;
  attempts: number;
  audioRate: number;
  therapistRate: number | null;
  durationMinutes: number;
}

export interface RecentSessionPerformance {
  sessionId: string;
  dateLabel: string;
  fullDate: string;
  attempts: number;
  audioRate: number;
  therapistRate: number | null;
  reviewedCount: number;
}

export interface ExercisePracticeStats {
  exerciseId: string;
  name: string;
  targetText: string;
  difficulty: 'single' | 'sequence';
  targetUnits: string[];
  attempts: number;
  audioCorrect: number;
  audioIncorrect: number;
  audioUncertain: number;
  audioRate: number; // %
  therapistReviewed: number;
  therapistCorrect: number;
  therapistIncorrect: number;
  therapistUncertain: number;
  therapistRate: number | null; // %
}

export interface AppStatistics {
  // 1. Dashboard counts
  totalAttempts: number;
  audioCorrectCount: number;
  audioIncorrectCount: number;
  audioUncertainCount: number;
  therapistReviewedCount: number;
  therapistPendingCount: number;

  // 2. Daily progress (Today)
  todayAttempts: number;
  todayAudioCorrect: number;
  todayAudioIncorrect: number;
  todayAudioUncertain: number;
  todayAudioRate: number; // %

  // 3. Therapist-confirmed progress
  totalTherapistReviewed: number;
  totalTherapistCorrect: number;
  totalTherapistIncorrect: number;
  totalTherapistUncertain: number;
  therapistConfirmedRate: number | null; // % (only therapist-reviewed recordings count!)

  // 4. Streaks
  currentStreak: number;
  bestStreak: number;

  // 5. Personal Best
  bestDailyTherapistPercentage: number | null;
  bestDailyAttempts: number;
  longestStreak: number;

  // 6. Exercise statistics ("Qaf — Ka Practice")
  exerciseTotalAttempts: number;
  exerciseTotalReviewed: number;
  exerciseAudioCorrect: number;
  exerciseAudioIncorrect: number;
  exerciseAudioUncertain: number;
  exerciseTherapistCorrect: number;
  exerciseTherapistIncorrect: number;

  // 7. Recent performance (last 7 sessions)
  recentSessions: RecentSessionPerformance[];

  // 8. Recharts Time Series (for the 4 charts)
  dailyChartData: DailyChartPoint[];

  // 9. Multi-Exercise Progress Breakdown
  byExercise: ExercisePracticeStats[];
  exerciseStatsMap: Record<string, ExercisePracticeStats>;

  // Backward compatibility fields
  reviewedAttempts: number;
  correctCount: number;
  incorrectCount: number;
  uncertainCount: number;
  pendingReviewCount: number;
  accuracyRate: number | null;
  weeklyStats: (DailyPracticeStats & { dayName: string })[];
}

/**
 * Calculate streaks from completed or active sessions and recordings.
 * A day counts when the user completes at least one attempt on that day.
 */
export function calculateStreaks(
  sessions: PracticeSession[],
  recordings: Recording[] = []
): { currentStreak: number; bestStreak: number } {
  const daySet = new Set<string>();

  // A day counts when there is at least one recording attempt
  for (const r of recordings) {
    if (r.createdAt) {
      daySet.add(toDateKey(r.createdAt));
    }
  }

  // Also include completed sessions with attempts
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
    .map((key) => {
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
 * Calculate progress statistics for a specific exercise target.
 */
export function getStatisticsForExercise(
  recordings: Recording[],
  exerciseId: string,
  exerciseName?: string,
  targetText?: string,
  targetUnits?: string[],
  difficulty?: 'single' | 'sequence'
): ExercisePracticeStats {
  const matches = recordings.filter((r) => {
    if (r.exerciseId === exerciseId) return true;
    // Map missing exerciseId to canonical Ka
    if (!r.exerciseId && (exerciseId === 'ex-qaf-ka-01' || exerciseId === 'ka')) return true;
    return false;
  });

  const attempts = matches.length;
  let audioCorrect = 0;
  let audioIncorrect = 0;
  let audioUncertain = 0;
  let therapistReviewed = 0;
  let therapistCorrect = 0;
  let therapistIncorrect = 0;
  let therapistUncertain = 0;

  for (const r of matches) {
    if (r.autoResult === 'CORRECT') audioCorrect++;
    else if (r.autoResult === 'INCORRECT' || r.autoResult === 'NEEDS_PRACTICE') audioIncorrect++;
    else if (r.autoResult === 'UNCERTAIN') audioUncertain++;

    if (r.therapistResult) {
      therapistReviewed++;
      if (r.therapistResult === 'CORRECT') therapistCorrect++;
      else if (r.therapistResult === 'INCORRECT') therapistIncorrect++;
      else if (r.therapistResult === 'UNCERTAIN') therapistUncertain++;
    }
  }

  const audioRate = attempts > 0 ? Math.round((audioCorrect / attempts) * 100) : 0;
  const therapistRate = therapistReviewed > 0 ? Math.round((therapistCorrect / therapistReviewed) * 100) : null;

  const derivedUnits = targetUnits && targetUnits.length > 0
    ? targetUnits
    : (targetText ? [targetText] : [exerciseId]);

  return {
    exerciseId,
    name: exerciseName || exerciseId,
    targetText: targetText || derivedUnits.join('، '),
    difficulty: difficulty || (derivedUnits.length > 1 ? 'sequence' : 'single'),
    targetUnits: derivedUnits,
    attempts,
    audioCorrect,
    audioIncorrect,
    audioUncertain,
    audioRate,
    therapistReviewed,
    therapistCorrect,
    therapistIncorrect,
    therapistUncertain,
    therapistRate
  };
}

/**
 * Group practice statistics by exercise
 */
export function groupProgressByExercise(
  recordings: Recording[],
  exercises: Exercise[] = []
): ExercisePracticeStats[] {
  const exerciseMap = new Map<string, Exercise>();
  for (const ex of exercises) {
    exerciseMap.set(ex.id, ex);
  }

  const allIds = new Set<string>();
  for (const ex of exercises) {
    allIds.add(ex.id);
  }
  for (const r of recordings) {
    if (r.exerciseId) allIds.add(r.exerciseId);
  }
  // Default canonical targets if empty
  if (allIds.size === 0) {
    allIds.add('ka');
  }

  const result: ExercisePracticeStats[] = [];
  for (const id of allIds) {
    const ex = exerciseMap.get(id);
    result.push(
      getStatisticsForExercise(
        recordings,
        id,
        ex?.name,
        ex?.targetText,
        ex?.targetUnits,
        ex?.difficulty
      )
    );
  }

  return result;
}

/**
 * Calculate comprehensive statistics from recordings and sessions
 */
export function calculateStatistics(
  recordings: Recording[],
  sessions: PracticeSession[],
  exercises: Exercise[] = []
): AppStatistics {
  const totalAttempts = recordings.length;
  let audioCorrectCount = 0;
  let audioIncorrectCount = 0;
  let audioUncertainCount = 0;
  let therapistReviewedCount = 0;
  let therapistPendingCount = 0;
  let totalTherapistCorrect = 0;
  let totalTherapistIncorrect = 0;
  let totalTherapistUncertain = 0;

  const todayKey = toDateKey(new Date());
  let todayAttempts = 0;
  let todayAudioCorrect = 0;
  let todayAudioIncorrect = 0;
  let todayAudioUncertain = 0;

  // Group by date for personal bests and daily stats
  const dateMap: Record<
    string,
    {
      attempts: number;
      audioCorrect: number;
      durationSeconds: number;
      therapistCorrect: number;
      therapistReviewed: number;
    }
  > = {};

  for (const rec of recordings) {
    const key = toDateKey(rec.createdAt);
    if (!dateMap[key]) {
      dateMap[key] = {
        attempts: 0,
        audioCorrect: 0,
        durationSeconds: 0,
        therapistCorrect: 0,
        therapistReviewed: 0
      };
    }
    dateMap[key].attempts++;
    dateMap[key].durationSeconds += rec.duration || 0;

    // Automatic Audio Results
    if (rec.autoResult === 'CORRECT') {
      audioCorrectCount++;
      dateMap[key].audioCorrect++;
    } else if (rec.autoResult === 'INCORRECT' || rec.autoResult === 'NEEDS_PRACTICE') {
      audioIncorrectCount++;
    } else if (rec.autoResult === 'UNCERTAIN') {
      audioUncertainCount++;
    }

    // Today's specific counts
    if (key === todayKey) {
      todayAttempts++;
      if (rec.autoResult === 'CORRECT') todayAudioCorrect++;
      else if (rec.autoResult === 'INCORRECT' || rec.autoResult === 'NEEDS_PRACTICE') todayAudioIncorrect++;
      else if (rec.autoResult === 'UNCERTAIN') todayAudioUncertain++;
    }

    // Therapist Clinical Reviews
    if (rec.therapistResult) {
      therapistReviewedCount++;
      dateMap[key].therapistReviewed++;
      if (rec.therapistResult === 'CORRECT') {
        totalTherapistCorrect++;
        dateMap[key].therapistCorrect++;
      } else if (rec.therapistResult === 'INCORRECT') {
        totalTherapistIncorrect++;
      } else if (rec.therapistResult === 'UNCERTAIN') {
        totalTherapistUncertain++;
      }
    } else {
      therapistPendingCount++;
    }
  }

  const todayAudioRate =
    todayAttempts > 0 ? Math.round((todayAudioCorrect / todayAttempts) * 100) : 0;

  const therapistConfirmedRate =
    therapistReviewedCount > 0
      ? Math.round((totalTherapistCorrect / therapistReviewedCount) * 100)
      : null;

  const { currentStreak, bestStreak } = calculateStreaks(sessions, recordings);

  // Personal Bests
  let bestDailyAttempts = 0;
  let bestDailyTherapistPercentage: number | null = null;

  for (const day of Object.values(dateMap)) {
    if (day.attempts > bestDailyAttempts) {
      bestDailyAttempts = day.attempts;
    }
    if (day.therapistReviewed > 0) {
      const rate = Math.round((day.therapistCorrect / day.therapistReviewed) * 100);
      if (bestDailyTherapistPercentage === null || rate > bestDailyTherapistPercentage) {
        bestDailyTherapistPercentage = rate;
      }
    }
  }

  // Exercise Statistics for Qaf — Ka Practice ("ex-qaf-ka-01")
  const qafRecs = recordings.filter(
    (r) => !r.exerciseId || r.exerciseId === 'ex-qaf-ka-01'
  );
  const exerciseTotalAttempts = qafRecs.length;
  const exerciseAudioCorrect = qafRecs.filter((r) => r.autoResult === 'CORRECT').length;
  const exerciseAudioIncorrect = qafRecs.filter(
    (r) => r.autoResult === 'INCORRECT' || r.autoResult === 'NEEDS_PRACTICE'
  ).length;
  const exerciseAudioUncertain = qafRecs.filter((r) => r.autoResult === 'UNCERTAIN').length;
  const exerciseTherapistCorrect = qafRecs.filter((r) => r.therapistResult === 'CORRECT').length;
  const exerciseTherapistIncorrect = qafRecs.filter((r) => r.therapistResult === 'INCORRECT').length;
  const exerciseTotalReviewed = qafRecs.filter((r) => !!r.therapistResult).length;

  // Recent Performance: Last 7 Sessions
  const sortedSessions = [...sessions].sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
  );
  const recentSessions: RecentSessionPerformance[] = sortedSessions.slice(0, 7).map((s) => {
    const sRecs = recordings.filter((r) => r.sessionId === s.id);
    const sAttempts = sRecs.length;
    const sAudioCorrect = sRecs.filter((r) => r.autoResult === 'CORRECT').length;
    const sAudioRate = sAttempts > 0 ? Math.round((sAudioCorrect / sAttempts) * 100) : 0;

    const sReviewed = sRecs.filter((r) => !!r.therapistResult);
    const sTherapistCorrect = sReviewed.filter((r) => r.therapistResult === 'CORRECT').length;
    const sTherapistRate =
      sReviewed.length > 0 ? Math.round((sTherapistCorrect / sReviewed.length) * 100) : null;

    return {
      sessionId: s.id,
      dateLabel: formatDateLabel(s.startedAt),
      fullDate: s.startedAt,
      attempts: sAttempts,
      audioRate: sAudioRate,
      therapistRate: sTherapistRate,
      reviewedCount: sReviewed.length
    };
  });

  // Recharts Time Series (Last 7 Days)
  const last7Days = getLastNDaysKeys(7);
  const dailyChartData: DailyChartPoint[] = last7Days.map((dateKey) => {
    const day = dateMap[dateKey] || {
      attempts: 0,
      audioCorrect: 0,
      durationSeconds: 0,
      therapistCorrect: 0,
      therapistReviewed: 0
    };

    const [y, m, d] = dateKey.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    const formattedDate = dateKey === todayKey ? 'Today' : dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

    const audioRate =
      day.attempts > 0 ? Math.round((day.audioCorrect / day.attempts) * 100) : 0;
    const therapistRate =
      day.therapistReviewed > 0
        ? Math.round((day.therapistCorrect / day.therapistReviewed) * 100)
        : null;
    const durationMinutes = Number((day.durationSeconds / 60).toFixed(1));

    return {
      date: formattedDate,
      fullDate: dateKey,
      attempts: day.attempts,
      audioRate,
      therapistRate,
      durationMinutes
    };
  });

  // Backward compatibility weeklyStats
  const weeklyStats = last7Days.map((dateKey) => {
    const dayRecordings = recordings.filter((r) => toDateKey(r.createdAt) === dateKey);
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
    const correctPercentage =
      dayReviewed > 0 ? Math.round((dayCorrect / dayReviewed) * 100) : 0;

    const [y, m, d] = dateKey.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    const dayName =
      dateKey === todayKey
        ? 'Today'
        : dateObj.toLocaleDateString(undefined, { weekday: 'short' });

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

  // Multi-exercise aggregation
  const byExercise = groupProgressByExercise(recordings, exercises);
  const exerciseStatsMap: Record<string, ExercisePracticeStats> = {};
  for (const item of byExercise) {
    exerciseStatsMap[item.exerciseId] = item;
  }

  return {
    totalAttempts,
    audioCorrectCount,
    audioIncorrectCount,
    audioUncertainCount,
    therapistReviewedCount,
    therapistPendingCount,
    todayAttempts,
    todayAudioCorrect,
    todayAudioIncorrect,
    todayAudioUncertain,
    todayAudioRate,
    totalTherapistReviewed: therapistReviewedCount,
    totalTherapistCorrect,
    totalTherapistIncorrect,
    totalTherapistUncertain,
    therapistConfirmedRate,
    currentStreak,
    bestStreak,
    bestDailyAttempts,
    bestDailyTherapistPercentage,
    longestStreak: bestStreak,
    exerciseTotalAttempts,
    exerciseTotalReviewed,
    exerciseAudioCorrect,
    exerciseAudioIncorrect,
    exerciseAudioUncertain,
    exerciseTherapistCorrect,
    exerciseTherapistIncorrect,
    recentSessions,
    dailyChartData,
    byExercise,
    exerciseStatsMap,
    reviewedAttempts: therapistReviewedCount,
    correctCount: totalTherapistCorrect,
    incorrectCount: totalTherapistIncorrect,
    uncertainCount: totalTherapistUncertain,
    pendingReviewCount: therapistPendingCount,
    accuracyRate: therapistConfirmedRate,
    weeklyStats
  };
}

export interface PerUnitStat {
  unit: string;
  totalAttempts: number;
  audioCorrect: number;
  audioRate: number;
  therapistReviewed: number;
  therapistCorrect: number;
  therapistRate: number | null; // %
}

export interface SequenceProgressStat {
  exerciseId: string;
  name: string;
  sequenceDisplay: string;
  targetUnits: string[];
  totalAttempts: number;
  audioCorrect: number;
  audioRate: number;
  therapistReviewed: number;
  therapistCorrect: number;
  therapistRate: number | null; // %
}

/**
 * Calculates per-unit statistics across both single exercises and multi-unit sequence attempts.
 * Examples:
 * کا: 92% therapist-confirmed correct
 * کی: 81%
 * کے: 67%
 * کو: 88%
 */
export function calculatePerUnitStatistics(
  recordings: Recording[],
  units: string[] = ['کا', 'کی', 'کے', 'کو']
): PerUnitStat[] {
  return units.map((targetUnit) => {
    let totalAttempts = 0;
    let audioCorrect = 0;
    let therapistReviewed = 0;
    let therapistCorrect = 0;

    for (const rec of recordings) {
      // Case A: Multi-unit sequence recording
      if (rec.unitResults && rec.unitResults.length > 0) {
        const match = rec.unitResults.find((u) => u.target === targetUnit || u.unit === targetUnit);
        if (match) {
          totalAttempts++;
          if (match.result === 'CORRECT') {
            audioCorrect++;
          }

          // Check therapist unit-level review or overall review
          if (rec.therapistUnitReviews && rec.therapistUnitReviews[targetUnit]) {
            therapistReviewed++;
            if (rec.therapistUnitReviews[targetUnit] === 'CORRECT') {
              therapistCorrect++;
            }
          } else if (rec.therapistResult) {
            therapistReviewed++;
            if (rec.therapistResult === 'CORRECT') {
              therapistCorrect++;
            }
          }
        }
      } else {
        // Case B: Single-unit practice recording
        const isTargetMatch =
          rec.exerciseId === targetUnit ||
          rec.exerciseId.includes(targetUnit) ||
          (targetUnit === 'کا' && (rec.exerciseId === 'ka' || rec.exerciseId === 'ex-qaf-ka-01')) ||
          (targetUnit === 'کی' && rec.exerciseId === 'ki') ||
          (targetUnit === 'کے' && rec.exerciseId === 'ke') ||
          (targetUnit === 'کو' && rec.exerciseId === 'ko');

        if (isTargetMatch) {
          totalAttempts++;
          if (rec.autoResult === 'CORRECT') {
            audioCorrect++;
          }
          if (rec.therapistResult) {
            therapistReviewed++;
            if (rec.therapistResult === 'CORRECT') {
              therapistCorrect++;
            }
          }
        }
      }
    }

    const audioRate = totalAttempts > 0 ? Math.round((audioCorrect / totalAttempts) * 100) : 0;
    const therapistRate =
      therapistReviewed > 0 ? Math.round((therapistCorrect / therapistReviewed) * 100) : null;

    return {
      unit: targetUnit,
      totalAttempts,
      audioCorrect,
      audioRate,
      therapistReviewed,
      therapistCorrect,
      therapistRate
    };
  });
}

/**
 * Calculates sequence-specific statistics without combining unrelated exercises into one metric.
 * Examples:
 * کا → کی: 75%
 * کا → کی → کے: 68%
 * کا → کی → کے → کو: 80%
 */
export function calculateSequenceProgressStats(
  recordings: Recording[],
  exercises: Exercise[] = []
): SequenceProgressStat[] {
  // Find all sequence exercises
  const sequenceExercises = exercises.filter(
    (ex) => (ex.targetUnits && ex.targetUnits.length > 1) || ex.difficulty === 'sequence'
  );

  // If no sequence exercises in list, use standard sequences
  const targetList =
    sequenceExercises.length > 0
      ? sequenceExercises
      : [
          {
            id: 'ka-ki',
            name: 'Ka + Ki',
            targetText: 'کا، کی',
            targetUnits: ['کا', 'کی'],
            difficulty: 'sequence' as const,
            isActive: true,
            createdAt: ''
          },
          {
            id: 'ka-ki-ke',
            name: 'Ka + Ki + Ke',
            targetText: 'کا، کی، کے',
            targetUnits: ['کا', 'کی', 'کے'],
            difficulty: 'sequence' as const,
            isActive: true,
            createdAt: ''
          },
          {
            id: 'ka-ki-ke-ko',
            name: 'Ka + Ki + Ke + Ko',
            targetText: 'کا، کی، کے، کو',
            targetUnits: ['کا', 'کی', 'کے', 'کو'],
            difficulty: 'sequence' as const,
            isActive: true,
            createdAt: ''
          }
        ];

  return targetList.map((ex) => {
    const units = ex.targetUnits || ex.targetText.split(/[،,]/).map((s) => s.trim());
    const display = units.join(' → ');

    // Filter recordings for this specific sequence
    const matches = recordings.filter(
      (r) =>
        r.exerciseId === ex.id ||
        (r.unitResults &&
          r.unitResults.length === units.length &&
          r.unitResults.every((u, i) => (u.target || u.unit) === units[i]))
    );

    const totalAttempts = matches.length;
    let audioCorrect = 0;
    let therapistReviewed = 0;
    let therapistCorrect = 0;

    for (const r of matches) {
      if (r.autoResult === 'CORRECT') {
        audioCorrect++;
      }
      if (r.therapistResult) {
        therapistReviewed++;
        if (r.therapistResult === 'CORRECT') {
          therapistCorrect++;
        }
      }
    }

    const audioRate = totalAttempts > 0 ? Math.round((audioCorrect / totalAttempts) * 100) : 0;
    const therapistRate =
      therapistReviewed > 0 ? Math.round((therapistCorrect / therapistReviewed) * 100) : null;

    return {
      exerciseId: ex.id,
      name: ex.name,
      sequenceDisplay: display,
      targetUnits: units,
      totalAttempts,
      audioCorrect,
      audioRate,
      therapistReviewed,
      therapistCorrect,
      therapistRate
    };
  });
}

