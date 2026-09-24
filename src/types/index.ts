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
export type PronunciationVerdict = 'CORRECT' | 'INCORRECT' | 'UNCERTAIN';

export interface AudioFeatures {
  speechDuration: number;
  rmsEnergy: number;
  zeroCrossingRate: number;
  spectralCentroid: number;
  spectralRolloff: number;
  bandEnergies: [number, number, number, number]; // [Low (100-600Hz), Mid (600-1800Hz), Mid-High (1800-3500Hz), High (3500-8000Hz)]
  transientRatio: number;
}

export interface PronunciationResult {
  result: PronunciationVerdict;
  similarity: number; // 0.0 to 1.0
  reason: string;
  details?: {
    correctSimilarity: number;
    incorrectSimilarity: number;
    speechDuration: number;
    speechEnergy: number;
    zeroCrossingRate: number;
    spectralCentroid: number;
  };
}

export interface CalibrationExample {
  id: string;
  exerciseId: string;
  label: 'CORRECT' | 'INCORRECT';
  blob: Blob;
  duration: number;
  mimeType: string;
  createdAt: string;
  note?: string;
  features?: AudioFeatures;
}

export interface CalibrationSettings {
  similarityThreshold: number; // e.g. 0.65
  marginVsIncorrect: number;    // e.g. 0.08
  minSpeechEnergy: number;      // e.g. 0.012
  minSpeechDuration: number;    // e.g. 0.15
  maxSpeechDuration: number;    // e.g. 2.5
}

export interface Recording {
  id: string;
  sessionId: string;
  exerciseId: string;
  blob: Blob;
  duration: number; // in seconds
  mimeType: string;
  createdAt: string;
  attemptNumber?: number;
  autoResult?: PronunciationVerdict;
  similarity?: number;
  analysisReason?: string;
  therapistResult?: TherapistResult;
  therapistRemarks?: string;
  therapistReviewedAt?: string;
}

export interface AppSettings {
  dailyGoal: number;
  userName?: string;
  calibration?: CalibrationSettings;
}

export interface ExportRecordingItem {
  id: string;
  sessionId: string;
  exerciseId: string;
  duration: number;
  mimeType: string;
  createdAt: string;
  attemptNumber?: number;
  autoResult?: PronunciationVerdict;
  similarity?: number;
  analysisReason?: string;
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
