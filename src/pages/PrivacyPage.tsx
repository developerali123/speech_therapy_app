import React from 'react';
import { Card } from '../components/ui/Card';
import { ShieldCheck, Lock, HeartPulse } from 'lucide-react';

export const PrivacyPage: React.FC = () => {
  return (
    <div className="space-y-6 sm:space-y-8 max-w-2xl mx-auto animate-in fade-in duration-200">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          Privacy & Clinical Limitation
        </h1>
        <p className="text-sm text-slate-500 font-medium mt-0.5">
          How your audio is protected and clinical usage boundaries
        </p>
      </div>

      {/* Mandatory Speech Therapy Limitation Box */}
      <Card className="p-6 bg-amber-50/70 border-amber-200 space-y-3">
        <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
          <HeartPulse className="w-5 h-5 text-amber-600 shrink-0" />
          <h2>Clinical & Medical Limitation Statement</h2>
        </div>
        <p className="text-xs sm:text-sm font-semibold text-amber-900 leading-relaxed">
          &quot;This application supports speech practice and progress tracking. It does not diagnose speech disorders, determine tongue position, or replace guidance from a qualified speech therapist.&quot;
        </p>
        <p className="text-xs text-amber-800/90 leading-relaxed">
          No automated algorithm or microphone audio analysis can reliably determine the physical position or contact dynamics of your tongue or velum. Clinical assessment of articulation, speech mechanics, and therapy regimens must always be overseen by a licensed speech-language pathologist.
        </p>
      </Card>

      {/* Local Storage Only Guarantee */}
      <Card className="p-6 bg-white space-y-4">
        <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100">
          <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
            <Lock className="w-4 h-4" />
          </div>
          <h2 className="text-base font-bold text-slate-900">
            100% On-Device Local Storage
          </h2>
        </div>

        <div className="space-y-3 text-xs sm:text-sm text-slate-600 leading-relaxed">
          <p className="flex items-start gap-2">
            <span className="text-teal-600 font-bold">•</span>
            <span>
              <strong>Your practice recordings are stored locally on this device in this version.</strong> Audio files are written directly to your browser&apos;s IndexedDB database.
            </span>
          </p>

          <p className="flex items-start gap-2">
            <span className="text-teal-600 font-bold">•</span>
            <span>
              <strong>The application does not automatically upload your recordings to a server.</strong> There is no cloud backend, third-party speech API, or analytics tracker intercepting your voice.
            </span>
          </p>

          <p className="flex items-start gap-2">
            <span className="text-teal-600 font-bold">•</span>
            <span>
              <strong>Clearing browser storage may remove your recordings.</strong> If you clear site data, private browsing caches, or reinstall your browser, local IndexedDB files will be wiped.
            </span>
          </p>

          <p className="flex items-start gap-2">
            <span className="text-teal-600 font-bold">•</span>
            <span>
              <strong>Use Export Practice Data to create a backup.</strong> You can download a portable JSON backup file containing your audio recordings and therapist notes anytime in Settings.
            </span>
          </p>

          <p className="flex items-start gap-2">
            <span className="text-teal-600 font-bold">•</span>
            <span>
              <strong>Speech Practice Assistant is a practice and tracking tool and does not replace professional speech-therapy assessment.</strong>
            </span>
          </p>
        </div>
      </Card>

      {/* Therapist Authority Section */}
      <Card className="p-6 bg-white space-y-3">
        <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
          <ShieldCheck className="w-4 h-4 text-teal-600" />
          <h3>Manual Therapist Review Authority</h3>
        </div>
        <p className="text-xs text-slate-600 leading-relaxed">
          In this version, correctness results (CORRECT, INCORRECT, UNCERTAIN) can only be assigned manually during clinician review. We do not synthesize simulated accuracy scores or make automated judgments about clinical adequacy.
        </p>
      </Card>
    </div>
  );
};
