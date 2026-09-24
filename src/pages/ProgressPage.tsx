import React, { useState, useEffect } from 'react';
import { getAllSessions } from '../storage/sessionRepository';
import { getAllRecordings } from '../storage/recordingRepository';
import { useSettings } from '../hooks/useSettings';
import { PracticeSession, Recording } from '../types';
import { calculateStatistics } from '../utils/statistics';
import { ProgressSummary } from '../components/progress/ProgressSummary';
import { PracticeChart } from '../components/progress/PracticeChart';
import { ProgressBar } from '../components/ui/ProgressBar';
import { Card } from '../components/ui/Card';
import { Flame, Target, CheckCircle2 } from 'lucide-react';

export const ProgressPage: React.FC = () => {
  const { settings, updateSettings } = useSettings();
  const [sessions, setSessions] = useState<PracticeSession[]>([]);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [loadedSessions, loadedRecordings] = await Promise.all([
          getAllSessions(),
          getAllRecordings()
        ]);
        setSessions(loadedSessions);
        setRecordings(loadedRecordings);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const stats = calculateStatistics(recordings, sessions);
  const dailyGoal = settings.dailyGoal || 10;
  const isGoalCompleted = stats.todayAttempts >= dailyGoal;

  const goalOptions = [5, 10, 15, 20, 25];

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-200">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          Progress & Analytics
        </h1>
        <p className="text-sm text-slate-500 font-medium mt-0.5">
          Track practice volume, habit consistency, and therapist evaluation results
        </p>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-8 h-8 border-3 border-teal-600 border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-xs text-slate-500">Calculating practice statistics...</p>
        </div>
      ) : (
        <>
          {/* Top Row: Daily Goal & Streak Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Today's Goal Card */}
            <Card className="p-5 sm:p-6 bg-white border-slate-200/90 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center">
                      <Target className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-slate-900">Today&apos;s Goal</h2>
                      <span className="text-[11px] text-slate-400">Target repetitions</span>
                    </div>
                  </div>

                  <span className="text-xl font-extrabold text-teal-800">
                    {stats.todayAttempts} / {dailyGoal}
                  </span>
                </div>

                <div className="mt-3">
                  <ProgressBar
                    value={stats.todayAttempts}
                    max={dailyGoal}
                    color={isGoalCompleted ? 'emerald' : 'teal'}
                    size="md"
                  />
                </div>

                {isGoalCompleted && (
                  <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-emerald-800 bg-emerald-50 p-2.5 rounded-xl border border-emerald-200/60">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Today&apos;s practice goal completed.</span>
                  </div>
                )}
              </div>

              {/* Goal Selector */}
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">Adjust Daily Goal:</span>
                <div className="flex items-center gap-1.5">
                  {goalOptions.map((goal) => (
                    <button
                      key={goal}
                      type="button"
                      onClick={() => updateSettings({ dailyGoal: goal })}
                      className={`text-xs px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                        dailyGoal === goal
                          ? 'bg-teal-600 text-white shadow-2xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {goal}
                    </button>
                  ))}
                </div>
              </div>
            </Card>

            {/* Practice Streak Card */}
            <Card className="p-5 sm:p-6 bg-white border-slate-200/90 flex flex-col justify-between">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Flame className="w-4 h-4 fill-amber-500" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Practice Streak</h2>
                  <span className="text-[11px] text-slate-400">Daily habit tracking</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 my-2">
                <div className="p-3 bg-amber-50/50 rounded-2xl border border-amber-100/80">
                  <span className="text-xs font-semibold text-amber-800 block">Current Streak</span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-3xl font-extrabold text-amber-900">
                      {stats.currentStreak}
                    </span>
                    <span className="text-xs font-semibold text-amber-700">days</span>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                  <span className="text-xs font-semibold text-slate-600 block">Best Streak</span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-3xl font-extrabold text-slate-800">
                      {stats.bestStreak}
                    </span>
                    <span className="text-xs font-semibold text-slate-500">days</span>
                  </div>
                </div>
              </div>

              <p className="text-[11px] text-slate-400 mt-2">
                * A day counts when you complete at least one practice session.
              </p>
            </Card>
          </div>

          {/* Progress Summary Cards */}
          <section aria-labelledby="all-time-heading">
            <h2 id="all-time-heading" className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-3 px-1">
              Overall Practice & Review Breakdown
            </h2>
            <ProgressSummary stats={stats} />
          </section>

          {/* Weekly Practice Chart */}
          <section aria-labelledby="chart-heading">
            <h2 id="chart-heading" className="sr-only">
              Weekly Practice Chart
            </h2>
            <PracticeChart data={stats.weeklyStats} />
          </section>

          {/* Clinical Disclaimer */}
          <div className="p-4 bg-slate-100/70 border border-slate-200/80 rounded-2xl text-[11px] text-slate-600 leading-relaxed">
            <p className="font-semibold text-slate-700 mb-0.5">Clinical Disclaimer</p>
            Correctness metrics only reflect explicit manual assessments performed by your speech-language therapist. The application does not automatically diagnose, calculate confidence from audio, or make medical claims.
          </div>
        </>
      )}
    </div>
  );
};
