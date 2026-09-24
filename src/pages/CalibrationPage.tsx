import React, { useState, useEffect, useCallback } from 'react';
import {
  Sliders,
  CheckCircle2,
  XCircle,
  ShieldAlert,
  Mic,
  Square,
  RotateCcw,
  Trash2,
  Save,
  Info,
  RefreshCw,
  PlusCircle,
  Check,
  Award
} from 'lucide-react';
import { useRecorder } from '../hooks/useRecorder';
import { AudioPlayer } from '../components/audio/AudioPlayer';
import {
  CalibrationExample,
  CalibrationSettings
} from '../types';
import {
  getCalibrationExamples,
  getCalibrationSettings,
  saveCalibrationSettings,
  addCalibrationExample,
  deleteCalibrationExample,
  seedInitialCalibration,
  deleteAllCalibrationExamples,
  DEFAULT_CALIBRATION_SETTINGS
} from '../storage/calibrationRepository';
import { formatDurationSeconds } from '../utils/audio';

const TARGET_EXERCISE_ID = 'ex-qaf-ka-01';

export const CalibrationPage: React.FC = () => {
  const [examples, setExamples] = useState<CalibrationExample[]>([]);
  const [settings, setSettings] = useState<CalibrationSettings>(DEFAULT_CALIBRATION_SETTINGS);
  const [stagedSettings, setStagedSettings] = useState<CalibrationSettings>(DEFAULT_CALIBRATION_SETTINGS);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [recordNote, setRecordNote] = useState<string>('');
  const [filter, setFilter] = useState<'ALL' | 'CORRECT' | 'INCORRECT'>('ALL');

  const {
    state: recorderState,
    duration: recordedDuration,
    audioBlob,
    mimeType,
    errorMessage: recorderError,
    startRecording,
    stopRecording,
    resetRecorder
  } = useRecorder();

  // Load existing calibration data
  const loadCalibrationData = useCallback(async () => {
    setIsLoading(true);
    try {
      await seedInitialCalibration(TARGET_EXERCISE_ID);
      const [storedExamples, storedSettings] = await Promise.all([
        getCalibrationExamples(TARGET_EXERCISE_ID),
        getCalibrationSettings()
      ]);
      setExamples(storedExamples);
      setSettings(storedSettings);
      setStagedSettings(storedSettings);
    } catch (err) {
      console.error('Failed to load calibration data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCalibrationData();
  }, [loadCalibrationData]);

  // Handle saving new reference recording
  const handleSaveReference = async (label: 'CORRECT' | 'INCORRECT') => {
    if (!audioBlob) return;

    const newExample: CalibrationExample = {
      id: `calib-${label.toLowerCase()}-${Date.now()}`,
      exerciseId: TARGET_EXERCISE_ID,
      label,
      blob: audioBlob,
      duration: recordedDuration,
      mimeType: mimeType || 'audio/webm',
      createdAt: new Date().toISOString(),
      note: recordNote.trim() || undefined
    };

    await addCalibrationExample(newExample);
    setRecordNote('');
    resetRecorder();
    await loadCalibrationData();
  };

  // Handle delete reference
  const handleDeleteExample = async (id: string) => {
    if (window.confirm('Are you sure you want to remove this reference recording?')) {
      await deleteCalibrationExample(id);
      await loadCalibrationData();
    }
  };

  // Handle reset baseline
  const handleRestoreBaseline = async () => {
    if (window.confirm('Reset reference examples to the initial baseline library? Existing custom recordings will be replaced.')) {
      await deleteAllCalibrationExamples();
      await seedInitialCalibration(TARGET_EXERCISE_ID);
      await loadCalibrationData();
    }
  };

  // Handle saving modified thresholds
  const handleSaveSettings = async () => {
    await saveCalibrationSettings(stagedSettings);
    setSettings(stagedSettings);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  // Handle reset settings to defaults
  const handleResetSettings = () => {
    setStagedSettings(DEFAULT_CALIBRATION_SETTINGS);
  };

  // Metrics
  const correctCount = examples.filter((e) => e.label === 'CORRECT').length;
  const incorrectCount = examples.filter((e) => e.label === 'INCORRECT').length;
  const totalCount = examples.length;
  const isSettingsDirty = JSON.stringify(settings) !== JSON.stringify(stagedSettings);

  const filteredExamples = examples.filter((e) => {
    if (filter === 'CORRECT') return e.label === 'CORRECT';
    if (filter === 'INCORRECT') return e.label === 'INCORRECT';
    return true;
  });

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-100 text-teal-800">
              Exercise Calibration
            </span>
            <span className="text-xs text-slate-500 font-arabic font-bold text-base">کا</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-1">
            Calibration & Reference Library
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Therapist-confirmed reference samples used for transparent acoustic comparison.
          </p>
        </div>

        <button
          type="button"
          onClick={handleRestoreBaseline}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition active:scale-95 cursor-pointer shadow-xs self-start sm:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
          <span>Restore Baseline Library</span>
        </button>
      </div>

      {/* Mandatory Clinical Limitation Notice */}
      <section
        aria-label="Clinical limitation notice"
        className="p-4 sm:p-5 rounded-2xl bg-amber-50/80 border border-amber-200/90 text-amber-950 flex items-start gap-3.5 shadow-xs"
      >
        <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="space-y-1 text-xs sm:text-sm leading-relaxed">
          <p className="font-semibold text-amber-900">
            Audio-based practice feedback. Confirm pronunciation with your speech therapist.
          </p>
          <p className="text-amber-800/90">
            Microphone audio cannot directly measure physical tongue body or velopharyngeal articulation. Results indicate acoustic similarity to your therapist-confirmed examples, not a medical diagnosis or therapy conclusion.
          </p>
        </div>
      </section>

      {/* Calibration Quality Dashboard */}
      <section aria-labelledby="quality-heading" className="space-y-3">
        <h2 id="quality-heading" className="text-base font-bold text-slate-900 flex items-center gap-2">
          <Award className="w-4 h-4 text-teal-600" />
          <span>Calibration Quality Dashboard</span>
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
            <span className="text-xs font-medium text-slate-500 block">Correct References</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold text-emerald-600">{correctCount}</span>
              <span className="text-xs text-slate-400">samples</span>
            </div>
            <span className="text-[11px] text-emerald-700 mt-1 flex items-center gap-1 font-medium">
              <CheckCircle2 className="w-3 h-3" />
              Verified &ldquo;کا&rdquo;
            </span>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
            <span className="text-xs font-medium text-slate-500 block">Incorrect References</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold text-rose-600">{incorrectCount}</span>
              <span className="text-xs text-slate-400">samples</span>
            </div>
            <span className="text-[11px] text-rose-700 mt-1 flex items-center gap-1 font-medium">
              <XCircle className="w-3 h-3" />
              Contrast patterns
            </span>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
            <span className="text-xs font-medium text-slate-500 block">Total References</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold text-slate-900">{totalCount}</span>
              <span className="text-xs text-slate-400">recordings</span>
            </div>
            <span className="text-[11px] text-slate-500 mt-1 block">
              In IndexedDB
            </span>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
            <span className="text-xs font-medium text-slate-500 block">Target Threshold</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold text-teal-700">
                {Math.round(settings.similarityThreshold * 100)}%
              </span>
              <span className="text-xs text-slate-400">min</span>
            </div>
            <span className="text-[11px] text-teal-800 mt-1 block font-medium">
              Margin: +{Math.round(settings.marginVsIncorrect * 100)}%
            </span>
          </div>
        </div>
      </section>

      {/* Thresholds Configuration */}
      <section aria-labelledby="settings-heading" className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-teal-600" />
            <h2 id="settings-heading" className="text-base font-bold text-slate-900">
              Acoustic Comparison Thresholds
            </h2>
          </div>
          <span className="text-xs text-slate-500">Therapist Configurable</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Similarity Threshold Slider */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-sm">
              <label htmlFor="sim-threshold" className="font-semibold text-slate-800">
                Minimum Similarity for Correct
              </label>
              <span className="font-mono text-teal-700 font-bold bg-teal-50 px-2 py-0.5 rounded-lg border border-teal-200">
                {Math.round(stagedSettings.similarityThreshold * 100)}%
              </span>
            </div>
            <input
              id="sim-threshold"
              type="range"
              min="0.50"
              max="0.90"
              step="0.01"
              value={stagedSettings.similarityThreshold}
              onChange={(e) =>
                setStagedSettings({
                  ...stagedSettings,
                  similarityThreshold: parseFloat(e.target.value)
                })
              }
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-teal-600"
            />
            <p className="text-xs text-slate-500">
              Higher value requires a closer acoustic match to therapist-confirmed samples before signaling ✓ CORRECT.
            </p>
          </div>

          {/* Margin vs Incorrect Slider */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-sm">
              <label htmlFor="margin-threshold" className="font-semibold text-slate-800">
                Confidence Margin over Incorrect
              </label>
              <span className="font-mono text-teal-700 font-bold bg-teal-50 px-2 py-0.5 rounded-lg border border-teal-200">
                +{Math.round(stagedSettings.marginVsIncorrect * 100)}%
              </span>
            </div>
            <input
              id="margin-threshold"
              type="range"
              min="0.02"
              max="0.25"
              step="0.01"
              value={stagedSettings.marginVsIncorrect}
              onChange={(e) =>
                setStagedSettings({
                  ...stagedSettings,
                  marginVsIncorrect: parseFloat(e.target.value)
                })
              }
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-teal-600"
            />
            <p className="text-xs text-slate-500">
              Score for correct references must exceed incorrect references by this buffer to prevent false approvals.
            </p>
          </div>
        </div>

        {/* Action bar for thresholds */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
          <div className="flex items-center gap-2">
            {saveSuccess && (
              <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl font-medium border border-emerald-200">
                <Check className="w-3.5 h-3.5" />
                Thresholds saved successfully
              </span>
            )}
            {!saveSuccess && isSettingsDirty && (
              <span className="text-xs text-amber-700 bg-amber-50 px-3 py-1 rounded-lg">
                Unsaved modifications pending
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleResetSettings}
              disabled={!isSettingsDirty}
              className="px-3 py-2 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
            >
              Reset Defaults
            </button>
            <button
              type="button"
              onClick={handleSaveSettings}
              disabled={!isSettingsDirty}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-teal-600 rounded-xl hover:bg-teal-700 disabled:opacity-50 transition active:scale-95 cursor-pointer shadow-xs"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save Thresholds</span>
            </button>
          </div>
        </div>
      </section>

      {/* Record New Reference Example */}
      <section aria-labelledby="record-ref-heading" className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <PlusCircle className="w-4 h-4 text-teal-600" />
          <h2 id="record-ref-heading" className="text-base font-bold text-slate-900">
            Record New Reference Example for &ldquo;کا&rdquo;
          </h2>
        </div>

        <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
          The speech therapist or guided learner can record a clean audio take of &ldquo;کا&rdquo; and categorize it as either a confirmed correct example or a contrastive incorrect example.
        </p>

        {recorderError && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{recorderError}</span>
          </div>
        )}

        {/* Recorder Controls */}
        <div className="bg-slate-50 rounded-2xl border border-slate-200/80 p-4 sm:p-5 flex flex-col items-center justify-center gap-4">
          {recorderState === 'idle' && (
            <button
              type="button"
              onClick={startRecording}
              className="flex items-center gap-2.5 px-5 py-3 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm transition-all duration-150 shadow-md shadow-teal-600/20 active:scale-95 cursor-pointer"
            >
              <Mic className="w-4 h-4" />
              <span>Record Reference Take</span>
            </button>
          )}

          {recorderState === 'recording' && (
            <div className="flex flex-col items-center gap-3">
              <div className="flex items-center gap-2 text-rose-600 font-semibold animate-pulse">
                <span className="w-3 h-3 rounded-full bg-rose-500" />
                <span>Recording reference &ldquo;کا&rdquo;...</span>
              </div>
              <span className="text-2xl font-mono font-bold text-slate-800">
                {formatDurationSeconds(recordedDuration)}
              </span>
              <button
                type="button"
                onClick={stopRecording}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-sm transition active:scale-95 cursor-pointer shadow-xs"
              >
                <Square className="w-4 h-4 fill-current" />
                <span>Stop Recording</span>
              </button>
            </div>
          )}

          {recorderState === 'recorded' && audioBlob && (
            <div className="w-full space-y-4">
              <AudioPlayer
                blob={audioBlob}
                recordedDuration={recordedDuration}
              />

              <div className="space-y-1.5">
                <label htmlFor="ref-notes" className="text-xs font-semibold text-slate-700">
                  Therapist Clinical Notes (Optional)
                </label>
                <input
                  id="ref-notes"
                  type="text"
                  placeholder="e.g. Clean velar burst with open vowel, or Dental substitution [ta]"
                  value={recordNote}
                  onChange={(e) => setRecordNote(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              {/* Action Buttons: Mark Correct vs Mark Incorrect */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  onClick={resetRecorder}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Discard Take</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleSaveReference('INCORRECT')}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition active:scale-95 cursor-pointer shadow-xs"
                  >
                    <XCircle className="w-4 h-4" />
                    <span>Save as ✗ INCORRECT</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSaveReference('CORRECT')}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition active:scale-95 cursor-pointer shadow-xs"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Save as ✓ CORRECT</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Reference Library List */}
      <section aria-labelledby="library-heading" className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h2 id="library-heading" className="text-base font-bold text-slate-900">
              Active Reference Library ({filteredExamples.length})
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              These recordings are compared against live student attempts in real time.
            </p>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setFilter('ALL')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                filter === 'ALL'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All ({totalCount})
            </button>
            <button
              type="button"
              onClick={() => setFilter('CORRECT')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                filter === 'CORRECT'
                  ? 'bg-white text-emerald-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ✓ Correct ({correctCount})
            </button>
            <button
              type="button"
              onClick={() => setFilter('INCORRECT')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                filter === 'INCORRECT'
                  ? 'bg-white text-rose-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ✗ Incorrect ({incorrectCount})
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="py-8 text-center text-xs text-slate-400">
            Loading reference audio database...
          </div>
        ) : filteredExamples.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-200">
            No reference recordings match the selected filter.
          </div>
        ) : (
          <div className="space-y-3">
            {filteredExamples.map((ex) => (
              <div
                key={ex.id}
                className="p-4 rounded-xl border border-slate-200/90 bg-slate-50/50 hover:bg-slate-50 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    {ex.label === 'CORRECT' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        CORRECT
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800">
                        <XCircle className="w-3.5 h-3.5" />
                        INCORRECT
                      </span>
                    )}
                    <span className="text-xs text-slate-400 font-mono">
                      {formatDurationSeconds(ex.duration)}
                    </span>
                    <span className="text-xs text-slate-400">
                      {new Date(ex.createdAt).toLocaleDateString()} {new Date(ex.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  {ex.note && (
                    <p className="text-xs text-slate-700 font-medium">
                      {ex.note}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {ex.blob && (
                    <div className="w-48 sm:w-56">
                      <AudioPlayer
                        blob={ex.blob}
                        recordedDuration={ex.duration}
                        className="py-1.5 px-2 bg-white"
                      />
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => handleDeleteExample(ex.id)}
                    className="p-2 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                    title="Remove reference recording"
                    aria-label={`Remove reference ${ex.id}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Explanatory Clinical Guidelines Footer */}
      <footer className="p-4 rounded-xl bg-slate-100/80 border border-slate-200 text-xs text-slate-600 space-y-1">
        <div className="flex items-center gap-1.5 font-semibold text-slate-800">
          <Info className="w-4 h-4 text-teal-600" />
          <span>Transparent Signal Comparison vs Black-Box Models</span>
        </div>
        <p className="leading-relaxed">
          This system uses normalized frequency spectra, formant distribution, zero-crossing rates, and RMS envelope comparison. No speech-to-text API or deep neural network is used. Confirm all findings with a licensed Speech-Language Pathologist.
        </p>
      </footer>
    </div>
  );
};
