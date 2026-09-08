/**
 * Centralized WebRTC ICE Configuration supporting STUN and TURN servers.
 * Configurable via environment variables without hard-coding private credentials.
 */

export function getIceConfiguration(): RTCConfiguration {
  const stunUrls: string[] = [
    process.env.NEXT_PUBLIC_STUN_SERVER || 'stun:stun.l.google.com:19302',
    'stun:stun1.l.google.com:19302',
    'stun:stun2.l.google.com:19302',
  ].filter(Boolean);

  const iceServers: RTCIceServer[] = [
    {
      urls: stunUrls,
    },
  ];

  // Configurable TURN server for symmetric NAT traversal across cellular/WiFi networks
  const turnServerUrl = process.env.NEXT_PUBLIC_TURN_SERVER;
  const turnUsername = process.env.NEXT_PUBLIC_TURN_USERNAME;
  const turnCredential = process.env.NEXT_PUBLIC_TURN_CREDENTIAL;

  if (turnServerUrl) {
    const turnConfig: RTCIceServer = {
      urls: turnServerUrl.split(',').map((url) => url.trim()),
    };

    if (turnUsername) {
      turnConfig.username = turnUsername;
    }

    if (turnCredential) {
      turnConfig.credential = turnCredential;
    }

    iceServers.push(turnConfig);
  } else {
    // Production-ready public TURN relay servers (OpenRelay / Metered)
    // Enables WebRTC peer connections across cellular 4G/5G networks and symmetric NATs
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
    iceServers,
    iceCandidatePoolSize: 10,
  };
}
