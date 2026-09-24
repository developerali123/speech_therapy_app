import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getSession } from '../storage/sessionRepository';
import { getRecordingsBySession, updateRecording, deleteRecording } from '../storage/recordingRepository';
import { getExerciseById } from '../storage/exerciseRepository';
import { PracticeSession, Recording, Exercise, TherapistResult } from '../types';
import { PracticeAttempt } from '../components/practice/PracticeAttempt';
import { Card } from '../components/ui/Card';
import { formatDateTime, formatSessionDuration } from '../utils/dates';
import { ArrowLeft, Clock, Mic, CheckCircle2, UserCheck, AlertCircle } from 'lucide-react';

export const SessionDetailsPage: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  const [session, setSession] = useState<PracticeSession | null>(null);
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [feedbackNotice, setFeedbackNotice] = useState<string | null>(null);

  useEffect(() => {
    async function loadSessionData() {
      if (!sessionId) return;
      try {
        setLoading(true);
        const loadedSession = await getSession(sessionId);
        if (loadedSession) {
          setSession(loadedSession);
          const [loadedRecordings, loadedExercise] = await Promise.all([
            getRecordingsBySession(sessionId),
            getExerciseById(loadedSession.exerciseId)
          ]);
          setRecordings(loadedRecordings);
          setExercise(loadedExercise || null);
        }
      } finally {
        setLoading(false);
      }
    }
    loadSessionData();
  }, [sessionId]);

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

    setFeedbackNotice('Therapist review saved and persisted to IndexedDB.');
    setTimeout(() => setFeedbackNotice(null), 3500);
  };

  const handleDeleteRecording = async (recordingId: string) => {
    if (window.confirm('Delete this recording attempt? This action cannot be undone.')) {
      await deleteRecording(recordingId);
      setRecordings(prev => prev.filter(r => r.id !== recordingId));
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-8 h-8 border-3 border-teal-600 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs text-slate-500 font-medium">Loading session recordings...</p>
      </div>
    );
  }

  if (!session) {
    return (
      <Card className="p-8 text-center max-w-md mx-auto my-12">
        <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-3" />
        <h3 className="text-base font-bold text-slate-900">Session Not Found</h3>
        <p className="text-xs text-slate-500 mt-1">
          This session may have been cleared or deleted.
        </p>
        <div className="mt-4">
          <button
            onClick={() => navigate('/history')}
            className="text-xs font-semibold text-teal-700 hover:underline"
          >
            Return to History
          </button>
        </div>
      </Card>
    );
  }

  const durationStr = formatSessionDuration(session.startedAt, session.completedAt);
  const reviewedCount = recordings.filter(r => !!r.therapistResult).length;
  const correctCount = recordings.filter(r => r.therapistResult === 'CORRECT').length;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Back button */}
      <div>
        <button
          type="button"
          onClick={() => navigate('/history')}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 px-3 py-1.5 rounded-xl transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to History</span>
        </button>
      </div>

      {/* Session Header Card */}
      <Card className="p-6 bg-white">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-teal-700 bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-200/60">
                Session Overview
              </span>
              <span className="text-xs text-slate-500 font-medium">
                {formatDateTime(session.startedAt)}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">
              {exercise?.name || 'Qaf — Ka Practice'}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Target sound: <span className="font-arabic font-bold text-teal-900 text-sm">{exercise?.targetText || 'کا'}</span>
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5 text-slate-600">
              <Clock className="w-4 h-4 text-slate-400" />
              <span>Duration: <strong className="text-slate-900">{durationStr}</strong></span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-600">
              <Mic className="w-4 h-4 text-teal-600" />
              <span>Attempts: <strong className="text-slate-900">{recordings.length}</strong></span>
            </div>
          </div>
        </div>

        {/* Therapist Review Status Banner */}
        <div className="pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-indigo-600" />
            <span className="font-semibold text-slate-800">Therapist Review:</span>
            <span className="text-slate-600">
              {reviewedCount} of {recordings.length} attempts evaluated
              {reviewedCount > 0 ? ` (${correctCount} marked correct)` : ''}
            </span>
          </div>

          <span className="text-[11px] text-slate-400">
            Open any attempt below to record clinical assessment
          </span>
        </div>
      </Card>

      {/* Persistence feedback notice */}
      {feedbackNotice && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xl flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{feedbackNotice}</span>
        </div>
      )}

      {/* Recordings List */}
      <section className="space-y-4" aria-labelledby="attempts-heading">
        <div className="flex items-center justify-between px-1">
          <h2 id="attempts-heading" className="text-sm font-bold uppercase tracking-wider text-slate-600">
            Recorded Attempts ({recordings.length})
          </h2>
        </div>

        {recordings.length === 0 ? (
          <Card className="p-8 text-center text-xs text-slate-500">
            No audio recordings found for this session.
          </Card>
        ) : (
          <div className="space-y-3.5">
            {recordings.map((recording, idx) => (
              <PracticeAttempt
                key={recording.id}
                recording={recording}
                index={idx}
                onReview={handleTherapistReview}
                onDelete={handleDeleteRecording}
                allowReview={true}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
