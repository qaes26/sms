'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { MediaConnection } from 'peerjs';
import { getPeerJSOptions, getAdminPeerId, getClientPeerId } from '@/lib/webrtc/peer-config';

interface UseWebRTCClientProps {
  sessionId: string | null;
  onSessionEnded?: () => void;
}

export function useWebRTCClient({ sessionId, onSessionEnded }: UseWebRTCClientProps) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [connectionState, setConnectionState] = useState<string>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [isAudioMuted, setIsAudioMuted] = useState<boolean>(false);
  const [isVideoMuted, setIsVideoMuted] = useState<boolean>(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [peerId, setPeerId] = useState<string | null>(null);

  const peerRef = useRef<any>(null);
  const callRef = useRef<MediaConnection | null>(null);
  const hasCalledRef = useRef<boolean>(false);
  const localStreamRef = useRef<MediaStream | null>(null);
  const facingModeRef = useRef<'user' | 'environment'>('user');
  const isTerminatedRef = useRef<boolean>(false);
  const isConnectedRef = useRef<boolean>(false);
  const retryCallTimerRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Stop all camera/microphone tracks and WebRTC PeerJS connections
  const stopStream = useCallback(async () => {
    isTerminatedRef.current = true;
    isConnectedRef.current = false;

    if (retryCallTimerRef.current) {
      clearInterval(retryCallTimerRef.current);
      retryCallTimerRef.current = null;
    }

    if (heartbeatTimerRef.current) {
      clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }

    // Close PeerJS active media call
    if (callRef.current) {
      try {
        callRef.current.close();
      } catch (e) {
        console.warn('[WebRTC Client] Call close error', e);
      }
      callRef.current = null;
    }

    // Destroy Peer instance
    if (peerRef.current) {
      try {
        peerRef.current.destroy();
      } catch (e) {
        console.warn('[WebRTC Client] Peer destroy error', e);
      }
      peerRef.current = null;
    }

    // Stop every local media track (camera + mic)
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (e) {
          console.warn('[WebRTC Client] Track stop error', e);
        }
      });
      localStreamRef.current = null;
      setLocalStream(null);
    }

    setIsStreaming(false);
    setConnectionState('stopped');

    // Notify backend that session is ended
    if (sessionId) {
      try {
        await fetch(`/api/sessions/${sessionId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ streamStatus: 'stopped', status: 'ended' }),
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

  // Toggle Microphone mute
  const toggleAudioMute = useCallback(() => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      const newMutedState = !isAudioMuted;
      audioTracks.forEach((track) => {
        track.enabled = !newMutedState;
      });
      setIsAudioMuted(newMutedState);
    }
  }, [isAudioMuted]);

  // Toggle Camera video mute
  const toggleVideoMute = useCallback(() => {
    if (localStreamRef.current) {
      const videoTracks = localStreamRef.current.getVideoTracks();
      const newMutedState = !isVideoMuted;
      videoTracks.forEach((track) => {
        track.enabled = !newMutedState;
      });
      setIsVideoMuted(newMutedState);
    }
  }, [isVideoMuted]);

  // Flip Camera (Front <-> Back on mobile)
  const flipCamera = useCallback(async () => {
    const nextMode: 'user' | 'environment' =
      facingModeRef.current === 'user' ? 'environment' : 'user';

    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: nextMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      const newVideoTrack = newStream.getVideoTracks()[0];
      if (!newVideoTrack || !localStreamRef.current) return;

      // Stop old video track
      const oldVideoTrack = localStreamRef.current.getVideoTracks()[0];
      if (oldVideoTrack) {
        oldVideoTrack.stop();
        localStreamRef.current.removeTrack(oldVideoTrack);
      }

      // Preserve current mute state on new track
      newVideoTrack.enabled = !isVideoMuted;
      localStreamRef.current.addTrack(newVideoTrack);

      // Seamlessly replace track on the ongoing WebRTC peer connection
      if (callRef.current?.peerConnection) {
        const senders = callRef.current.peerConnection.getSenders();
        const videoSender = senders.find((s) => s.track?.kind === 'video');
        if (videoSender) {
          await videoSender.replaceTrack(newVideoTrack);
        }
      }

      facingModeRef.current = nextMode;
      setFacingMode(nextMode);

      // Trigger re-render of local preview
      setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
    } catch (err) {
      console.warn('[WebRTC Client] Camera flip failed:', err);
    }
  }, [isVideoMuted]);

  // Request camera and microphone access, initialize PeerJS and call Admin
  const startStream = useCallback(async () => {
    if (!sessionId) {
      setErrorMessage('Keine gültige Sitzung gefunden.');
      return false;
    }

    try {
      setErrorMessage(null);
      setConnectionState('requesting-permission');
      isTerminatedRef.current = false;
      isConnectedRef.current = false;

      // 1. Request user media (audio + video with mobile-friendly constraints)
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingModeRef.current },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: true,
      });

      localStreamRef.current = stream;
      setLocalStream(stream);
      setIsStreaming(true);
      setConnectionState('connecting');

      // 2. Dynamically import PeerJS (safe against SSR in Next.js)
      const { default: Peer } = await import('peerjs');

      const clientPeerId = getClientPeerId(sessionId);
      const adminPeerId = getAdminPeerId(sessionId);
      const peerOptions = getPeerJSOptions();

      console.log(`[WebRTC Client] Connecting PeerJS Cloud with ID: ${clientPeerId}`);
      const peer = new Peer(clientPeerId, peerOptions);
      peerRef.current = peer;

      // Function to initiate or retry calling Admin
      const makeCall = () => {
        if (hasCalledRef.current || isTerminatedRef.current || isConnectedRef.current || !peerRef.current || peer.destroyed) {
          return;
        }

        // Clean up previous call attempt if not connected yet
        if (callRef.current) {
          try {
            callRef.current.close();
          } catch (_) {}
          callRef.current = null;
        }

        hasCalledRef.current = true;
        console.log(`[WebRTC Client] Calling Admin peer: ${adminPeerId}`);
        const call = peer.call(adminPeerId, stream);
        if (!call) return;
        callRef.current = call;

        // Monitor the underlying RTCPeerConnection for connection state
        if (call.peerConnection) {
          call.peerConnection.onconnectionstatechange = () => {
            const state = call.peerConnection.connectionState;
            console.log('[WebRTC Client] PC connectionState:', state);
            if (state === 'connected') {
              isConnectedRef.current = true;
              setConnectionState('connected');
              if (retryCallTimerRef.current) {
                clearInterval(retryCallTimerRef.current);
                retryCallTimerRef.current = null;
              }
            } else if (state === 'disconnected') {
              setConnectionState('disconnected');
            } else if (state === 'failed') {
              setConnectionState('failed');
            }
          };

          call.peerConnection.oniceconnectionstatechange = () => {
            const ice = call.peerConnection.iceConnectionState;
            console.log('[WebRTC Client] PC iceConnectionState:', ice);
            if (ice === 'connected' || ice === 'completed') {
              isConnectedRef.current = true;
              setConnectionState('connected');
              if (retryCallTimerRef.current) {
                clearInterval(retryCallTimerRef.current);
                retryCallTimerRef.current = null;
              }
            }
          };
        }

        call.on('close', () => {
          console.log('[WebRTC Client] MediaConnection closed');
          if (!isTerminatedRef.current) {
            setConnectionState('disconnected');
          }
        });

        call.on('error', (err) => {
          console.warn('[WebRTC Client] MediaConnection error:', err);
        });
      };

      peer.on('open', (id) => {
        console.log('[WebRTC Client] PeerJS connected with ID:', id);
        setPeerId(id);
        setConnectionState('waiting-admin');

        // Immediately attempt initial call
        makeCall();

        // Retry calling if admin dashboard opens a few seconds later
        if (retryCallTimerRef.current) {
          clearInterval(retryCallTimerRef.current);
        }
        retryCallTimerRef.current = setInterval(() => {
          if (!isConnectedRef.current && !isTerminatedRef.current) {
            console.log('[WebRTC Client] Retrying call to Admin...');
            makeCall();
          } else if (retryCallTimerRef.current) {
            clearInterval(retryCallTimerRef.current);
            retryCallTimerRef.current = null;
          }
        }, 2500);
      });

      peer.on('error', (err: any) => {
        console.warn('[WebRTC Client] Peer error:', err?.type, err?.message);
        if (err?.type === 'peer-unavailable') {
          // Admin peer is not yet connected to PeerJS Cloud.
          // Keep state at waiting-admin and let the retry interval call again.
          setConnectionState('waiting-admin');
        } else if (err?.type === 'unavailable-id') {
          // ID already registered, recreate
          console.warn('[WebRTC Client] Client Peer ID unavailable');
        } else {
          setErrorMessage('Verbindungsfehler: ' + (err?.message || 'Signalfehler'));
        }
      });

      peer.on('disconnected', () => {
        console.log('[WebRTC Client] PeerJS disconnected from signaling server. Reconnecting...');
        if (!isTerminatedRef.current && peerRef.current && !peer.destroyed) {
          peer.reconnect();
        }
      });

      peer.on('close', () => {
        console.log('[WebRTC Client] Peer destroyed');
        if (!isTerminatedRef.current) {
          setConnectionState('disconnected');
        }
      });

      // 3. Inform backend that streaming has started
      try {
        await fetch(`/api/sessions/${sessionId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ streamStatus: 'streaming', heartbeat: true }),
        });
      } catch (_) {}

      // 4. Start periodic heartbeat to keep session active in backend
      heartbeatTimerRef.current = setInterval(() => {
        if (!isTerminatedRef.current && sessionId) {
          fetch(`/api/sessions/${sessionId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ heartbeat: true }),
          }).catch(() => {});
        }
      }, 10000);

      return true;
    } catch (err: any) {
      console.error('[WebRTC Client Error]', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setErrorMessage(
          'Der Zugriff auf Kamera und Mikrofon wurde abgelehnt. Bitte erlauben Sie den Zugriff in Ihren Browsereinstellungen, um fortzufahren.'
        );
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setErrorMessage('Keine Kamera oder kein Mikrofon auf Ihrem Gerät gefunden.');
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        setErrorMessage(
          'Die Kamera oder das Mikrofon wird bereits von einer anderen Anwendung verwendet.'
        );
      } else {
        setErrorMessage(
          'Der Kamerazugriff ist derzeit nicht verfügbar (' + (err.message || 'Fehler') + ').'
        );
      }
      setConnectionState('error');
      return false;
    }
  }, [sessionId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (retryCallTimerRef.current) {
        clearInterval(retryCallTimerRef.current);
      }
      if (heartbeatTimerRef.current) {
        clearInterval(heartbeatTimerRef.current);
      }
      if (callRef.current) {
        try {
          callRef.current.close();
        } catch (_) {}
      }
      if (peerRef.current) {
        try {
          peerRef.current.destroy();
        } catch (_) {}
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  return {
    localStream,
    connectionState,
    errorMessage,
    isStreaming,
    isAudioMuted,
    isVideoMuted,
    facingMode,
    peerId,
    startStream,
    stopStream,
    toggleAudioMute,
    toggleVideoMute,
    flipCamera,
  };
}
