import React, { useState } from 'react';
import { Recording, TherapistResult, TrainingExclusionReason } from '../../types';
import { AudioPlayer } from '../audio/AudioPlayer';
import { formatTime } from '../../utils/dates';
import {
  CheckCircle2,
  XCircle,
  HelpCircle,
  Clock,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  UserCheck,
  Activity,
  Trash2
} from 'lucide-react';
import { clsx } from 'clsx';

interface PracticeAttemptProps {
  recording: Recording;
  index: number;
  exerciseName?: string;
  targetText?: string;
  onReview?: (
    recordingId: string,
    result: TherapistResult,
    remarks?: string,
    excludedFromTraining?: boolean,
    trainingExclusionReason?: TrainingExclusionReason
  ) => Promise<void>;
  onDelete?: (recordingId: string) => Promise<void>;
  allowReview?: boolean;
}

const EXCLUSION_REASONS: { label: string; value: TrainingExclusionReason }[] = [
  { label: 'Background noise', value: 'background noise' },
  { label: 'Cough / Throat clear', value: 'cough' },
  { label: 'Interruption', value: 'interruption' },
  { label: 'Microphone problem / Distortion', value: 'microphone problem' },
  { label: 'Wrong exercise sound', value: 'wrong exercise' },
  { label: 'Accidental recording', value: 'accidental recording' },
  { label: 'Poor audio quality', value: 'poor audio' },
  { label: 'Other', value: 'other' }
];

