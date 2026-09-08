'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

interface UseWebRTCAdminProps {
  sessionId: string | null;
  onSessionTerminated?: () => void;
}

export function useWebRTCAdmin({ sessionId, onSessionTerminated }: UseWebRTCAdminProps) {
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [connectionState, setConnectionState] = useState<string>('idle');
  const [error, setError] = useState<string | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const lastMessageTimestamp = useRef<number>(0);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isAnsweredRef = useRef<boolean>(false);

  const cleanup = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    setRemoteStream(null);
    setConnectionState('disconnected');
    isAnsweredRef.current = false;
  }, []);

  const connectToSession = useCallback(async () => {
    if (!sessionId) return;

    cleanup();
    setError(null);
    setConnectionState('connecting');

    try {
      const pc = new RTCPeerConnection(ICE_SERVERS);
      pcRef.current = pc;

      // Handle incoming remote video track from user
      pc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          setRemoteStream(event.streams[0]);
          setConnectionState('connected');
        }
      };

      // Handle ICE candidates to send back to client
      pc.onicecandidate = async (event) => {
        if (event.candidate && pcRef.current) {
          try {
            await fetch('/api/signaling', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                sessionId,
                sender: 'admin',
                type: 'ice-candidate',
                payload: event.candidate.toJSON(),
              }),
            });
          } catch (e) {
            console.warn('[WebRTC Admin] Candidate send error', e);
          }
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'connected') {
          setConnectionState('connected');
        } else if (pc.connectionState === 'failed') {
          setConnectionState('failed');
          setError('Die Verbindung konnte nicht hergestellt werden.');
        } else if (pc.connectionState === 'disconnected') {
          setConnectionState('disconnected');
        }
      };

      // Poll signaling server for client offer and candidates
      lastMessageTimestamp.current = 0; // fetch existing offer

      const pollSignaling = async () => {
        if (!pcRef.current) return;

        try {
          const res = await fetch(
            `/api/signaling?sessionId=${sessionId}&role=admin&since=${lastMessageTimestamp.current}`
          );
          if (!res.ok) return;

          const data = await res.json();

          if (data.sessionStatus === 'ended') {
            cleanup();
            if (onSessionTerminated) onSessionTerminated();
            return;
          }

          if (data.messages && Array.isArray(data.messages)) {
            for (const msg of data.messages) {
              if (msg.timestamp > lastMessageTimestamp.current) {
                lastMessageTimestamp.current = msg.timestamp;
              }

              // Client sent offer: admin answers
              if (msg.type === 'offer' && !isAnsweredRef.current && pcRef.current) {
                isAnsweredRef.current = true;
                const offerDesc = new RTCSessionDescription(msg.payload);
                await pcRef.current.setRemoteDescription(offerDesc);

                const answer = await pcRef.current.createAnswer();
                await pcRef.current.setLocalDescription(answer);

                await fetch('/api/signaling', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    sessionId,
                    sender: 'admin',
                    type: 'answer',
                    payload: {
                      type: answer.type,
                      sdp: answer.sdp,
                    },
                  }),
                });
              } else if (msg.type === 'ice-candidate' && msg.payload && pcRef.current) {
                try {
                  await pcRef.current.addIceCandidate(new RTCIceCandidate(msg.payload));
                } catch (candidateErr) {
                  console.warn('[WebRTC Admin] Could not add candidate', candidateErr);
                }
              } else if (msg.type === 'session-ended') {
                cleanup();
                if (onSessionTerminated) onSessionTerminated();
                return;
              }
            }
          }
        } catch (pollErr) {
          console.warn('[WebRTC Admin] Signaling poll error', pollErr);
        }
      };

      // Initial check & interval
      await pollSignaling();
      pollIntervalRef.current = setInterval(pollSignaling, 1200);
    } catch (err: any) {
      console.error('[WebRTC Admin Error]', err);
      setError('Die Verbindung konnte nicht hergestellt werden.');
      setConnectionState('failed');
    }
  }, [sessionId, cleanup, onSessionTerminated]);

  useEffect(() => {
    if (sessionId) {
      connectToSession();
    } else {
      cleanup();
    }

    return () => {
      cleanup();
    };
  }, [sessionId, connectToSession, cleanup]);

  return {
    remoteStream,
    connectionState,
    error,
    reconnect: connectToSession,
    disconnect: cleanup,
  };
}
