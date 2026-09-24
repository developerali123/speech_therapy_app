# Speech Practice Assistant

A mobile-first, 100% frontend-only Progressive Web Application (PWA) designed to help individuals practice speech-therapy exercises at home and track their progress with their speech-language pathologist.

The initial target exercise is:
# **کا** (Qaf — Ka Practice)

---

## Important Clinical & Medical Limitation Notice

> **"This application supports speech practice and progress tracking. It does not diagnose speech disorders, determine tongue position, or replace guidance from a qualified speech therapist."**

* The application does **NOT** claim to diagnose speech disorders.
* The application does **NOT** claim that microphone audio can directly determine tongue position or physical contact dynamics.
* The speech therapist remains the sole authority for clinical and pronunciation assessment.
* In this application, correctness results (**CORRECT**, **INCORRECT**, **UNCERTAIN**) are solely entered manually through the **Manual Therapist Review** interface.

---

## 100% Frontend-Only Architecture

* **Zero Backend**: No Node.js, Express, NestJS, Python, REST API, GraphQL, Prisma, or cloud databases.
* **On-Device Storage**:
  * **IndexedDB** (`speech-practice-assistant`) is used for audio recordings (stored safely as Blobs), practice sessions, target exercises, and therapist reviews.
  * **localStorage** is used exclusively for lightweight settings caching.
* **Static Deployment**: Can be hosted on Vercel, Netlify, GitHub Pages, or any static file server / CDN.

---

## Key Features

1. **Focused Practice Interface**:
   - Clean, distraction-free interface built specifically for mobile screens.
   - Large prominent target display: **کا** rendered in high-legibility Arabic typography.
   - Step-by-step guidance: "Say the target sound as instructed by your speech therapist."
2. **Reliable Cross-Browser Audio Recording**:
   - Built on native browser `MediaRecorder` API.
   - Dynamic MIME type resolution via `MediaRecorder.isTypeSupported()` (WebM/Opus, MP4, AAC, OGG).
   - Large touch-friendly microphone button with live elapsed recording timer and animated visual feedback.
   - Friendly permission handling (guidance for permission denials, missing inputs, and busy devices).
3. **Safe Audio Playback**:
   - Custom `AudioPlayer` component with play, pause, replay, and scrubbing.
   - Safe object URL lifecycle management with automatic `URL.revokeObjectURL()` cleanup.
4. **Structured Practice Sessions**:
   - Session goal default of 10 attempts (configurable to 5, 10, 15, 20, 25).
   - Visual attempt indicator (`● ● ● ○ ○ ○ ○ ○ ○ ○`).
   - Ability to re-record or save each attempt directly to local storage.
   - Session completion summary showing total attempts, session duration, and review status.
5. **Manual Therapist Review (MVP)**:
   - Dedicated local clinical review interface on each recording.
   - Clinician marks: **CORRECT**, **INCORRECT**, or **UNCERTAIN**.
   - Input field for clinician remarks and home drill tips.
   - Updates persist reliably across page refreshes in IndexedDB.
6. **Progress & Analytics**:
   - **Weekly Practice Chart** powered by Recharts showing daily attempts and therapist-confirmed correctness rate.
   - Daily practice goal tracker with real-time progress bar.
   - Habit streak tracking (Current streak & Best streak).
   - Status cards: Total Attempts, Reviewed Attempts, Correct, Incorrect, Uncertain, and Pending Review.
7. **Data Backup & Restore**:
   - **Export Practice Data**: Creates a versioned `.json` file containing all exercises, sessions, therapist evaluations, and Base64-encoded audio recordings.
   - **Import Practice Data**: Restores sessions and recordings from a backup file with full schema validation and Blob reconstruction.
   - Permanent data deletion and reset options with confirmation modals.
8. **PWA & Offline First**:
   - Installable experience with web app manifest and icons.
   - Service worker precaching of static assets.
   - Recording, playback, and review work 100% offline.

---

## Technology Stack

* **Framework**: React 19 (Functional components, hooks, strict TypeScript)
* **Build Tool**: Vite 8
* **Styling**: Tailwind CSS v4
* **Routing**: React Router v7
* **Charts**: Recharts
* **Storage**: Native IndexedDB (`idb` abstraction pattern)
* **PWA**: `vite-plugin-pwa` (Workbox)
* **Icons**: `lucide-react`
* **Testing**: Vitest, `@testing-library/react`, `fake-indexeddb`, `jsdom`

---

## Project Structure

