import React, { useState } from 'react';
import { Recording, TherapistResult } from '../../types';
import { AudioPlayer } from '../audio/AudioPlayer';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { CheckCircle2, XCircle, HelpCircle, UserCheck } from 'lucide-react';
import { clsx } from 'clsx';

interface ManualReviewProps {
  recording: Recording;
  onSave: (recordingId: string, result: TherapistResult, remarks?: string) => Promise<void>;
  onClose?: () => void;
}

export const ManualReview: React.FC<ManualReviewProps> = ({
  recording,
  onSave,
  onClose
}) => {
  const [result, setResult] = useState<TherapistResult | undefined>(recording.therapistResult);
  const [remarks, setRemarks] = useState<string>(recording.therapistRemarks || '');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [hasSaved, setHasSaved] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!result) return;
    try {
      setIsSubmitting(true);
      await onSave(recording.id, result, remarks);
      setHasSaved(true);
      setTimeout(() => {
        setHasSaved(false);
        if (onClose) onClose();
      }, 800);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="w-full border-teal-200 bg-white shadow-sm p-5 sm:p-6">
      {/* Title & Guidance Header */}
      <div className="flex items-center gap-2.5 pb-4 border-b border-slate-100">
        <div className="w-9 h-9 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center shrink-0">
          <UserCheck className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-base font-bold text-slate-900">
            Manual Therapist Review
          </h3>
          <p className="text-xs text-slate-500">
            Clinical pronunciation evaluation by licensed speech pathologist
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 pt-4">
        {/* Play Recording section */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Play Recording
          </label>
          <AudioPlayer blob={recording.blob} />
        </div>

        {/* Clinical Result Assessment */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-2">
            Result:
          </label>
          <div className="grid grid-cols-3 gap-2.5">
            <button
              type="button"
              onClick={() => setResult('CORRECT')}
              className={clsx(
                'flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-bold transition-all cursor-pointer',
                result === 'CORRECT'
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm shadow-emerald-700/20'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-emerald-50/50 hover:border-emerald-300'
              )}
            >
              <CheckCircle2 className="w-4 h-4 mb-1" />
              CORRECT
            </button>

            <button
              type="button"
              onClick={() => setResult('INCORRECT')}
              className={clsx(
                'flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-bold transition-all cursor-pointer',
                result === 'INCORRECT'
                  ? 'bg-rose-600 text-white border-rose-600 shadow-sm shadow-rose-700/20'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-rose-50/50 hover:border-rose-300'
              )}
            >
              <XCircle className="w-4 h-4 mb-1" />
              INCORRECT
            </button>

            <button
              type="button"
              onClick={() => setResult('UNCERTAIN')}
              className={clsx(
                'flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-bold transition-all cursor-pointer',
                result === 'UNCERTAIN'
                  ? 'bg-amber-500 text-white border-amber-500 shadow-sm shadow-amber-600/20'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-amber-50/50 hover:border-amber-300'
              )}
            >
              <HelpCircle className="w-4 h-4 mb-1" />
              UNCERTAIN
            </button>
          </div>
        </div>

        {/* Remarks Input */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Remarks:
          </label>
          <textarea
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            rows={2}
            placeholder="Clinical observations, phoneme placement feedback, or home drill instructions..."
            className="w-full text-xs p-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all resize-none"
          />
        </div>

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
          >
            {hasSaved ? 'Review Saved!' : 'Save Review'}
          </Button>
        </div>
      </form>
    </Card>
  );
};
