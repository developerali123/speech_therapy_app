import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Database,
  Download,
  Filter,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Clock,
  Play,
  Pause,
  RefreshCw,
  Info,
  Loader2
} from 'lucide-react';
import {
  TrainingExample,
  Recording,
  Exercise,
  TrainingExclusionReason,
  TrainingDatasetFilters,
  TherapistResult
} from '../types';
import { getAllRecordings, updateRecording } from '../storage/recordingRepository';
import { getExercises } from '../storage/exerciseRepository';
import {
  getAllTrainingExamples,
  syncAllTrainingExamples,
  saveTrainingExample
} from '../storage/trainingDatasetRepository';
import {
  calculateDatasetStatistics,
  filterTrainingExamples,
  generateMLDatasetExport,
  downloadMLDatasetExport
} from '../utils/trainingDataset';

const EXCLUSION_REASONS: Array<{ value: TrainingExclusionReason; label: string }> = [
  { value: 'background noise', label: 'Background Noise' },
  { value: 'cough', label: 'Cough / Throat Clearing' },
  { value: 'interruption', label: 'Interruption / Distraction' },
  { value: 'microphone problem', label: 'Microphone Problem' },
  { value: 'wrong exercise', label: 'Wrong Exercise / Sound' },
  { value: 'accidental recording', label: 'Accidental Recording' },
  { value: 'poor audio', label: 'Poor Audio Quality' },
  { value: 'other', label: 'Other' }
];

