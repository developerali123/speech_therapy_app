/**
 * ONNX Model Loader for Browser ML Inference (Phase 14).
 *
 * Responsibilities:
 * - Load ONNX model once
 * - Cache model session
 * - Expose loading state ('IDLE' | 'LOADING' | 'READY' | 'ERROR')
 * - Expose model version ('xlsr-v1.0-linear-onnx')
 * - Prevent duplicate model loading (deduplicates concurrent requests)
 * - Handle model loading failure gracefully
 * - Execution providers: WASM compatibility baseline with optional WebGPU
 * - Measure first model load time
 */

import * as ort from 'onnxruntime-web';

export type ModelLoadingState = 'IDLE' | 'LOADING' | 'READY' | 'ERROR';

export interface ModelLoaderMetrics {
  firstModelLoadTimeMs: number | null;
  lastLoadAttemptTime: string | null;
  executionProvider: string;
}

export const MODEL_CONFIG = {
  defaultModelPath: '/models/pronunciation-model.onnx',
  metadataPath: '/models/model-metadata.json',
  modelVersion: 'xlsr-v1.0-linear-onnx',
  targetPhonemes: ['کا', 'کی', 'کے', 'کو'] as const
} as const;

let cachedSession: ort.InferenceSession | null = null;
let currentLoadingState: ModelLoadingState = 'IDLE';
let activeLoadingPromise: Promise<ort.InferenceSession> | null = null;
let lastErrorMessage: string | null = null;
let firstLoadTimeMs: number | null = null;
let activeExecutionProvider: string = 'wasm';

/**
 * Checks whether WebGPU execution provider is available in the browser runtime.
 * WebGPU is optional and never required.
 */
export function isWebGpuSupported(): boolean {
  if (typeof navigator === 'undefined') return false;
  return 'gpu' in navigator && !!(navigator as unknown as { gpu?: unknown }).gpu;
}

/**
 * Exposes the current loading state of the model.
 */
export function getLoadingState(): ModelLoadingState {
  return currentLoadingState;
}

/**
 * Returns true if the model session is loaded, cached, and ready for inference.
 */
export function isModelReady(): boolean {
  return currentLoadingState === 'READY' && cachedSession !== null;
}

/**
 * Returns the version string of the model.
 */
export function getModelVersion(): string {
  return MODEL_CONFIG.modelVersion;
}

/**
 * Returns the last recorded error message, if any.
 */
export function getModelLoadingError(): string | null {
  return lastErrorMessage;
}

/**
 * Returns performance and provider metrics for the model loader.
 */
export function getModelLoaderMetrics(): ModelLoaderMetrics {
  return {
    firstModelLoadTimeMs: firstLoadTimeMs,
    lastLoadAttemptTime: new Date().toISOString(),
    executionProvider: activeExecutionProvider
  };
}

/**
 * Loads and caches the ONNX pronunciation model session.
 *
 * Guarantees:
 * - Loads once; subsequent calls return the cached session immediately.
 * - Deduplicates concurrent calls via a shared promise.
 * - WASM baseline; attempts WebGPU if supported.
 * - On failure, sets state to ERROR and handles error safely.
 */
export async function getModelSession(
  modelPath: string | ArrayBuffer = MODEL_CONFIG.defaultModelPath
): Promise<ort.InferenceSession> {
  // 1. Return cached session if already loaded
  if (cachedSession !== null) {
    return cachedSession;
  }

  // 2. Prevent duplicate concurrent loading requests
  if (activeLoadingPromise !== null) {
    return activeLoadingPromise;
  }

  currentLoadingState = 'LOADING';
  lastErrorMessage = null;
  const startTime = typeof performance !== 'undefined' ? performance.now() : Date.now();

  activeLoadingPromise = (async () => {
    try {
      // Determine execution providers: WASM baseline, optional WebGPU
      const providers: string[] = isWebGpuSupported() ? ['webgpu', 'wasm'] : ['wasm'];

      const createSessionInstance = (opts: ort.InferenceSession.SessionOptions) => {
        if (typeof modelPath === 'string') {
          return ort.InferenceSession.create(modelPath, opts);
        }
        return ort.InferenceSession.create(new Uint8Array(modelPath), opts);
      };

      let session: ort.InferenceSession;
      try {
        session = await createSessionInstance({
          executionProviders: providers,
          graphOptimizationLevel: 'all'
        });
        activeExecutionProvider = isWebGpuSupported() ? 'webgpu' : 'wasm';
      } catch (providerErr) {
        // Fallback strictly to wasm if webgpu or custom provider rejected
        if (providers.includes('webgpu')) {
          session = await createSessionInstance({
            executionProviders: ['wasm'],
            graphOptimizationLevel: 'all'
          });
          activeExecutionProvider = 'wasm';
        } else {
          throw providerErr;
        }
      }

      cachedSession = session;
      currentLoadingState = 'READY';

      const endTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
      if (firstLoadTimeMs === null) {
        firstLoadTimeMs = Math.round(endTime - startTime);
      }

      return session;
    } catch (err) {
      currentLoadingState = 'ERROR';
      const msg = err instanceof Error ? err.message : String(err);
      lastErrorMessage = msg;
      cachedSession = null;
      throw new Error(`Pronunciation model could not be loaded: ${msg}`);
    } finally {
      activeLoadingPromise = null;
    }
  })();

  return activeLoadingPromise;
}

/**
 * Resets the cached model session and state (primarily used in tests).
 */
export function resetModelSession(): void {
  cachedSession = null;
  currentLoadingState = 'IDLE';
  activeLoadingPromise = null;
  lastErrorMessage = null;
  activeExecutionProvider = 'wasm';
}

/**
 * Injects a mock session (useful for test environments without WASM binaries).
 */
export function setMockSession(mock: ort.InferenceSession | null): void {
  cachedSession = mock;
  currentLoadingState = mock ? 'READY' : 'IDLE';
  activeLoadingPromise = null;
  lastErrorMessage = null;
}
