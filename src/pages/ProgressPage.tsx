import React, { useState, useEffect } from 'react';
import { getAllSessions } from '../storage/sessionRepository';
import { getAllRecordings } from '../storage/recordingRepository';
import { useSettings } from '../hooks/useSettings';
import { PracticeSession, Recording } from '../types';
import { calculateStatistics } from '../utils/statistics';
import { Phase7Charts } from '../components/progress/Phase7Charts';
import { ProgressBar } from '../components/ui/ProgressBar';
import { downloadPracticeBackup } from '../utils/export';
import {
  CheckCircle2,
  XCircle,
  HelpCircle,
  UserCheck,
  Clock,
  Flame,
  Award,
  Download,
  ShieldAlert,
  Info,
  ChevronRight
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const ProgressPage: React.FC = () => {
  const navigate = useNavigate();
  const { settings, updateSettings } = useSettings();
  const [sessions, setSessions] = useState<PracticeSession[]>([]);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isExporting, setIsExporting] = useState<boolean>(false);

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

  const handleExportBackup = async () => {
    try {
      setIsExporting(true);
      await downloadPracticeBackup();
    } catch (err) {
      console.error('Failed to export data:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const todayDateString = new Date().toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-200 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Progress & Analytics
          </h1>
          <p className="text-sm text-slate-500 font-medium mt-0.5">
            Track speech practice volume, acoustic patterns, and confirmed therapist evaluations
          </p>
        </div>

        <button
          type="button"
          onClick={handleExportBackup}
          disabled={isExporting}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition active:scale-95 cursor-pointer shadow-xs self-start sm:self-auto"
        >
          <Download className="w-3.5 h-3.5 text-teal-600" />
          <span>{isExporting ? 'Exporting...' : 'Export Progress Data'}</span>
        </button>
      </div>

      {/* Mandatory Clinical Limitation Notice */}
      <section
        aria-label="Clinical disclaimer"
        className="p-4 sm:p-5 rounded-2xl bg-amber-50/80 border border-amber-200/90 text-amber-950 flex items-start gap-3.5 shadow-xs"
      >
        <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="space-y-1 text-xs sm:text-sm leading-relaxed">
          <p className="font-semibold text-amber-900">
            Audio-based practice feedback. Confirm pronunciation with your speech therapist.
          </p>
          <p className="text-amber-800/90">
            Acoustic improvements in this application reflect speech audio similarity to practice examples, not physical tongue articulatory placement or a clinical cure. Always confirm articulation progress with your licensed Speech-Language Pathologist.
          </p>
        </div>
      </section>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-8 h-8 border-3 border-teal-600 border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-xs text-slate-500">Calculating practice statistics from IndexedDB...</p>
        </div>
      ) : (
        <>
          {/* 1. PROGRESS DASHBOARD */}
          <section aria-labelledby="dashboard-heading" className="space-y-3">
            <h2 id="dashboard-heading" className="text-xs font-bold uppercase tracking-wider text-slate-500 px-1">
              Progress Dashboard (Overall)
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs">
                <span className="text-[11px] font-medium text-slate-500 block">Total Attempts</span>
                <span className="text-2xl font-extrabold text-slate-900 font-mono mt-1 block">
                  {stats.totalAttempts}
                </span>
                <span className="text-[10px] text-slate-400 mt-0.5 block">Recorded takes</span>
              </div>

              <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs">
                <span className="text-[11px] font-semibold text-emerald-700 block flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  Correct
                </span>
                <span className="text-2xl font-extrabold text-emerald-700 font-mono mt-1 block">
                  {stats.audioCorrectCount}
                </span>
                <span className="text-[10px] text-slate-400 mt-0.5 block">Audio result</span>
              </div>

              <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs">
                <span className="text-[11px] font-semibold text-rose-700 block flex items-center gap-1">
                  <XCircle className="w-3 h-3" />
                  Incorrect
                </span>
                <span className="text-2xl font-extrabold text-rose-700 font-mono mt-1 block">
                  {stats.audioIncorrectCount}
                </span>
                <span className="text-[10px] text-slate-400 mt-0.5 block">Audio result</span>
              </div>

              <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs">
                <span className="text-[11px] font-semibold text-amber-700 block flex items-center gap-1">
                  <HelpCircle className="w-3 h-3" />
                  Uncertain
                </span>
                <span className="text-2xl font-extrabold text-amber-700 font-mono mt-1 block">
                  {stats.audioUncertainCount}
                </span>
                <span className="text-[10px] text-slate-400 mt-0.5 block">Needs repeat</span>
              </div>

              <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs">
                <span className="text-[11px] font-semibold text-indigo-700 block flex items-center gap-1">
                  <UserCheck className="w-3 h-3" />
                  Therapist Reviewed
                </span>
                <span className="text-2xl font-extrabold text-indigo-800 font-mono mt-1 block">
                  {stats.therapistReviewedCount}
                </span>
                <span className="text-[10px] text-indigo-500 mt-0.5 block">Clinical evaluation</span>
              </div>

              <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs">
                <span className="text-[11px] font-medium text-slate-500 block flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Pending Review
                </span>
                <span className="text-2xl font-extrabold text-slate-600 font-mono mt-1 block">
                  {stats.therapistPendingCount}
                </span>
                <span className="text-[10px] text-slate-400 mt-0.5 block">Awaiting therapist</span>
              </div>
            </div>
          </section>

          {/* 2. DAILY PROGRESS & 3. THERAPIST-CONFIRMED PROGRESS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Daily Progress Card */}
            <div className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-6 shadow-xs flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <span className="text-[11px] font-bold text-teal-700 bg-teal-50 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                      Daily Progress
                    </span>
                    <h3 className="text-lg font-bold text-slate-900 mt-1">
                      {todayDateString}
                    </h3>
                  </div>
                  <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-xl">
                    Goal: {dailyGoal}
                  </span>
                </div>

                {/* Today's Tally Breakdown */}
                <div className="grid grid-cols-4 gap-2 my-4 text-center">
                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[10px] text-slate-500 block">Attempts</span>
                    <span className="text-lg font-extrabold text-slate-900 font-mono">{stats.todayAttempts}</span>
                  </div>
                  <div className="p-2.5 bg-emerald-50/60 rounded-xl border border-emerald-100">
                    <span className="text-[10px] text-emerald-700 block font-semibold">Correct</span>
                    <span className="text-lg font-extrabold text-emerald-700 font-mono">{stats.todayAudioCorrect}</span>
                  </div>
                  <div className="p-2.5 bg-rose-50/60 rounded-xl border border-rose-100">
                    <span className="text-[10px] text-rose-700 block font-semibold">Incorrect</span>
                    <span className="text-lg font-extrabold text-rose-700 font-mono">{stats.todayAudioIncorrect}</span>
                  </div>
                  <div className="p-2.5 bg-amber-50/60 rounded-xl border border-amber-100">
                    <span className="text-[10px] text-amber-700 block font-semibold">Uncertain</span>
                    <span className="text-lg font-extrabold text-amber-700 font-mono">{stats.todayAudioUncertain}</span>
                  </div>
                </div>

                <div className="p-3 bg-teal-50/60 border border-teal-100/80 rounded-2xl flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-teal-950 block">
                      Audio-based correct rate
                    </span>
                    <span className="text-[10px] font-semibold text-teal-700 uppercase tracking-wider block">
                      &ldquo;Audio-based result&rdquo;
                    </span>
                  </div>
                  <span className="text-2xl font-extrabold text-teal-800 font-mono">
                    {stats.todayAudioRate}%
                  </span>
                </div>

                <div className="mt-3">
                  <ProgressBar
                    value={stats.todayAttempts}
                    max={dailyGoal}
                    color={isGoalCompleted ? 'emerald' : 'teal'}
                    size="sm"
                  />
                </div>
              </div>

              {/* Goal Selector */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-500">Target Repetitions:</span>
                <div className="flex items-center gap-1.5">
                  {goalOptions.map((goal) => (
                    <button
                      key={goal}
                      type="button"
                      onClick={() => updateSettings({ dailyGoal: goal })}
                      className={`px-2 py-0.5 rounded-lg font-bold transition cursor-pointer ${
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
            </div>

            {/* Therapist-Confirmed Progress Card (Separated) */}
            <div className="bg-white rounded-3xl border border-indigo-200/80 p-5 sm:p-6 shadow-xs flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between border-b border-indigo-100 pb-3">
                  <div>
                    <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                      Clinical Evaluation
                    </span>
                    <h3 className="text-lg font-bold text-slate-900 mt-1">
                      Therapist-Confirmed Results
                    </h3>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-xl font-semibold">
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>Clinician Verified</span>
                  </div>
                </div>

                {/* Therapist Tally Breakdown */}
                <div className="grid grid-cols-3 gap-2 my-4 text-center">
                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[10px] text-slate-500 block">Reviewed</span>
                    <span className="text-lg font-extrabold text-slate-900 font-mono">
                      {stats.totalTherapistReviewed}
                    </span>
                  </div>
                  <div className="p-2.5 bg-emerald-50/60 rounded-xl border border-emerald-100">
                    <span className="text-[10px] text-emerald-700 block font-semibold">Correct</span>
                    <span className="text-lg font-extrabold text-emerald-700 font-mono">
                      {stats.totalTherapistCorrect}
                    </span>
                  </div>
                  <div className="p-2.5 bg-rose-50/60 rounded-xl border border-rose-100">
                    <span className="text-[10px] text-rose-700 block font-semibold">Incorrect</span>
                    <span className="text-lg font-extrabold text-rose-700 font-mono">
                      {stats.totalTherapistIncorrect}
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-indigo-50/70 border border-indigo-200/80 rounded-2xl flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-indigo-950 block">
                      Therapist-confirmed rate
                    </span>
                    <span className="text-[10px] text-indigo-700 leading-tight block">
                      Only therapist-reviewed recordings count in this statistic.
                    </span>
                  </div>
                  <span className="text-2xl font-extrabold text-indigo-900 font-mono">
                    {stats.therapistConfirmedRate !== null ? `${stats.therapistConfirmedRate}%` : 'N/A'}
                  </span>
                </div>
              </div>

              <p className="text-[11px] text-slate-500 leading-relaxed pt-2 border-t border-slate-100">
                Notice: Automatic audio results are never mixed with therapist clinical verdicts.
              </p>
            </div>
          </div>

          {/* 4. CHARTS SECTION (Recharts - 4 Visualizations) */}
          <section aria-labelledby="charts-heading">
            <h2 id="charts-heading" className="sr-only">
              Practice Trend Charts
            </h2>
            <Phase7Charts data={stats.dailyChartData} />
          </section>

          {/* 5. STREAK & 6. PERSONAL BEST */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Streak Card */}
            <div className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-3">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Flame className="w-4 h-4 fill-amber-500" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Practice Consistency Streak</h3>
                  <span className="text-[11px] text-slate-400">Daily engagement</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="p-3.5 bg-amber-50/60 rounded-2xl border border-amber-100">
                  <span className="text-xs font-semibold text-amber-800 block">Current Streak</span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-3xl font-extrabold text-amber-950 font-mono">
                      {stats.currentStreak}
                    </span>
                    <span className="text-xs font-bold text-amber-700">days</span>
                  </div>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/70">
                  <span className="text-xs font-semibold text-slate-600 block">Best Streak</span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-3xl font-extrabold text-slate-900 font-mono">
                      {stats.bestStreak}
                    </span>
                    <span className="text-xs font-bold text-slate-500">days</span>
                  </div>
                </div>
              </div>

              <p className="text-[11px] text-slate-400 leading-relaxed">
                * A day counts when you complete at least one practice attempt.
              </p>
            </div>

            {/* Personal Best Card */}
            <div className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-3">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center">
                  <Award className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Personal Best Records</h3>
                  <span className="text-[11px] text-slate-400">Milestones achieved</span>
                </div>
              </div>

              <div className="space-y-2 pt-1 text-xs">
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                  <span className="font-semibold text-slate-700">Best Daily Therapist-Confirmed %:</span>
                  <span className="font-mono font-extrabold text-indigo-700 text-sm">
                    {stats.bestDailyTherapistPercentage !== null ? `${stats.bestDailyTherapistPercentage}%` : 'Pending'}
                  </span>
                </div>

                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                  <span className="font-semibold text-slate-700">Best Daily Number of Attempts:</span>
                  <span className="font-mono font-extrabold text-teal-700 text-sm">
                    {stats.bestDailyAttempts} attempts
                  </span>
                </div>

                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                  <span className="font-semibold text-slate-700">Longest Practice Streak:</span>
                  <span className="font-mono font-extrabold text-amber-700 text-sm">
                    {stats.longestStreak} days
                  </span>
                </div>
              </div>

              <p className="text-[11px] text-slate-400 italic">
                * Milestones represent personal practice consistency, not medical diagnoses.
              </p>
            </div>
          </div>

          {/* 7. EXERCISE STATISTICS ("Qaf — Ka Practice") */}
          <section aria-labelledby="exercise-stats-heading" className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <span className="text-[11px] font-bold text-teal-800 bg-teal-50 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                  Target Specific Statistics
                </span>
                <h3 id="exercise-stats-heading" className="text-lg font-bold text-slate-900 mt-1 flex items-center gap-2">
                  <span>Qaf — Ka Practice</span>
                  <span className="font-arabic text-xl font-bold text-teal-800">کا</span>
                </h3>
              </div>

              <button
                type="button"
                onClick={() => navigate('/practice')}
                className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:text-teal-900 transition self-start sm:self-auto cursor-pointer"
              >
                <span>Practice this target</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5 text-center text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[10px] text-slate-500 block">Total attempts</span>
                <span className="text-base font-extrabold text-slate-900 font-mono mt-0.5 block">
                  {stats.exerciseTotalAttempts}
                </span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[10px] text-slate-500 block">Total reviewed</span>
                <span className="text-base font-extrabold text-indigo-700 font-mono mt-0.5 block">
                  {stats.exerciseTotalReviewed}
                </span>
              </div>

              <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-100">
                <span className="text-[10px] text-emerald-700 block font-semibold">Audio Correct</span>
                <span className="text-base font-extrabold text-emerald-700 font-mono mt-0.5 block">
                  {stats.exerciseAudioCorrect}
                </span>
              </div>

              <div className="p-3 bg-rose-50/50 rounded-xl border border-rose-100">
                <span className="text-[10px] text-rose-700 block font-semibold">Audio Incorrect</span>
                <span className="text-base font-extrabold text-rose-700 font-mono mt-0.5 block">
                  {stats.exerciseAudioIncorrect}
                </span>
              </div>

              <div className="p-3 bg-amber-50/50 rounded-xl border border-amber-100">
                <span className="text-[10px] text-amber-700 block font-semibold">Audio Uncertain</span>
                <span className="text-base font-extrabold text-amber-700 font-mono mt-0.5 block">
                  {stats.exerciseAudioUncertain}
                </span>
              </div>

              <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100">
                <span className="text-[10px] text-indigo-700 block font-semibold">Therapist Correct</span>
                <span className="text-base font-extrabold text-indigo-800 font-mono mt-0.5 block">
                  {stats.exerciseTherapistCorrect}
                </span>
              </div>

              <div className="p-3 bg-rose-50/50 rounded-xl border border-rose-100">
                <span className="text-[10px] text-rose-700 block font-semibold">Therapist Incorrect</span>
                <span className="text-base font-extrabold text-rose-800 font-mono mt-0.5 block">
                  {stats.exerciseTherapistIncorrect}
                </span>
              </div>
            </div>
          </section>

          {/* 8. RECENT PERFORMANCE (Last 7 Sessions) */}
          <section aria-labelledby="recent-perf-heading" className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h3 id="recent-perf-heading" className="text-base font-bold text-slate-900">
                Recent Performance (Last 7 Sessions)
              </h3>
              <p className="text-xs text-slate-500">
                Clear distinction between automated audio-based comparisons and therapist-confirmed evaluations
              </p>
            </div>

            {stats.recentSessions.length === 0 ? (
              <p className="text-xs text-slate-500 italic py-4 text-center">
                No completed practice sessions yet.
              </p>
            ) : (
              <div className="space-y-2.5">
                {stats.recentSessions.map((session, i) => (
                  <div
                    key={session.sessionId || i}
                    className="p-3.5 rounded-2xl border border-slate-200/80 bg-slate-50/50 hover:bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs transition"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-xl bg-teal-100 text-teal-800 font-bold flex items-center justify-center font-mono">
                        #{i + 1}
                      </span>
                      <div>
                        <span className="font-bold text-slate-800 block text-sm">
                          {session.dateLabel}
                        </span>
                        <span className="text-[11px] text-slate-400 font-mono">
                          {session.attempts} attempts
                        </span>
                      </div>
                    </div>

                    {/* Both Rates Clearly Labeled Separately */}
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="px-3 py-1.5 rounded-xl bg-teal-50 border border-teal-200/70 flex items-center gap-2">
                        <span className="text-[11px] text-teal-700 font-semibold">Audio-based:</span>
                        <span className="font-mono font-extrabold text-teal-900 text-sm">
                          {session.audioRate}%
                        </span>
                      </div>

                      <div className="px-3 py-1.5 rounded-xl bg-indigo-50 border border-indigo-200/70 flex items-center gap-2">
                        <span className="text-[11px] text-indigo-700 font-semibold">Therapist-confirmed:</span>
                        <span className="font-mono font-extrabold text-indigo-900 text-sm">
                          {session.therapistRate !== null ? `${session.therapistRate}%` : 'Pending Review'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Clinical Guidelines Footer */}
          <footer className="p-4 rounded-2xl bg-slate-100/70 border border-slate-200 text-xs text-slate-600 space-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-slate-800">
              <Info className="w-4 h-4 text-teal-600" />
              <span>Personal Practice Aid Notice</span>
            </div>
            <p className="leading-relaxed">
              All statistical data is stored strictly on your local device via IndexedDB. Automated scores represent acoustic signal analysis and are not a medical diagnosis. Confirm all therapy progression with your speech-language clinician.
            </p>
          </footer>
        </>
      )}
    </div>
  );
};
