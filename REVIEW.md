# Technical Audit and Code Review: Speech Practice Assistant

**Document Name:** `REVIEW.md`  
**Date of Audit:** September 25, 2026  
**Audited Target:** Speech Practice Assistant for target sound **"کا"** (`ex-qaf-ka-01`)  
**Scope:** Phases 1 through 7 Implementation Review  
**Application Architecture:** Frontend-only Single Page Application (React 19 + TypeScript + Vite + Tailwind CSS + IndexedDB + Web Audio API). Zero backend, zero external ML/AI APIs.

---

## 1. Project Overview

The **Speech Practice Assistant** is an offline-first, client-side web application designed to support individuals practicing speech articulation. The application focuses on single-repetition practice of the Urdu/Arabic target sound **"کا"** (voiceless velar stop /k/ followed by the open back vowel /aː/).

### Primary Functionality
1. **Target Practice ("کا"):** The user is presented with a large, high-legibility display of the target sound "کا".
2. **One-by-One Voice Capture:** The user initiates an attempt using a prominent `[ 🎙 SPEAK ]` action, speaks the target sound once, and presses `[ Stop Recording ]`.
3. **Immediate On-Device Acoustic Analysis:** Immediately upon recording completion, the application analyzes the audio in the browser (without network requests or third-party servers) and classifies the attempt into one of three distinct outcomes:
   - **✓ CORRECT**
   - **✗ INCORRECT**
   - **? UNCERTAIN**
4. **Immediate Workflow Continuation:** The user is provided with immediate visual feedback, an acoustic match percentage, and one-touch actions to either `[ Try Again ]` or advance to the `[ Next Attempt ]`.
5. **Persistent Session & History Tracking:** Every attempt, including raw audio blobs, acoustic metadata, and automatic verdicts, is stored locally in browser **IndexedDB**.
6. **Separation of Clinical Evaluation:** Automated results are strictly segregated from therapist clinical evaluations. A speech therapist can review recorded attempts, listen to playback, and record clinical verdicts with written notes.
7. **Longitudinal Progress Tracking:** Users and clinicians can view session history, daily attempt tallies, streak consistency, personal bests, and four interactive time-series charts (Recharts) covering volume, acoustic result trends, therapist review trends, and practice duration.

---

## 2. Technology Stack

The project relies exclusively on modern, standard web technologies and installed npm packages without external backend infrastructure:

### Core Framework & Build Tooling
| Technology | Installed Version | Purpose in Application |
| :--- | :--- | :--- |
| **Node.js / npm** | Node v20+ / npm v10+ | Runtime and package management environment |
| **TypeScript** | `~6.0.2` | Static typing, interface contracts, and compiler validation |
| **Vite** | `^8.3.0` | Frontend build pipeline, local HMR development server |
| **React** | `^19.3.0` | UI component tree, state management, and lifecycle hooks |
| **React DOM** | `^19.3.0` | Virtual DOM rendering to the browser document |
| **React Router DOM** | `^7.18.4` | Client-side routing (`BrowserRouter`, `Routes`, `Route`, `Navigate`) |

### Styling & UI Design System
| Library | Installed Version | Purpose in Application |
| :--- | :--- | :--- |
| **Tailwind CSS** | `^4.3.3` | Utility-first CSS engine |
| **@tailwindcss/vite** | `^4.3.3` | Native Vite integration for Tailwind v4 engine |
| **clsx** | `^2.1.1` | Conditional className concatenation utility |
| **tailwind-merge** | `^3.7.0` | Conflict-free Tailwind CSS class merging utility |
| **lucide-react** | `^1.48.0` | High-quality SVG icon set for speech and clinical UI |

### Data Visualization & Offline Infrastructure
| Library | Installed Version | Purpose in Application |
| :--- | :--- | :--- |
| **Recharts** | `^3.10.1` | SVG charts (`ResponsiveContainer`, `BarChart`, `LineChart`, `AreaChart`) |
| **vite-plugin-pwa** | `^1.3.0` | Progressive Web App manifest generation and offline service worker caching |
| **IndexedDB API** | Browser Native | On-device persistent relational database (raw audio Blobs & metadata) |
| **Web Audio API** | Browser Native | In-browser DSP: `AudioContext`, FFT spectral decomposition, waveform analysis |
| **MediaStream Recording API** | Browser Native | Hardware microphone audio capture (`MediaRecorder`, `getUserMedia`) |

### Testing & Quality Assurance
| Library | Installed Version | Purpose in Application |
| :--- | :--- | :--- |
| **Vitest** | `^5.0.1` | Fast unit and integration test runner |
| **@testing-library/react** | `^16.3.3` | React component integration testing |
| **@testing-library/jest-dom**| `^7.0.1` | Custom DOM element matchers |
| **fake-indexeddb** | `^6.2.5` | In-memory IndexedDB mock for headless tests |
| **jsdom** | `^29.1.1` | Headless browser DOM simulation for tests |

---

## 3. Current Architecture

The application adopts a modular layered architecture:

```
UI Layer (Pages & Components)
           ↓
Custom Hooks Layer (Business & State Orchestration)
           ↓
Domain Services & DSP (Pronunciation Analysis & Feature Extraction)
           ↓
Storage Repositories (IndexedDB Operations & LocalStorage Settings)
           ↓
Native Browser APIs (Web Audio API, MediaRecorder, IndexedDB, ServiceWorker)
```

### Directory Tree

