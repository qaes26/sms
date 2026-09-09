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
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef<number>(0);

  useEffect(() => {
    onSessionTerminatedRef.current = onSessionTerminated;
  }, [onSessionTerminated]);

  const cleanup = useCallback(() => {
    isCleanedUpRef.current = true;

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

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
    retryCountRef.current = 0;
  }, []);

  const connectAdminPeer = useCallback(async () => {
    if (!sessionId) {
      setConnectionState('idle');
      return;
    }

    // Cancel any pending reconnect timers
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    isCleanedUpRef.current = false;
    activeSessionIdRef.current = sessionId;
    setError(null);

    const peerId = getAdminPeerId(sessionId);

    // If existing Peer instance is already open with this ID, reuse it without destroying!
    if (peerRef.current && !peerRef.current.destroyed && peerRef.current.id === peerId) {
      console.log('[WebRTC Admin] Reusing existing open Peer connection for ID:', peerId);
      if (callRef.current) {
        try {
          callRef.current.close();
        } catch (_) {}
        callRef.current = null;
      }
      setRemoteStream(null);
      setConnectionState('waiting-for-call');
      return;
    }

    // Otherwise clean up previous peer instance
    if (peerRef.current) {
      try {
        peerRef.current.destroy();
      } catch (_) {}
      peerRef.current = null;
    }

    setConnectionState('connecting');

    try {
      // Dynamic import of PeerJS for SSR safety
      const { default: Peer } = await import('peerjs');
      const peerOptions = getPeerJSOptions();

      console.log(`[WebRTC Admin] Initializing Peer with ID: ${peerId}`);
      const peer = new Peer(peerId, peerOptions);
      peerRef.current = peer;

      peer.on('open', (id) => {
        console.log('[WebRTC Admin] Peer connected with ID:', id);
        setAdminPeerId(id);
        setConnectionState('waiting-for-call');
        retryCountRef.current = 0; // Reset retry counter on successful open
      });

      peer.on('call', (incomingCall: MediaConnection) => {
        console.log('[WebRTC Admin] Incoming call received from:', incomingCall.peer);

        if (callRef.current) {
          // تجاهل أي اتصال مكرر إذا كان البث قيد العمل
          console.log('[WebRTC Admin] Ignoring duplicate incoming call because an active call exists');
          return;
        }
        
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
            setConnectionState('waiting-for-call');
            if (onSessionTerminatedRef.current) {
              onSessionTerminatedRef.current();
            }
          }
        });

        incomingCall.on('error', (err) => {
          console.warn('[WebRTC Admin] Call error:', err);
        });
      });

      peer.on('error', (err: any) => {
        console.warn('[WebRTC Admin] Peer error:', err?.type, err?.message);
        if (err?.type === 'unavailable-id') {
          // Guard against infinite reconnect loop: max 3 retries with exponential backoff
          if (retryCountRef.current < 3) {
            retryCountRef.current += 1;
            const delay = retryCountRef.current * 2000;
            console.log(`[WebRTC Admin] Admin ID busy. Retry ${retryCountRef.current}/3 in ${delay}ms...`);
            if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = setTimeout(() => {
              if (!isCleanedUpRef.current && sessionId === activeSessionIdRef.current) {
                connectAdminPeer();
              }
            }, delay);
          } else {
            setError('Der Übertragungskanal ist derzeit belegt. Bitte klicken Sie auf "Erneut verbinden".');
            setConnectionState('error');
          }
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
  }, [sessionId]);

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
