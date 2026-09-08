'use client';

import React, { useEffect, useRef, useCallback } from 'react';
import { VideoOff, Radio, ShieldCheck } from 'lucide-react';

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

  return (
    <div className="w-full max-w-md mx-auto p-5 sm:p-6 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-zinc-200/80 dark:border-zinc-800 transition-all">
      {/* Header with Live indicator */}
      <div className="flex items-center justify-between gap-3 mb-4 pb-3 border-b border-zinc-100 dark:border-zinc-800">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
          </span>
          <h2 className="font-bold text-base text-zinc-900 dark:text-white">
            Kamera aktiv
          </h2>
        </div>

        {/* Live badge */}
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 text-xs font-semibold uppercase tracking-wider">
          <Radio className="w-3.5 h-3.5 animate-pulse" />
          <span>Live</span>
        </div>
      </div>

      {/* Visible Video Preview */}
      <div className="relative aspect-[4/3] w-full bg-black rounded-xl overflow-hidden shadow-inner border border-zinc-800 flex items-center justify-center">
        <video
          ref={setVideoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover transform -scale-x-100"
        />

        {/* Technical connection badge */}
        <div className="absolute bottom-3 right-3 bg-black/70 backdrop-blur-md px-2.5 py-1 rounded-md text-[11px] text-zinc-300 font-mono">
          {connectionState === 'connected' ? 'Verbunden' : 'Verbindung wird hergestellt...'}
        </div>
      </div>

      {/* Notification Banner */}
      <div className="mt-4 p-3.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
        <p className="text-sm font-medium text-blue-900 dark:text-blue-200 leading-normal">
          Ihre Kamera wird derzeit live übertragen.
        </p>
      </div>

      {/* Stop Streaming Button */}
      <button
        id="stop-camera-button"
        onClick={onStop}
        className="mt-5 w-full py-3.5 px-5 rounded-xl bg-red-600 hover:bg-red-700 active:scale-[0.99] text-white font-medium text-sm flex items-center justify-center gap-2 transition-all shadow-md shadow-red-600/20"
      >
        <VideoOff className="w-4 h-4" />
        <span>Kamerafreigabe beenden</span>
      </button>
    </div>
  );
};
