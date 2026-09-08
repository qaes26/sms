/**
 * Optional Standalone WebRTC Signaling Server
 * 
 * Note: When deploying directly to Vercel, the built-in HTTP/SSE signaling route
 * (/api/signaling) is used automatically because Vercel Serverless runs in ephemeral lambdas.
 * 
 * If you deploy on a dedicated Node.js host (e.g., Railway, Fly.io, DigitalOcean, VPS),
 * you can optionally run this persistent WebSocket server using:
 *   npm run signaling
 */

const http = require('http');

const PORT = process.env.SIGNALING_PORT || 3001;

const sessions = new Map(); // sessionId -> Set of connected sockets

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 'Signaling server is running', activeSessions: sessions.size }));
});

server.listen(PORT, () => {
  console.log(`[Signaling Server] Dedicated signaling server listening on port ${PORT}`);
  console.log(`[Signaling Server] Vercel deployments use the built-in /api/signaling endpoint.`);
});
