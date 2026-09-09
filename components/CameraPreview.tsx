'use client';

import React, { useEffect, useRef, useCallback } from 'react';
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  Radio,
  ShieldCheck,
  SwitchCamera,
  PhoneOff,
} from 'lucide-react';

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
}

export const CameraPreview: React.FC<CameraPreviewProps> = ({
  stream,
  connectionState,
  onStop,
  isAudioMuted = false,
  isVideoMuted = false,
  onToggleAudioMute,
  onToggleVideoMute,
  onFlipCamera,
  facingMode = 'user',
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

  // Connection state label & badge helper
  const getConnectionLabel = () => {
    switch (connectionState) {
      case 'connected':
        return 'Verbunden (Live)';
      case 'waiting-admin':
        return 'Warten auf Admin...';
      case 'connecting':
        return 'Verbindung aufbauen...';
      case 'disconnected':
        return 'Verbindung getrennt';
      case 'failed':
        return 'Verbindungsfehler';
      default:
        return 'Wird initialisiert...';
    }
  };

  return (
    <div className="w-full max-w-md mx-auto p-5 sm:p-6 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-zinc-200/80 dark:border-zinc-800 transition-all">
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
            Kamera aktiv
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
          <span>{connectionState === 'connected' ? 'Live' : 'Bereit'}</span>
        </div>
      </div>

      {/* Video Preview Stage */}
      <div className="relative aspect-[4/3] w-full bg-black rounded-xl overflow-hidden shadow-inner border border-zinc-800 flex items-center justify-center">
        <video
          ref={setVideoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-cover transition-transform ${
            facingMode === 'user' ? 'transform -scale-x-100' : ''
          }`}
        />

        {isVideoMuted && (
          <div className="absolute inset-0 bg-zinc-900/90 backdrop-blur-sm flex flex-col items-center justify-center text-zinc-400 gap-2">
            <VideoOff className="w-10 h-10 text-zinc-500" />
            <span className="text-xs font-medium">Kamera ist stummgeschaltet</span>
          </div>
        )}

        {/* Technical connection badge */}
        <div className="absolute bottom-3 right-3 bg-black/75 backdrop-blur-md px-2.5 py-1 rounded-md text-[11px] text-zinc-300 font-mono">
          {getConnectionLabel()}
        </div>
      </div>

      {/* Media Controls Bar (Mute Audio, Mute Video, Flip Camera) */}
      <div className="mt-4 grid grid-cols-3 gap-2">
        {onToggleAudioMute && (
          <button
            type="button"
            onClick={onToggleAudioMute}
            className={`py-2.5 px-3 rounded-xl border text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
              isAudioMuted
                ? 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900/60 text-red-600 dark:text-red-400'
                : 'bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700'
            }`}
          >
            {isAudioMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            <span>{isAudioMuted ? 'Mikro stumm' : 'Mikrofon'}</span>
          </button>
        )}

        {onToggleVideoMute && (
          <button
            type="button"
            onClick={onToggleVideoMute}
            className={`py-2.5 px-3 rounded-xl border text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
              isVideoMuted
                ? 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900/60 text-red-600 dark:text-red-400'
                : 'bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700'
            }`}
          >
            {isVideoMuted ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
            <span>{isVideoMuted ? 'Video aus' : 'Kamera'}</span>
          </button>
        )}

        {onFlipCamera && (
          <button
            type="button"
            onClick={onFlipCamera}
            title="Kamera wechseln (Front / Rückseite)"
            className="py-2.5 px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 text-xs font-medium flex items-center justify-center gap-1.5 transition-all"
          >
            <SwitchCamera className="w-4 h-4" />
            <span>Drehen</span>
          </button>
        )}
      </div>

      {/* Notification Banner */}
      <div className="mt-4 p-3.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
        <p className="text-sm font-medium text-blue-900 dark:text-blue-200 leading-normal">
          Ihre Kamera und Ihr Ton werden jetzt live per WebRTC übertragen.
        </p>
      </div>

      {/* Stop Streaming Button */}
      <button
        id="stop-camera-button"
        onClick={onStop}
        className="mt-5 w-full py-3.5 px-5 rounded-xl bg-red-600 hover:bg-red-700 active:scale-[0.99] text-white font-medium text-sm flex items-center justify-center gap-2 transition-all shadow-md shadow-red-600/20"
      >
        <PhoneOff className="w-4 h-4" />
        <span>Kamerafreigabe beenden</span>
      </button>
    </div>
  );
};