```text
speech_therapy_app/
├── public/
│   ├── favicon.svg
│   ├── pwa-192x192.png
│   └── pwa-512x512.png
├── src/
│   ├── components/
│   │   ├── ui/               # Button, Card, Modal, ProgressBar
│   │   ├── layout/           # AppLayout, MobileNavigation, DesktopSidebar
│   │   ├── audio/            # SpeechRecorder, AudioPlayer, RecordingTimer
│   │   ├── practice/         # ExerciseCard, PracticeSession, PracticeAttempt
│   │   ├── progress/         # ProgressSummary, PracticeChart
│   │   └── therapist/        # ManualReview
│   ├── pages/
│   │   ├── HomePage.tsx
│   │   ├── PracticePage.tsx
│   │   ├── HistoryPage.tsx
│   │   ├── SessionDetailsPage.tsx
│   │   ├── ProgressPage.tsx
│   │   ├── SettingsPage.tsx
│   │   └── PrivacyPage.tsx
│   ├── hooks/
│   │   ├── useRecorder.ts
│   │   ├── usePracticeSession.ts
│   │   ├── useRecordings.ts
│   │   ├── useExercises.ts
│   │   └── useSettings.ts
│   ├── storage/
│   │   ├── indexedDb.ts
│   │   ├── exerciseRepository.ts
│   │   ├── sessionRepository.ts
│   │   ├── recordingRepository.ts
│   │   └── settingsRepository.ts
│   ├── services/
│   │   └── speechAnalysisService.ts   # Future AI architecture placeholder
│   ├── types/
│   │   └── index.ts
│   ├── utils/
│   │   ├── audio.ts
│   │   ├── dates.ts
│   │   ├── statistics.ts
│   │   ├── export.ts
│   │   └── import.ts
│   ├── data/
│   │   └── initialExercises.ts
│   ├── App.tsx
│   ├── main.tsx
│   ├── index.css
│   └── setupTests.ts
├── tests/
│   ├── repositories.test.ts
│   ├── statistics.test.ts
│   ├── exportImport.test.ts
│   ├── components.test.tsx
│   └── recorder.test.ts
├── vite.config.ts
├── vitest.config.ts
├── tsconfig.json
└── package.json
```

---

## Local Development

### 1. Prerequisites
* Node.js v18 or later (tested on Node v22)
* npm v9 or later

### 2. Install Dependencies
```bash
npm install
```

### 3. Run Development Server
```bash
npm run dev
```
Open `http://localhost:3000` in your web browser.

### 4. Run Unit Tests
```bash
npm test
```
Executes all 20 Vitest unit test suites covering IndexedDB repositories, statistics, streaks, export/import, microphone state handling, and React components.

### 5. Build for Production
```bash
npm run build
```
Generates a minified, production-ready static bundle inside the `dist/` directory.

---

## Static Deployment Guide

Because the application contains **zero backend code**, it can be deployed to any static host:

### 1. Vercel (Recommended)
1. Push your repository to GitHub.
2. Go to [vercel.com](https://vercel.com) and click **"Add New Project"**.
3. Import the repository.
4. Set Build Command: `npm run build`
5. Set Output Directory: `dist`
6. Click **Deploy**.

For single-page application (SPA) routing, create a `vercel.json` in the root:
```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

### 2. Netlify
1. Connect your repository in [netlify.com](https://netlify.com).
2. Set Build Command: `npm run build`
3. Set Publish Directory: `dist`
4. Add a `_redirects` file in `public/`:
   ```text
   /*    /index.html   200
   ```

### 3. GitHub Pages
1. Install `gh-pages`: `npm install -D gh-pages`
2. Add `"deploy": "gh-pages -d dist"` to `package.json`.
3. Run `npm run build && npm run deploy`.

---

## Future AI Architecture

In accordance with product specifications:
* Automated AI classification is **intentionally not activated** at this stage.
* The file [`src/services/speechAnalysisService.ts`](file:///d:/speech_therapy_app/src/services/speechAnalysisService.ts) defines the placeholder contract:
  ```ts
  export interface SpeechAnalysisResult {
    prediction: 'LIKELY_CORRECT' | 'UNCERTAIN' | 'LIKELY_INCORRECT';
    confidence: number;
    modelVersion: string;
  }
  ```
* Calling `analyzeRecording()` throws an explicit `"Speech analysis is not implemented."` error. No synthetic or deceptive confidence numbers are presented to the patient.
* Audio recordings, target text, and manual therapist ratings can serve as a ground-truth dataset for future model fine-tuning.

---

## License

MIT License. Designed and engineered for speech-therapy practice and clinical review.
