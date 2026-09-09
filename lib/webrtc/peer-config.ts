import type { PeerOptions } from 'peerjs';

/**
 * Standard public Google STUN servers (always available worldwide for NAT discovery).
 */
export const defaultStunServers: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
];

/**
 * Parses and builds ICE (STUN + TURN Relay) servers from environment variables
 * or explicit provider configurations (Coturn, Twilio, Xirsys, Metered).
 */
export function getIceServers(): RTCIceServer[] {
  const servers: RTCIceServer[] = [...defaultStunServers];

  // Optional custom STUN server
  if (process.env.NEXT_PUBLIC_STUN_SERVER) {
    const customStuns = process.env.NEXT_PUBLIC_STUN_SERVER.split(',').map((s) => s.trim());
    for (const url of customStuns) {
      if (url && !servers.some((s) => s.urls === url)) {
        servers.unshift({ urls: url });
      }
    }
  }

  // Explicit TURN Server Configuration (Required for 4G/5G mobile & symmetric NAT traversal)
  const turnServerEnv = process.env.NEXT_PUBLIC_TURN_SERVER;
  const turnUsername = process.env.NEXT_PUBLIC_TURN_USERNAME || '';
  const turnCredential = process.env.NEXT_PUBLIC_TURN_CREDENTIAL || '';

  if (turnServerEnv && turnUsername && turnCredential) {
    const rawUrls = turnServerEnv.split(',').map((u) => u.trim()).filter(Boolean);
    const turnUrls: string[] = [];

    for (const raw of rawUrls) {
      if (raw.startsWith('turn:') || raw.startsWith('turns:')) {
        turnUrls.push(raw);
      } else {
        // If user entered host:port without turn: prefix (e.g. "my-turn.com:3478")
        turnUrls.push(`turn:${raw}?transport=udp`);
        turnUrls.push(`turn:${raw}?transport=tcp`);
        turnUrls.push(`turns:${raw}?transport=tcp`);
      }
    }

    servers.push({
      urls: turnUrls,
      username: turnUsername,
      credential: turnCredential,
    });
  }

  return servers;
}

/**
 * Builds PeerJS initialization options with explicit ICE (STUN + TURN) configuration.
 */
export function getPeerJSOptions(customIceServers?: RTCIceServer[]): PeerOptions {
  const activeIceServers = customIceServers && customIceServers.length > 0
    ? customIceServers
    : getIceServers();

  return {
    debug: 1,
    config: {
      iceServers: activeIceServers,
      iceCandidatePoolSize: 10,
      iceTransportPolicy: 'all', // 'all' allows direct STUN P2P and TURN Relay
    },
  };
}

/**
 * Asynchronously retrieves the best ICE servers (checking /api/webrtc/ice for dynamic
 * ephemeral TURN tokens like Twilio/Metered, with instant fallback to static/env config).
 */
export async function getPeerJSOptionsAsync(): Promise<PeerOptions> {
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch('/api/webrtc/ice', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data.iceServers && Array.isArray(data.iceServers) && data.iceServers.length > 0) {
          console.log(`[PeerJS Config] Using dynamic TURN credentials (source: ${data.source})`);
          // Combine Google STUN with dynamic TURN servers
          const mergedServers = [...defaultStunServers, ...data.iceServers];
          return getPeerJSOptions(mergedServers);
        }
      }
    } catch (err) {
      console.warn('[PeerJS Config] Could not fetch dynamic ICE servers, using env fallback:', err);
    }
  }

  return getPeerJSOptions();
}

/**
 * Deterministic Admin Peer ID.
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
