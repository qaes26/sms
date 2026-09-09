'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { MediaConnection } from 'peerjs';
import { getPeerJSOptions, getAdminPeerId } from '@/lib/webrtc/peer-config';

interface UseWebRTCAdminProps {
  sessionId: string | null;
  onSessionTerminated?: () => void;
}

export function useWebRTCAdmin({ sessionId, onSessionTerminated }: UseWebRTCAdminProps) {
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [connectionState, setConnectionState] = useState<string>('idle');
  const [error, setError] = useState<string | null>(null);
  const [adminPeerId, setAdminPeerId] = useState<string | null>(null);

  const peerRef = useRef<any>(null);
  const callRef = useRef<MediaConnection | null>(null);
  const isCleanedUpRef = useRef<boolean>(false);
  const activeSessionIdRef = useRef<string | null>(null);
  const onSessionTerminatedRef = useRef(onSessionTerminated);

  useEffect(() => {
    onSessionTerminatedRef.current = onSessionTerminated;
  }, [onSessionTerminated]);

  const cleanup = useCallback(() => {
    isCleanedUpRef.current = true;

    if (callRef.current) {
      try {
        callRef.current.close();
      } catch (_) {}
      callRef.current = null;
    }

    if (peerRef.current) {
      try {
        peerRef.current.destroy();
      } catch (_) {}
      peerRef.current = null;
    }

    setRemoteStream(null);
    setConnectionState('disconnected');
    setError(null);
  }, []);

  const connectAdminPeer = useCallback(async () => {
    if (!sessionId) {
      setConnectionState('idle');
      return;
    }

    cleanup();
    isCleanedUpRef.current = false;
    activeSessionIdRef.current = sessionId;
    setError(null);
    setConnectionState('connecting');

    try {
      // Dynamic import of PeerJS for SSR safety
      const { default: Peer } = await import('peerjs');

      const peerId = getAdminPeerId(sessionId);
      const peerOptions = getPeerJSOptions();

      console.log(`[WebRTC Admin] Initializing Peer with ID: ${peerId}`);
      const peer = new Peer(peerId, peerOptions);
      peerRef.current = peer;

      peer.on('open', (id) => {
        console.log('[WebRTC Admin] Peer connected with ID:', id);
        setAdminPeerId(id);
        setConnectionState('waiting-for-call');
      });

      peer.on('call', (incomingCall: MediaConnection) => {
        console.log('[WebRTC Admin] Incoming call received from:', incomingCall.peer);
        callRef.current = incomingCall;
        setConnectionState('call-received');

        // Answer the call without sending any local media stream
        incomingCall.answer();

        // Attach remote MediaStream
        incomingCall.on('stream', (stream: MediaStream) => {
          console.log('[WebRTC Admin] Remote MediaStream attached with tracks:', stream.getTracks().length);
          setRemoteStream(stream);
          setConnectionState('connected');
        });

        // Monitor underlying RTCPeerConnection for connection events
        if (incomingCall.peerConnection) {
          incomingCall.peerConnection.onconnectionstatechange = () => {
            const pcState = incomingCall.peerConnection.connectionState;
            console.log('[WebRTC Admin] PC connectionState:', pcState);
            if (pcState === 'connected') {
              setConnectionState('connected');
            } else if (pcState === 'disconnected') {
              setConnectionState('disconnected');
            } else if (pcState === 'failed') {
              setConnectionState('failed');
              setError('Die Verbindung zum Smartphone ist fehlgeschlagen.');
            }
          };

          incomingCall.peerConnection.oniceconnectionstatechange = () => {
            const iceState = incomingCall.peerConnection.iceConnectionState;
            console.log('[WebRTC Admin] PC iceConnectionState:', iceState);
            if (iceState === 'connected' || iceState === 'completed') {
              setConnectionState('connected');
            } else if (iceState === 'failed') {
              setConnectionState('failed');
              setError('Verbindung über ICE fehlgeschlagen. Bitte überprüfen Sie Ihre Netzwerkeinstellungen.');
            }
          };
        }

        incomingCall.on('close', () => {
          console.log('[WebRTC Admin] MediaConnection closed');
          if (!isCleanedUpRef.current) {
            setRemoteStream(null);
            setConnectionState('disconnected');
            if (onSessionTerminatedRef.current) {
              onSessionTerminatedRef.current();
            }
          }
        });

        incomingCall.on('error', (err) => {
          console.warn('[WebRTC Admin] Call error:', err);
          setError('Anruffehler: ' + (err.message || 'Verbindung unterbrochen'));
        });
      });

      peer.on('error', (err: any) => {
        console.warn('[WebRTC Admin] Peer error:', err?.type, err?.message);
        if (err?.type === 'unavailable-id') {
          // If ID is occupied by a lingering connection, wait and retry once
          console.log('[WebRTC Admin] Admin ID currently registered. Retrying in 1.5s...');
          setTimeout(() => {
            if (!isCleanedUpRef.current && sessionId === activeSessionIdRef.current) {
              connectAdminPeer();
            }
          }, 1500);
        } else {
          setError('Signalfehler: ' + (err?.message || 'Verbindungsfehler'));
          setConnectionState('error');
        }
      });

      peer.on('disconnected', () => {
        console.log('[WebRTC Admin] Disconnected from signaling. Reconnecting...');
        if (!isCleanedUpRef.current && peerRef.current && !peer.destroyed) {
          peer.reconnect();
        }
      });

      peer.on('close', () => {
        console.log('[WebRTC Admin] Peer closed');
        if (!isCleanedUpRef.current) {
          setConnectionState('disconnected');
        }
      });
    } catch (err: any) {
      console.error('[WebRTC Admin Init Error]', err);
      setError('Fehler bei der Initialisierung von PeerJS.');
      setConnectionState('error');
    }
  }, [sessionId, cleanup]);

  useEffect(() => {
    if (sessionId === activeSessionIdRef.current) return;
    connectAdminPeer();

    return () => {
      cleanup();
      activeSessionIdRef.current = null;
    };
  }, [sessionId, connectAdminPeer, cleanup]);

  return {
    remoteStream,
    connectionState,
    error,
    adminPeerId,
    reconnect: connectAdminPeer,
    disconnect: cleanup,
  };
}
