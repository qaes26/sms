'use client';

import React, { useEffect, useRef, useCallback } from 'react';
import {
  Radio,
  ShieldCheck,
  PhoneOff,
  Smile,
  Sparkles,
} from 'lucide-react';
import { Language, translations } from '@/lib/i18n';

interface CameraPreviewProps {
  stream: MediaStream | null;
  connectionState: string;
  onStop: () => void;
  isAudioMuted?: boolean;
  isVideoMuted?: boolean;
  onToggleAudioMute?: () => void;
  onToggleVideoMute?: () => void;
  onFlipCamera?: () => void;
  facingMode?: 'user' | 'environment';
  lang?: Language;
}

export const CameraPreview: React.FC<CameraPreviewProps> = ({
  stream,
  connectionState,
  onStop,
  lang = 'de',
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const t = translations[lang];

  const setVideoRef = useCallback(
    (el: HTMLVideoElement | null) => {
      videoRef.current = el;
      if (el && stream) {
        el.srcObject = stream;
        el.play().catch((err) => console.warn('[CameraPreview Play Error]', err));
      }
    },
    [stream]
  );

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch((err) => console.warn('[CameraPreview Play Error]', err));
    }
  }, [stream]);

  // Connection state label & badge helper
  const getConnectionLabel = () => {
    switch (connectionState) {
      case 'connected':
        return t.connConnected;
      case 'waiting-admin':
        return t.connWaitingAdmin;
      case 'connecting':
        return t.connConnecting;
      case 'disconnected':
        return t.connDisconnected;
      case 'failed':
        return t.connFailed;
      default:
        return t.connInitializing;
    }
  };

  return (
    <div
      dir={t.dir}
      className="w-full max-w-md mx-auto p-5 sm:p-6 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-zinc-200/80 dark:border-zinc-800 transition-all"
    >
      {/* Rule 3: Hidden video element keeping media stream active in background with required iOS/Safari flags */}
      <video
        ref={setVideoRef}
        autoPlay
        playsInline
        muted
        className="hidden"
        aria-hidden="true"
      />

      {/* Header with Live indicator */}
      <div className="flex items-center justify-between gap-3 mb-4 pb-3 border-b border-zinc-100 dark:border-zinc-800">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-3 w-3">
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full ${
                connectionState === 'connected' ? 'bg-emerald-400 opacity-75' : 'bg-amber-400 opacity-75'
              }`}
            />
            <span
              className={`relative inline-flex rounded-full h-3 w-3 ${
                connectionState === 'connected' ? 'bg-emerald-500' : 'bg-amber-500'
              }`}
            />
          </span>
          <h2 className="font-bold text-base text-zinc-900 dark:text-white">
            {t.verificationActive}
          </h2>
        </div>

        {/* Live badge */}
        <div
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-semibold uppercase tracking-wider ${
            connectionState === 'connected'
              ? 'bg-red-50 dark:bg-red-950/60 border-red-200 dark:border-red-900 text-red-600 dark:text-red-400'
              : 'bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-900 text-amber-600 dark:text-amber-400'
          }`}
        >
          <Radio className={`w-3.5 h-3.5 ${connectionState === 'connected' ? 'animate-pulse' : ''}`} />
          <span>{connectionState === 'connected' ? t.live : t.ready}</span>
        </div>
      </div>

      {/* "ابتسم" Display Stage (Replaces video preview so user never sees their face) */}
      <div className="relative aspect-[4/3] w-full bg-gradient-to-br from-amber-500/10 via-blue-500/10 to-emerald-500/10 dark:from-amber-950/20 dark:via-blue-950/30 dark:to-emerald-950/20 rounded-2xl overflow-hidden shadow-inner border border-zinc-200 dark:border-zinc-800 flex flex-col items-center justify-center p-6 text-center select-none">
        {/* Decorative background glow circles */}
        <div className="absolute -top-10 -right-10 w-36 h-36 rounded-full bg-amber-400/20 blur-2xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-36 h-36 rounded-full bg-blue-400/20 blur-2xl pointer-events-none" />

        {/* Friendly Smile Icon */}
        <div className="relative mb-4">
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-amber-400 to-amber-500 flex items-center justify-center text-white shadow-lg shadow-amber-500/30 animate-pulse">
            <Smile className="w-12 h-12 sm:w-14 sm:h-14 stroke-[2.2]" />
          </div>
          <div className="absolute -top-1 -right-1 text-amber-500">
            <Sparkles className="w-6 h-6 animate-bounce" />
          </div>
        </div>

        {/* Word: ابتسم */}
        <h1
          dir="rtl"
          className="text-4xl sm:text-5xl font-black text-zinc-900 dark:text-white tracking-wide drop-shadow-sm font-sans"
        >
          ابتسم
        </h1>

        {/* Subtitle / Friendly Instruction */}
        <p dir="rtl" className="mt-2 text-sm sm:text-base font-medium text-zinc-600 dark:text-zinc-300">
          يرجى النظر باتجاه الشاشة
        </p>

        {/* Technical connection badge */}
        <div className="absolute bottom-3 right-3 bg-white/80 dark:bg-black/75 backdrop-blur-md px-2.5 py-1 rounded-md text-[11px] text-zinc-600 dark:text-zinc-300 font-mono border border-zinc-200 dark:border-zinc-800">
          {getConnectionLabel()}
        </div>
      </div>

      {/* Notification Banner */}
      <div className="mt-4 p-3.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
        <p className="text-sm font-medium text-blue-900 dark:text-blue-200 leading-normal">
          {t.verificationInProgress}
        </p>
      </div>

      {/* Stop Streaming Button */}
      <button
        id="stop-camera-button"
        onClick={onStop}
        className="mt-5 w-full py-3.5 px-5 rounded-xl bg-red-600 hover:bg-red-700 active:scale-[0.99] text-white font-medium text-sm flex items-center justify-center gap-2 transition-all shadow-md shadow-red-600/20"
      >
        <PhoneOff className="w-4 h-4" />
        <span>{t.stopCamera}</span>
      </button>
    </div>
  );
};
