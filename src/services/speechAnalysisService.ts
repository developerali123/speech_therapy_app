import { Recording, SpeechAnalysisResult } from '../types';

/**
 * SpeechAnalysisService (Placeholder for Future ML Integration)
 *
 * NOTE: Automated speech analysis is intentionally not implemented.
 * In accordance with speech therapy guidelines:
 * - We do NOT provide automated or simulated clinical predictions.
 * - We do NOT generate synthetic or random confidence scores.
 * - All clinical and pronunciation assessment remains exclusively with
 *   the qualified speech-language pathologist/therapist.
 */
export async function analyzeRecording(
  _recording: Recording
): Promise<SpeechAnalysisResult> {
  // Explicitly throw or return a rejected promise indicating not implemented
  throw new Error('Speech analysis is not implemented.');
}
