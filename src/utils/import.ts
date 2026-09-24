import { ExportData, Recording, PracticeSession, Exercise, AppSettings } from '../types';
import { base64ToBlob } from './audio';
import { createRecording, deleteAllRecordings } from '../storage/recordingRepository';
import { createSession, deleteAllSessions } from '../storage/sessionRepository';
import { saveExercise, seedExercises } from '../storage/exerciseRepository';
import { saveSettings } from '../storage/settingsRepository';

export interface ImportResult {
  success: boolean;
  sessionsCount: number;
  recordingsCount: number;
  error?: string;
}

/**
 * Validate export data structure
 */
export function validateExportData(data: unknown): data is ExportData {
  if (!data || typeof data !== 'object') {
    return false;
  }

  const candidate = data as Partial<ExportData>;

  if (typeof candidate.version !== 'number' || candidate.version < 1) {
    return false;
  }

  if (!candidate.exportedAt || typeof candidate.exportedAt !== 'string') {
    return false;
  }

  if (!Array.isArray(candidate.sessions) || !Array.isArray(candidate.recordings)) {
    return false;
  }

  // Validate session items
  for (const s of candidate.sessions) {
    if (!s.id || !s.exerciseId || !s.startedAt || !s.status) {
      return false;
    }
  }

  // Validate recording items
  for (const r of candidate.recordings) {
    if (!r.id || !r.sessionId || !r.exerciseId || !r.audioBase64 || typeof r.duration !== 'number') {
      return false;
    }
  }

  return true;
}

/**
 * Restore practice data from parsed JSON
 * @param jsonText string content of imported file
 * @param replaceExisting whether to clear existing data before restore
 */
export async function importPracticeData(jsonText: string, replaceExisting: boolean = true): Promise<ImportResult> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return { success: false, sessionsCount: 0, recordingsCount: 0, error: 'Invalid JSON file format.' };
  }

  if (!validateExportData(parsed)) {
    return {
      success: false,
      sessionsCount: 0,
      recordingsCount: 0,
      error: 'Malformed or incompatible practice backup file.'
    };
  }

  try {
    if (replaceExisting) {
      await deleteAllRecordings();
      await deleteAllSessions();
    }

    // Restore exercises
    if (Array.isArray(parsed.exercises) && parsed.exercises.length > 0) {
      for (const ex of parsed.exercises as Exercise[]) {
        await saveExercise(ex);
      }
    } else {
      await seedExercises();
    }

    // Restore sessions
    for (const session of parsed.sessions as PracticeSession[]) {
      await createSession(session);
    }

    // Restore recordings
    for (const item of parsed.recordings) {
      const blob = await base64ToBlob(item.audioBase64, item.mimeType || 'audio/webm');
      const recording: Recording = {
        id: item.id,
        sessionId: item.sessionId,
        exerciseId: item.exerciseId,
        blob,
        duration: item.duration,
        mimeType: item.mimeType || 'audio/webm',
        createdAt: item.createdAt,
        attemptNumber: item.attemptNumber,
        therapistResult: item.therapistResult,
        therapistRemarks: item.therapistRemarks,
        therapistReviewedAt: item.therapistReviewedAt
      };
      await createRecording(recording);
    }

    // Restore settings
    if (parsed.settings && typeof parsed.settings === 'object') {
      await saveSettings(parsed.settings as AppSettings);
    }

    return {
      success: true,
      sessionsCount: parsed.sessions.length,
      recordingsCount: parsed.recordings.length
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error during import restore.';
    return {
      success: false,
      sessionsCount: 0,
      recordingsCount: 0,
      error: message
    };
  }
}
