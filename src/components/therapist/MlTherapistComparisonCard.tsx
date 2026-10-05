import React, { useState } from 'react';
import { Recording, Exercise, TrainingExclusionReason } from '../../types';
import { getComparisonDetail } from '../../utils/modelAgreement';
import { addRecordingToTrainingDataset, excludeRecordingFromTrainingDataset } from '../../storage/trainingDatasetRepository';
import { AudioPlayer } from '../audio/AudioPlayer';
import {
  CheckCircle2,
  XCircle,
  HelpCircle,
  ShieldCheck,
  Cpu,
  UserCheck,
  PlusCircle,
  MinusCircle,
  AlertTriangle
} from 'lucide-react';
import { clsx } from 'clsx';

interface MlTherapistComparisonCardProps {
  recording: Recording;
  exercise?: Exercise;
  onDatasetUpdate?: (updatedRecording: Recording) => Promise<void> | void;
  showAudioPlayer?: boolean;
}

const EXCLUSION_REASONS: { label: string; value: TrainingExclusionReason }[] = [
  { label: 'Background noise', value: 'background noise' },
  { label: 'Cough / Throat clear', value: 'cough' },
  { label: 'Interruption', value: 'interruption' },
  { label: 'Microphone problem', value: 'microphone problem' },
  { label: 'Wrong exercise sound', value: 'wrong exercise' },
  { label: 'Accidental recording', value: 'accidental recording' },
  { label: 'Poor audio quality', value: 'poor audio' },
  { label: 'Other', value: 'other' }
];

