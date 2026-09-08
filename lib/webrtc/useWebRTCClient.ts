'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { getIceConfiguration } from '@/lib/webrtc/ice-config';

interface UseWebRTCClientProps {
  sessionId: string | null;
  onSessionEnded?: () => void;
}

export function useWebRTCClient({ sessionId, onSessionEnded }: UseWebRTCClientProps) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [connectionState, setConnectionState] = useState<string>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState<boolean>(false);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const lastMessageTimestamp = useRef<number>(0);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isTerminatedRef = useRef<boolean>(false);

  // Stop all camera tracks and WebRTC connections
  const stopStream = useCallback(async () => {
    isTerminatedRef.current = true;

    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }

    // Stop every media track
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (e) {
          console.warn('[Track stop error]', e);
        }
      });
      localStreamRef.current = null;
      setLocalStream(null);
    }

    // Close peer connection
    if (pcRef.current) {
      try {
        pcRef.current.close();
      } catch (e) {
        console.warn('[PC close error]', e);
      }
      pcRef.current = null;
    }

    setIsStreaming(false);
    setConnectionState('stopped');

    // Inform signaling bus and terminate session in database
    if (sessionId) {
      try {
        await fetch('/api/signaling', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            sender: 'client',
            type: 'session-ended',
            payload: { reason: 'Kamerafreigabe durch Benutzer beendet' },
          }),
        });
      } catch (_) {}

      try {
        await fetch(`/api/sessions/${sessionId}`, { method: 'DELETE' });
      } catch (_) {}
    }

    if (onSessionEnded) {
      onSessionEnded();
    }
  }, [sessionId, onSessionEnded]);

  // Handle page leave / tab close
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (sessionId && isStreaming) {
        // Send keepalive request to end session
        navigator.sendBeacon(`/api/sessions/${sessionId}`);
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [sessionId, isStreaming]);

  // Request camera access and start WebRTC stream
  const startStream = useCallback(async () => {
    if (!sessionId) {
      setErrorMessage('Keine gültige Sitzung gefunden.');
      return false;
    }

    try {
      setErrorMessage(null);
      setConnectionState('requesting-permission');

      // Request camera with mobile-friendly constraints
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      localStreamRef.current = stream;
      setLocalStream(stream);
      setIsStreaming(true);
      setConnectionState('creating-connection');

      // Create RTCPeerConnection with STUN + TURN config
      const iceConfig = getIceConfiguration();
      const pc = new RTCPeerConnection(iceConfig);
      pcRef.current = pc;

      // Add local video tracks to peer connection
      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      // Handle ICE candidates
      pc.onicecandidate = async (event) => {
        if (event.candidate && !isTerminatedRef.current) {
          try {
            await fetch('/api/signaling', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                sessionId,
                sender: 'client',
                type: 'ice-candidate',
                payload: event.candidate.toJSON(),
              }),
            });
          } catch (e) {
            console.warn('[WebRTC Client] ICE candidate send error', e);
          }
        }
      };

      pc.onconnectionstatechange = () => {
        if (!pcRef.current) return;
        const state = pcRef.current.connectionState;
        if (state === 'connected') {
          setConnectionState('connected');
        } else if (state === 'failed') {
          setConnectionState('failed');
          setErrorMessage('Die Verbindung konnte nicht hergestellt werden.');
        } else if (state === 'disconnected') {
          setConnectionState('disconnected');
        }
      };

      pc.oniceconnectionstatechange = () => {
        if (!pcRef.current) return;
        const ice = pcRef.current.iceConnectionState;
        if (ice === 'connected' || ice === 'completed') {
          setConnectionState('connected');
        }
      };

      // Create offer
      const offer = await pc.createOffer({
        offerToReceiveVideo: false,
        offerToReceiveAudio: false,
      });
      await pc.setLocalDescription(offer);

      // Send offer to signaling bus
      await fetch('/api/signaling', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          sender: 'client',
          type: 'offer',
          payload: {
            type: offer.type,
            sdp: offer.sdp,
          },
        }),
      });

      // Notify signaling of stream status
      await fetch('/api/signaling', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          sender: 'client',
          type: 'stream-status',
          payload: { streamStatus: 'streaming' },
        }),
      });

      setConnectionState('waiting-admin');

      // Start polling for signaling responses (answers, candidates, termination)
      lastMessageTimestamp.current = 0;
      isTerminatedRef.current = false;

      const pollSignaling = async () => {
        if (isTerminatedRef.current || !pcRef.current) return;

        try {
          const res = await fetch(
            `/api/signaling?sessionId=${sessionId}&role=client&since=${lastMessageTimestamp.current}`
          );
          if (!res.ok) return;

          const data = await res.json();
          if (data.sessionStatus === 'ended') {
            stopStream();
            return;
          }

          if (data.messages && Array.isArray(data.messages)) {
            for (const msg of data.messages) {
              if (msg.timestamp > lastMessageTimestamp.current) {
                lastMessageTimestamp.current = msg.timestamp;
              }

              if (msg.type === 'answer' && pcRef.current && pcRef.current.signalingState !== 'stable') {
                const answerDesc = new RTCSessionDescription(msg.payload);
                await pcRef.current.setRemoteDescription(answerDesc);
                setConnectionState('connected');
              } else if (msg.type === 'ice-candidate' && msg.payload && pcRef.current) {
                try {
                  await pcRef.current.addIceCandidate(new RTCIceCandidate(msg.payload));
                } catch (iceErr) {
                  console.warn('[WebRTC Client] Could not add ICE candidate', iceErr);
                }
              } else if (msg.type === 'session-ended') {
                stopStream();
                return;
              }
            }
          }
        } catch (pollErr) {
          console.warn('[WebRTC Client] Signaling poll error', pollErr);
        }
      };

      pollIntervalRef.current = setInterval(pollSignaling, 1200);
      return true;
    } catch (err: any) {
      console.error('[WebRTC Client Error]', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setErrorMessage(
          'Der Zugriff auf die Kamera wurde abgelehnt. Bitte erlauben Sie den Kamerazugriff in Ihren Browsereinstellungen, wenn Sie fortfahren möchten.'
        );
      } else {
        setErrorMessage('Der Kamerazugriff ist derzeit nicht verfügbar.');
      }
      setConnectionState('error');
      return false;
    }
  }, [sessionId, stopStream]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (pcRef.current) {
        pcRef.current.close();
      }
    };
  }, []);

  return {
    localStream,
    connectionState,
    errorMessage,
    isStreaming,
    startStream,
    stopStream,
  };
}
