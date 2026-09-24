/**
 * Audio recording and playback utilities
 */

const PREFERRED_MIME_TYPES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/mp4;codecs=mp4a',
  'audio/ogg;codecs=opus',
  'audio/aac',
  'audio/wav'
];

/**
 * Detect the best audio mime type supported by this browser.
 * Never hardcodes a single mime type. Uses MediaRecorder.isTypeSupported().
 */
export function getSupportedMimeType(): string {
  if (
    typeof window === 'undefined' ||
    typeof MediaRecorder === 'undefined' ||
    typeof MediaRecorder.isTypeSupported !== 'function'
  ) {
    return '';
  }

  for (const type of PREFERRED_MIME_TYPES) {
    try {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    } catch {
      // In some older engines, isTypeSupported might throw for uncommon types
      continue;
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
export async function blobToBase64(blob: unknown): Promise<string> {
  if (!blob) return '';
  const b = blob as {
    type?: string;
    arrayBuffer?: () => Promise<ArrayBuffer>;
    _buffer?: Uint8Array;
    parts?: unknown[];
  };
  const mimeType = b.type || 'audio/webm';

  // 1. Try FileReader if blob is an actual instance recognized by the environment
  if (typeof FileReader !== 'undefined') {
    try {
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          if (typeof reader.result === 'string') {
            resolve(reader.result);
          } else {
            reject(new Error('Failed to convert Blob to Base64'));
          }
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob as Blob);
      });
    } catch {
      // FileReader rejected non-standard blob clone; continue to byte fallback
    }
  }

  // 2. Fallback: Extract bytes via arrayBuffer or Buffer
  try {
    let bytes: Uint8Array | null = null;
    if (typeof b.arrayBuffer === 'function') {
      const ab = await b.arrayBuffer();
      bytes = new Uint8Array(ab);
    } else if (b._buffer && b._buffer instanceof Uint8Array) {
      bytes = b._buffer;
    } else if (b.parts && Array.isArray(b.parts)) {
      const parts = b.parts as (Uint8Array | ArrayBuffer)[];
      const totalLen = parts.reduce((acc: number, p) => acc + (p.byteLength || 0), 0);
      bytes = new Uint8Array(totalLen);
      let offset = 0;
      for (const part of parts) {
        const u8 = part instanceof Uint8Array ? part : new Uint8Array(part);
        bytes.set(u8, offset);
        offset += u8.length;
      }
    }

    if (bytes) {
      if (typeof Buffer !== 'undefined') {
        const base64Str = Buffer.from(bytes).toString('base64');
        return `data:${mimeType};base64,${base64Str}`;
      } else {
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        return `data:${mimeType};base64,${btoa(binary)}`;
      }
    }
  } catch (err) {
    console.warn('blobToBase64 fallback error:', err);
  }

  return `data:${mimeType};base64,`;
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