export const MlTherapistComparisonCard: React.FC<MlTherapistComparisonCardProps> = ({
  recording,
  exercise,
  onDatasetUpdate,
  showAudioPlayer = true
}) => {
  const comp = getComparisonDetail(recording, exercise);

  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [showExcludeSelector, setShowExcludeSelector] = useState<boolean>(false);
  const [selectedExclusionReason, setSelectedExclusionReason] = useState<TrainingExclusionReason>(
    recording.trainingExclusionReason || 'background noise'
  );
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const isIncluded = !recording.excludedFromTraining && (recording.therapistResult === 'CORRECT' || recording.therapistResult === 'INCORRECT');

  const handleAddToDataset = async () => {
    try {
      setIsUpdating(true);
      await addRecordingToTrainingDataset(recording, exercise);
      const updated: Recording = {
        ...recording,
        excludedFromTraining: false,
        trainingExclusionReason: undefined
      };
      setStatusMessage('Added to training dataset candidate pool. (Do not automatically retrain)');
      if (onDatasetUpdate) await onDatasetUpdate(updated);
      setTimeout(() => setStatusMessage(null), 4000);
    } catch (err) {
      console.error('Failed to add recording to training dataset:', err);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleExcludeFromDataset = async () => {
    try {
      setIsUpdating(true);
      await excludeRecordingFromTrainingDataset(recording, selectedExclusionReason, exercise);
      const updated: Recording = {
        ...recording,
        excludedFromTraining: true,
        trainingExclusionReason: selectedExclusionReason
      };
      setShowExcludeSelector(false);
      setStatusMessage(`Excluded from dataset: ${selectedExclusionReason}`);
      if (onDatasetUpdate) await onDatasetUpdate(updated);
      setTimeout(() => setStatusMessage(null), 4000);
    } catch (err) {
      console.error('Failed to exclude recording from training dataset:', err);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4 transition-all">
      {/* Target & Model Version Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Expected Target:
          </span>
          <span className="font-arabic font-bold text-xl sm:text-2xl text-slate-900 bg-slate-50 border border-slate-200 px-3 py-0.5 rounded-xl">
            {comp.expected}
          </span>
        </div>

        {/* Model Version Badge */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 border border-slate-200 text-slate-600 rounded-lg text-xs font-mono">
          <Cpu className="w-3.5 h-3.5 text-teal-600" />
          <span>Model: {comp.modelVersion}</span>
        </div>
      </div>

      {/* Comparison Grid: ML vs Therapist */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {/* ML Assessment Column */}
        <div className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/60 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5 uppercase tracking-wider">
              <Cpu className="w-3.5 h-3.5 text-teal-600" />
              ML Prediction
            </span>
            {comp.mlConfidence !== null && (
              <span className="text-[11px] font-mono font-semibold text-slate-500">
                Confidence: {Math.round(comp.mlConfidence * 100)}%
              </span>
            )}
          </div>

          <div className="pt-1">
            {comp.mlResult === 'CORRECT' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold text-emerald-800 bg-emerald-100 border border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                CORRECT
              </span>
            )}
            {(comp.mlResult === 'INCORRECT' || comp.mlResult === 'NEEDS_PRACTICE') && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold text-rose-800 bg-rose-100 border border-rose-200">
                <XCircle className="w-3.5 h-3.5 text-rose-600" />
                {comp.mlResult}
              </span>
            )}
            {comp.mlResult === 'UNCERTAIN' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold text-amber-800 bg-amber-100 border border-amber-200">
                <HelpCircle className="w-3.5 h-3.5 text-amber-600" />
                UNCERTAIN
              </span>
            )}
          </div>
        </div>

        {/* Therapist Assessment Column */}
        <div className="p-3.5 rounded-xl border border-indigo-200/80 bg-indigo-50/40 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-indigo-950 flex items-center gap-1.5 uppercase tracking-wider">
              <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
              Therapist (Ground Truth)
            </span>
            <span className="text-[10px] font-semibold text-indigo-600 bg-indigo-100 px-1.5 py-0.5 rounded">
              Clinical
            </span>
          </div>

          <div className="pt-1">
            {comp.therapistResult === 'CORRECT' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold text-emerald-800 bg-emerald-100 border border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                CORRECT
              </span>
            )}
            {comp.therapistResult === 'INCORRECT' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold text-rose-800 bg-rose-100 border border-rose-200">
                <XCircle className="w-3.5 h-3.5 text-rose-600" />
                INCORRECT
              </span>
            )}
            {comp.therapistResult === 'UNCERTAIN' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold text-amber-800 bg-amber-100 border border-amber-200">
                <HelpCircle className="w-3.5 h-3.5 text-amber-600" />
                UNCERTAIN
              </span>
            )}
          </div>

          {recording.therapistRemarks && (
            <p className="text-[11px] text-indigo-900/90 italic pt-1">
              &ldquo;{recording.therapistRemarks}&rdquo;
            </p>
          )}
        </div>
      </div>

      {/* Difference Banner */}
      <div
        className={clsx(
          'p-3 rounded-xl border text-xs flex items-center justify-between flex-wrap gap-2',
          comp.isAgreement
            ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
            : comp.isFalsePositive
            ? 'bg-rose-50 border-rose-200 text-rose-900'
            : comp.isFalseNegative
            ? 'bg-amber-50 border-amber-200 text-amber-900'
            : 'bg-slate-50 border-slate-200 text-slate-800'
        )}
      >
        <div className="flex items-center gap-2">
          {comp.isAgreement ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <div>
            <span className="font-bold">Difference: </span>
            <span>{comp.differenceText}</span>
            {comp.isFalsePositive && (
              <span className="block text-[11px] text-rose-700 font-medium">
                (False Positive: ML predicted CORRECT, therapist confirmed INCORRECT)
              </span>
            )}
            {comp.isFalseNegative && (
              <span className="block text-[11px] text-amber-800 font-medium">
                (False Negative: ML predicted NEEDS_PRACTICE, therapist confirmed CORRECT)
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Inviolable Ground Truth Rule Notice */}
      <div className="text-[11px] text-slate-500 bg-slate-50/80 p-2.5 rounded-xl border border-slate-200/60 flex items-start gap-2">
        <ShieldCheck className="w-3.5 h-3.5 text-teal-600 shrink-0 mt-0.5" />
        <p>
          <strong className="text-slate-700">Clinical Inviolability:</strong> The therapist's confirmed assessment is the ground truth. The ML model prediction must NEVER automatically become a therapist label.
        </p>
      </div>

      {/* Audio Playback */}
      {showAudioPlayer && recording.blob && (
        <div className="pt-1">
          <AudioPlayer blob={recording.blob} recordedDuration={recording.duration} />
        </div>
      )}

      {/* Dataset Candidate Controls: Include, Exclude, Exclude Reason */}
      <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-slate-600">Dataset Status:</span>
          {isIncluded ? (
            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              Candidate for Training Dataset
            </span>
          ) : (
            <span className="text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
              Excluded from Dataset {recording.trainingExclusionReason ? `(${recording.trainingExclusionReason})` : ''}
            </span>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {!isIncluded ? (
            <button
              type="button"
              onClick={handleAddToDataset}
              disabled={isUpdating}
              className="inline-flex items-center gap-1 text-xs font-bold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200/80 px-3 py-1.5 rounded-xl transition cursor-pointer disabled:opacity-50"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Add to Training Dataset</span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              {!showExcludeSelector ? (
                <button
                  type="button"
                  onClick={() => setShowExcludeSelector(true)}
                  disabled={isUpdating}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-3 py-1.5 rounded-xl transition cursor-pointer disabled:opacity-50"
                >
                  <MinusCircle className="w-3.5 h-3.5" />
                  <span>Exclude</span>
                </button>
              ) : (
                <div className="flex items-center gap-2 flex-wrap animate-in fade-in">
                  <select
                    value={selectedExclusionReason}
                    onChange={(e) => setSelectedExclusionReason(e.target.value as TrainingExclusionReason)}
                    className="text-xs p-1.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-rose-500"
                  >
                    {EXCLUSION_REASONS.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleExcludeFromDataset}
                    disabled={isUpdating}
                    className="text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 px-2.5 py-1.5 rounded-lg transition cursor-pointer"
                  >
                    Confirm Exclude
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowExcludeSelector(false)}
                    className="text-xs text-slate-500 hover:text-slate-700 px-1 py-1 cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Temporary feedback banner */}
      {statusMessage && (
        <div className="p-2.5 bg-teal-50 border border-teal-200 text-teal-900 rounded-xl text-xs font-medium animate-in fade-in">
          {statusMessage}
        </div>
      )}
    </div>
  );
};
