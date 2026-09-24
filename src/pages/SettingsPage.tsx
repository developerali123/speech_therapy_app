import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useSettings } from '../hooks/useSettings';
import { getAllRecordings, deleteAllRecordings } from '../storage/recordingRepository';
import { getAllSessions, deleteAllSessions } from '../storage/sessionRepository';
import { seedExercises } from '../storage/exerciseRepository';
import { downloadPracticeBackup } from '../utils/export';
import { importPracticeData } from '../utils/import';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import {
  HardDrive,
  Download,
  Upload,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  ShieldCheck,
  RefreshCw
} from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const { settings, updateSettings } = useSettings();

  const [recordingsCount, setRecordingsCount] = useState<number>(0);
  const [sessionsCount, setSessionsCount] = useState<number>(0);
  const [storageEstimate, setStorageEstimate] = useState<string>('Calculating...');
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Confirmation Modals
  const [deleteRecordingsModal, setDeleteRecordingsModal] = useState<boolean>(false);
  const [resetAllDataModal, setResetAllDataModal] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadStorageInfo = async () => {
    try {
      const [recs, sess] = await Promise.all([
        getAllRecordings(),
        getAllSessions()
      ]);
      setRecordingsCount(recs.length);
      setSessionsCount(sess.length);

      if (navigator.storage && navigator.storage.estimate) {
        const estimate = await navigator.storage.estimate();
        if (estimate.usage !== undefined) {
          const mb = (estimate.usage / (1024 * 1024)).toFixed(2);
          setStorageEstimate(`${mb} MB used`);
        } else {
          setStorageEstimate('Available');
        }
      } else {
        setStorageEstimate('IndexedDB Local');
      }
    } catch {
      setStorageEstimate('IndexedDB Local');
    }
  };

  useEffect(() => {
    loadStorageInfo();
  }, []);

  const handleExport = async () => {
    try {
      setIsExporting(true);
      await downloadPracticeBackup();
      setStatusMessage({ type: 'success', text: 'Practice backup downloaded successfully.' });
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Export failed'
      });
    } finally {
      setIsExporting(false);
      setTimeout(() => setStatusMessage(null), 4000);
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsImporting(true);
      const text = await file.text();
      const result = await importPracticeData(text, true);

      if (result.success) {
        setStatusMessage({
          type: 'success',
          text: `Restored ${result.sessionsCount} sessions and ${result.recordingsCount} recordings.`
        });
        await loadStorageInfo();
      } else {
        setStatusMessage({
          type: 'error',
          text: result.error || 'Failed to restore backup.'
        });
      }
    } catch {
      setStatusMessage({ type: 'error', text: 'Error reading backup file.' });
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setTimeout(() => setStatusMessage(null), 5000);
    }
  };

  const handleDeleteRecordings = async () => {
    await deleteAllRecordings();
    setDeleteRecordingsModal(false);
    await loadStorageInfo();
    setStatusMessage({ type: 'success', text: 'All audio recordings deleted.' });
    setTimeout(() => setStatusMessage(null), 3000);
  };

  const handleResetAllData = async () => {
    await deleteAllRecordings();
    await deleteAllSessions();
    await seedExercises();
    await updateSettings({ dailyGoal: 10, userName: '' });
    setResetAllDataModal(false);
    await loadStorageInfo();
    setStatusMessage({ type: 'success', text: 'All practice data reset to initial state.' });
    setTimeout(() => setStatusMessage(null), 3000);
  };

  return (
    <div className="space-y-6 sm:space-y-8 max-w-2xl mx-auto animate-in fade-in duration-200">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          Settings
        </h1>
        <p className="text-sm text-slate-500 font-medium mt-0.5">
          Manage your personal preferences, audio storage, and data backups
        </p>
      </div>

      {statusMessage && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center gap-2 animate-in fade-in ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* User Preferences */}
      <Card className="p-5 sm:p-6 bg-white space-y-4">
        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider pb-1 border-b border-slate-100">
          User Preferences
        </h2>

        {/* User Name */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Your Name / Nickname (Optional)
          </label>
          <input
            type="text"
            value={settings.userName || ''}
            onChange={(e) => updateSettings({ userName: e.target.value })}
            placeholder="e.g. Alex"
            className="w-full text-sm px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>

        {/* Daily Practice Goal */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-2">
            Daily Practice Goal (Attempts/day)
          </label>
          <div className="grid grid-cols-5 gap-2">
            {[5, 10, 15, 20, 25].map((val) => (
              <button
                key={val}
                type="button"
                onClick={() => updateSettings({ dailyGoal: val })}
                className={`py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                  settings.dailyGoal === val
                    ? 'bg-teal-600 text-white border-teal-600 shadow-2xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {val}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Audio Storage Information */}
      <Card className="p-5 sm:p-6 bg-white space-y-3">
        <div className="flex items-center justify-between pb-1 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-teal-600" />
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Audio Storage Information
            </h2>
          </div>
          <button
            type="button"
            onClick={loadStorageInfo}
            className="text-xs text-teal-600 hover:text-teal-700 flex items-center gap-1 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3 pt-1">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-[11px] text-slate-500 block">Recordings</span>
            <span className="text-xl font-bold text-slate-900 mt-0.5 block">{recordingsCount}</span>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-[11px] text-slate-500 block">Sessions</span>
            <span className="text-xl font-bold text-slate-900 mt-0.5 block">{sessionsCount}</span>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-[11px] text-slate-500 block">Storage Used</span>
            <span className="text-sm font-bold text-slate-900 mt-1 block truncate">
              {storageEstimate}
            </span>
          </div>
        </div>

        <p className="text-[11px] text-slate-400 leading-relaxed">
          Recordings are stored entirely in your device browser via IndexedDB. No audio is ever transmitted to a server.
        </p>
      </Card>

      {/* Backup and Restore */}
      <Card className="p-5 sm:p-6 bg-white space-y-4">
        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider pb-1 border-b border-slate-100">
          Backup & Restore
        </h2>

        <p className="text-xs text-slate-600 leading-relaxed">
          Export all sessions, audio recordings, therapist remarks, and settings to a JSON file. You can restore this file on another device or after clearing browser storage.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <Button
            variant="outline"
            size="md"
            onClick={handleExport}
            isLoading={isExporting}
            leftIcon={<Download className="w-4 h-4" />}
          >
            Export Practice Data
          </Button>

          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleImportFile}
              className="hidden"
              id="import-backup-input"
            />
            <Button
              variant="outline"
              size="md"
              fullWidth
              onClick={() => fileInputRef.current?.click()}
              isLoading={isImporting}
              leftIcon={<Upload className="w-4 h-4" />}
            >
              Import Practice Data
            </Button>
          </div>
        </div>
      </Card>

      {/* Danger Zone: Data Management */}
      <Card className="p-5 sm:p-6 bg-white border-rose-200/80 space-y-4">
        <div className="flex items-center gap-2 pb-1 border-b border-rose-100 text-rose-700">
          <AlertTriangle className="w-4 h-4" />
          <h2 className="text-sm font-bold uppercase tracking-wider">
            Manage Local Data
          </h2>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed">
          Permanent actions for device management. We recommend exporting a backup first.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 pt-1">
          <Button
            variant="outline"
            size="md"
            className="text-rose-700 border-rose-200 hover:bg-rose-50"
            onClick={() => setDeleteRecordingsModal(true)}
            leftIcon={<Trash2 className="w-4 h-4" />}
          >
            Delete All Recordings
          </Button>

          <Button
            variant="outline"
            size="md"
            className="text-rose-700 border-rose-200 hover:bg-rose-50"
            onClick={() => setResetAllDataModal(true)}
            leftIcon={<Trash2 className="w-4 h-4" />}
          >
            Reset All Practice Data
          </Button>
        </div>
      </Card>

      {/* Links & About */}
      <Card className="p-5 sm:p-6 bg-white space-y-3">
        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider pb-1 border-b border-slate-100">
          Information & Legal
        </h2>

        <div className="flex flex-col gap-2 pt-1 text-xs">
          <Link
            to="/privacy"
            className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 transition-colors text-slate-700 font-semibold"
          >
            <span className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-teal-600" />
              Privacy & Clinical Limitation Policy
            </span>
            <span className="text-slate-400">→</span>
          </Link>
        </div>

        <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-400 space-y-1">
          <p>Speech Practice Assistant • Version 1.0.0 (Frontend-only PWA)</p>
          <p>Created for home drill support and speech-language therapy review.</p>
        </div>
      </Card>

      {/* Confirmation Modal: Delete Recordings */}
      <Modal
        isOpen={deleteRecordingsModal}
        onClose={() => setDeleteRecordingsModal(false)}
        title="Delete All Recordings"
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeleteRecordingsModal(false)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleDeleteRecordings}
            >
              Confirm Delete
            </Button>
          </>
        }
      >
        <p className="text-xs text-slate-600 leading-relaxed">
          Are you sure? This will permanently delete locally stored practice recordings and cannot be undone unless you have exported a backup.
        </p>
      </Modal>

      {/* Confirmation Modal: Reset All Data */}
      <Modal
        isOpen={resetAllDataModal}
        onClose={() => setResetAllDataModal(false)}
        title="Reset All Practice Data"
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setResetAllDataModal(false)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleResetAllData}
            >
              Confirm Reset
            </Button>
          </>
        }
      >
        <p className="text-xs text-slate-600 leading-relaxed">
          Are you sure? This will permanently delete locally stored practice recordings, all session history, and reset your preferences. This action cannot be undone unless you have exported a backup.
        </p>
      </Modal>
    </div>
  );
};
