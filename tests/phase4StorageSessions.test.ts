import { describe, it, expect, beforeEach } from 'vitest';
import {
  openAppDatabase,
  closeDatabase,
  deleteEntireDatabase
} from '../src/storage/indexedDb';
import {
  createSession,
  getSession,
  getAllSessions,
  updateSession,
  getLatestInProgressSession,
  deleteAllSessions
} from '../src/storage/sessionRepository';
import {
  createRecording,
  getRecording,
  getRecordingsBySession,
  deleteAllRecordings
} from '../src/storage/recordingRepository';
import { PracticeSession, Recording } from '../src/types';

describe('Phase 4: Local Recording Storage & Practice Sessions Lifecycle', () => {
  beforeEach(async () => {
    await deleteAllRecordings();
    await deleteAllSessions();
  });

  it('executes full 11-step persistence, refresh, separation, and multi-session verification', async () => {
    // ----------------------------------------------------
    // STEP 1 & 2: Start session, Record "کا" and Save to IndexedDB
    // ----------------------------------------------------
    const session1Id = `sess-qaf-${Date.now()}`;
    const session1: PracticeSession = {
      id: session1Id,
      exerciseId: 'ex-qaf-ka-01',
      startedAt: new Date(Date.now() - 120000).toISOString(), // 2 mins ago
      status: 'IN_PROGRESS',
      attemptCount: 1,
      targetAttempts: 10
    };
    await createSession(session1);

    const audioBlob1 = new Blob(['sample-audio-stream-ka-1'], { type: 'audio/webm' });
    const recording1: Recording = {
      id: `rec-${session1Id}-1`,
      sessionId: session1Id,
      exerciseId: 'ex-qaf-ka-01',
      blob: audioBlob1,
      duration: 0.82,
      mimeType: 'audio/webm',
      createdAt: new Date().toISOString(),
      attemptNumber: 1
    };
    await createRecording(recording1);

    // Verify saved locally in IndexedDB
    const savedRec1 = await getRecording(recording1.id);
    expect(savedRec1).toBeDefined();
    expect(savedRec1?.duration).toBe(0.82);
    expect(savedRec1?.blob).toBeDefined();
    expect(savedRec1?.mimeType).toBe('audio/webm');
    expect(savedRec1?.attemptNumber).toBe(1);

    // ----------------------------------------------------
    // STEP 3 & 4: Simulate Page Refresh (Recording still exists)
    // ----------------------------------------------------
    // After page refresh, repositories query the DB afresh
    const refreshedSession = await getSession(session1Id);
    expect(refreshedSession).toBeDefined();
    expect(refreshedSession?.id).toBe(session1Id);
    expect(refreshedSession?.attemptCount).toBe(1);

    const refreshedRecs = await getRecordingsBySession(session1Id);
    expect(refreshedRecs.length).toBe(1);
    expect(refreshedRecs[0].id).toBe(recording1.id);
    expect(refreshedRecs[0].duration).toBe(0.82);
    expect(refreshedRecs[0].blob).toBeDefined();

    // In-progress session detection on refresh
    const inProgressOnRefresh = await getLatestInProgressSession('ex-qaf-ka-01');
    expect(inProgressOnRefresh?.id).toBe(session1Id);

    // ----------------------------------------------------
    // STEP 5, 6 & 7: Simulate Closing Browser & Reopening (Persistent Storage)
    // ----------------------------------------------------
    closeDatabase();
    // Reopen database connection
    const db = await openAppDatabase();
    expect(db).toBeDefined();

    const reopenedSession = await getSession(session1Id);
    expect(reopenedSession).toBeDefined();
    expect(reopenedSession?.status).toBe('IN_PROGRESS');

    const reopenedRecs = await getRecordingsBySession(session1Id);
    expect(reopenedRecs.length).toBe(1);
    expect(reopenedRecs[0].id).toBe(recording1.id);
    expect(reopenedRecs[0].blob).toBeDefined();

    // ----------------------------------------------------
    // STEP 8: Finish Session 1 & Start Another Session (Session 2)
    // ----------------------------------------------------
    // Mark Session 1 as completed (or finish early)
    await updateSession({
      ...session1,
      status: 'COMPLETED',
      completedAt: new Date().toISOString()
    });

    const session2Id = `sess-qaf-${Date.now() + 1000}`;
    const session2: PracticeSession = {
      id: session2Id,
      exerciseId: 'ex-qaf-ka-01',
      startedAt: new Date().toISOString(),
      status: 'IN_PROGRESS',
      attemptCount: 0,
      targetAttempts: 10
    };
    await createSession(session2);

    // ----------------------------------------------------
    // STEP 9: Create Multiple Recordings in Session 2
    // ----------------------------------------------------
    const audioBlob2A = new Blob(['sample-audio-ka-session2-take1'], { type: 'audio/webm' });
    const recording2A: Recording = {
      id: `rec-${session2Id}-1`,
      sessionId: session2Id,
      exerciseId: 'ex-qaf-ka-01',
      blob: audioBlob2A,
      duration: 0.95,
      mimeType: 'audio/webm',
      createdAt: new Date().toISOString(),
      attemptNumber: 1
    };
    await createRecording(recording2A);

    const audioBlob2B = new Blob(['sample-audio-ka-session2-take2'], { type: 'audio/webm' });
    const recording2B: Recording = {
      id: `rec-${session2Id}-2`,
      sessionId: session2Id,
      exerciseId: 'ex-qaf-ka-01',
      blob: audioBlob2B,
      duration: 1.12,
      mimeType: 'audio/webm',
      createdAt: new Date().toISOString(),
      attemptNumber: 2
    };
    await createRecording(recording2B);

    await updateSession({
      ...session2,
      attemptCount: 2,
      status: 'COMPLETED',
      completedAt: new Date().toISOString()
    });

    // ----------------------------------------------------
    // STEP 10: Verify Sessions Are Separated
    // ----------------------------------------------------
    const allSessions = await getAllSessions();
    expect(allSessions.length).toBe(2);
    expect(allSessions.some(s => s.id === session1Id)).toBe(true);
    expect(allSessions.some(s => s.id === session2Id)).toBe(true);

    // ----------------------------------------------------
    // STEP 11: Verify Recordings Belong to the Correct Session
    // ----------------------------------------------------
    const session1Recordings = await getRecordingsBySession(session1Id);
    const session2Recordings = await getRecordingsBySession(session2Id);

    // Session 1 has exactly 1 recording
    expect(session1Recordings.length).toBe(1);
    expect(session1Recordings[0].id).toBe(recording1.id);
    expect(session1Recordings[0].sessionId).toBe(session1Id);
    expect(session1Recordings[0].duration).toBe(0.82);

    // Session 2 has exactly 2 recordings
    expect(session2Recordings.length).toBe(2);
    expect(session2Recordings[0].id).toBe(recording2A.id);
    expect(session2Recordings[0].sessionId).toBe(session2Id);
    expect(session2Recordings[1].id).toBe(recording2B.id);
    expect(session2Recordings[1].sessionId).toBe(session2Id);

    // Zero cross-contamination between sessions
    expect(session1Recordings.some(r => r.sessionId === session2Id)).toBe(false);
    expect(session2Recordings.some(r => r.sessionId === session1Id)).toBe(false);
  });
});
