import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllSessions } from '../storage/sessionRepository';
import { getAllRecordings, updateRecording, deleteRecording } from '../storage/recordingRepository';
import { PracticeSession, Recording, TherapistResult } from '../types';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { PracticeAttempt } from '../components/practice/PracticeAttempt';
import { formatDateLabel, formatTime, toDateKey, formatSessionDuration } from '../utils/dates';
import {
  History,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Mic,
  ChevronDown,
  ChevronUp,
  Volume2,
  HelpCircle
} from 'lucide-react';

export const HistoryPage: React.FC = () => {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<PracticeSession[]>([]);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [expandedSessionIds, setExpandedSessionIds] = useState<Record<string, boolean>>({});

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

        // Auto-expand the most recent session if available
        if (loadedSessions.length > 0) {
          setExpandedSessionIds({ [loadedSessions[0].id]: true });
        }
      } finally {
        setLoading(false);
      }
    }
    loadHistory();
  }, []);

  const toggleSessionExpanded = (sessionId: string) => {
    setExpandedSessionIds(prev => ({
      ...prev,
      [sessionId]: !prev[sessionId]
    }));
  };

  const handleTherapistReview = async (
    recordingId: string,
    result: TherapistResult,
    remarks?: string
  ) => {
    const target = recordings.find(r => r.id === recordingId);
    if (!target) return;

    const updated: Recording = {
      ...target,
      therapistResult: result,
      therapistRemarks: remarks?.trim() || '',
      therapistReviewedAt: new Date().toISOString()
    };

    await updateRecording(updated);
    setRecordings(prev => prev.map(r => (r.id === recordingId ? updated : r)));
  };

  const handleDeleteRecording = async (recordingId: string) => {
    if (window.confirm('Delete this recording attempt?')) {
      await deleteRecording(recordingId);
      setRecordings(prev => prev.filter(r => r.id !== recordingId));
    }
  };

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
          Locally saved sessions and playable audio recordings
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
            Recordings from your practice sessions will appear here with playable audio, attempt counts, and session durations.
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
              <section key={dateKey} className="space-y-4">
                <div className="flex items-center gap-2 px-1">
                  <Calendar className="w-4 h-4 text-teal-600" />
                  <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                    {dateLabel}
                  </h2>
                  <span className="text-xs text-slate-400 font-medium">
                    ({daySessions.length} {daySessions.length === 1 ? 'session' : 'sessions'})
                  </span>
                </div>

                <div className="space-y-4">
                  {daySessions.map((session) => {
                    const sessionRecs = recordings.filter((r) => r.sessionId === session.id);
                    const reviewedCount = sessionRecs.filter((r) => !!r.therapistResult).length;
                    const correctCount = sessionRecs.filter((r) => r.therapistResult === 'CORRECT').length;
                    const incorrectCount = sessionRecs.filter((r) => r.therapistResult === 'INCORRECT').length;
                    const uncertainCount = sessionRecs.filter((r) => r.therapistResult === 'UNCERTAIN').length;
                    const isExpanded = !!expandedSessionIds[session.id];
                    const durationStr = formatSessionDuration(session.startedAt, session.completedAt);

                    return (
                      <Card
                        key={session.id}
                        padding="none"
                        className="bg-white border border-slate-200/90 shadow-xs overflow-hidden transition-all"
                      >
                        {/* Session Summary Header */}
                        <div className="p-4 sm:p-5 flex flex-col gap-3">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3.5">
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-semibold text-slate-500">
                                  Date: <strong className="text-slate-800">{formatDateLabel(session.startedAt)} at {formatTime(session.startedAt)}</strong>
                                </span>
                                <span className="text-slate-300">•</span>
                                <span className="text-xs font-semibold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200/50">
                                  Exercise: Qaf — Ka Practice (کا)
                                </span>
                              </div>
                              <h3 className="font-bold text-slate-900 text-lg mt-1">
                                Qaf — Ka Practice
                              </h3>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => toggleSessionExpanded(session.id)}
                                rightIcon={isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                className="text-xs font-semibold"
                                id={`toggle-recordings-${session.id}`}
                              >
                                {isExpanded ? 'Hide Audio' : `Play Recordings (${sessionRecs.length})`}
                              </Button>

                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => navigate(`/history/${session.id}`)}
                                rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
                                className="text-xs text-slate-600 hover:text-teal-700"
                              >
                                Details
                              </Button>
                            </div>
                          </div>

                          {/* Key Clinical & Session Metrics */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                              <span className="text-[11px] text-slate-500 block">Number of attempts</span>
                              <span className="font-bold text-slate-900 text-sm">
                                {session.attemptCount || sessionRecs.length} attempts
                              </span>
                            </div>

                            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                              <span className="text-[11px] text-slate-500 block flex items-center gap-1">
                                <Clock className="w-3 h-3 text-slate-400" />
                                Session duration
                              </span>
                              <span className="font-bold text-slate-900 text-sm">
                                {durationStr}
                              </span>
                            </div>

                            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                              <span className="text-[11px] text-slate-500 block">Reviewed recordings</span>
                              <span className="font-bold text-slate-900 text-sm">
                                {reviewedCount} of {sessionRecs.length}
                              </span>
                            </div>

                            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 flex flex-col justify-center">
                              <span className="text-[11px] text-slate-500 block">Evaluation status</span>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                {correctCount > 0 && (
                                  <span className="inline-flex items-center gap-0.5 text-emerald-700 font-bold text-[11px]">
                                    <CheckCircle2 className="w-3 h-3" /> {correctCount}
                                  </span>
                                )}
                                {incorrectCount > 0 && (
                                  <span className="inline-flex items-center gap-0.5 text-rose-700 font-bold text-[11px]">
                                    <XCircle className="w-3 h-3" /> {incorrectCount}
                                  </span>
                                )}
                                {uncertainCount > 0 && (
                                  <span className="inline-flex items-center gap-0.5 text-amber-700 font-bold text-[11px]">
                                    <HelpCircle className="w-3 h-3" /> {uncertainCount}
                                  </span>
                                )}
                                {reviewedCount === 0 && (
                                  <span className="text-slate-400 text-[11px] italic">Pending</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Inline Playable Recordings Accordion */}
                        {isExpanded && (
                          <div className="bg-slate-50/70 border-t border-slate-200/80 p-4 sm:p-5 space-y-3 animate-in fade-in duration-150">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                                <Volume2 className="w-3.5 h-3.5 text-teal-600" />
                                Playable Recordings ({sessionRecs.length})
                              </span>
                              <span className="text-[11px] text-slate-400">
                                Stored locally in IndexedDB
                              </span>
                            </div>

                            {sessionRecs.length === 0 ? (
                              <p className="text-xs text-slate-500 italic py-2">
                                No audio recordings were captured in this session.
                              </p>
                            ) : (
                              <div className="space-y-3">
                                {sessionRecs.map((rec, index) => (
                                  <PracticeAttempt
                                    key={rec.id}
                                    recording={rec}
                                    index={index}
                                    onReview={handleTherapistReview}
                                    onDelete={handleDeleteRecording}
                                    allowReview={true}
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                        )}
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
