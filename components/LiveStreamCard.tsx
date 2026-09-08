'use client';

import React, { useEffect, useRef, useCallback } from 'react';
import { useWebRTCAdmin } from '@/lib/webrtc/useWebRTCAdmin';
import { ConnectionStatus } from '@/components/ConnectionStatus';
import { UserSession } from '@/lib/types';
import { Phone, Clock, Maximize2, X, AlertTriangle } from 'lucide-react';

interface LiveStreamCardProps {
  session: UserSession;
  onClose: () => void;
  onTerminate: (sessionId: string) => void;
}

export const LiveStreamCard: React.FC<LiveStreamCardProps> = ({
  session,
  onClose,
  onTerminate,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const { remoteStream, connectionState, error, reconnect } = useWebRTCAdmin({
    sessionId: session.id,
    onSessionTerminated: () => {
      onClose();
    },
  });

  const setVideoRef = useCallback(
    (el: HTMLVideoElement | null) => {
      videoRef.current = el;
      if (el && remoteStream) {
        el.srcObject = remoteStream;
        el.play().catch((e) => console.warn('[Admin Video Autoplay]', e));
      }
    },
    [remoteStream]
  );

  const toggleFullscreen = () => {
    if (videoRef.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        videoRef.current.requestFullscreen();
      }
    }
  };

  const formattedStartTime = new Date(session.createdAt).toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden flex flex-col">
      {/* Header */}
      <div className="p-4 bg-zinc-50 dark:bg-zinc-800/60 border-b border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200">
              ID: {session.id.substring(0, 8)}...
            </span>
            <ConnectionStatus
              status={remoteStream ? 'connected' : connectionState}
              isLive={!!remoteStream && connectionState === 'connected'}
            />
          </div>
          <div className="flex items-center gap-4 text-xs text-zinc-500 dark:text-zinc-400">
            <span className="flex items-center gap-1">
              <Phone className="w-3.5 h-3.5" />
              <strong className="text-zinc-700 dark:text-zinc-300 font-mono">
                {session.maskedPhoneNumber}
              </strong>
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              <span>Start: {formattedStartTime}</span>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={toggleFullscreen}
            title="Vollbild"
            className="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition-all"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            title="Schließen"
            className="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Video Stream Stage */}
      <div className="relative aspect-video w-full bg-black flex items-center justify-center overflow-hidden">
        {remoteStream ? (
          <video
            ref={setVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-contain"
          />
        ) : (
          <div className="text-center p-6 space-y-3">
            <div className="w-12 h-12 mx-auto rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 animate-pulse">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
              </span>
            </div>
            <p className="text-sm font-medium text-zinc-300">
              Verbindung wird hergestellt...
            </p>
            <p className="text-xs text-zinc-500 max-w-xs">
              Warten auf Videodaten des Smartphones über WebRTC PeerConnection.
            </p>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 bg-black/80 flex items-center justify-center p-4 z-10">
            <div className="bg-red-950/80 border border-red-800 text-red-200 p-4 rounded-xl max-w-sm text-center space-y-3">
              <AlertTriangle className="w-6 h-6 mx-auto text-red-400" />
              <p className="text-sm font-semibold">{error}</p>
              <button
                onClick={reconnect}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-red-700 hover:bg-red-600 text-white transition-all shadow-sm"
              >
                Erneut verbinden
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer controls */}
      <div className="p-3 bg-zinc-50 dark:bg-zinc-800/40 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          Live-Videoübertragung aktiv (WebRTC)
        </span>
        <button
          onClick={() => onTerminate(session.id)}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-600 hover:bg-red-700 text-white transition-all shadow-sm"
        >
          Sitzung beenden
        </button>
      </div>
    </div>
  );
};
