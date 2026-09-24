import { getAllSessions } from '../storage/sessionRepository';
import { getAllRecordings } from '../storage/recordingRepository';
import { getExercises } from '../storage/exerciseRepository';
import { getSettings } from '../storage/settingsRepository';
import { blobToBase64 } from './audio';
import { ExportData, ExportRecordingItem } from '../types';

/**
 * Generate full versioned JSON export with Base64 audio blobs
 */
export async function generateExportData(): Promise<ExportData> {
  const [exercises, sessions, recordings, settings] = await Promise.all([
    getExercises(),
    getAllSessions(),
    getAllRecordings(),
    getSettings()
  ]);

  // Convert audio Blobs to Base64 data URLs
  const exportRecordings: ExportRecordingItem[] = await Promise.all(
    recordings.map(async (rec) => {
      const audioBase64 = await blobToBase64(rec.blob);
      return {
        id: rec.id,
        sessionId: rec.sessionId,
        exerciseId: rec.exerciseId,
        duration: rec.duration,
        mimeType: rec.mimeType,
        createdAt: rec.createdAt,
        attemptNumber: rec.attemptNumber,
        therapistResult: rec.therapistResult,
        therapistRemarks: rec.therapistRemarks,
        therapistReviewedAt: rec.therapistReviewedAt,
        audioBase64
      };
    })
  );

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    exercises,
    sessions,
    recordings: exportRecordings,
    settings
  };
}

/**
 * Triggers a download of the export file in the browser
 */
export async function downloadPracticeBackup(): Promise<void> {
  const data = await generateExportData();
  const jsonString = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const link = document.createElement('a');
  link.href = url;
  link.download = `speech-practice-backup-${timestamp}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
