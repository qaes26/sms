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

  // Rule 2: Store Peer, Stream, and Active Call in useRef (instead of useState)
  // to prevent connection destruction when component re-renders.
  const peerRef = useRef<any>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const activeCallRef = useRef<MediaConnection | null>(null);

  const isUnmountedRef = useRef<boolean>(false);
  const activeSessionIdRef = useRef<string | null>(null);
  const onSessionTerminatedRef = useRef(onSessionTerminated);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef<number>(0);

  useEffect(() => {
    onSessionTerminatedRef.current = onSessionTerminated;
  }, [onSessionTerminated]);

  // Disconnect ongoing call without destroying the Peer instance
  const disconnectCall = useCallback(() => {
    if (activeCallRef.current) {
      try {
        activeCallRef.current.close();
      } catch (e) {
        console.warn('[WebRTC Admin] Error closing call:', e);
      }
      activeCallRef.current = null;
    }

    remoteStreamRef.current = null;
    setRemoteStream(null);
    setConnectionState('disconnected');
    setError(null);
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

    const peerId = getAdminPeerId(sessionId);

    // If already connected to the same peer ID, don't recreate
    if (peerRef.current && !peerRef.current.destroyed && activeSessionIdRef.current === sessionId) {
      console.log(`[WebRTC Admin] Peer already active for ID: ${peerId}`);
      return;
    }

    // If switching to another session ID, close previous call and peer first
    if (peerRef.current && activeSessionIdRef.current !== sessionId) {
      try {
        if (activeCallRef.current) {
          activeCallRef.current.close();
          activeCallRef.current = null;
        }
        peerRef.current.destroy();
      } catch (_) {}
      peerRef.current = null;
    }

    activeSessionIdRef.current = sessionId;
    setError(null);
    setConnectionState('connecting');

    try {
      const { default: Peer } = await import('peerjs');
      const peerOptions = getPeerJSOptions();

      console.log(`[WebRTC Admin] Initializing Peer with ID: ${peerId}`);
      const peer = new Peer(peerId, peerOptions);
      peerRef.current = peer;

      peer.on('open', (id) => {
        if (isUnmountedRef.current) return;
        console.log('[WebRTC Admin] Peer connected with ID:', id);
        setAdminPeerId(id);
        setConnectionState('waiting-for-call');
        retryCountRef.current = 0;
      });

      // Rule 5: If an incoming call arrives and there is an existing active call,
      // gracefully close the old one and accept the new one without crashing the UI.
      peer.on('call', (incomingCall: MediaConnection) => {
        if (isUnmountedRef.current) return;
        console.log('[WebRTC Admin] Incoming call received from:', incomingCall.peer);

        if (activeCallRef.current) {
          console.log('[WebRTC Admin] Gracefully closing existing active call');
          try {
            activeCallRef.current.close();
          } catch (err) {
            console.warn('[WebRTC Admin] Error closing old call:', err);
          }
          activeCallRef.current = null;
        }

        activeCallRef.current = incomingCall;
        setConnectionState('call-received');

        // Answer without sending local stream
        incomingCall.answer();

        // Attach incoming stream to ref and state
        incomingCall.on('stream', (stream: MediaStream) => {
          if (isUnmountedRef.current) return;
          console.log('[WebRTC Admin] Remote MediaStream attached with tracks:', stream.getTracks().length);
          remoteStreamRef.current = stream;
          setRemoteStream(stream);
          setConnectionState('connected');
          setError(null);
        });

        incomingCall.on('close', () => {
          console.log('[WebRTC Admin] MediaConnection closed');
          if (activeCallRef.current === incomingCall) {
            activeCallRef.current = null;
            remoteStreamRef.current = null;
            if (!isUnmountedRef.current) {
              setRemoteStream(null);
              setConnectionState('waiting-for-call');
              if (onSessionTerminatedRef.current) {
                onSessionTerminatedRef.current();
              }
            }
          }
        });

        incomingCall.on('error', (err) => {
          console.warn('[WebRTC Admin] MediaConnection error:', err);
          if (activeCallRef.current === incomingCall) {
            activeCallRef.current = null;
            remoteStreamRef.current = null;
            if (!isUnmountedRef.current) {
              setRemoteStream(null);
              setConnectionState('failed');
              setError('Verbindungsfehler während der Übertragung.');
            }
          }
        });
      });

      // Rule 5: Error handling & graceful state updates
      peer.on('error', (err: any) => {
        if (isUnmountedRef.current) return;
        console.warn('[WebRTC Admin] Peer error:', err?.type, err?.message);

        if (err?.type === 'unavailable-id') {
          if (retryCountRef.current < 3) {
            retryCountRef.current += 1;
            const delay = retryCountRef.current * 2000;
            console.log(`[WebRTC Admin] Admin ID busy. Retry ${retryCountRef.current}/3 in ${delay}ms...`);
            if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = setTimeout(() => {
              if (!isUnmountedRef.current && sessionId === activeSessionIdRef.current) {
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

      // Rule 5: Disconnection handling
      peer.on('disconnected', () => {
        if (isUnmountedRef.current) return;
        console.log('[WebRTC Admin] Disconnected from signaling server.');
        setConnectionState('disconnected');
        if (peerRef.current && !peer.destroyed) {
          peer.reconnect();
        }
      });

      peer.on('close', () => {
        console.log('[WebRTC Admin] Peer closed');
        if (!isUnmountedRef.current) {
          setConnectionState('disconnected');
        }
      });
    } catch (err: any) {
      console.error('[WebRTC Admin Init Error]', err);
      if (!isUnmountedRef.current) {
        setError('Fehler bei der Initialisierung von PeerJS.');
        setConnectionState('error');
      }
    }
  }, [sessionId]);

  // Connect whenever sessionId changes
  useEffect(() => {
    isUnmountedRef.current = false;
    connectAdminPeer();

    return () => {
      // Rule 2: Do NOT destroy peer here just because of re-render.
      // Simply close active call if sessionId changes.
      if (activeCallRef.current) {
        try {
          activeCallRef.current.close();
        } catch (_) {}
        activeCallRef.current = null;
      }
    };
  }, [sessionId, connectAdminPeer]);

  // Rule 2: Destroy Peer ONLY on actual component unmount
  useEffect(() => {
    return () => {
      isUnmountedRef.current = true;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (activeCallRef.current) {
        try {
          activeCallRef.current.close();
        } catch (_) {}
        activeCallRef.current = null;
      }
      if (peerRef.current) {
        try {
          peerRef.current.destroy();
        } catch (_) {}
        peerRef.current = null;
      }
      remoteStreamRef.current = null;
    };
  }, []);

  return {
    remoteStream,
    connectionState,
    error,
    adminPeerId,
    reconnect: connectAdminPeer,
    disconnect: disconnectCall,
  };
}
