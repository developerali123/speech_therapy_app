import React, { useState } from 'react';
import { Recording, TherapistResult, TrainingExclusionReason } from '../../types';
import { AudioPlayer } from '../audio/AudioPlayer';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { CheckCircle2, XCircle, HelpCircle, UserCheck } from 'lucide-react';
import { clsx } from 'clsx';

interface ManualReviewProps {
  recording: Recording;
  onSave: (
    recordingId: string,
    result: TherapistResult,
    remarks?: string,
    excludedFromTraining?: boolean,
    trainingExclusionReason?: TrainingExclusionReason
  ) => Promise<void>;
  onClose?: () => void;
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

export const ManualReview: React.FC<ManualReviewProps> = ({
  recording,
  onSave,
  onClose
}) => {
  const [result, setResult] = useState<TherapistResult | undefined>(recording.therapistResult);
  const [remarks, setRemarks] = useState<string>(recording.therapistRemarks || '');
  const [isExcluded, setIsExcluded] = useState<boolean>(!!recording.excludedFromTraining);
  const [exclusionReason, setExclusionReason] = useState<TrainingExclusionReason>(
    recording.trainingExclusionReason || 'background noise'
  );
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [hasSaved, setHasSaved] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!result) return;
    try {
      setIsSubmitting(true);
      if (isExcluded) {
        await onSave(
          recording.id,
          result,
          remarks,
          isExcluded,
          exclusionReason
        );
      } else {
        await onSave(recording.id, result, remarks);
      }
      setHasSaved(true);
      setTimeout(() => {
        setHasSaved(false);
        if (onClose) onClose();
      }, 900);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="w-full border-teal-200 bg-white shadow-sm p-5 sm:p-6 space-y-4">
      {/* Title & Guidance Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center shrink-0">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Therapist Assessment
            </h3>
            <p className="text-xs text-slate-500">
              Clinical pronunciation assessment &amp; ML training dataset curation
            </p>
          </div>
        </div>

        {/* Confirmed Banner if previously evaluated */}
        {recording.therapistResult && (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-slate-50 border border-slate-200 text-slate-800">
            <span>Therapist Confirmed:</span>
            {recording.therapistResult === 'CORRECT' && (
              <span className="text-emerald-700 flex items-center gap-0.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> CORRECT
              </span>
            )}
            {recording.therapistResult === 'INCORRECT' && (
              <span className="text-rose-700 flex items-center gap-0.5">
                <XCircle className="w-3.5 h-3.5 text-rose-600" /> INCORRECT
              </span>
            )}
            {recording.therapistResult === 'UNCERTAIN' && (
              <span className="text-amber-700 flex items-center gap-0.5">
                <HelpCircle className="w-3.5 h-3.5 text-amber-600" /> UNCERTAIN
              </span>
            )}
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Play Recording section */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Play Recording
          </label>
          <AudioPlayer blob={recording.blob} recordedDuration={recording.duration} />
        </div>

        {/* ML Prediction Reference (Non-binding reference; Therapist is ground truth) */}
        <div className="p-3 bg-slate-50 border border-slate-200/90 rounded-xl space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-600">ML Prediction:</span>
            <span className="font-mono text-[10px] text-slate-500">
              Model: {recording.modelVersion || 'xlsr-v1.0-linear-onnx'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={clsx(
                'px-2 py-0.5 rounded text-xs font-bold',
                recording.autoResult === 'CORRECT'
                  ? 'bg-emerald-100 text-emerald-800'
                  : recording.autoResult === 'INCORRECT' || recording.autoResult === 'NEEDS_PRACTICE'
                  ? 'bg-rose-100 text-rose-800'
                  : 'bg-amber-100 text-amber-800'
              )}
            >
              {recording.autoResult || 'None'}
            </span>
            {(typeof recording.confidence === 'number' || typeof recording.similarity === 'number') && (
              <span className="text-xs text-slate-500 font-mono">
                Confidence: {Math.round(((recording.confidence ?? recording.similarity) ?? 0) * 100)}%
              </span>
            )}
          </div>
          <p className="text-[10px] text-slate-500 italic pt-0.5">
            Notice: The therapist's confirmed assessment is the ground truth. The ML model prediction must NEVER automatically become a therapist label.
          </p>
        </div>

        {/* Therapist Assessment: Radio Options */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
            Therapist Assessment:
          </label>
          <div className="grid grid-cols-3 gap-2.5">
            <button
              type="button"
              onClick={() => setResult('CORRECT')}
              className={clsx(
                'flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-bold transition-all cursor-pointer select-none',
                result === 'CORRECT'
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm shadow-emerald-700/20 ring-2 ring-emerald-500/20'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-emerald-50/50 hover:border-emerald-300'
              )}
            >
              <span className="w-3.5 h-3.5 rounded-full border border-current flex items-center justify-center">
                {result === 'CORRECT' && <span className="w-2 h-2 rounded-full bg-white" />}
              </span>
              <span>Correct</span>
              <span className="sr-only">CORRECT</span>
            </button>

            <button
              type="button"
              onClick={() => setResult('INCORRECT')}
              className={clsx(
                'flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-bold transition-all cursor-pointer select-none',
                result === 'INCORRECT'
                  ? 'bg-rose-600 text-white border-rose-600 shadow-sm shadow-rose-700/20 ring-2 ring-rose-500/20'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-rose-50/50 hover:border-rose-300'
              )}
            >
              <span className="w-3.5 h-3.5 rounded-full border border-current flex items-center justify-center">
                {result === 'INCORRECT' && <span className="w-2 h-2 rounded-full bg-white" />}
              </span>
              <span>Incorrect</span>
              <span className="sr-only">INCORRECT</span>
            </button>

            <button
              type="button"
              onClick={() => setResult('UNCERTAIN')}
              className={clsx(
                'flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-bold transition-all cursor-pointer select-none',
                result === 'UNCERTAIN'
                  ? 'bg-amber-500 text-white border-amber-500 shadow-sm shadow-amber-600/20 ring-2 ring-amber-500/20'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-amber-50/50 hover:border-amber-300'
              )}
            >
              <span className="w-3.5 h-3.5 rounded-full border border-current flex items-center justify-center">
                {result === 'UNCERTAIN' && <span className="w-2 h-2 rounded-full bg-white" />}
              </span>
              <span>Uncertain</span>
              <span className="sr-only">UNCERTAIN</span>
            </button>
          </div>
        </div>

        {/* Notes Input */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
            Notes:
          </label>
          <textarea
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            rows={2}
            placeholder="Clinical observations, phonetic cues, or feedback..."
            className="w-full text-xs p-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all resize-none"
          />
        </div>

        {/* Section 8: Exclude from ML Training Dataset */}
        <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2.5">
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-800 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isExcluded}
              onChange={(e) => setIsExcluded(e.target.checked)}
              className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500 border-slate-300"
            />
            <span>Exclude recording from ML training dataset</span>
          </label>

          {isExcluded && (
            <div className="pl-6 space-y-1.5 animate-in fade-in">
              <span className="text-[11px] font-bold text-slate-600 block">Exclusion Reason:</span>
              <select
                value={exclusionReason}
                onChange={(e) => setExclusionReason(e.target.value as TrainingExclusionReason)}
                className="w-full text-xs p-2 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500"
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

        {/* Post-save feedback banner */}
        {hasSaved && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs font-bold flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>
              Therapist Confirmed: {result}
              {isExcluded ? ` (Excluded: ${exclusionReason})` : ' (Eligible for ML Training)'}
            </span>
          </div>
        )}

        {/* Submit Review */}
        <div className="flex items-center justify-between pt-2">
          {onClose ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClose}
            >
              Cancel
            </Button>
          ) : (
            <div />
          )}

          <Button
            type="submit"
            variant="primary"
            size="md"
            disabled={!result || isSubmitting}
            isLoading={isSubmitting}
            aria-label="Save Review / Therapist Assessment"
          >
            {hasSaved ? 'Assessment Saved!' : 'Save Therapist Assessment'}
          </Button>
        </div>
      </form>
    </Card>
  );
};