export const TrainingDatasetPage: React.FC = () => {
  const [examples, setExamples] = useState<TrainingExample[]>([]);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [includeAudioInExport, setIncludeAudioInExport] = useState(false);

  // Audio playback state
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);

  // Filters state
  const [filters, setFilters] = useState<TrainingDatasetFilters>({
    exerciseId: 'all',
    targetUnit: 'all',
    therapistResult: 'all',
    reviewStatus: 'all',
    trainingStatus: 'all',
    startDate: '',
    endDate: '',
    searchQuery: ''
  });

  const [activeTab, setActiveTab] = useState<'statistics' | 'examples'>('statistics');

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [recList, exList] = await Promise.all([
        getAllRecordings(),
        getExercises()
      ]);
      setRecordings(recList);
      setExercises(exList);

      // Synchronize training examples from recordings
      let exampList = await getAllTrainingExamples();
      if (exampList.length === 0 && recList.length > 0) {
        exampList = await syncAllTrainingExamples(recList, exList);
      }
      setExamples(exampList);
    } catch (err) {
      console.error('Failed to load dataset:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    return () => {
      if (audioElement) {
        audioElement.pause();
      }
    };
  }, [loadData]);

  const handleSyncAll = async () => {
    setSyncing(true);
    try {
      const recList = await getAllRecordings();
      const exList = await getExercises();
      setRecordings(recList);
      setExercises(exList);
      const synced = await syncAllTrainingExamples(recList, exList);
      setExamples(synced);
    } catch (err) {
      console.error('Sync failed:', err);
    } finally {
      setSyncing(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const dataset = await generateMLDatasetExport(examples, recordings, {
        includeAudioBase64: includeAudioInExport
      });
      downloadMLDatasetExport(dataset);
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setExporting(false);
    }
  };

  const handlePlayAudio = (example: TrainingExample) => {
    if (playingId === example.id && audioElement) {
      audioElement.pause();
      setPlayingId(null);
      return;
    }

    if (audioElement) {
      audioElement.pause();
    }

    const rec = recordings.find((r) => r.id === example.recordingId);
    if (!rec || !rec.blob) {
      alert('Audio file not found in local storage.');
      return;
    }

    const url = URL.createObjectURL(rec.blob);
    const audio = new Audio(url);
    audio.onended = () => {
      setPlayingId(null);
      URL.revokeObjectURL(url);
    };
    audio.onerror = () => {
      setPlayingId(null);
      URL.revokeObjectURL(url);
    };
    audio.play();
    setAudioElement(audio);
    setPlayingId(example.id);
  };

  const handleToggleExclusion = async (example: TrainingExample, reason?: TrainingExclusionReason) => {
    const newIncluded = !example.includedInTraining;
    const newReason = newIncluded ? undefined : (reason || 'other');

    const updatedExample: TrainingExample = {
      ...example,
      includedInTraining: newIncluded,
      excludedReason: newReason
    };

    await saveTrainingExample(updatedExample);

    // Update in local state
    setExamples((prev) =>
      prev.map((e) => (e.id === example.id ? updatedExample : e))
    );

    // Also update backing recording if exists
    const rec = recordings.find((r) => r.id === example.recordingId);
    if (rec) {
      const updatedRec: Recording = {
        ...rec,
        excludedFromTraining: !newIncluded,
        trainingExclusionReason: newReason
      };
      await updateRecording(updatedRec);
      setRecordings((prev) =>
        prev.map((r) => (r.id === rec.id ? updatedRec : r))
      );
    }
  };

  const handleExclusionReasonChange = async (
    example: TrainingExample,
    reason: TrainingExclusionReason
  ) => {
    const updatedExample: TrainingExample = {
      ...example,
      includedInTraining: false,
      excludedReason: reason
    };

    await saveTrainingExample(updatedExample);

    setExamples((prev) =>
      prev.map((e) => (e.id === example.id ? updatedExample : e))
    );

    const rec = recordings.find((r) => r.id === example.recordingId);
    if (rec) {
      const updatedRec: Recording = {
        ...rec,
        excludedFromTraining: true,
        trainingExclusionReason: reason
      };
      await updateRecording(updatedRec);
      setRecordings((prev) =>
        prev.map((r) => (r.id === rec.id ? updatedRec : r))
      );
    }
  };

  // Compute dataset statistics
  const stats = useMemo(() => {
    return calculateDatasetStatistics(examples, exercises);
  }, [examples, exercises]);

  // Filtered examples
  const filteredExamples = useMemo(() => {
    return filterTrainingExamples(examples, filters);
  }, [examples, filters]);

  const uniqueUnits = useMemo(() => {
    const set = new Set<string>();
    examples.forEach((e) => e.targetUnits.forEach((u) => set.add(u)));
    return Array.from(set);
  }, [examples]);

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-12 text-center text-slate-500 flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
        <p className="text-sm font-medium">Loading training dataset...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header & Privacy Notice */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 bg-teal-50 text-teal-700 rounded-xl">
                <Database className="w-5 h-5" />
              </span>
              <h1 className="text-2xl font-bold text-slate-900">Training Dataset</h1>
            </div>
            <p className="text-sm text-slate-600 mt-1">
              Curate and export therapist-labelled speech practice examples for acoustic ML model training.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleSyncAll}
              disabled={syncing}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
              Sync Latest Recordings
            </button>

            <button
              onClick={handleExport}
              disabled={exporting || examples.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 rounded-xl shadow-xs transition"
            >
              <Download className="w-4 h-4" />
              {exporting ? 'Exporting...' : 'Export ML Dataset'}
            </button>
          </div>
        </div>

        {/* Explicit Privacy Banner */}
        <div className="flex items-start gap-3 p-4 bg-teal-50/70 border border-teal-200/80 rounded-xl">
          <ShieldCheck className="w-5 h-5 text-teal-700 shrink-0 mt-0.5" />
          <div className="text-xs text-teal-900 leading-relaxed">
            <p className="font-semibold text-teal-950">Strict Local Privacy Guarantee</p>
            <p className="mt-0.5">
              <strong>Training recordings remain on this device unless you explicitly export them.</strong> No speech audio is uploaded to any external server or cloud service.
            </p>
          </div>
        </div>

        {/* Quality Rule Banner */}
        <div className="flex items-start gap-3 p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl text-xs text-slate-600">
          <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <span className="font-semibold text-slate-800">Dataset Quality Standard: </span>
            Only clinical therapist assessments (<span className="text-emerald-700 font-medium">CORRECT</span> or <span className="text-rose-700 font-medium">INCORRECT</span>) are eligible for training. Automatic algorithmic verdicts, unreviewed recordings, and <span className="text-amber-700 font-medium">UNCERTAIN</span> evaluations are excluded by default.
          </div>
        </div>
      </div>

      {/* High-Level Dataset Summary Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <p className="text-xs font-medium text-slate-500">Total Examples</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{stats.totalRecordings}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">{stats.totalTherapistReviewed} therapist reviewed</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-emerald-100 bg-emerald-50/30 shadow-xs">
          <p className="text-xs font-medium text-emerald-800">Eligible for Training</p>
          <p className="text-2xl font-bold text-emerald-700 mt-1">{stats.totalEligible}</p>
          <p className="text-[11px] text-emerald-600 mt-0.5">Therapist confirmed</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <p className="text-xs font-medium text-amber-700">Uncertain / Unreviewed</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">
            {stats.totalUncertain + stats.totalUnreviewed}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">{stats.totalUncertain} uncertain, {stats.totalUnreviewed} unreviewed</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-rose-100 bg-rose-50/30 shadow-xs">
          <p className="text-xs font-medium text-rose-800">Excluded</p>
          <p className="text-2xl font-bold text-rose-700 mt-1">{stats.totalExcluded}</p>
          <p className="text-[11px] text-rose-600 mt-0.5">Noise, cough, or manual</p>
        </div>
      </div>

      {/* Tabs for Navigation */}
      <div className="flex border-b border-slate-200 gap-4">
        <button
          onClick={() => setActiveTab('statistics')}
          className={`pb-3 font-semibold text-sm transition-colors border-b-2 ${
            activeTab === 'statistics'
              ? 'border-teal-600 text-teal-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Target Sound Statistics
        </button>
        <button
          onClick={() => setActiveTab('examples')}
          className={`pb-3 font-semibold text-sm transition-colors border-b-2 flex items-center gap-2 ${
            activeTab === 'examples'
              ? 'border-teal-600 text-teal-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <span>All Training Examples</span>
          <span className="px-2 py-0.5 text-xs bg-slate-100 text-slate-600 rounded-full font-medium">
            {filteredExamples.length}
          </span>
        </button>
      </div>

      {/* Tab 1: Dataset Statistics */}
      {activeTab === 'statistics' && (
        <div className="space-y-6">
          {/* Individual Targets Section */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Individual Target Phonemes</h2>
                <p className="text-xs text-slate-500">Single syllables: کا, کی, کے, کو</p>
              </div>
              <span className="px-2.5 py-1 text-xs bg-teal-50 text-teal-700 font-semibold rounded-lg">
                Phase 8 Targets
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {stats.individualTargets.map((target) => (
                <div
                  key={target.targetKey}
                  className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-bold font-serif text-teal-800">
                      {target.targetText}
                    </span>
                    <span className="text-xs font-semibold px-2 py-0.5 bg-white border border-slate-200 rounded-md text-slate-700">
                      {target.totalExamples} total
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs border-t border-slate-200/70 pt-2">
                    <div className="flex justify-between items-center text-emerald-700">
                      <span className="flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Correct:
                      </span>
                      <span className="font-bold">{target.correctCount}</span>
                    </div>

                    <div className="flex justify-between items-center text-rose-700">
                      <span className="flex items-center gap-1">
                        <XCircle className="w-3.5 h-3.5" />
                        Incorrect:
                      </span>
                      <span className="font-bold">{target.incorrectCount}</span>
                    </div>

                    <div className="flex justify-between items-center text-amber-700">
                      <span className="flex items-center gap-1">
                        <HelpCircle className="w-3.5 h-3.5" />
                        Uncertain:
                      </span>
                      <span className="font-bold">{target.uncertainCount}</span>
                    </div>

                    <div className="flex justify-between items-center text-slate-500">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        Unreviewed:
                      </span>
                      <span className="font-medium">{target.unreviewedCount}</span>
                    </div>
                  </div>

                  <div className="border-t border-slate-200/70 pt-2 flex items-center justify-between text-[11px]">
                    <span className="text-emerald-800 font-semibold">
                      Training Eligible:
                    </span>
                    <span className="font-bold text-emerald-700">
                      {target.includedCount}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Sequences Section */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Sequence Combinations</h2>
                <p className="text-xs text-slate-500">
                  Target sequences: کا، کی / کا، کی، کے / کا، کی، کے، کو
                </p>
              </div>
              <span className="px-2.5 py-1 text-xs bg-indigo-50 text-indigo-700 font-semibold rounded-lg">
                Multi-phoneme
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {stats.sequenceTargets.map((target) => (
                <div
                  key={target.targetKey}
                  className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xl font-bold font-serif text-indigo-900">
                      {target.targetText}
                    </span>
                    <span className="text-xs font-semibold px-2 py-0.5 bg-white border border-slate-200 rounded-md text-slate-700">
                      {target.totalExamples} total
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs border-t border-slate-200/70 pt-2">
                    <div className="flex justify-between items-center text-emerald-700">
                      <span className="flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Correct:
                      </span>
                      <span className="font-bold">{target.correctCount}</span>
                    </div>

                    <div className="flex justify-between items-center text-rose-700">
                      <span className="flex items-center gap-1">
                        <XCircle className="w-3.5 h-3.5" />
                        Incorrect:
                      </span>
                      <span className="font-bold">{target.incorrectCount}</span>
                    </div>

                    <div className="flex justify-between items-center text-amber-700">
                      <span className="flex items-center gap-1">
                        <HelpCircle className="w-3.5 h-3.5" />
                        Uncertain:
                      </span>
                      <span className="font-bold">{target.uncertainCount}</span>
                    </div>

                    <div className="flex justify-between items-center text-slate-500">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        Unreviewed:
                      </span>
                      <span className="font-medium">{target.unreviewedCount}</span>
                    </div>
                  </div>

                  <div className="border-t border-slate-200/70 pt-2 flex items-center justify-between text-[11px]">
                    <span className="text-indigo-800 font-semibold">
                      Training Eligible:
                    </span>
                    <span className="font-bold text-indigo-700">
                      {target.includedCount}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Exclusion Breakdown */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-3">
            <h3 className="text-sm font-bold text-slate-900">Training Exclusions by Category</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {EXCLUSION_REASONS.map((r) => (
                <div
                  key={r.value}
                  className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs"
                >
                  <span className="text-slate-600 truncate">{r.label}</span>
                  <span className="font-bold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200">
                    {stats.exclusionBreakdown[r.value] || 0}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Filtered Training Examples List */}
      {activeTab === 'examples' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                <Filter className="w-4 h-4 text-teal-600" />
                <span>Filter Training Examples</span>
              </div>
              <button
                onClick={() =>
                  setFilters({
                    exerciseId: 'all',
                    targetUnit: 'all',
                    therapistResult: 'all',
                    reviewStatus: 'all',
                    trainingStatus: 'all',
                    startDate: '',
                    endDate: '',
                    searchQuery: ''
                  })
                }
                className="text-xs text-slate-500 hover:text-slate-800 underline"
              >
                Reset Filters
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              {/* Target Exercise */}
              <div>
                <label className="block font-medium text-slate-600 mb-1">Target Exercise</label>
                <select
                  value={filters.exerciseId}
                  onChange={(e) => setFilters({ ...filters, exerciseId: e.target.value })}
                  className="w-full rounded-lg border-slate-200 bg-slate-50 p-2 text-xs focus:ring-1 focus:ring-teal-500"
                >
                  <option value="all">All Exercises</option>
                  {stats.allTargets.map((t) => (
                    <option key={t.targetKey} value={t.targetKey}>
                      {t.targetText} ({t.name})
                    </option>
                  ))}
                </select>
              </div>

              {/* Target Unit */}
              <div>
                <label className="block font-medium text-slate-600 mb-1">Target Unit</label>
                <select
                  value={filters.targetUnit}
                  onChange={(e) => setFilters({ ...filters, targetUnit: e.target.value })}
                  className="w-full rounded-lg border-slate-200 bg-slate-50 p-2 text-xs focus:ring-1 focus:ring-teal-500"
                >
                  <option value="all">All Units</option>
                  {uniqueUnits.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>

              {/* Therapist Result */}
              <div>
                <label className="block font-medium text-slate-600 mb-1">Therapist Verdict</label>
                <select
                  value={filters.therapistResult}
                  onChange={(e) =>
                    setFilters({
                      ...filters,
                      therapistResult: e.target.value as TherapistResult | 'all'
                    })
                  }
                  className="w-full rounded-lg border-slate-200 bg-slate-50 p-2 text-xs focus:ring-1 focus:ring-teal-500"
                >
                  <option value="all">All Verdicts</option>
                  <option value="CORRECT">Correct</option>
                  <option value="INCORRECT">Incorrect</option>
                  <option value="UNCERTAIN">Uncertain</option>
                </select>
              </div>

              {/* Training Inclusion Status */}
              <div>
                <label className="block font-medium text-slate-600 mb-1">Dataset Status</label>
                <select
                  value={filters.trainingStatus}
                  onChange={(e) =>
                    setFilters({
                      ...filters,
                      trainingStatus: e.target.value as 'all' | 'included' | 'excluded'
                    })
                  }
                  className="w-full rounded-lg border-slate-200 bg-slate-50 p-2 text-xs focus:ring-1 focus:ring-teal-500"
                >
                  <option value="all">All Statuses</option>
                  <option value="included">Included in Training</option>
                  <option value="excluded">Excluded / Not Eligible</option>
                </select>
              </div>

              {/* Review status */}
              <div>
                <label className="block font-medium text-slate-600 mb-1">Review Status</label>
                <select
                  value={filters.reviewStatus}
                  onChange={(e) =>
                    setFilters({
                      ...filters,
                      reviewStatus: e.target.value as 'all' | 'reviewed' | 'unreviewed'
                    })
                  }
                  className="w-full rounded-lg border-slate-200 bg-slate-50 p-2 text-xs focus:ring-1 focus:ring-teal-500"
                >
                  <option value="all">All Statuses</option>
                  <option value="reviewed">Reviewed by Therapist</option>
                  <option value="unreviewed">Pending Review</option>
                </select>
              </div>

              {/* Date Start */}
              <div>
                <label className="block font-medium text-slate-600 mb-1">From Date</label>
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                  className="w-full rounded-lg border-slate-200 bg-slate-50 p-2 text-xs focus:ring-1 focus:ring-teal-500"
                />
              </div>

              {/* Date End */}
              <div>
                <label className="block font-medium text-slate-600 mb-1">To Date</label>
                <input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                  className="w-full rounded-lg border-slate-200 bg-slate-50 p-2 text-xs focus:ring-1 focus:ring-teal-500"
                />
              </div>

              {/* Search text */}
              <div>
                <label className="block font-medium text-slate-600 mb-1">Search Notes</label>
                <input
                  type="text"
                  placeholder="Notes, targets..."
                  value={filters.searchQuery}
                  onChange={(e) => setFilters({ ...filters, searchQuery: e.target.value })}
                  className="w-full rounded-lg border-slate-200 bg-slate-50 p-2 text-xs focus:ring-1 focus:ring-teal-500"
                />
              </div>
            </div>
          </div>

          {/* Table / List */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            {filteredExamples.length === 0 ? (
              <div className="p-12 text-center text-slate-500 text-sm">
                No training examples match your current filter criteria.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredExamples.map((item) => {
                  const isPlaying = playingId === item.id;
                  return (
                    <div
                      key={item.id}
                      className={`p-4 transition flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                        item.includedInTraining
                          ? 'bg-white hover:bg-slate-50/70'
                          : 'bg-slate-50/40 hover:bg-slate-100/50 opacity-90'
                      }`}
                    >
                      {/* Left: Target, Play, and Label */}
                      <div className="flex items-start sm:items-center gap-3">
                        <button
                          onClick={() => handlePlayAudio(item)}
                          className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition ${
                            isPlaying
                              ? 'bg-teal-600 text-white'
                              : 'bg-slate-100 text-slate-700 hover:bg-teal-50 hover:text-teal-700'
                          }`}
                          aria-label={isPlaying ? 'Pause audio' : 'Play audio'}
                        >
                          {isPlaying ? (
                            <Pause className="w-4 h-4" />
                          ) : (
                            <Play className="w-4 h-4 ml-0.5" />
                          )}
                        </button>

                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-bold font-serif text-slate-900">
                              {item.targetText}
                            </span>
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-mono">
                              {item.exerciseId}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-1">
                            <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                            <span>•</span>
                            <span>{item.audioQuality?.duration?.toFixed(2) || '0.00'}s</span>
                            <span>•</span>
                            <span className="text-slate-400 font-mono">
                              {item.audioQuality?.mimeType || 'audio/webm'}
                            </span>
                            {item.audioQuality?.sampleRate && (
                              <>
                                <span>•</span>
                                <span>{item.audioQuality.sampleRate} Hz</span>
                              </>
                            )}
                            {item.audioQuality?.silencePercentage !== undefined && (
                              <>
                                <span>•</span>
                                <span>{item.audioQuality.silencePercentage}% silence</span>
                              </>
                            )}
                          </div>

                          {item.therapistRemarks && (
                            <p className="text-xs text-slate-600 italic mt-1 bg-slate-50 px-2 py-1 rounded border border-slate-100">
                              "{item.therapistRemarks}"
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Right: Therapist Label & Training Eligibility Toggle */}
                      <div className="flex flex-wrap items-center gap-3 self-end sm:self-center">
                        {/* Clinical label badge */}
                        <div>
                          {item.therapistLabel === 'CORRECT' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              CORRECT
                            </span>
                          ) : item.therapistLabel === 'INCORRECT' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full bg-rose-100 text-rose-800">
                              <XCircle className="w-3.5 h-3.5" />
                              INCORRECT
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-800">
                              <HelpCircle className="w-3.5 h-3.5" />
                              {item.therapistLabel || 'PENDING'}
                            </span>
                          )}
                        </div>

                        {/* Training Inclusion status */}
                        <div className="flex items-center gap-2">
                          {item.includedInTraining ? (
                            <span className="px-2 py-0.5 text-xs font-semibold rounded bg-teal-50 text-teal-700 border border-teal-200">
                              Training Eligible
                            </span>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <span className="px-2 py-0.5 text-xs font-semibold rounded bg-slate-100 text-slate-500 border border-slate-200">
                                Excluded
                              </span>
                              {item.excludedReason && (
                                <span className="text-[11px] text-rose-600 font-medium">
                                  ({item.excludedReason})
                                </span>
                              )}
                            </div>
                          )}

                          {/* Toggle Inclusion / Exclusion */}
                          <button
                            onClick={() => handleToggleExclusion(item)}
                            className="text-xs text-slate-600 hover:text-slate-900 underline px-1 py-0.5"
                          >
                            {item.includedInTraining ? 'Exclude' : 'Include'}
                          </button>

                          {/* Reason Selector if excluded */}
                          {!item.includedInTraining && (
                            <select
                              value={item.excludedReason || 'other'}
                              onChange={(e) =>
                                handleExclusionReasonChange(
                                  item,
                                  e.target.value as TrainingExclusionReason
                                )
                              }
                              className="text-[11px] border-slate-200 bg-white rounded px-2 py-1 text-slate-700 focus:ring-1 focus:ring-teal-500"
                              aria-label="Exclusion reason"
                            >
                              {EXCLUSION_REASONS.map((r) => (
                                <option key={r.value} value={r.value}>
                                  {r.label}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Export Options & Notes */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs text-slate-600 space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-slate-800">Export Configuration</span>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={includeAudioInExport}
              onChange={(e) => setIncludeAudioInExport(e.target.checked)}
              className="rounded border-slate-300 text-teal-600 focus:ring-teal-500 w-3.5 h-3.5"
            />
            <span className="text-xs text-slate-700">Embed Audio as Base64 in JSON</span>
          </label>
        </div>
        <p className="leading-relaxed">
          The ML export produces a standalone JSON formatted strictly for audio machine learning pipelines. It links target phonemes (e.g. <code>کا</code>, <code>کی</code>, <code>کے</code>, <code>کو</code>), clinical evaluations, and audio properties. Recordings remain local on your device until exported.
        </p>
      </div>
    </div>
  );
};