export const PracticeAttempt: React.FC<PracticeAttemptProps> = ({
  recording,
  index,
  exerciseName,
  targetText,
  onReview,
  onDelete,
  allowReview = true
}) => {
  const [showReviewPanel, setShowReviewPanel] = useState<boolean>(false);
  const [selectedResult, setSelectedResult] = useState<TherapistResult | undefined>(recording.therapistResult);
  const [remarks, setRemarks] = useState<string>(recording.therapistRemarks || '');
  const [isExcluded, setIsExcluded] = useState<boolean>(!!recording.excludedFromTraining);
  const [exclusionReason, setExclusionReason] = useState<TrainingExclusionReason>(
    recording.trainingExclusionReason || 'background noise'
  );
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [justConfirmed, setJustConfirmed] = useState<TherapistResult | null>(null);

  const attemptNumber = recording.attemptNumber || index + 1;
  const displayTarget = targetText || 'کا';
  const displayTitle = exerciseName || (recording.exerciseId === 'ex-qaf-ka-01' ? 'Qaf Practice Attempt' : 'Speech Practice Attempt');

  const handleSaveReview = async () => {
    if (!onReview || !selectedResult) return;
    try {
      setIsSaving(true);
      await onReview(
        recording.id,
        selectedResult,
        remarks,
        isExcluded,
        isExcluded ? exclusionReason : undefined
      );
      setJustConfirmed(selectedResult);
      setShowReviewPanel(false);
      setTimeout(() => setJustConfirmed(null), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs transition-all hover:border-slate-300 space-y-3.5">
      {/* Header: Date/Time, Target, Attempt # */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <span className="w-7 h-7 rounded-lg bg-teal-50 text-teal-800 text-xs font-bold flex items-center justify-center border border-teal-200/60 font-mono">
            #{attemptNumber}
          </span>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 font-mono">
                {formatTime(recording.createdAt)}
              </span>
              <span className="text-slate-300">•</span>
              <span className="text-sm font-arabic font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md">
                {displayTarget}
              </span>
            </div>
            <h4 className="text-xs font-bold text-slate-800 mt-0.5">
              {displayTitle}
            </h4>
          </div>
        </div>

        {/* Status Pills: Both Automatic Result AND Therapist Review clearly visible */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Automatic Audio Result */}
          <div className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full font-semibold border bg-slate-50 border-slate-200 text-slate-700">
            <Activity className="w-3 h-3 text-teal-600" />
            <span>{recording.assessmentMethod === 'ML' ? 'ML Assessment:' : 'Audio:'}</span>
            {recording.autoResult === 'CORRECT' && (
              <span className="text-emerald-700 font-bold">✓ CORRECT</span>
            )}
            {(recording.autoResult === 'INCORRECT' || recording.autoResult === 'NEEDS_PRACTICE') && (
              <span className="text-rose-700 font-bold">
                {recording.autoResult === 'NEEDS_PRACTICE' ? '✗ NEEDS PRACTICE' : '✗ INCORRECT'}
              </span>
            )}
            {recording.autoResult === 'UNCERTAIN' && (
              <span className="text-amber-700 font-bold">? UNCERTAIN</span>
            )}
            {!recording.autoResult && (
              <span className="text-slate-400 italic">None</span>
            )}
            {(typeof recording.confidence === 'number' || typeof recording.similarity === 'number') && (
              <span className="font-mono text-[10px] text-slate-500">
                ({Math.round(((recording.confidence ?? recording.similarity) ?? 0) * 100)}%)
              </span>
            )}
          </div>

          {/* Therapist Confirmed Status */}
          <div className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full font-semibold border">
            <UserCheck className="w-3 h-3 text-indigo-600" />
            <span>Therapist Confirmed:</span>
            {recording.therapistResult === 'CORRECT' && (
              <span className="inline-flex items-center gap-0.5 text-emerald-800 font-bold bg-emerald-100 px-1.5 py-0.2 rounded">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                CORRECT
              </span>
            )}
            {recording.therapistResult === 'INCORRECT' && (
              <span className="inline-flex items-center gap-0.5 text-rose-800 font-bold bg-rose-100 px-1.5 py-0.2 rounded">
                <XCircle className="w-3 h-3 text-rose-600" />
                INCORRECT
              </span>
            )}
            {recording.therapistResult === 'UNCERTAIN' && (
              <span className="inline-flex items-center gap-0.5 text-amber-800 font-bold bg-amber-100 px-1.5 py-0.2 rounded">
                <HelpCircle className="w-3 h-3 text-amber-600" />
                UNCERTAIN
              </span>
            )}
            {!recording.therapistResult && (
              <span className="inline-flex items-center gap-0.5 text-slate-500 font-medium bg-slate-100 px-1.5 py-0.2 rounded">
                <Clock className="w-3 h-3 text-slate-400" />
                Pending Review
              </span>
            )}
          </div>

          {/* Excluded from training pill if applicable */}
          {recording.excludedFromTraining && (
            <span className="text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200/80 px-2 py-0.5 rounded-full">
              Excluded: {recording.trainingExclusionReason || 'other'}
            </span>
          )}
        </div>
      </div>

      {/* Audio Playback Component */}
      <div>
        <AudioPlayer blob={recording.blob} recordedDuration={recording.duration} />
      </div>

      {/* Immediate confirmation banner */}
      {justConfirmed && (
        <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Therapist Confirmed: {justConfirmed}</span>
        </div>
      )}

      {/* Rationale / Remarks Display */}
      {(recording.analysisReason || recording.therapistRemarks) && (
        <div className="space-y-1.5 text-xs">
          {recording.analysisReason && (
            <p className="text-slate-500 text-[11px] bg-slate-50 p-2 rounded-xl border border-slate-100">
              <strong className="text-slate-700">Audio Evaluation:</strong> {recording.analysisReason}
            </p>
          )}

          {recording.therapistRemarks && !showReviewPanel && (
            <div className="p-2.5 bg-indigo-50/60 rounded-xl border border-indigo-100 text-xs text-indigo-950 flex items-start gap-2">
              <MessageSquare className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block text-[11px] text-indigo-900">Therapist Clinical Notes:</span>
                <p className="mt-0.5 leading-relaxed">&ldquo;{recording.therapistRemarks}&rdquo;</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Manual Therapist Review Toggle and Panel */}
      {allowReview && (
        <div className="pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={() => setShowReviewPanel(!showReviewPanel)}
            className="flex items-center justify-between w-full text-xs font-semibold text-slate-600 hover:text-teal-700 transition-colors py-1 cursor-pointer"
          >
            <span className="flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
              <span>Therapist Assessment</span>
              {recording.therapistResult && (
                <span className="text-[10px] text-slate-400 font-normal">
                  (Current: {recording.therapistResult})
                </span>
              )}
            </span>
            {showReviewPanel ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showReviewPanel && (
            <div className="mt-3 p-4 bg-slate-50 border border-slate-200/90 rounded-2xl space-y-3.5 animate-in fade-in duration-150">
              {/* Radio buttons for Therapist Assessment */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                  Therapist Assessment:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedResult('CORRECT')}
                    className={clsx(
                      'flex items-center justify-center gap-1.5 py-2.5 px-3 text-xs font-bold rounded-xl border transition-all cursor-pointer select-none',
                      selectedResult === 'CORRECT'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    )}
                  >
                    <span className="w-3 h-3 rounded-full border border-current flex items-center justify-center">
                      {selectedResult === 'CORRECT' && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </span>
                    <span>Correct</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedResult('INCORRECT')}
                    className={clsx(
                      'flex items-center justify-center gap-1.5 py-2.5 px-3 text-xs font-bold rounded-xl border transition-all cursor-pointer select-none',
                      selectedResult === 'INCORRECT'
                        ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    )}
                  >
                    <span className="w-3 h-3 rounded-full border border-current flex items-center justify-center">
                      {selectedResult === 'INCORRECT' && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </span>
                    <span>Incorrect</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedResult('UNCERTAIN')}
                    className={clsx(
                      'flex items-center justify-center gap-1.5 py-2.5 px-3 text-xs font-bold rounded-xl border transition-all cursor-pointer select-none',
                      selectedResult === 'UNCERTAIN'
                        ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    )}
                  >
                    <span className="w-3 h-3 rounded-full border border-current flex items-center justify-center">
                      {selectedResult === 'UNCERTAIN' && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </span>
                    <span>Uncertain</span>
                  </button>
                </div>
              </div>

              {/* Notes Input */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Notes:
                </label>
                <input
                  type="text"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Clinical observations, phoneme placement feedback..."
                  className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              {/* Training Dataset Exclude Option */}
              <div className="p-3 bg-white rounded-xl border border-slate-200/80 space-y-2">
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isExcluded}
                    onChange={(e) => setIsExcluded(e.target.checked)}
                    className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500 border-slate-300"
                  />
                  <span>Exclude recording from ML training dataset</span>
                </label>

                {isExcluded && (
                  <div className="pl-6 space-y-1 animate-in fade-in">
                    <span className="text-[11px] font-bold text-slate-500 block">Exclusion Reason:</span>
                    <select
                      value={exclusionReason}
                      onChange={(e) => setExclusionReason(e.target.value as TrainingExclusionReason)}
                      className="w-full text-xs p-2 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500"
                    >
                      {EXCLUSION_REASONS.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Save / Cancel buttons */}
              <div className="flex items-center justify-between pt-1">
                {onDelete && (
                  <button
                    type="button"
                    onClick={() => onDelete(recording.id)}
                    className="inline-flex items-center gap-1 text-xs text-rose-600 hover:text-rose-800 font-medium cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Attempt</span>
                  </button>
                )}
                <div className="flex gap-2 ml-auto">
                  <button
                    type="button"
                    onClick={() => setShowReviewPanel(false)}
                    className="text-xs px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-100 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveReview}
                    disabled={!selectedResult || isSaving}
                    aria-label="Save Review / Therapist Assessment"
                    className="text-xs px-4 py-1.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl shadow-xs disabled:opacity-50 cursor-pointer"
                  >
                    {isSaving ? 'Saving...' : 'Save Therapist Assessment'}
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
