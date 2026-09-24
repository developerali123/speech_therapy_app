import { describe, it, expect, beforeEach } from 'vitest';
import { validateExportData, importPracticeData } from '../src/utils/import';
import { getAllRecordings, deleteAllRecordings } from '../src/storage/recordingRepository';
import { getAllSessions, deleteAllSessions } from '../src/storage/sessionRepository';

describe('Export and Import Backup System', () => {
  beforeEach(async () => {
    await deleteAllRecordings();
    await deleteAllSessions();
  });

  it('validates export backup schema correctly', () => {
    const validData = {
      version: 1,
      exportedAt: new Date().toISOString(),
      exercises: [],
      sessions: [
        {
          id: 's1',
          exerciseId: 'ex1',
          startedAt: new Date().toISOString(),
          status: 'COMPLETED',
          attemptCount: 10
        }
      ],
      recordings: [
        {
          id: 'r1',
          sessionId: 's1',
          exerciseId: 'ex1',
          duration: 0.8,
          mimeType: 'audio/webm',
          createdAt: new Date().toISOString(),
          audioBase64: 'data:audio/webm;base64,GkXfo59ChoEBQveBAULygQRC84EIQoKEd2VibUKHgQJChYECGFOAZwEAAAAAAA'
        }
      ],
      settings: { dailyGoal: 10 }
    };

    expect(validateExportData(validData)).toBe(true);

    // Invalid missing version
    expect(validateExportData({ ...validData, version: undefined })).toBe(false);

    // Invalid malformed recordings
    expect(validateExportData({ ...validData, recordings: 'not an array' })).toBe(false);

    // Null or non-object
    expect(validateExportData(null)).toBe(false);
  });

  it('imports valid backup and restores sessions and recordings into IndexedDB', async () => {
    const backupJson = JSON.stringify({
      version: 1,
      exportedAt: new Date().toISOString(),
      exercises: [],
      sessions: [
        {
          id: 's-import-1',
          exerciseId: 'ex-qaf-ka-01',
          startedAt: new Date().toISOString(),
          status: 'COMPLETED',
          attemptCount: 1
        }
      ],
      recordings: [
        {
          id: 'r-import-1',
          sessionId: 's-import-1',
          exerciseId: 'ex-qaf-ka-01',
          duration: 0.77,
          mimeType: 'audio/webm',
          createdAt: new Date().toISOString(),
          attemptNumber: 1,
          therapistResult: 'CORRECT',
          therapistRemarks: 'Verified in clinic',
          audioBase64: 'data:audio/webm;base64,GkXfo59ChoEBQveBAULygQRC84EIQoKEd2VibUKHgQJChYECGFOAZwEAAAAAAA'
        }
      ],
      settings: { dailyGoal: 15, userName: 'Tariq' }
    });

    const result = await importPracticeData(backupJson, true);
    expect(result.success).toBe(true);
    expect(result.sessionsCount).toBe(1);
    expect(result.recordingsCount).toBe(1);

    // Verify database contents
    const sessions = await getAllSessions();
    expect(sessions.length).toBe(1);
    expect(sessions[0].id).toBe('s-import-1');

    const recordings = await getAllRecordings();
    expect(recordings.length).toBe(1);
    expect(recordings[0].id).toBe('r-import-1');
    expect(recordings[0].therapistResult).toBe('CORRECT');
    expect(recordings[0].blob).toBeDefined();
    expect(recordings[0].blob.size).toBe(46);
    expect(recordings[0].blob.type).toBe('audio/webm');
  });

  it('rejects malformed JSON gracefully', async () => {
    const result = await importPracticeData('{ broken json ...', true);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid JSON');
  });
});
