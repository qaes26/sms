'use client';

import React, { useEffect, useRef } from 'react';
import { VideoOff, Radio, ShieldAlert } from 'lucide-react';

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

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className="w-full max-w-md mx-auto p-4 sm:p-6 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-zinc-200/80 dark:border-zinc-800 transition-all">
      {/* Active Stream Banner */}
      <div className="flex items-center justify-between gap-3 mb-4 pb-3 border-b border-zinc-100 dark:border-zinc-800">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
          </span>
          <span className="font-semibold text-sm text-zinc-900 dark:text-white">
            Kamera aktiv
          </span>
        </div>

        {/* Live indicator badge */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 text-xs font-semibold uppercase tracking-wider">
          <Radio className="w-3.5 h-3.5 animate-pulse" />
          <span>Live</span>
        </div>
      </div>

      {/* Video Viewport */}
      <div className="relative aspect-[3/4] sm:aspect-[4/3] w-full bg-black rounded-xl overflow-hidden shadow-inner border border-zinc-800 flex items-center justify-center">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover transform -scale-x-100"
        />

        {/* Overlay notification */}
        <div className="absolute top-3 left-3 right-3 bg-black/60 backdrop-blur-md px-3 py-2 rounded-lg border border-white/10 flex items-center gap-2 text-white">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
          <p className="text-xs font-medium tracking-tight">
            Ihre Kamera wird derzeit live übertragen.
          </p>
        </div>

        {/* Technical connection badge at bottom */}
        <div className="absolute bottom-3 right-3 bg-black/70 backdrop-blur-md px-2.5 py-1 rounded-md text-[11px] text-zinc-300 font-mono">
          {connectionState === 'connected' ? 'Verbunden' : 'Verbindung wird hergestellt...'}
        </div>
      </div>

      {/* Status Warning and Confirmation */}
      <div className="mt-4 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 flex items-start gap-2.5">
        <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-amber-800 dark:text-amber-300 leading-normal">
          Ihre Kamera wird derzeit live übertragen. Sie können die Übertragung jederzeit mit einem Klick beenden.
        </p>
      </div>

      {/* Stop Button */}
      <button
        id="stop-camera-button"
        onClick={onStop}
        className="mt-4 w-full py-3.5 px-5 rounded-xl bg-red-600 hover:bg-red-700 active:scale-[0.99] text-white font-medium text-sm flex items-center justify-center gap-2 transition-all shadow-md shadow-red-600/20"
      >
        <VideoOff className="w-4 h-4" />
        <span>Kamerafreigabe beenden</span>
      </button>
    </div>
  );
};
