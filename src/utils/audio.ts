/**
 * Audio recording and playback utilities
 */

const PREFERRED_MIME_TYPES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/ogg;codecs=opus',
  'audio/aac',
  'audio/wav'
];

/**
 * Detect the best audio mime type supported by this browser.
 * Never hardcodes a single mime type.
 */
export function getSupportedMimeType(): string {
  if (typeof window === 'undefined' || typeof MediaRecorder === 'undefined') {
    return 'audio/webm';
  }

  for (const type of PREFERRED_MIME_TYPES) {
    if (MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }

  return '';
}

/**
 * Format duration in seconds to "0.82 sec" or "00:03"
 */
export function formatDurationSeconds(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '0.00 sec';
  return `${seconds.toFixed(2)} sec`;
}

export function formatTimeCode(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = Math.floor(totalSeconds % 60);
  const paddedMins = mins.toString().padStart(2, '0');
  const paddedSecs = secs.toString().padStart(2, '0');
  return `${paddedMins}:${paddedSecs}`;
}

/**
 * Convert a Blob to a Base64 data URL string
 */
export async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to convert Blob to Base64 string'));
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/**
 * Convert a Base64 data URL string back to a Blob
 */
export async function base64ToBlob(base64Data: string, defaultMime = 'audio/webm'): Promise<Blob> {
  // If it's a data URL (e.g. data:audio/webm;base64,....)
  if (base64Data.startsWith('data:')) {
    const response = await fetch(base64Data);
    return await response.blob();
  }

  // Raw base64 string
  const byteCharacters = atob(base64Data);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: defaultMime });
}
