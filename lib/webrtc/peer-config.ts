import type { PeerOptions } from 'peerjs';

/**
 * WebRTC ICE Server Configuration.
 * Configured with Google public STUN servers for NAT traversal across Wi-Fi and 4G networks.
 */
export const PEER_ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
];

/**
 * Builds PeerJS initialization options using free PeerJS Cloud signaling
 * and Google STUN servers.
 */
export function getPeerJSOptions(): PeerOptions {
  const iceServers: RTCIceServer[] = [...PEER_ICE_SERVERS];

  // Optional TURN server from environment variables for symmetric NAT traversal
  const turnServerUrl = process.env.NEXT_PUBLIC_TURN_SERVER;
  const turnUsername = process.env.NEXT_PUBLIC_TURN_USERNAME;
  const turnCredential = process.env.NEXT_PUBLIC_TURN_CREDENTIAL;

  if (turnServerUrl) {
    const turnConfig: RTCIceServer = {
      urls: turnServerUrl.split(',').map((url) => url.trim()),
    };
    if (turnUsername) turnConfig.username = turnUsername;
    if (turnCredential) turnConfig.credential = turnCredential;
    iceServers.push(turnConfig);
  } else {
    // OpenRelay backup for restricted cellular networks
    iceServers.push({
      urls: [
        'turn:openrelay.metered.ca:80',
        'turn:openrelay.metered.ca:443',
        'turn:openrelay.metered.ca:443?transport=tcp',
      ],
      username: 'openrelayproject',
      credential: 'openrelayproject',
    });
  }

  return {
    debug: 1,
    config: {
      iceServers,
      iceCandidatePoolSize: 10,
    },
  };
}

/**
 * Deterministic or fixed Admin Peer ID.
 */
export function getAdminPeerId(sessionId?: string | null): string {
  if (process.env.NEXT_PUBLIC_ADMIN_PEER_ID) {
    return process.env.NEXT_PUBLIC_ADMIN_PEER_ID;
  }
  return sessionId ? `sms-admin-${sessionId}` : 'sms-admin-default';
}

/**
 * Deterministic Client Peer ID.
 */
export function getClientPeerId(sessionId?: string | null): string {
  return sessionId
    ? `sms-client-${sessionId}`
    : `sms-client-${Math.random().toString(36).substring(2, 9)}`;
}
