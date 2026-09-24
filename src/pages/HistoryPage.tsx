import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllSessions } from '../storage/sessionRepository';
import { getAllRecordings } from '../storage/recordingRepository';
import { PracticeSession, Recording } from '../types';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { formatDateLabel, formatTime, toDateKey } from '../utils/dates';
import { History, Calendar, CheckCircle2, XCircle, ArrowRight, Mic } from 'lucide-react';

export const HistoryPage: React.FC = () => {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<PracticeSession[]>([]);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function loadHistory() {
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
    loadHistory();
  }, []);

  // Group sessions by date key
  const groupedSessions = sessions.reduce<Record<string, PracticeSession[]>>((acc, session) => {
    const key = toDateKey(session.startedAt);
    if (!acc[key]) acc[key] = [];
    acc[key].push(session);
    return acc;
  }, {});

  const dateKeys = Object.keys(groupedSessions);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          Practice History
        </h1>
        <p className="text-sm text-slate-500 font-medium mt-0.5">
          View all completed and recorded speech sessions
        </p>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-8 h-8 border-3 border-teal-600 border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-xs text-slate-500">Loading history records...</p>
        </div>
      ) : sessions.length === 0 ? (
        <Card className="p-8 sm:p-12 text-center bg-white border-dashed">
          <div className="w-14 h-14 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center mx-auto mb-4">
            <History className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-slate-800">No practice history yet</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto leading-relaxed">
            Recordings from your practice sessions will appear here grouped by day so you and your therapist can review pronunciation.
          </p>
          <div className="mt-5">
            <Button
              variant="primary"
              size="md"
              onClick={() => navigate('/practice')}
              leftIcon={<Mic className="w-4 h-4" />}
            >
              Start Practice Session
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-8">
          {dateKeys.map((dateKey) => {
            const daySessions = groupedSessions[dateKey];
            const dateLabel = formatDateLabel(daySessions[0].startedAt);

            return (
              <section key={dateKey} className="space-y-3">
                <div className="flex items-center gap-2 px-1">
                  <Calendar className="w-4 h-4 text-teal-600" />
                  <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                    {dateLabel}
                  </h2>
                  <span className="text-xs text-slate-400 font-medium">
                    ({daySessions.length} {daySessions.length === 1 ? 'session' : 'sessions'})
                  </span>
                </div>

                <div className="space-y-3">
                  {daySessions.map((session) => {
                    // Match recordings belonging to this session
                    const sessionRecs = recordings.filter((r) => r.sessionId === session.id);
                    const reviewedCount = sessionRecs.filter((r) => !!r.therapistResult).length;
                    const correctCount = sessionRecs.filter((r) => r.therapistResult === 'CORRECT').length;
                    const incorrectCount = sessionRecs.filter((r) => r.therapistResult === 'INCORRECT').length;
                    const uncertainCount = sessionRecs.filter((r) => r.therapistResult === 'UNCERTAIN').length;

                    return (
                      <Card
                        key={session.id}
                        padding="md"
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white hover:border-slate-300 transition-all"
                      >
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-slate-900 text-base">
                              Qaf — Ka Practice
                            </h3>
                            <span className="text-xs text-slate-400">
                              at {formatTime(session.startedAt)}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-3 text-xs">
                            <span className="font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                              {session.attemptCount || sessionRecs.length} attempts
                            </span>

                            {reviewedCount > 0 ? (
                              <>
                                <span className="text-slate-500 font-medium">
                                  {reviewedCount} reviewed
                                </span>
                                {correctCount > 0 && (
                                  <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-md">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                    {correctCount} correct
                                  </span>
                                )}
                                {incorrectCount > 0 && (
                                  <span className="inline-flex items-center gap-1 text-rose-700 font-semibold bg-rose-50 px-2 py-0.5 rounded-md">
                                    <XCircle className="w-3 h-3 text-rose-600" />
                                    {incorrectCount} incorrect
                                  </span>
                                )}
                                {uncertainCount > 0 && (
                                  <span className="text-amber-700 font-semibold bg-amber-50 px-2 py-0.5 rounded-md">
                                    {uncertainCount} uncertain
                                  </span>
                                )}
                              </>
                            ) : (
                              <span className="text-slate-400 italic">
                                Pending therapist review
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="shrink-0">
                          <Button
                            variant="outline"
                            size="md"
                            fullWidth
                            className="sm:w-auto"
                            onClick={() => navigate(`/history/${session.id}`)}
                            rightIcon={<ArrowRight className="w-4 h-4" />}
                          >
                            View Session
                          </Button>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
};
