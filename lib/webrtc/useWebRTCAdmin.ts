'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { getIceConfiguration } from '@/lib/webrtc/ice-config';

interface UseWebRTCAdminProps {
  sessionId: string | null;
  onSessionTerminated?: () => void;
}

export function useWebRTCAdmin({ sessionId, onSessionTerminated }: UseWebRTCAdminProps) {
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [connectionState, setConnectionState] = useState<string>('idle');
  const [error, setError] = useState<string | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isAnsweredRef = useRef<boolean>(false);
  const isCleanedUpRef = useRef<boolean>(false);
  const activeSessionIdRef = useRef<string | null>(null);
  const onSessionTerminatedRef = useRef(onSessionTerminated);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);

  // Keep callback ref updated without triggering re-connect
  useEffect(() => {
    onSessionTerminatedRef.current = onSessionTerminated;
  }, [onSessionTerminated]);

  const cleanup = useCallback(() => {
    isCleanedUpRef.current = true;
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    if (pcRef.current) {
      try {
        pcRef.current.close();
      } catch (_) {}
      pcRef.current = null;
    }
    setRemoteStream(null);
    setConnectionState('disconnected');
    isAnsweredRef.current = false;
    pendingCandidatesRef.current = [];
  }, []);

  useEffect(() => {
    // Skip if same session is already connected
    if (sessionId === activeSessionIdRef.current) return;

    // Cleanup previous connection
    cleanup();
    activeSessionIdRef.current = sessionId;

    if (!sessionId) {
      setConnectionState('idle');
      return;
    }

    isCleanedUpRef.current = false;
    setError(null);
    setConnectionState('connecting');
    pendingCandidatesRef.current = [];

    let latestTimestamp = 0;

    const pollForOffer = async () => {
      if (isCleanedUpRef.current || isAnsweredRef.current) return;

      try {
        const res = await fetch(
          `/api/signaling?sessionId=${sessionId}&role=admin&since=0`
        );
        if (!res.ok) return;

        const data = await res.json();

        if (data.sessionStatus === 'ended') {
          cleanup();
          activeSessionIdRef.current = null;
          if (onSessionTerminatedRef.current) onSessionTerminatedRef.current();
          return;
        }

        if (!data.messages || !Array.isArray(data.messages)) return;

        // Find the offer message from client
        const offerMsg = data.messages.find(
          (msg: any) => msg.type === 'offer' && msg.payload
        );

        if (!offerMsg || isAnsweredRef.current || isCleanedUpRef.current) return;

        // Found offer - stop polling for offer and establish connection
        isAnsweredRef.current = true;
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }

        // Create PeerConnection ONCE with configurable STUN + TURN
        const iceConfig = getIceConfiguration();
        const pc = new RTCPeerConnection(iceConfig);
        pcRef.current = pc;

        // Handle incoming remote video track
        pc.ontrack = (event) => {
          console.log('[WebRTC Admin] ontrack received:', event.track.kind, event.streams);
          let inboundStream: MediaStream | null = null;
          if (event.streams && event.streams[0]) {
            inboundStream = event.streams[0];
          } else if (event.track) {
            inboundStream = new MediaStream([event.track]);
          }
          if (inboundStream) {
            setRemoteStream(inboundStream);
            setConnectionState('connected');
          }
        };

        // Handle ICE candidates to send to client
        pc.onicecandidate = async (event) => {
          if (event.candidate && !isCleanedUpRef.current) {
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

        // Comprehensive WebRTC state logging
        pc.onsignalingstatechange = () => {
          console.log('[WebRTC Admin] signalingState:', pc.signalingState);
        };

        pc.onicegatheringstatechange = () => {
          console.log('[WebRTC Admin] iceGatheringState:', pc.iceGatheringState);
        };

        pc.oniceconnectionstatechange = () => {
          console.log('[WebRTC Admin] iceConnectionState:', pc.iceConnectionState);
          const iceState = pc.iceConnectionState;
          if (iceState === 'connected' || iceState === 'completed') {
            setConnectionState('connected');
          } else if (iceState === 'failed') {
            console.warn('[WebRTC Admin] ICE connection failed. A TURN server may be required for cross-network streaming.');
          }
        };

        pc.onconnectionstatechange = () => {
          console.log('[WebRTC Admin] connectionState:', pc.connectionState);
          const state = pc.connectionState;
          if (state === 'connected') {
            setConnectionState('connected');
          } else if (state === 'failed') {
            setConnectionState('failed');
            setError('Die Verbindung konnte nicht hergestellt werden. Bitte überprüfen Sie Ihre Netzwerkeinstellungen.');
            console.error('[WebRTC Admin] PeerConnection failed for session:', sessionId);
          } else if (state === 'disconnected') {
            setConnectionState('disconnected');
          }
        };

        // Set remote description (the offer from client)
        await pc.setRemoteDescription(new RTCSessionDescription(offerMsg.payload));

        // Add any existing ICE candidates that arrived with or before the offer
        const candidateMsgs = data.messages.filter(
          (msg: any) => msg.type === 'ice-candidate' && msg.payload
        );
        for (const candMsg of candidateMsgs) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(candMsg.payload));
          } catch (e) {
            console.warn('[WebRTC Admin] Early candidate error', e);
          }
        }

        // Apply any queued pending candidates
        if (pendingCandidatesRef.current.length > 0) {
          for (const cand of pendingCandidatesRef.current) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(cand));
            } catch (e) {
              console.warn('[WebRTC Admin] Pending candidate error', e);
            }
          }
          pendingCandidatesRef.current = [];
        }

        // Create and send answer
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

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

        // Track timestamp for incremental polling
        for (const msg of data.messages) {
          if (msg.timestamp > latestTimestamp) {
            latestTimestamp = msg.timestamp;
          }
        }

        // Start incremental polling for new ICE candidates only
        const pollIncremental = async () => {
          if (isCleanedUpRef.current || !pcRef.current) return;
          try {
            const incRes = await fetch(
              `/api/signaling?sessionId=${sessionId}&role=admin&since=${latestTimestamp}`
            );
            if (!incRes.ok) return;
            const incData = await incRes.json();

            if (incData.sessionStatus === 'ended') {
              cleanup();
              activeSessionIdRef.current = null;
              if (onSessionTerminatedRef.current) onSessionTerminatedRef.current();
              return;
            }

            if (incData.messages && Array.isArray(incData.messages)) {
              for (const msg of incData.messages) {
                if (msg.timestamp > latestTimestamp) {
                  latestTimestamp = msg.timestamp;
                }
                if (msg.type === 'ice-candidate' && msg.payload && pcRef.current) {
                  if (pcRef.current.remoteDescription) {
                    try {
                      await pcRef.current.addIceCandidate(new RTCIceCandidate(msg.payload));
                    } catch (e) {
                      console.warn('[WebRTC Admin] ICE add error', e);
                    }
                  } else {
                    pendingCandidatesRef.current.push(msg.payload);
                  }
                } else if (msg.type === 'session-ended') {
                  cleanup();
                  activeSessionIdRef.current = null;
                  if (onSessionTerminatedRef.current) onSessionTerminatedRef.current();
                  return;
                }
              }
            }
          } catch (e) {
            console.warn('[WebRTC Admin] Poll error', e);
          }
        };

        pollIntervalRef.current = setInterval(pollIncremental, 1000);
      } catch (err) {
        console.error('[WebRTC Admin Error]', err);
        setError('Die Verbindung konnte nicht hergestellt werden.');
        setConnectionState('failed');
      }
    };

    // Start polling for the offer
    pollForOffer();
    pollIntervalRef.current = setInterval(pollForOffer, 800);

    return () => {
      cleanup();
      activeSessionIdRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  return {
    remoteStream,
    connectionState,
    error,
    reconnect: () => {
      activeSessionIdRef.current = null;
      isAnsweredRef.current = false;
      cleanup();
      if (sessionId) {
        activeSessionIdRef.current = null;
        isCleanedUpRef.current = false;
        setError(null);
        setConnectionState('connecting');
      }
    },
    disconnect: cleanup,
  };
}
