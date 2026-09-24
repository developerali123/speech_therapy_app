export interface Exercise {
  id: string;
  name: string;
  targetText: string;
  description: string;
  isActive: boolean;
  createdAt: string;
  phonemeTarget?: string;
  tips?: string[];
}

export type SessionStatus = 'IN_PROGRESS' | 'COMPLETED' | 'ABANDONED';

export interface PracticeSession {
  id: string;
  exerciseId: string;
  startedAt: string;
  completedAt?: string;
  status: SessionStatus;
  attemptCount: number;
  targetAttempts?: number;
}

export type TherapistResult = 'CORRECT' | 'INCORRECT' | 'UNCERTAIN';

export interface Recording {
  id: string;
  sessionId: string;
  exerciseId: string;
  blob: Blob;
  duration: number; // in seconds
  mimeType: string;
  createdAt: string;
  attemptNumber?: number;
  therapistResult?: TherapistResult;
  therapistRemarks?: string;
  therapistReviewedAt?: string;
}

export interface AppSettings {
  dailyGoal: number;
  userName?: string;
}

export interface ExportRecordingItem {
  id: string;
  sessionId: string;
  exerciseId: string;
  duration: number;
  mimeType: string;
  createdAt: string;
  attemptNumber?: number;
  therapistResult?: TherapistResult;
  therapistRemarks?: string;
  therapistReviewedAt?: string;
  audioBase64: string;
}

export interface ExportData {
  version: number;
  exportedAt: string;
  exercises: Exercise[];
  sessions: PracticeSession[];
  recordings: ExportRecordingItem[];
  settings: AppSettings;
}

export interface SpeechAnalysisResult {
  prediction: 'LIKELY_CORRECT' | 'UNCERTAIN' | 'LIKELY_INCORRECT';
  confidence: number;
  modelVersion: string;
}

export interface SessionWithStats extends PracticeSession {
  exercise?: Exercise;
  recordings?: Recording[];
  correctCount: number;
  incorrectCount: number;
  uncertainCount: number;
  pendingCount: number;
  reviewedCount: number;
}

export interface DailyPracticeStats {
  date: string;
  attempts: number;
  reviewedAttempts: number;
  correctCount: number;
  incorrectCount: number;
  uncertainCount: number;
  correctPercentage: number;
}
