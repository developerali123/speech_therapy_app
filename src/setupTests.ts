import '@testing-library/jest-dom';
import 'fake-indexeddb/auto';

// Mock URL.createObjectURL and revokeObjectURL for jsdom environment
if (typeof window !== 'undefined') {
  window.URL.createObjectURL = () => 'blob:http://localhost/mock-audio-blob-stream';
  window.URL.revokeObjectURL = () => {};
}
if (typeof URL !== 'undefined') {
  URL.createObjectURL = () => 'blob:http://localhost/mock-audio-blob-stream';
  URL.revokeObjectURL = () => {};
}
if (typeof globalThis !== 'undefined' && globalThis.URL) {
  globalThis.URL.createObjectURL = () => 'blob:http://localhost/mock-audio-blob-stream';
  globalThis.URL.revokeObjectURL = () => {};
}
