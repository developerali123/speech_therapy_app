import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ExerciseCard } from '../components/practice/ExerciseCard';
import { ProgressBar } from '../components/ui/ProgressBar';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { useExercises } from '../hooks/useExercises';
import { useSettings } from '../hooks/useSettings';
import { getAllSessions } from '../storage/sessionRepository';
import { getAllRecordings } from '../storage/recordingRepository';
import { PracticeSession, Recording } from '../types';
import { calculateStatistics } from '../utils/statistics';
import { formatDateLabel, formatTime } from '../utils/dates';
import { ArrowRight, CheckCircle2, Flame, Clock, Sliders } from 'lucide-react';

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { activeExercise, loading: loadingExercise } = useExercises();
  const { settings } = useSettings();

  const [sessions, setSessions] = useState<PracticeSession[]>([]);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loadingData, setLoadingData] = useState<boolean>(true);

  useEffect(() => {
    async function loadData() {
      try {
        setLoadingData(true);
        const [loadedSessions, loadedRecordings] = await Promise.all([
          getAllSessions(),
          getAllRecordings()
        ]);
        setSessions(loadedSessions);
        setRecordings(loadedRecordings);
      } finally {
        setLoadingData(false);
      }
    }
    loadData();
  }, []);

  const stats = calculateStatistics(recordings, sessions);
  const dailyGoal = settings.dailyGoal || 10;
  const isGoalCompleted = stats.todayAttempts >= dailyGoal;

  // Recent sessions (last 3)
  const recentSessions = sessions.slice(0, 3);

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-200">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Speech Practice
          </h1>
          <p className="text-sm text-slate-500 font-medium mt-0.5">
            {settings.userName ? `Welcome back, ${settings.userName} — ` : ''}Your speech practice space
          </p>
        </div>

        {/* Practice Streak Badge */}
        {stats.currentStreak > 0 && (
          <div className="flex items-center gap-2 self-start sm:self-auto bg-amber-50 border border-amber-200/80 px-3.5 py-1.5 rounded-2xl shadow-2xs">
            <Flame className="w-5 h-5 text-amber-500 fill-amber-500" />
            <div className="text-left">
              <span className="text-xs font-bold text-amber-900 block leading-tight">
                {stats.currentStreak} Day Streak!
              </span>
              <span className="text-[10px] text-amber-700 block">Best: {stats.bestStreak} days</span>
            </div>
          </div>
        )}
      </div>

      {/* Today's Practice Progress Card */}
      <Card className="p-5 sm:p-6 bg-white border-slate-200/80">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Today&apos;s Practice
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Goal: {dailyGoal} attempts
            </p>
          </div>
          <span className="text-lg font-extrabold text-teal-700">
            {stats.todayAttempts} / {dailyGoal} attempts
          </span>
        </div>

        <ProgressBar
          value={stats.todayAttempts}
          max={dailyGoal}
          color={isGoalCompleted ? 'emerald' : 'teal'}
          size="md"
        />

        {isGoalCompleted && (
          <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-emerald-800 bg-emerald-50 p-2.5 rounded-xl border border-emerald-200/60">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Today&apos;s practice goal completed. Great job!</span>
          </div>
        )}
      </Card>

      {/* Current Exercise Card */}
      <section aria-labelledby="current-exercise-title">
        <div className="flex items-center justify-between mb-2 px-1">
          <h2 id="current-exercise-title" className="text-xs font-bold uppercase tracking-wider text-slate-600">
            Current Exercise
          </h2>
          <span className="text-xs font-semibold text-teal-700">Daily Target</span>
        </div>

        {activeExercise ? (
          <div className="space-y-3">
            <ExerciseCard exercise={activeExercise} />
            <div className="flex items-center justify-between p-3.5 bg-teal-50/70 border border-teal-200/80 rounded-2xl">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-teal-600 text-white flex items-center justify-center shrink-0">
                  <Sliders className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-teal-900 block leading-tight">
                    Therapist Calibration Active
                  </span>
                  <span className="text-[11px] text-teal-700">
                    4 correct & 3 contrast references for &ldquo;کا&rdquo;
                  </span>
                </div>
              </div>
              <Link
                to="/calibration"
                className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:text-teal-900 transition"
              >
                <span>Tune / Add</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        ) : loadingExercise ? (
          <Card className="p-8 text-center text-xs text-slate-400">Loading target exercise...</Card>
        ) : null}
      </section>

      {/* Today's Summary Cards */}
      <section aria-labelledby="todays-summary-title">
        <div className="flex items-center justify-between mb-2 px-1">
          <h2 id="todays-summary-title" className="text-xs font-bold uppercase tracking-wider text-slate-600">
            Today&apos;s Summary
          </h2>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card padding="md" className="bg-white">
            <span className="text-xs font-semibold text-slate-500 block">Attempts</span>
            <span className="text-2xl font-extrabold text-slate-900 mt-1 block">
              {stats.todayAttempts}
            </span>
          </Card>

          <Card padding="md" className="bg-white">
            <span className="text-xs font-semibold text-slate-500 block">Reviewed</span>
            <span className="text-2xl font-extrabold text-indigo-700 mt-1 block">
              {stats.reviewedAttempts}
            </span>
          </Card>

          <Card padding="md" className="bg-white">
            <span className="text-xs font-semibold text-slate-500 block">Correct</span>
            <span className="text-2xl font-extrabold text-emerald-600 mt-1 block">
              {stats.correctCount}
            </span>
          </Card>

          <Card padding="md" className="bg-white">
            <span className="text-xs font-semibold text-slate-500 block">Incorrect</span>
            <span className="text-2xl font-extrabold text-rose-600 mt-1 block">
              {stats.incorrectCount}
            </span>
          </Card>
        </div>
      </section>

      {/* Recent Practice Sessions */}
      <section aria-labelledby="recent-practice-title">
        <div className="flex items-center justify-between mb-2 px-1">
          <h2 id="recent-practice-title" className="text-xs font-bold uppercase tracking-wider text-slate-600">
            Recent Practice
          </h2>
          {sessions.length > 0 && (
            <Link
              to="/history"
              className="text-xs font-semibold text-teal-700 hover:text-teal-800"
            >
              View all
            </Link>
          )}
        </div>

        {loadingData ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : sessions.length === 0 ? (
          <Card className="p-8 text-center bg-white border-dashed">
            <div className="w-12 h-12 rounded-full bg-teal-50 text-teal-600 flex items-center justify-center mx-auto mb-3">
              <Clock className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">No practice sessions yet</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
              Ready to begin? Tap Practice Now to record your first repetition of &quot;کا&quot;.
            </p>
            {activeExercise && (
              <div className="mt-4">
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => navigate(`/practice/${activeExercise.id}`)}
                >
                  Start First Session
                </Button>
              </div>
            )}
          </Card>
        ) : (
          <div className="space-y-2.5">
            {recentSessions.map((session) => (
              <Card
                key={session.id}
                padding="md"
                className="flex items-center justify-between hover:border-slate-300 transition-colors"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900">
                      {formatDateLabel(session.startedAt)}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      at {formatTime(session.startedAt)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Qaf — Ka Practice • {session.attemptCount} attempts
                  </p>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/history/${session.id}`)}
                  rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
                >
                  View
                </Button>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Clinical Disclaimer Footer */}
      <div className="p-4 bg-slate-100/70 border border-slate-200/80 rounded-2xl text-[11px] text-slate-600 leading-relaxed">
        <p className="font-semibold text-slate-700 mb-0.5">Important Clinical Notice</p>
        This application supports speech practice and progress tracking. It does not diagnose speech disorders, determine tongue position, or replace guidance from a qualified speech therapist.
      </div>
    </div>
  );
};