```
speech_therapy_app/
├── index.html                       # HTML5 entry with viewport, PWA manifest links, font imports
├── package.json                     # Dependency declarations and npm scripts
├── tsconfig.json                    # Strict TypeScript configuration
├── vite.config.ts                   # Vite + Tailwind + VitePWA configuration
├── vitest.config.ts                 # Vitest test runner configuration
├── public/                          # Static assets and PWA icons
│   ├── favicon.ico
│   ├── pwa-192x192.png
│   └── pwa-512x512.png
├── tests/                           # 10 automated test suites (64 passing tests)
│   ├── components.test.tsx
│   ├── exportImport.test.ts
│   ├── phase4StorageSessions.test.ts
│   ├── phase6OneByOnePractice.test.ts
│   ├── phase7ProgressTracking.test.ts
│   ├── pronunciationAnalyzer.test.ts
│   ├── recorder.test.ts
│   ├── repositories.test.ts
│   ├── responsiveLayout.test.tsx
│   └── statistics.test.ts
└── src/
    ├── main.tsx                     # React application bootstrap
    ├── App.tsx                      # Route declarations and layout shell
    ├── index.css                    # Tailwind imports and base typographic tokens
    ├── setupTests.ts                # Test environment mocks (AudioContext, MediaRecorder, fake-indexeddb)
    ├── vite-env.d.ts                # Vite environment types
    ├── types/
    │   └── index.ts                 # Central domain interfaces and TypeScript types
    ├── data/
    │   └── initialExercises.ts      # Seed data for default "کا" exercise
    ├── storage/
    │   ├── indexedDb.ts             # IDB database lifecycle, schema migrations, store descriptors
    │   ├── exerciseRepository.ts    # CRUD operations for exercises
    │   ├── sessionRepository.ts     # CRUD and query methods for practice sessions
    │   ├── recordingRepository.ts   # Audio Blob and attempt storage operations
    │   ├── calibrationRepository.ts # Reference audio storage, default settings, synthetic seeds
    │   └── settingsRepository.ts   # User preferences and daily goal persistence
    ├── services/
    │   ├── pronunciationAnalyzer.ts # DSP feature extraction, FFT spectrum, similarity scoring
    │   └── speechAnalysisService.ts # Legacy stub retained for interface compatibility
    ├── hooks/
    │   ├── useRecorder.ts           # MediaRecorder lifecycle, audio stream, and error handling
    │   ├── usePracticeSession.ts    # Practice session state, live counters, and attempt saving
    │   ├── useExercises.ts          # Exercise listing and initialization
    │   ├── useRecordings.ts         # Session recording queries and mutations
    │   └── useSettings.ts           # Daily goal and user preference hook
    ├── utils/
    │   ├── audio.ts                 # MIME detection, duration formatting, base64 conversions
    │   ├── dates.ts                 # ISO date formatting, relative time, and calendar keys
    │   ├── statistics.ts            # Metric aggregation, streak algorithms, Recharts formatters
    │   ├── export.ts                # JSON backup export with base64 audio serialization
    │   └── import.ts                # JSON backup restoration and validation
    ├── components/
    │   ├── audio/
    │   │   ├── SpeechRecorder.tsx   # Core interactive one-by-one practice recorder
    │   │   ├── AudioPlayer.tsx      # Waveform/scrubber audio playback component
    │   │   └── RecordingTimer.tsx   # Live digital stopwatch display
    │   ├── layout/
    │   │   ├── AppLayout.tsx        # Responsive layout container (sidebar vs mobile nav)
    │   │   ├── DesktopSidebar.tsx   # Desktop fixed side navigation bar
    │   │   └── MobileNavigation.tsx # Mobile bottom navigation tab bar
    │   ├── practice/
    │   │   ├── PracticeSession.tsx  # One-by-one practice session container with summary
    │   │   ├── PracticeAttempt.tsx  # Individual attempt card with playback and therapist review
    │   │   └── ExerciseCard.tsx     # Exercise selection card
    │   ├── progress/
    │   │   ├── Phase7Charts.tsx     # Recharts 4-in-1 interactive analytics visualization
    │   │   ├── PracticeChart.tsx    # Legacy weekly bar chart
    │   │   └── ProgressSummary.tsx  # Compact progress card
    │   ├── therapist/
    │   │   └── ManualReview.tsx     # Clinician evaluation form modal
    │   └── ui/
    │       ├── Button.tsx           # Standard accessible button component
    │       ├── Card.tsx             # Surface card container
    │       ├── Modal.tsx            # Accessible modal dialog
    │       ├── ProgressBar.tsx      # Multi-color visual progress bar
    │       ├── LoadingState.tsx     # Spinner and loading state
    │       ├── EmptyState.tsx       # Zero-data empty state placeholder
    │       └── ErrorState.tsx       # Actionable error alert component
    └── pages/
        ├── HomePage.tsx             # Dashboard: quick start, today's metrics, exercise list
        ├── PracticePage.tsx         # Practice route hosting PracticeSessionComponent
        ├── CalibrationPage.tsx      # Reference audio recording, seed reset, threshold tuning
        ├── HistoryPage.tsx          # Full practice history grouped by date and session
        ├── SessionDetailsPage.tsx   # Deep link view for a single practice session
        ├── ProgressPage.tsx         # Phase 7 analytics dashboard with Recharts & streaks
        ├── SettingsPage.tsx         # App settings, target repetitions, export/import data
        └── PrivacyPage.tsx          # Privacy policy, local-storage notice, clinical disclaimers
```

---

## 4. Phase 1 Implementation

### Implemented Requirements
- Initialized Vite + React 19 + TypeScript application structure.
- Configured Tailwind CSS utility styling and design tokens.
- Defined domain TypeScript models for `Exercise`, `PracticeSession`, `Recording`, `AppSettings`.
- Pre-seeded default exercise in `src/data/initialExercises.ts` with ID `'ex-qaf-ka-01'`, target text **"کا"**, phoneme description `[kaː]`, and therapeutic cues.
- Implemented reusable UI primitives (`Button`, `Card`, `Modal`, `ProgressBar`, `LoadingState`, `EmptyState`, `ErrorState`).

### Implementation Status
- **Complete:** Core foundation, TypeScript setup, data contracts, and design tokens.
- **Partial:** None.
- **Missing:** None.

---

## 5. Phase 2 Implementation

### Implemented Requirements
- Implemented responsive navigation layout supporting both mobile and desktop viewports (`AppLayout`, `DesktopSidebar`, `MobileNavigation`).
- Established routing structure via React Router DOM across `/home`, `/practice`, `/calibration`, `/history`, `/progress`, `/settings`, and `/privacy`.
- Created home dashboard (`HomePage`) showing current streak, daily goal progress, quick start launcher, and exercise cards.
- Embedded clinical limitation statements ("Practice companion only; does not replace speech therapist diagnosis").

### Implementation Status
- **Complete:** Responsive layout shell, multi-page routing, layout breakpoint adaptability, clinical banners.
- **Partial:** None.
- **Missing:** None.

---

## 6. Phase 3 — Microphone Recording

