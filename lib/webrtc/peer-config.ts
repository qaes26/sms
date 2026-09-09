import type { PeerOptions } from 'peerjs';

export const iceServers: RTCIceServer[] = [
  {
    urls: 'stun:stun.relay.metered.ca:80',
  },
  {
    urls: 'turn:global.relay.metered.ca:80',
    username: '78d387946f097b066e309eed',
    credential: 'RwVC3eS9k3PB654i',
  },
  {
    urls: 'turn:global.relay.metered.ca:80?transport=tcp',
    username: '78d387946f097b066e309eed',
    credential: 'RwVC3eS9k3PB654i',
  },
  {
    urls: 'turn:global.relay.metered.ca:443',
    username: '78d387946f097b066e309eed',
    credential: 'RwVC3eS9k3PB654i',
  },
  {
    urls: 'turns:global.relay.metered.ca:443?transport=tcp',
    username: '78d387946f097b066e309eed',
    credential: 'RwVC3eS9k3PB654i',
  },
];

/**
 * Builds PeerJS initialization options using free PeerJS Cloud signaling
 */
export function getPeerJSOptions(): PeerOptions {
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
