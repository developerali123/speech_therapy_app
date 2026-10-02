export type ExerciseDifficulty = 'single' | 'sequence';

export interface Exercise {
  id: string;
  name: string;
  targetText: string;
  targetUnits: string[];
  description: string;
  isActive: boolean;
  createdAt: string;
  difficulty?: ExerciseDifficulty;
  repetitions?: number;
  phonemeTarget?: string;
  tips?: string[];
}

export type SpeechExercise = Exercise;

export type SessionStatus = 'IN_PROGRESS' | 'COMPLETED' | 'ABANDONED';

export interface PracticeSession {
  id: string;
  exerciseId: string;
  startedAt: string;
  completedAt?: string;
  status: SessionStatus;
  attemptCount: number;
  targetAttempts?: number;
  targetUnits?: string[];
  totalTargetUnits?: number;
  currentUnitIndex?: number;
  currentRepetition?: number;
  targetRepetitions?: number;
  completedRepetitions?: number;
}

export type TherapistResult = 'CORRECT' | 'INCORRECT' | 'UNCERTAIN';
export type PronunciationVerdict = 'CORRECT' | 'INCORRECT' | 'NEEDS_PRACTICE' | 'UNCERTAIN';

export type AssessmentMethod = 'ML' | 'DSP' | 'NONE';

export interface UnitAssessment {
  unit: string;
  score: number;
  result: 'CORRECT' | 'NEEDS_PRACTICE' | 'UNCERTAIN';
}

export type MLAssessmentResult = 'CORRECT' | 'NEEDS_PRACTICE' | 'UNCERTAIN';

export interface MLPronunciationResponse {
  exerciseId: string;
  targetText: string;
  result: MLAssessmentResult;
  confidence: number;
  pronunciationScore: number;
  modelVersion: string;
  unitResults: UnitAssessment[];
  reason?: string;
  isServiceUnavailable?: boolean;
}

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
  // Phase 10: ML Assessment metadata
  assessmentMethod?: AssessmentMethod;
  modelVersion?: string;
  pronunciationScore?: number;
  confidence?: number;
  unitResults?: UnitAssessment[];
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

export type TrainingExclusionReason =
  | 'background noise'
  | 'cough'
  | 'interruption'
  | 'microphone problem'
  | 'wrong exercise'
  | 'accidental recording'
  | 'poor audio'
  | 'other';

export interface AudioQualityInfo {
  duration: number;
  mimeType: string;
  sampleRate?: number;
  channelCount?: number;
  silencePercentage?: number;
  decodingStatus: 'VALID' | 'CORRUPTED' | 'PENDING';
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
  // Phase 9: ML Training Dataset Curation
  excludedFromTraining?: boolean;
  trainingExclusionReason?: TrainingExclusionReason;
  audioQuality?: AudioQualityInfo;
  // Phase 10: ML Pronunciation Integration
  assessmentMethod?: AssessmentMethod;
  modelVersion?: string;
  pronunciationScore?: number;
  confidence?: number;
  unitResults?: UnitAssessment[];
}

export interface TrainingExample {
  id: string;
  recordingId: string;
  exerciseId: string;
  targetUnits: string[];
  targetText: string;
  therapistLabel: TherapistResult;
  therapistRemarks?: string;
  createdAt: string;
  therapistReviewedAt?: string;
  datasetVersion: number;
  includedInTraining: boolean;
  excludedReason?: TrainingExclusionReason;
  audioQuality?: AudioQualityInfo;
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

export interface TrainingTargetStats {
  targetKey: string;
  targetText: string;
  name: string;
  difficulty: 'single' | 'sequence';
  targetUnits: string[];
  totalExamples: number;
  correctCount: number;
  incorrectCount: number;
  uncertainCount: number;
  unreviewedCount: number;
  includedCount: number;
  excludedCount: number;
}

export interface DatasetStatistics {
  totalRecordings: number;
  totalTherapistReviewed: number;
  totalEligible: number;
  totalExcluded: number;
  totalUncertain: number;
  totalUnreviewed: number;
  individualTargets: TrainingTargetStats[];
  sequenceTargets: TrainingTargetStats[];
  allTargets: TrainingTargetStats[];
  exclusionBreakdown: Record<TrainingExclusionReason, number>;
}

export interface TrainingDatasetFilters {
  exerciseId?: string;
  targetUnit?: string;
  therapistResult?: string; // 'all' | 'CORRECT' | 'INCORRECT' | 'UNCERTAIN' | 'NONE'
  reviewStatus?: 'all' | 'reviewed' | 'unreviewed';
  trainingStatus?: 'all' | 'included' | 'excluded';
  startDate?: string;
  endDate?: string;
  searchQuery?: string;
}

export interface MLLabelledDatasetExportItem {
  id: string;
  recordingId: string;
  exerciseId: string;
  targetText: string;
  targetUnits: string[];
  therapistLabel: TherapistResult;
  therapistRemarks?: string;
  createdAt: string;
  therapistReviewedAt?: string;
  duration: number;
  mimeType: string;
  includedInTraining: boolean;
  excludedReason?: TrainingExclusionReason;
  audioQuality?: AudioQualityInfo;
  audioBase64?: string;
}

export interface MLLabelledDatasetExport {
  format: 'speech-practice-ml-dataset';
  version: number;
  exportedAt: string;
  datasetName: string;
  totalExamples: number;
  totalIncludedForTraining: number;
  targets: string[];
  metadata: {
    description: string;
    labelSchema: ['CORRECT', 'INCORRECT'];
    noteOnAudioPackaging: string;
    minDurationConfigured: number;
  };
  examples: MLLabelledDatasetExportItem[];
}