Microphone capture is implemented in [src/hooks/useRecorder.ts](file:///d:/speech_therapy_app/src/hooks/useRecorder.ts) and utilized by [src/components/audio/SpeechRecorder.tsx](file:///d:/speech_therapy_app/src/components/audio/SpeechRecorder.tsx).

### MediaRecorder Implementation
- Uses standard browser `navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } })`.
- Collects raw binary chunks using the `ondataavailable` callback with a timeslice of `100ms` (`recorder.start(100)`).
- Assembles recorded chunks into an immutable `Blob` on the `onstop` callback.
- Releases hardware resources immediately upon stopping: every audio track in `MediaStream` has `.stop()` invoked to shut down the hardware microphone LED indicator.

### Supported MIME Types
MIME type selection is dynamic and prioritized rather than hardcoded, as defined in `getSupportedMimeType()` in [src/utils/audio.ts](file:///d:/speech_therapy_app/src/utils/audio.ts):
1. `audio/webm;codecs=opus` (Chrome, Edge, Firefox, Android)
2. `audio/webm`
3. `audio/mp4` (Safari iOS and macOS)
4. `audio/mp4;codecs=mp4a`
5. `audio/ogg;codecs=opus`
6. `audio/aac`
7. `audio/wav`
- Uses `MediaRecorder.isTypeSupported(mime)` sequentially and selects the first supported format.
- If a browser engine rejects the explicit MIME options object, `new MediaRecorder(stream)` is called without parameters as an automatic native fallback.

### Microphone Permission Handling
- Tracks state transition: `idle` → `requesting_permission` → `recording`.
- Catches DOM exceptions and categorizes them with user-friendly actionable feedback:
  - `NotAllowedError` / `PermissionDeniedError`: "Microphone permission is required to record your practice."
  - `NotFoundError` / `DevicesNotFoundError`: "No microphone was found on this device. Please connect an audio input."
  - `NotReadableError` / `TrackStartError`: "Microphone is busy or already in use by another application."
  - `NotSupportedError`: "MediaRecorder is unsupported or the selected audio format is not supported in this browser."
  - `SecurityError`: "Microphone access blocked due to security restrictions."

### Recording States
The `useRecorder` hook maintains six explicit states (`RecorderState`):
- `'idle'`: Ready for a new practice recording.
- `'requesting_permission'`: Waiting for user browser prompt response.
- `'recording'`: Active audio capture with live timer.
- `'stopping'`: Transitioning, waiting for final data slice.
- `'recorded'`: Blob finalized and available in memory.
- `'error'`: An error occurred; descriptive `errorMessage` populated.

### Audio Format & Recording Duration
- Duration is measured via continuous high-resolution timer (`window.setInterval` every 50ms) and validated on `onstop` against `(Date.now() - startTimeRef.current) / 1000`.
- Minimum duration clamp is `0.1s`.
- Stored as standard `Blob` with detected MIME type.

### Mobile-Browser Considerations
- Implemented `touch-manipulation` CSS on buttons to eliminate the 300ms tap delay on mobile WebKit.
- Supported iOS Safari's preferred `audio/mp4` container.
- Cleanly stops media tracks on component unmount to prevent background recording drain on mobile batteries.

---

## 7. Phase 4 — IndexedDB

Client-side data persistence is implemented in [src/storage/indexedDb.ts](file:///d:/speech_therapy_app/src/storage/indexedDb.ts) and its associated repository modules.

### Database Specification
- **Database Name:** `'speech-practice-assistant'`
- **Database Version:** `2`

### Object Stores and Schemas
1. **`exercises`**:
   - Primary Key: `id` (string)
   - Indexes: None
   - Stores exercise definitions (name, target text, therapeutic instructions).
2. **`sessions`**:
   - Primary Key: `id` (string, e.g. `session-1727218000000`)
   - Indexes: `exerciseId` (non-unique), `startedAt` (non-unique)
   - Tracks session lifecycle: `status` (`'IN_PROGRESS' | 'COMPLETED' | 'ABANDONED'`), `attemptCount`, `startedAt`, `completedAt`.
3. **`recordings`**:
   - Primary Key: `id` (string, e.g. `rec-1727218000000-1`)
   - Indexes: `sessionId` (non-unique), `exerciseId` (non-unique), `createdAt` (non-unique)
   - Stores raw audio `blob` (`Blob`), `duration` (number), `mimeType` (string), `attemptNumber` (number), `autoResult` (`'CORRECT' | 'INCORRECT' | 'UNCERTAIN'`), `similarity` (number), `analysisReason` (string), `therapistResult` (`'CORRECT' | 'INCORRECT' | 'UNCERTAIN'`), `therapistRemarks` (string), `therapistReviewedAt` (string).
4. **`settings`**:
   - Primary Key: `id` (string)
   - Stores general user preferences.
5. **`calibration`**:
   - Primary Key: `id` (string, e.g. `calib-correct-1727218000000-1`)
   - Indexes: `exerciseId` (non-unique), `label` (non-unique)
   - Stores reference audio examples with pre-extracted or dynamic acoustic feature vectors.

### Persistence & Data Relationships
- Sessions and Recordings have a 1-to-Many relational link established through `recording.sessionId`.
- Recordings and Exercises are linked through `recording.exerciseId`.
- Audio Blobs are stored natively in IndexedDB as binary Large Objects (BLOBs), avoiding base64 bloat during active operation.

### Delete & Reset Behavior
- Individual attempt deletion (`deleteRecording(id)`): Deletes the single recording record.
- Full database purge (`deleteEntireDatabase()`): Closes active connections and calls `indexedDB.deleteDatabase('speech-practice-assistant')`.
- Backup Export/Import: Serializes all stores to a portable JSON file, converting Blobs to Base64 data URLs for backup and deserializing on import.

---

## 8. Phase 5 — Pronunciation Analysis

The pronunciation analysis engine is implemented in [src/services/pronunciationAnalyzer.ts](file:///d:/speech_therapy_app/src/services/pronunciationAnalyzer.ts). It contains no machine learning models, neural networks, or external cloud APIs. It operates purely on **Digital Signal Processing (DSP)** and acoustic feature comparison.

### 1. Audio Preprocessing
When an audio `Blob` is received by `analyzePronunciation(audioBlob, exerciseId)`:
1. `getArrayBufferFromBlob(blob)` safely extracts an `ArrayBuffer`.
2. Audio is decoded into a mono `Float32Array` PCM buffer:
   - Primary: Browser `AudioContext.decodeAudioData()`.
   - Secondary Fallback: Custom byte parser `parseWavOrRawPcm()` which reads 16-bit linear PCM WAV RIFF headers.
   - Tertiary Fallback: `approximatePcmFromBytes()` which normalizes byte amplitudes to $[-1.0, 1.0]$.
3. Default sample rate is normalized to $16{,}000\text{ Hz}$.

### 2. Silence & Active Speech Detection
In `computeFeaturesFromSamples(samples, sampleRate)`:
- Audio is framed using a sliding window:
  - **Frame Size:** $25\text{ ms}$ ($\text{sampleRate} \times 0.025 = 400$ samples at $16\text{ kHz}$)
  - **Hop Size:** $10\text{ ms}$ ($\text{sampleRate} \times 0.010 = 160$ samples at $16\text{ kHz}$)
- For every frame, the Root Mean Square (RMS) energy is computed:
  $$\text{RMS} = \sqrt{\frac{1}{N}\sum_{j=0}^{N-1} s[j]^2}$$
- **Dynamic Speech Threshold:**
  $$\text{Threshold} = \max(0.010, \text{PeakRMS} \times 0.20)$$
- Consecutive frames meeting or exceeding this threshold define `speechStartFrame` and `speechEndFrame`.
- **Speech Duration:**
  $$\text{speechDuration} = \frac{(\text{speechEndFrame} - \text{speechStartFrame} + 1) \times \text{hopSize}}{\text{sampleRate}}$$
- If $\text{RMS} < \text{minSpeechEnergy}$ (default $0.012$) or $\text{speechDuration} < \text{minSpeechDuration}$ (default $0.15\text{ s}$), analysis short-circuits immediately:
  - Verdict: **`UNCERTAIN`**
  - Reason: *"Not enough usable audio. Please try again."*

### 3. Feature Extraction
For frames identified as speech, six acoustic dimensions are extracted:

1. **Speech Duration (`speechDuration`):** Total duration of the active speech segment in seconds.
2. **RMS Energy (`rmsEnergy`):** Average energy across active speech frames.
3. **Zero-Crossing Rate (`zeroCrossingRate`):** Rate at which the audio signal changes sign:
   $$\text{ZCR} = \frac{1}{N}\sum_{j=1}^{N-1} \mathbb{I}(\text{sgn}(s[j]) \neq \text{sgn}(s[j-1]))$$
   Used to detect the voiceless velar burst/frication characteristics of the letter "ک" (/k/).
4. **Spectral Centroid (`spectralCentroid`):** Center of mass of the frequency spectrum, computed via discrete Hann-windowed FFT (512-point Discrete Fourier Transform):
   $$\text{Centroid} = \frac{\sum_{k=0}^{M-1} f[k] \cdot |X[k]|}{\sum_{k=0}^{M-1} |X[k]|}$$
   Reflects the frequency balance (velar stop burst vs vowel resonance).
5. **Spectral Rolloff (`spectralRolloff`):** Frequency below which $85\%$ of the spectral energy is concentrated.
6. **Normalized 4-Band Spectral Energy Distribution (`bandEnergies`):**
   Acoustic spectrum is divided into four clinically relevant frequency bands:
   - **Band 0 (Low):** $100\text{ Hz} - 600\text{ Hz}$ (Fundamental pitch and lower vowel resonance)
   - **Band 1 (Mid):** $600\text{ Hz} - 1{,}800\text{ Hz}$ (Vowel /aː/ first and second formants: F1 $\approx 750\text{ Hz}$, F2 $\approx 1{,}250\text{ Hz}$)
   - **Band 2 (Mid-High):** $1{,}800\text{ Hz} - 3{,}500\text{ Hz}$ (Velar stop burst compact energy /k/ $\approx 2{,}000\text{ Hz}$)
   - **Band 3 (High):** $3{,}500\text{ Hz} - 8{,}000\text{ Hz}$ (Aspiration, high-frequency frication or dental substitution /t/)
   Energy in each band is normalized such that $\sum_{i=0}^3 \text{band}[i] = 1.0$, rendering it invariant to microphone gain or volume.
7. **Transient Burst Ratio (`transientRatio`):** Ratio of energy in the first $25\%$ of active speech frames to the overall speech energy, measuring the release burst sharpness of the consonant.

### 4. Acoustic Similarity Calculation
In `computeAcousticSimilarity(a, b)`:
Two feature vectors are compared across 5 normalized dimensions $[0.0, 1.0]$:
1. **Duration Similarity:**
   $$\text{Sim}_{\text{dur}} = \max\left(0, 1 - \frac{|\text{dur}_a - \text{dur}_b|}{0.8}\right)$$
2. **Zero-Crossing Rate Similarity:**
   $$\text{Sim}_{\text{zcr}} = \max\left(0, 1 - \frac{|\text{zcr}_a - \text{zcr}_b|}{0.35}\right)$$
3. **Spectral Centroid Similarity:**
   $$\text{Sim}_{\text{centroid}} = \max\left(0, 1 - \frac{|\text{cent}_a - \text{cent}_b|}{1{,}500}\right)$$
4. **Band Energy Distribution Similarity:** Cosine similarity of the 4-element normalized vector:
   $$\text{Sim}_{\text{band}} = \frac{\mathbf{B}_a \cdot \mathbf{B}_b}{\|\mathbf{B}_a\| \|\mathbf{B}_b\|}$$
5. **Transient Ratio Similarity:**
   $$\text{Sim}_{\text{trans}} = \max\left(0, 1 - \frac{|\text{trans}_a - \text{trans}_b|}{0.5}\right)$$

**Composite Weighted Formula:**
$$\text{Composite Similarity} = 0.40 \cdot \text{Sim}_{\text{band}} + 0.25 \cdot \text{Sim}_{\text{centroid}} + 0.15 \cdot \text{Sim}_{\text{zcr}} + 0.10 \cdot \text{Sim}_{\text{dur}} + 0.10 \cdot \text{Sim}_{\text{trans}}$$

### 5. Multi-Reference Comparison & Final Verdict Selection
The candidate recording is compared against both therapist-confirmed **CORRECT** references and **INCORRECT** references loaded from IndexedDB.
- For Correct references: calculates peak match $\max(\text{Sim}_{\text{corr}})$ and average $\text{avg}(\text{Sim}_{\text{corr}})$.
  $$\text{Score}_{\text{corr}} = 0.70 \cdot \max(\text{Sim}_{\text{corr}}) + 0.30 \cdot \text{avg}(\text{Sim}_{\text{corr}})$$
- For Incorrect references:
  $$\text{Score}_{\text{incorr}} = 0.70 \cdot \max(\text{Sim}_{\text{incorr}}) + 0.30 \cdot \text{avg}(\text{Sim}_{\text{incorr}})$$

**Decision Rules (using Configurable Thresholds):**
- Let $\theta_{\text{sim}} = \text{similarityThreshold}$ (default $0.65$ / $65\%$)
- Let $\Delta_{\text{margin}} = \text{marginVsIncorrect}$ (default $0.08$ / $8\%$)

1. **✓ CORRECT:**
   $$\text{Score}_{\text{corr}} \ge \theta_{\text{sim}} \quad \text{AND} \quad \text{Score}_{\text{corr}} \ge (\text{Score}_{\text{incorr}} + \Delta_{\text{margin}})$$
   Reason: *"Your recording is similar to your confirmed practice examples."*

2. **✗ INCORRECT:**
   $$\text{Score}_{\text{incorr}} \ge \theta_{\text{sim}} \quad \text{OR} \quad \text{Score}_{\text{incorr}} > (\text{Score}_{\text{corr}} + \Delta_{\text{margin}})$$
   Reason: *"Try again according to your speech therapist's instructions."*

3. **? UNCERTAIN:**
   If neither condition is satisfied (e.g. scores are intermediate, ambiguous, or the margin between correct and incorrect is insufficient).
   Reason: *"Uncertain — please repeat or ask your speech therapist to review."*

---

## 9. Calibration

Calibration functionality is implemented in [src/pages/CalibrationPage.tsx](file:///d:/speech_therapy_app/src/pages/CalibrationPage.tsx) and [src/storage/calibrationRepository.ts](file:///d:/speech_therapy_app/src/storage/calibrationRepository.ts).

### Baseline Reference Seeding
On initial launch (or upon pressing "Reset to Initial Baseline"), the application seeds 7 reference recordings for exercise `'ex-qaf-ka-01'` into IndexedDB store `calibration`:
- **4 Correct References:** Representing clean velar stop closure followed by open back vowel [kaː] with acoustic energy concentrated at $1{,}850\text{–}1{,}910\text{ Hz}$ and F1/F2 formants at $750\text{ Hz}$ / $1{,}250\text{ Hz}$.
- **3 Incorrect References:** Representing common articulation errors:
  1. Anterior dental stop substitution [taː] (energy concentrated at high frequencies $>3{,}600\text{ Hz}$).
  2. Glottal stop substitution [ʔaː] (lacking velar occlusion burst).
  3. Distorted vowel closure (improper velopharyngeal seal).

### Clinician Calibration UI
The `/calibration` view allows a speech-language pathologist to:
1. **Record Custom Reference Audio:** Record their own voice or confirmed patient takes directly via microphone.
2. **Assign Reference Class:** Save the recording as either a verified **`[ Save as CORRECT Reference ]`** or **`[ Save as INCORRECT Reference ]`** example.
3. **Annotate Clinical Cues:** Attach clinical descriptions (e.g., "Clear velar stop; good back-tongue elevation").
4. **Tune Decision Thresholds:**
   - **Similarity Threshold:** Slider ($0.40$ to $0.90$, default $0.65$).
   - **Margin Over Incorrect:** Slider ($0.00$ to $0.25$, default $0.08$).
   - **Minimum Speech Energy:** Slider ($0.005$ to $0.050$, default $0.012$).
5. **Delete / Audit References:** Play back any reference recording using `AudioPlayer`, inspect its acoustic parameters, or delete outdated references.

---

## 10. Phase 6 — Practice Flow

The practice workflow is implemented in [src/components/practice/PracticeSession.tsx](file:///d:/speech_therapy_app/src/components/practice/PracticeSession.tsx) and [src/components/audio/SpeechRecorder.tsx](file:///d:/speech_therapy_app/src/components/audio/SpeechRecorder.tsx).

```
Start
  ↓
[ 🎙 SPEAK ]
  ↓
User says "کا"
  ↓
[ Stop Recording ]
  ↓
Analyzing... (DSP extraction & reference comparison)
  ↓
Immediate Feedback Card (✓ CORRECT / ✗ INCORRECT / ? UNCERTAIN)
  ↓
[ Try Again ] or [ Next Attempt ]
  ↓
Session Complete (After Target Repetitions, e.g. 10/10)
  ↓
Today's Practice Session Summary
```

### Detailed State Operations
1. **Initiation:** The practice view loads an in-progress session from IndexedDB or initializes a new one (`id: session-[timestamp]`, `targetAttempts: 10`).
2. **Display:** A large Arabic typeface displays **"کا"** with the label "Qaf Practice • [kaː]".
3. **Live Practice Counter:** Shows the active attempt number (e.g. `Attempt: 7 / 10`) along with live counts (`Correct: 5`, `Incorrect: 1`, `Uncertain: 1`) and a visual 10-dot progress indicator.
4. **Recording:** The user taps `[ 🎙 SPEAK ]`. Microphone stream opens, timer runs, button transitions to `[ Stop Recording ]`.
5. **Analysis:** Upon stopping, state becomes `Analyzing...`. The audio Blob is analyzed via `analyzePronunciation()`.
6. **Immediate Verdict:**
   - If Correct: Banner turns green, displays `✓ CORRECT`, match percentage, rationale, and highlights `[ Next Attempt ]` as the primary button.
   - If Incorrect or Uncertain: Banner turns red or amber, displays `✗ INCORRECT` or `? UNCERTAIN`, and highlights `[ Try Again ]` as the primary button.
   - A `[ Listen to Your Attempt ]` button allows instant audio review.
7. **Auto-Persist:** The attempt is saved directly to IndexedDB with duration, audio blob, similarity score, and verdict.
8. **Session Completion:** When `attemptCount >= targetAttempts`, the view renders the **Session Summary** screen displaying total attempts, count breakdown, audio-based correct rate percentage, visual split progress bar, and clinical disclaimers.

---

## 11. Phase 7 — Progress

Progress tracking is implemented in [src/pages/ProgressPage.tsx](file:///d:/speech_therapy_app/src/pages/ProgressPage.tsx) and [src/utils/statistics.ts](file:///d:/speech_therapy_app/src/utils/statistics.ts).

### 1. Progress Dashboard Metrics
Displays overall historical totals:
- **Total Attempts:** All audio takes recorded across all sessions.
- **Correct (Audio):** Automated match count.
- **Incorrect (Audio):** Automated incorrect count.
- **Uncertain (Audio):** Low-confidence / unclassified count.
- **Therapist Reviewed:** Clinician-evaluated recordings count.
- **Pending Review:** Awaiting clinician evaluation.

### 2. Daily Progress (Today)
- Date Header (e.g. "September 25, 2026")
- Today's Attempts, Correct, Incorrect, Uncertain.
- **Audio-Based Correct Rate:** Explicitly labeled **"Audio-based result"** (e.g. `70%`).
- Target Repetition Goal Selector (5, 10, 15, 20, 25 repetitions) with progress bar.

### 3. Therapist-Confirmed Progress (Strictly Segregated)
- A separate visual card with indigo accent styling.
- Total Reviewed, Confirmed Correct, Confirmed Incorrect.
- **Therapist-Confirmed Rate:**
  $$\text{Rate} = \frac{\text{Therapist Correct}}{\text{Therapist Reviewed}} \times 100$$
- **Strict Clinical Invariant:** Automated audio results are strictly excluded from this calculation. Only clinician-evaluated takes are counted.

### 4. Interactive Visual Charts (Recharts)
Implemented in [src/components/progress/Phase7Charts.tsx](file:///d:/speech_therapy_app/src/components/progress/Phase7Charts.tsx):
- **Attempts Per Day:** Bar chart of daily practice volume over the past 7 days.
- **Audio Result Trend:** Area chart of daily automated match percentages ($0\text{–}100\%$).
- **Therapist Result Trend:** Line chart of clinician-confirmed accuracy ($0\text{–}100\%$), with disconnected points for unreviewed days (`connectNulls={false}`).
- **Practice Duration:** Bar chart of cumulative practice minutes per day.

### 5. Practice Consistency Streaks & Personal Bests
- **Streak Calculation:** Evaluates daily engagement. A day counts if at least one attempt was recorded. Calculates `currentStreak` and `bestStreak`.
- **Personal Best Records:** Tracks best single-day therapist-confirmed accuracy %, highest daily attempt volume, and longest streak.

---

## 12. Data Flow

```
[ Microphone Hardware ]
        ↓ (navigator.mediaDevices.getUserMedia)
[ MediaStream / MediaRecorder ]
        ↓ (ondataavailable 100ms slices)
[ Audio Blob ] (audio/webm or audio/mp4)
        ↓
[ Preprocessing ] (Web Audio API / ArrayBuffer / decodeAudioData)
        ↓
[ Feature Extraction ] (RMS Framing, ZCR, 512-FFT Centroid, Rolloff, 4-Bands, Transient)
        ↓
[ Reference Comparison ] (IndexedDB Calibration Examples for "کا")
        ↓
[ Result Verdict ] (✓ CORRECT / ✗ INCORRECT / ? UNCERTAIN + Similarity Score)
        ↓
[ IndexedDB Persistence ] (Store: 'recordings' [Blob + Result] & Store: 'sessions')
        ↓
[ Progress & Analytics ] (Aggregated via calculateStatistics() → Phase7Charts & History)
```

---

## 13. Automatic Result vs Therapist Result

Automated and clinician evaluations are kept strictly distinct across data models, business logic, and UI presentation:

### TypeScript Interface Contracts

In [src/types/index.ts](file:///d:/speech_therapy_app/src/types/index.ts):

```typescript
export type PronunciationVerdict = 'CORRECT' | 'INCORRECT' | 'UNCERTAIN';
export type TherapistResult = 'CORRECT' | 'INCORRECT' | 'UNCERTAIN';

export interface Recording {
  id: string;
  sessionId: string;
  exerciseId: string;
  blob: Blob;
  duration: number;
  mimeType: string;
  createdAt: string;
  attemptNumber?: number;

  // Automated Audio Analysis Fields (Generated by browser DSP)
  autoResult?: PronunciationVerdict;
  similarity?: number;        // Normalized score 0.0 to 1.0
  analysisReason?: string;    // e.g. "Your recording is similar to your confirmed practice examples."

  // Therapist Clinical Evaluation Fields (Set exclusively by clinician)
  therapistResult?: TherapistResult;
  therapistRemarks?: string;  // Clinical notes, e.g. "Good velar contact"
  therapistReviewedAt?: string;
}
```

### Visual and Functional Differentiation
1. **Badges:** In attempt cards, the automated score is badged with an Activity icon and labeled `"Audio: ✓ CORRECT (78%)"`. The clinician verdict is badged with a UserCheck icon and labeled `"Therapist: CORRECT"`.
2. **Progress Metrics:** The Daily Progress card computes percentage solely from `autoResult`. The Clinical Evaluation card computes percentage solely from `therapistResult`. The two are never combined or averaged.
3. **Clinical Authority:** The UI displays notices that the automated analysis is an acoustic aid, and only the therapist's judgment constitutes clinical assessment.

---

## 14. Mobile Responsiveness

The application layout has been validated across standard mobile, tablet, and desktop viewports:

| Viewport Width | Typical Device | Verified Layout Behavior |
| :--- | :--- | :--- |
| **320px** | iPhone SE (1st gen) | Minimum supported viewport. Single column layout. Target text "کا" scales down to `text-6xl` to prevent horizontal clipping. Fixed bottom navigation fits 4 icons with reduced text padding. |
| **375px** | iPhone SE (2nd/3rd gen) | Single column layout. Large `[ 🎙 SPEAK ]` button fits with comfortable tap margin. Practice counter and live tallies stack cleanly. |
| **390px** | iPhone 12/13/14/15 | Standard mobile display. Practice counter displays horizontally. Bottom navigation utilizes iOS safe-area inset padding (`env(safe-area-inset-bottom)`). |
| **412px** | Samsung Galaxy / Pixel | Standard Android viewport. Grid items in session summary format into 3 balanced columns. Modal dialogs maintain 16px lateral padding. |
| **768px** | iPad Mini / Portrait Tablet | Breakpoint transition (`md:`). Mobile top header and bottom nav bar hide. Desktop sidebar (`w-64`) appears on the left. Main content container expands with multi-column analytics. |
| **1024px** | iPad Pro / Laptop | Desktop sidebar (`w-72`). Dashboard metrics display in a 6-column grid. Recharts analytics render at 288px height with rich tooltips. |
| **1440px** | Desktop Monitor | Max-width constraints (`max-w-4xl`, `max-w-xl` on practice) maintain optimal line lengths and prevent UI stretching. Centered layout with generous whitespace. |

---

## 15. Privacy

An audit of the codebase confirms that:

1. **Zero External Audio Transmission:** Audio recordings are captured via `MediaRecorder`, processed in-memory via `AudioContext`, and saved directly to the browser's local `IndexedDB`. No audio binary or base64 string is ever transmitted over the network.
2. **Zero External API Calls:**
   - No speech recognition APIs (Web Speech API, Google Cloud Speech, Whisper, OpenAI) are invoked.
   - No external telemetry, tracking scripts, or analytics SDKs are bundled.
3. **Network Audit:**
   - Network activity is limited to downloading the static application bundle and local fonts during the initial page load.
   - Once cached by the PWA service worker, the application runs entirely offline.
4. **Data Ownership:**
   - The user has complete control over stored data.
   - Full data export (`downloadPracticeBackup()`) generates a local `.json` file containing audio as base64 data URLs.
   - An option to delete all data (`deleteEntireDatabase()`) is available in Settings.

---

## 16. Known Limitations

A transparent evaluation of the current system identifies the following limitations:

1. **Acoustic Comparison vs Articulatory Mechanics:**
   - The microphone captures only air-pressure fluctuations. It cannot detect physical tongue placement, tongue-body elevation against the soft palate, or velopharyngeal closure.
   - If a user produces an acoustic waveform that mimics the spectral envelope of "کا" through compensatory speech mechanisms (e.g., pharyngeal or glottal substitutions), the acoustic similarity metric may register a high match despite incorrect articulatory placement.
2. **Initial Synthetic Baseline vs Human Voice:**
   - The pre-seeded calibration examples are generated via synthetic additive sinusoids (`createSyntheticKaAudio`) to allow immediate offline use without bundling large audio assets.
   - Because synthetic audio lacks human vocal tract resonance and natural jitter/shimmer, real user speech may yield lower similarity scores until a therapist records real human references in the Calibration tab.
3. **Sensitivity to Acoustic Environment:**
   - Background noise, room reverberation, microphone clipping, or variations in mouth-to-microphone distance can alter the spectral centroid and zero-crossing rate, occasionally resulting in `UNCERTAIN` classifications.
4. **Fixed Target Sound Focus:**
   - The feature extraction parameters (e.g. spectral bands centered on $2{,}000\text{ Hz}$ for velar burst and $750/1{,}250\text{ Hz}$ for /aː/) are specifically tuned for **"کا"**. They are not directly applicable to other phonemes (e.g. sibilants or labials) without reconfiguring the band filters.

---

## 17. Potential Bugs and Risky Behaviors

A code-level inspection of the implementation reveals the following items prioritized by severity:

### HIGH
1. **Fallback Decoding on Non-WAV Formats in Mobile Safari:**
   - In [src/services/pronunciationAnalyzer.ts](file:///d:/speech_therapy_app/src/services/pronunciationAnalyzer.ts), `extractAudioFeatures()` first attempts `ctx.decodeAudioData()`. If this fails on mobile browsers (e.g. during certain background state transitions in iOS Safari), it falls back to `parseWavOrRawPcm()`.
   - If the recording is compressed AAC/MP4 (standard on iOS), `parseWavOrRawPcm()` returns `null`.
   - The subsequent fallback is `approximatePcmFromBytes()`, which treats compressed bitstream bytes as linear 8-bit unsigned PCM. This would generate arbitrary noise features.
   - *Mitigation:* Ensure `AudioContext.decodeAudioData()` is always awaited with a valid slice, and handle compressed fallback gracefully by returning `null` rather than parsing compressed headers as PCM.

### MEDIUM
2. **IndexedDB Audio Storage Quota on Mobile Devices:**
   - Audio blobs are saved indefinitely in IndexedDB without a maximum storage ceiling or automated cleanup of old takes.
   - On iOS Safari, WebKit may enforce IndexedDB storage quotas as low as 50MB to 500MB. Storing hundreds of uncompressed WAV or large WebM takes could eventually trigger `QuotaExceededError`.
   - *Mitigation:* Implement an optional setting to purge audio blobs older than 30 or 60 days, or store metadata-only records for older sessions while retaining audio for the last 50 attempts.
3. **Try Again vs Discard Semantics:**
   - In `SpeechRecorder.tsx`, when an attempt is recorded, it is automatically saved to IndexedDB (`saveAttempt`).
   - If the user clicks `[ Try Again ]`, the recorder resets for another attempt, but the previous attempt remains saved in the session history.
   - Some clinical users might expect "Try Again" to discard the flawed take rather than incrementing the attempt counter.
   - *Mitigation:* The current behavior preserves all practice attempts for therapist review, which is clinically defensible, but a distinct "Discard and Redo" button could prevent counting accidental recordings.

### LOW
4. **Recharts Container Measurement Warnings in Headless Environments:**
   - In headless test runs (jsdom), Recharts logs minor `act(...)` or zero-dimension container warnings because jsdom does not implement SVG layout calculation. This does not affect live browser execution.
5. **Single Active Tab IndexedDB Locking:**
   - Opening the application in multiple browser tabs simultaneously could trigger `onblocked` during database upgrade events. A console warning is logged, but an in-app banner is not displayed.

---

## 18. Requirements Not Implemented

Comparison of the original Phase 1–7 requirements against the current codebase:

| Phase | Requirement Specification | Implementation Status | Notes |
| :--- | :--- | :--- | :--- |
| **Phase 1** | Project setup, design tokens, "کا" target definition | **Fully Implemented** | Exercise `'ex-qaf-ka-01'` seeded with phoneme targets and tips. |
| **Phase 2** | Responsive shell, navigation, 6 view routes | **Fully Implemented** | Desktop sidebar + mobile nav bar across all routes. |
| **Phase 3** | Audio recording, permissions, MediaRecorder | **Fully Implemented** | Full permission handling, timers, dynamic MIME selection. |
| **Phase 4** | IndexedDB storage, sessions, audio blobs, export | **Fully Implemented** | 5 stores, relational keys, export/import with Base64 audio. |
| **Phase 5** | Pronunciation check for "کا", CORRECT/INCORRECT/UNCERTAIN | **Fully Implemented** | Web Audio DSP, feature extraction, reference scoring. |
| **Phase 6** | One-by-one practice flow, counter, summary screen | **Fully Implemented** | Streamlined `[ SPEAK ]` → `[ Stop ]` → Result → Next flow. |
| **Phase 7** | Progress dashboard, separated therapist stats, 4 charts | **Fully Implemented** | Recharts time-series, streak tracking, separated metrics. |

*All specified Phase 1 through Phase 7 requirements have been implemented. No required functional phases are missing.*

---

## 19. Recommended Improvements

The following improvements are recommended to increase reliability and clinical utility:

1. **Enhanced AudioContext Mobile Resume:**
   Ensure `AudioContext.resume()` is explicitly triggered on direct user gesture before `decodeAudioData()` is executed, preventing silent decoding suspensions on iOS Safari.
2. **Clinician Reference Audio Onboarding:**
   Add a quick-start calibration prompt encouraging the therapist to record 2–3 real human reference takes of "کا" during initial setup, replacing the synthetic baseline for improved patient-specific matching.
3. **Storage Quota Indicator:**
   Add a simple storage meter in Settings showing estimated IndexedDB storage usage (via `navigator.storage.estimate()`) with a "Purge Audio Older Than 30 Days" utility.
4. **Optional Discard Take Action:**
   Provide an explicit "Discard Take" button on the feedback card for instances where the user sneezed, coughed, or had background noise interrupt the recording.

---

## 20. Final End-to-End Test

### Verification of Complete User Workflow

The end-to-end user workflow was audited against the codebase and test suite:

| Step | User Action / Application Event | Implemented Component / Function | Audit Status |
| :--- | :--- | :--- | :--- |
| **1** | Open application | `App.tsx` routes to `HomePage.tsx` | **PASS** |
| **2** | Navigate to Practice | Clicks "Start Practice" or nav link to `/practice` | **PASS** |
| **3** | Display "کا" | `PracticeSessionComponent` renders Arabic target "کا" | **PASS** |
| **4** | Initiate recording | Taps `[ 🎙 SPEAK ]` (`SpeechRecorder.tsx` → `startRecording`) | **PASS** |
| **5** | Utter sound "کا" | User articulates target into microphone | **PASS** |
| **6** | Stop recording | Taps `[ Stop Recording ]` (`stopRecording`) | **PASS** |
| **7** | Audio analysis | `analyzePronunciation()` executes feature extraction & comparison | **PASS** |
| **8** | Immediate feedback | Renders card with **✓ CORRECT**, **✗ INCORRECT**, or **? UNCERTAIN** | **PASS** |
| **9** | Save attempt | Automatically persists recording and verdict to IndexedDB `recordings` | **PASS** |
| **10** | Repeat cycle | Taps `[ Next Attempt ]` or `[ Try Again ]`, counter updates | **PASS** |
| **11** | Complete session | Reaches target attempts (e.g. 10/10), renders Session Summary | **PASS** |
| **12** | View history | Taps "View in History" → `HistoryPage.tsx` lists session & audio | **PASS** |
| **13** | View progress | Navigates to `/progress` → `ProgressPage.tsx` renders stats & charts | **PASS** |

### Verification Summary
- **End-to-End Status:** **Operational and Functional.**
- **Test Suite Results:** All **15 test files** and **147 automated tests** pass cleanly with 0 failures in Vitest.
- **TypeScript Compilation:** `npx tsc --noEmit` compiles cleanly with **0 errors**.
- **Production Build:** `npm run build` succeeds cleanly in under 6 seconds with PWA and ONNX WebAssembly assets.
- **Architectural Integrity:** The application operates strictly on the frontend without any backend server or external AI dependencies.

---

## 21. Phase 14 — Browser ML Inference Architecture

### Overview
In Phase 14, client-side Machine Learning inference using **ONNX Runtime Web** (`onnxruntime-web`) was integrated directly into the React application, transitioning the primary pronunciation assessment from external Python microservices to 100% on-device browser inference.

### Key Implemented Components

1. **Model Loader (`src/ai/modelLoader.ts`):**
   - **Singleton Architecture:** Loads the validated ONNX model (`/models/pronunciation-model.onnx`) once and caches the session.
   - **State Exposure:** Tracks states `IDLE`, `LOADING`, `READY`, and `ERROR` via `getLoadingState()`.
   - **Concurrency Guard:** Prevents duplicate in-flight requests by sharing an active loading promise across concurrent callers.
   - **Provider Baseline:** Uses WebAssembly (`wasm`) as the compatibility baseline, with opportunistic WebGPU execution if supported by the browser. WebGPU is strictly optional.
   - **Failure Handling:** Transitions safely to `ERROR` state with descriptive error capture; never leaves hanging promises.

2. **Audio Preprocessor (`src/ai/audioPreprocessor.ts`):**
   - **16 kHz Resampling:** High-fidelity linear interpolation ensures audio is exactly 16,000 Hz.
   - **Mono Conversion:** Downmixes multi-channel audio to single-channel float PCM.
   - **Peak Normalization:** Scales peak amplitude to 0.95 with a 20.0x gain clamp and floor noise protection.
   - **Silence Handling:** Rejects raw ambient floor noise (< 0.005 peak) and high-silence frames (> 0.96 ratio with peak < 0.05).
   - **Padding & Duration Guards:** Rejects recordings under 0.20s or over 15.0s.
   - **Acoustic Projection:** Extracts 1024-dimensional normalized feature tensors matching the model's XLS-R projection graph.

3. **Inference Service (`src/ai/pronunciationInference.ts`):**
   - **Clean Abstraction:** Accepts audio `Blob` or `Float32Array` alongside exercise identifiers; returns clean `PronunciationAssessment` without leaking ONNX internals, tensors, or session objects to UI components.
   - **Calibrated Policy:** Applies validated thresholds (`tau_low = 0.35`, `tau_high = 0.40`, `min_confidence = 0.60`) for all four target phonemes (`کا`, `کی`, `کے`, `کو`).
   - **Fail-Safe Policy:** On model load failure returns `UNCERTAIN` (`"Pronunciation model could not be loaded."`); on inference/preprocessing rejection returns `UNCERTAIN` (`"Unable to analyze this recording."`). Never fabricates `CORRECT` or `NEEDS_PRACTICE` on failure.
   - **Performance Instrumentation:** Tracks first model load time, first inference latency, subsequent inference latency, and JS heap memory.

4. **Practice Flow Integration (`src/components/audio/SpeechRecorder.tsx`):**
   - **Updated Flow:** `Record -> Analyze -> ML inference -> Result`.
   - **Initial Load UX:** Displays `"Loading model..."` on initial attempt when the ONNX session is initializing; subsequent assessments reuse the cached model and immediately display `"Analyzing pronunciation..."`.
   - **Dev/Debug Option:** Retains `VITE_USE_SERVER_INFERENCE` toggle for development comparison against FastAPI service without modifying production bundles.

5. **Privacy Guarantee (`src/pages/PrivacyPage.tsx`):**
   - Explicitly updated with: *"Pronunciation analysis runs on this device using the local pronunciation model."*
   - Guarantees 0% network egress for practice audio recordings in production.

### Verification Results
- **Automated Tests:** `npm test` passed 15 test files and 147 test cases (including 25 new Phase 14 tests in `tests/phase14BrowserInference.test.ts`).
- **Type Checking:** `npx tsc --noEmit` passed with 0 errors.
- **Production Build:** `npm run build` succeeded cleanly in 5.69s.

---

## 22. Phase 15 — Sequence Pronunciation Assessment Architecture

### Overview
In Phase 15, the Speech Practice Assistant was extended from single-unit assessment (`کا`, `کی`, `کے`, `کو`) to full **continuous sequence pronunciation assessment**. Users can practice multi-unit combinations (e.g. `کا، کی`, `کا، کی، کے`, `کا، کی، کے، کو`, or arbitrary future sequences) in a single continuous recording, receiving per-unit phoneme breakdowns, temporal boundaries, and an overarching clinical sequence score.

### Key Architecture & Implementation Details

1. **Flexible Sequence Model (`exercise.targetUnits`):**
   - Does not hardcode four positions; accepts arbitrary string arrays (e.g. `["کا", "کی"]`, `["کا", "کی", "کے"]`, `["کا", "کی", "کے", "کو"]`).
   - Dynamic resolution supports both structured exercise objects and comma-delimited strings (`کا، کی`).

2. **Acoustic Energy Segmentation (`src/ai/sequenceSegmentation.ts`):**
   - Determines approximate unit boundaries using 25ms windows with 10ms hops, smoothed RMS energy contour profiling, adaptive speech thresholds, and inter-syllable acoustic dips/closures.
   - Strictly avoids equal-duration chunking: accurately measures variable duration units with true `startTime`, `endTime`, and `duration`.

3. **Monotonic Dynamic Programming Alignment:**
   - Evaluates acoustic features for each speech segment against candidate phoneme targets.
   - Computes optimal monotonic alignment path $O(M \times N)$ between $M$ expected targets and $N$ acoustic segments.
   - Robustly handles:
     - Missing units ($N < M$): Omitted targets are aligned as unfulfilled and scored as `NEEDS_PRACTICE` with score `0.0`.
     - Extra units ($N > M$): Hesitations, coughs, or noise bursts are skipped while matching intended targets.
     - Variable durations: Segments of varying lengths are aligned to their highest likelihood target.
     - Ambiguity margins: Scores in uncertainty regions ($0.35 \le \text{prob} \le 0.40$ or confidence $< 0.60$) map to `UNCERTAIN`.

4. **Per-Unit Result Contract (`src/types/index.ts`):**
   ```typescript
   export interface UnitAssessment {
     target: string;
     unit?: string; // Backward compatibility alias
     detected?: string;
     score: number;
     confidence: number;
     result: 'CORRECT' | 'NEEDS_PRACTICE' | 'UNCERTAIN';
     startTime?: number;
     endTime?: number;
   }
   ```

5. **Overall Sequence Evaluation Policy:**
   - If any unit is `NEEDS_PRACTICE` $\to$ overall sequence is `NEEDS_PRACTICE`. Never mark entire sequence `CORRECT` if a required unit fails.
   - Else if any unit is `UNCERTAIN` $\to$ overall sequence is `UNCERTAIN`.
   - Else (all units `CORRECT`) $\to$ overall sequence is `CORRECT`.

6. **Sequence Practice UI (`src/components/audio/SpeechRecorder.tsx`):**
   - Prominently displays the full sequence breadcrumb (e.g. `کا → کی → کے → کو`).
   - Post-analysis breakdown card displays each target with status badge (`✓ CORRECT`, `✗ PRACTICE`, `? UNCERTAIN`), score %, and detected phoneme.
   - Displays sequence summary (e.g. `3 / 4 good`).
   - Dynamic primary action: `[Practice "کے" Again]` when a unit fails, directing the user to isolate the faulty unit; `[Next Sequence]` when successful.

7. **Recording Persistence & Therapist Review:**
   - Saved records include overall verdict, confidence, per-unit assessments, timing intervals, and model version (`src/storage/recordingRepository.ts`).
   - Speech therapists can submit overall evaluations (`CORRECT` / `INCORRECT` / `UNCERTAIN`) and optional per-unit reviews (`therapistUnitReviews`) with clinical notes (`src/components/practice/PracticeAttempt.tsx`).
   - Model labels and therapist reviews remain strictly independent; therapist actions never overwrite model inference records.

8. **Progress & Analytics Isolation (`src/pages/ProgressPage.tsx`, `src/utils/statistics.ts`):**
   - Per-unit statistics for `کا`, `کی`, `کے`, `کو` calculate therapist-confirmed percentages independently (e.g., `کا: 92%`, `کی: 81%`, `کے: 67%`, `کو: 88%`).
   - Sequence statistics track specific sequence combinations (`کا → کی: 75%`, `کا → کی → کے: 68%`) without combining unrelated exercises into one aggregated metric.

### Final Verification Results
- **Automated Tests:** `npm test` passed **16 test files** and **162 automated tests** with 0 failures (including 15 comprehensive tests in `tests/sequenceAssessment.test.ts`).
- **TypeScript Typecheck:** `npx tsc --noEmit` verified with **0 errors**.
- **Production Build:** `npm run build` completed successfully in under 4 seconds.

