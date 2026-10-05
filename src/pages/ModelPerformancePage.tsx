import React, { useState, useEffect } from 'react';
import { getAllRecordings } from '../storage/recordingRepository';
import { getExercises } from '../storage/exerciseRepository';
import { Recording, Exercise } from '../types';
import {
  calculateModelAgreementMetrics,
  STANDARD_TARGETS,
  normalizeTargetText,
  DEFAULT_MODEL_VERSION
} from '../utils/modelAgreement';
import { MlTherapistComparisonCard } from '../components/therapist/MlTherapistComparisonCard';
import {
  CheckCircle2,
  XCircle,
  Cpu,
  ShieldAlert,
  ShieldCheck,
  ArrowRight,
  AlertTriangle,
  Info
} from 'lucide-react';
import { clsx } from 'clsx';
import { useNavigate } from 'react-router-dom';

export const ModelPerformancePage: React.FC = () => {
  const navigate = useNavigate();
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedModelVersion, setSelectedModelVersion] = useState<string>('all');
  const [selectedTarget, setSelectedTarget] = useState<string>('all');
  const [filterType, setFilterType] = useState<
    'all' | 'agreed' | 'disagreed' | 'false_positive' | 'false_negative' | 'uncertain'
  >('all');

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [loadedRecs, loadedExercises] = await Promise.all([
          getAllRecordings(),
          getExercises()
        ]);
        setRecordings(loadedRecs);
        setExercises(loadedExercises);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const metrics = calculateModelAgreementMetrics(
    recordings,
    selectedModelVersion,
    exercises
  );

  const handleDatasetUpdate = async (updated: Recording) => {
    setRecordings((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
  };

  // Filter reviewed recordings for the list view
  const reviewedRecordings = recordings.filter((r) => {
    if (!r.therapistResult) return false;

    // Filter by model version
    if (selectedModelVersion !== 'all') {
      const recVersion = r.modelVersion || DEFAULT_MODEL_VERSION;
      if (recVersion !== selectedModelVersion) return false;
    }

    // Filter by target
    if (selectedTarget !== 'all') {
      const target = normalizeTargetText(r.exerciseId);
      if (target !== selectedTarget) return false;
    }

    const isMlCorrect = r.autoResult === 'CORRECT';
    const isMlIncorrect = r.autoResult === 'INCORRECT' || r.autoResult === 'NEEDS_PRACTICE';
    const isTherapistCorrect = r.therapistResult === 'CORRECT';
    const isTherapistIncorrect = r.therapistResult === 'INCORRECT';

    const isAgreed =
      (isMlCorrect && isTherapistCorrect) ||
      (isMlIncorrect && isTherapistIncorrect) ||
      (r.autoResult === 'UNCERTAIN' && r.therapistResult === 'UNCERTAIN');

    if (filterType === 'agreed') return isAgreed;
    if (filterType === 'disagreed') return !isAgreed;
    if (filterType === 'false_positive') return isMlCorrect && isTherapistIncorrect;
    if (filterType === 'false_negative') return isMlIncorrect && isTherapistCorrect;
    if (filterType === 'uncertain') return r.autoResult === 'UNCERTAIN' || r.therapistResult === 'UNCERTAIN';

    return true;
  });

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-200 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
              Clinical Validation
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-1 flex items-center gap-2.5">
            <Cpu className="w-7 h-7 text-teal-600" />
            <span>Model Performance (ML vs Therapist)</span>
          </h1>
          <p className="text-sm text-slate-500 font-medium mt-1">
            Validation metrics on local labelled dataset — not generalized clinical claims.
          </p>
        </div>

        {/* Model Version Filter */}
        <div className="flex items-center gap-2 self-start sm:self-auto bg-white border border-slate-200 p-1.5 rounded-2xl shadow-2xs">
          <span className="text-xs font-semibold text-slate-500 pl-2">Model Version:</span>
          <select
            value={selectedModelVersion}
            onChange={(e) => setSelectedModelVersion(e.target.value)}
            className="text-xs font-mono font-bold bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            <option value="all">All Models Combined</option>
            {metrics.availableModelVersions.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Mandatory Clinical Notice & Inviolable Ground Truth Notice */}
      <section
        aria-label="Clinical Ground Truth Notice"
        className="p-4 sm:p-5 rounded-2xl bg-amber-50/90 border border-amber-200/90 text-amber-950 flex items-start gap-3.5 shadow-2xs"
      >
        <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="space-y-1 text-xs sm:text-sm leading-relaxed">
          <p className="font-bold text-amber-950">
            The therapist's confirmed assessment is the ground truth.
          </p>
          <p className="text-amber-900/90">
            The ML model prediction must NEVER automatically become a therapist label. The metrics below represent concordance on your local device's reviewed dataset and are for model validation, not a guarantee of generalized clinical diagnostic accuracy.
          </p>
        </div>
      </section>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-8 h-8 border-3 border-teal-600 border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-xs text-slate-500">Computing agreement metrics from IndexedDB...</p>
        </div>
      ) : (
        <>
          {/* 1. TOP-LEVEL AGREEMENT METRICS */}
          <section aria-labelledby="agreement-heading" className="space-y-3">
            <h2 id="agreement-heading" className="text-xs font-bold uppercase tracking-wider text-slate-500 px-1">
              ML vs Therapist Summary Metrics
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
              {/* Overall Agreement Rate */}
              <div className="bg-white p-3.5 rounded-2xl border border-teal-200/90 shadow-2xs col-span-2 bg-gradient-to-br from-teal-50/40 to-white">
                <span className="text-[11px] font-bold text-teal-800 uppercase tracking-wider block">
                  Agreement Rate
                </span>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-3xl font-extrabold text-teal-900 font-mono">
                    {metrics.agreementRate}%
                  </span>
                </div>
                <span className="text-[10px] text-teal-700 mt-0.5 block">
                  Concordance on local labelled dataset
                </span>
              </div>

              {/* Reviewed Count */}
              <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs">
                <span className="text-[11px] font-medium text-slate-500 block">Reviewed</span>
                <span className="text-2xl font-extrabold text-slate-900 font-mono mt-1 block">
                  {metrics.totalReviewed}
                </span>
                <span className="text-[10px] text-slate-400 mt-0.5 block">Ground truth takes</span>
              </div>

              {/* Disagreements */}
              <div className="bg-white p-3.5 rounded-2xl border border-rose-200/80 shadow-2xs bg-rose-50/30">
                <span className="text-[11px] font-bold text-rose-700 block">Disagreements</span>
                <span className="text-2xl font-extrabold text-rose-800 font-mono mt-1 block">
                  {metrics.disagreementCount}
                </span>
                <span className="text-[10px] text-rose-600 mt-0.5 block">ML ≠ Therapist</span>
              </div>

              {/* ML Correct when Therapist Correct (TP) */}
              <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs">
                <span className="text-[10px] font-bold text-emerald-700 block flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  Both Correct
                </span>
                <span className="text-2xl font-extrabold text-emerald-800 font-mono mt-1 block">
                  {metrics.mlCorrectTherapistCorrect}
                </span>
                <span className="text-[10px] text-slate-400 mt-0.5 block">True Positives</span>
              </div>

              {/* ML Incorrect when Therapist Incorrect (TN) */}
              <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs">
                <span className="text-[10px] font-bold text-indigo-700 block flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  Both Incorrect
                </span>
                <span className="text-2xl font-extrabold text-indigo-900 font-mono mt-1 block">
                  {metrics.mlIncorrectTherapistIncorrect}
                </span>
                <span className="text-[10px] text-slate-400 mt-0.5 block">True Negatives</span>
              </div>

              {/* ML False Positives */}
              <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs">
                <span className="text-[10px] font-bold text-amber-700 block flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  False Positives
                </span>
                <span className="text-2xl font-extrabold text-amber-800 font-mono mt-1 block">
                  {metrics.mlFalsePositives}
                </span>
                <span className="text-[10px] text-slate-400 mt-0.5 block">ML=✓, Ther=✗</span>
              </div>

              {/* ML False Negatives */}
              <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs">
                <span className="text-[10px] font-bold text-rose-700 block flex items-center gap-1">
                  <XCircle className="w-3 h-3" />
                  False Negatives
                </span>
                <span className="text-2xl font-extrabold text-rose-800 font-mono mt-1 block">
                  {metrics.mlFalseNegatives}
                </span>
                <span className="text-[10px] text-slate-400 mt-0.5 block">ML=✗, Ther=✓</span>
              </div>
            </div>
          </section>

          {/* 2. PER-TARGET BREAKDOWN (کا, کی, کے, کو) */}
          <section aria-labelledby="per-target-heading" className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <span className="text-[11px] font-bold text-teal-800 bg-teal-50 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                  Target Specific Concordance
                </span>
                <h3 id="per-target-heading" className="text-lg font-bold text-slate-900 mt-1 flex items-center gap-2">
                  <span>Per-Target Performance Metrics</span>
                </h3>
              </div>
              <span className="text-xs text-slate-500 font-medium">
                Independently isolated by phoneme target
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {STANDARD_TARGETS.map((target) => {
                const tMetrics = metrics.byTarget[target] || {
                  target,
                  totalReviewed: 0,
                  agreementCount: 0,
                  disagreementCount: 0,
                  agreementRate: 0,
                  mlCorrectTherapistCorrect: 0,
                  mlIncorrectTherapistIncorrect: 0,
                  mlFalsePositives: 0,
                  mlFalseNegatives: 0,
                  uncertainCount: 0,
                  uncertainRate: 0
                };

                const isSelected = selectedTarget === target;

                return (
                  <button
                    key={target}
                    type="button"
                    onClick={() => setSelectedTarget(isSelected ? 'all' : target)}
                    className={clsx(
                      'p-4 rounded-2xl border text-left transition-all cursor-pointer space-y-3',
                      isSelected
                        ? 'border-teal-500 bg-teal-50/50 ring-2 ring-teal-500/20'
                        : 'border-slate-200/90 bg-white hover:border-slate-300'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-arabic text-3xl font-bold text-slate-900">
                        {target}
                      </span>
                      <span className="text-xs font-mono font-bold text-teal-800 bg-teal-50 border border-teal-200/60 px-2 py-0.5 rounded-lg">
                        {tMetrics.agreementRate}% Agreement
                      </span>
                    </div>

                    <div className="space-y-1.5 text-xs pt-1 border-t border-slate-100">
                      <div className="flex justify-between text-slate-600">
                        <span>Reviewed:</span>
                        <strong className="font-mono text-slate-900">{tMetrics.totalReviewed}</strong>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>Disagreements:</span>
                        <strong className="font-mono text-rose-700">{tMetrics.disagreementCount}</strong>
                      </div>
                      <div className="flex justify-between text-slate-500 text-[11px]">
                        <span>False Positives:</span>
                        <span className="font-mono text-amber-700">{tMetrics.mlFalsePositives}</span>
                      </div>
                      <div className="flex justify-between text-slate-500 text-[11px]">
                        <span>False Negatives:</span>
                        <span className="font-mono text-rose-700">{tMetrics.mlFalseNegatives}</span>
                      </div>
                    </div>

                    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-teal-600 h-full rounded-full transition-all duration-300"
                        style={{ width: `${tMetrics.agreementRate}%` }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>

            {selectedTarget !== 'all' && (
              <div className="flex items-center justify-between pt-1">
                <span className="text-xs font-semibold text-teal-700">
                  Filtering recordings for target: <strong className="font-arabic text-base">{selectedTarget}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedTarget('all')}
                  className="text-xs text-slate-500 hover:text-slate-800 underline cursor-pointer"
                >
                  Clear target filter
                </button>
              </div>
            )}
          </section>

          {/* 3. REVIEWED RECORDINGS LIST WITH ML VS THERAPIST COMPARISON */}
          <section aria-labelledby="recordings-heading" className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 pb-3">
              <div>
                <h3 id="recordings-heading" className="text-lg font-bold text-slate-900">
                  Reviewed Recordings Comparison ({reviewedRecordings.length})
                </h3>
                <p className="text-xs text-slate-500">
                  Detailed inspection of individual attempts showing ML predictions vs therapist ground truth
                </p>
              </div>

              {/* Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
                {(
                  [
                    { id: 'all', label: 'All Reviewed' },
                    { id: 'agreed', label: 'Agreed' },
                    { id: 'disagreed', label: 'Disagreed' },
                    { id: 'false_positive', label: 'False Positives' },
                    { id: 'false_negative', label: 'False Negatives' },
                    { id: 'uncertain', label: 'Uncertain' }
                  ] as const
                ).map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFilterType(f.id)}
                    className={clsx(
                      'px-3 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer',
                      filterType === f.id
                        ? 'bg-teal-600 text-white shadow-2xs font-bold'
                        : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {reviewedRecordings.length === 0 ? (
              <div className="p-8 text-center bg-white border border-slate-200/80 rounded-3xl space-y-2">
                <Info className="w-8 h-8 text-slate-400 mx-auto" />
                <h4 className="text-sm font-bold text-slate-700">No reviewed recordings match this filter</h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Evaluate recordings in History or Session Details to populate the therapist feedback loop and agreement metrics.
                </p>
                <button
                  type="button"
                  onClick={() => navigate('/history')}
                  className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 bg-teal-600 text-white rounded-xl text-xs font-bold hover:bg-teal-700 transition cursor-pointer"
                >
                  <span>Go to Practice History</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {reviewedRecordings.map((recording) => {
                  const ex = exercises.find((e) => e.id === recording.exerciseId);
                  return (
                    <MlTherapistComparisonCard
                      key={recording.id}
                      recording={recording}
                      exercise={ex}
                      onDatasetUpdate={handleDatasetUpdate}
                    />
                  );
                })}
              </div>
            )}
          </section>

          {/* Privacy & Clinical Footer */}
          <footer className="p-4 rounded-2xl bg-slate-100/70 border border-slate-200 text-xs text-slate-600 space-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-slate-800">
              <ShieldCheck className="w-4 h-4 text-teal-600" />
              <span>100% Local On-Device Validation Guarantee</span>
            </div>
            <p className="leading-relaxed">
              All recordings, predictions, and therapist ground-truth evaluations are stored strictly on your local device in IndexedDB. Audio data is never transmitted to external servers. These metrics represent performance exclusively on your local labelled dataset and do not represent generalized clinical validity claims.
            </p>
          </footer>
        </>
      )}
    </div>
  );
};
