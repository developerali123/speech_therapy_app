import React, { useState } from 'react';
import { Recording, TherapistResult } from '../../types';
import { AudioPlayer } from '../audio/AudioPlayer';
import { formatTime } from '../../utils/dates';
import { CheckCircle2, XCircle, HelpCircle, Clock, MessageSquare, ChevronDown, ChevronUp } from 'lucide-react';
import { clsx } from 'clsx';

interface PracticeAttemptProps {
  recording: Recording;
  index: number;
  onReview?: (recordingId: string, result: TherapistResult, remarks?: string) => Promise<void>;
  onDelete?: (recordingId: string) => Promise<void>;
  allowReview?: boolean;
}

export const PracticeAttempt: React.FC<PracticeAttemptProps> = ({
  recording,
  index,
  onReview,
  onDelete,
  allowReview = true
}) => {
  const [showReviewPanel, setShowReviewPanel] = useState<boolean>(false);
  const [selectedResult, setSelectedResult] = useState<TherapistResult | undefined>(recording.therapistResult);
  const [remarks, setRemarks] = useState<string>(recording.therapistRemarks || '');
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const attemptNumber = recording.attemptNumber || index + 1;

  const handleSaveReview = async () => {
    if (!onReview || !selectedResult) return;
    try {
      setIsSaving(true);
      await onReview(recording.id, selectedResult, remarks);
      setShowReviewPanel(false);
    } finally {
      setIsSaving(false);
    }
  };

  const getStatusBadge = () => {
    switch (recording.therapistResult) {
      case 'CORRECT':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Correct
          </span>
        );
      case 'INCORRECT':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800">
            <XCircle className="w-3.5 h-3.5 text-rose-600" />
            Incorrect
          </span>
        );
      case 'UNCERTAIN':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
            <HelpCircle className="w-3.5 h-3.5 text-amber-600" />
            Uncertain
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            Pending Review
          </span>
        );
    }
  };

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs transition-all hover:border-slate-300">
      {/* Top Header of Attempt */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <span className="w-7 h-7 rounded-lg bg-teal-50 text-teal-700 text-xs font-bold flex items-center justify-center border border-teal-200/60">
            #{attemptNumber}
          </span>
          <div>
            <h4 className="text-sm font-bold text-slate-800">
              Attempt {attemptNumber}
            </h4>
            <span className="text-[11px] text-slate-400">
              {formatTime(recording.createdAt)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {getStatusBadge()}
        </div>
      </div>

      {/* Audio Player */}
      <div className="pt-3 pb-1">
        <AudioPlayer blob={recording.blob} />
      </div>

      {/* Therapist Remarks if already present and review panel collapsed */}
      {recording.therapistRemarks && !showReviewPanel && (
        <div className="mt-2.5 p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-700 flex items-start gap-2">
          <MessageSquare className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-slate-900 block text-[11px]">Therapist Remarks:</span>
            <p className="mt-0.5">{recording.therapistRemarks}</p>
          </div>
        </div>
      )}

      {/* Manual Therapist Review Toggle and Panel */}
      {allowReview && (
        <div className="mt-3 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={() => setShowReviewPanel(!showReviewPanel)}
            className="flex items-center justify-between w-full text-xs font-semibold text-slate-600 hover:text-teal-700 transition-colors py-1 cursor-pointer"
          >
            <span className="flex items-center gap-1.5">
              <span>Manual Therapist Review</span>
              {recording.therapistResult && (
                <span className="text-[10px] text-slate-400 font-normal">(Edit)</span>
              )}
            </span>
            {showReviewPanel ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showReviewPanel && (
            <div className="mt-3 p-4 bg-slate-50 border border-slate-200/80 rounded-xl space-y-3 animate-in fade-in duration-150">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Clinical Assessment Result
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedResult('CORRECT')}
                    className={clsx(
                      'py-2 px-3 text-xs font-semibold rounded-lg border transition-all cursor-pointer',
                      selectedResult === 'CORRECT'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    )}
                  >
                    CORRECT
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedResult('INCORRECT')}
                    className={clsx(
                      'py-2 px-3 text-xs font-semibold rounded-lg border transition-all cursor-pointer',
                      selectedResult === 'INCORRECT'
                        ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    )}
                  >
                    INCORRECT
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedResult('UNCERTAIN')}
                    className={clsx(
                      'py-2 px-3 text-xs font-semibold rounded-lg border transition-all cursor-pointer',
                      selectedResult === 'UNCERTAIN'
                        ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    )}
                  >
                    UNCERTAIN
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Therapist Remarks
                </label>
                <input
                  type="text"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="e.g., Good velar contact; slight breathiness."
                  className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                {onDelete && (
                  <button
                    type="button"
                    onClick={() => onDelete(recording.id)}
                    className="text-xs text-rose-600 hover:text-rose-800 font-medium cursor-pointer"
                  >
                    Delete attempt
                  </button>
                )}
                <div className="flex gap-2 ml-auto">
                  <button
                    type="button"
                    onClick={() => setShowReviewPanel(false)}
                    className="text-xs px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-100 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveReview}
                    disabled={!selectedResult || isSaving}
                    className="text-xs px-4 py-1.5 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-lg shadow-xs disabled:opacity-50 cursor-pointer"
                  >
                    {isSaving ? 'Saving...' : 'Save Review'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
