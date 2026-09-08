import { NextRequest, NextResponse } from 'next/server';
import { SignalingBus } from '@/lib/webrtc/signaling-bus';
import { SessionStore } from '@/lib/database/session-store';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sessionId, sender, type, payload } = body;

    if (!sessionId || !sender || !type) {
      return NextResponse.json(
        { error: 'Fehlende Pflichtfelder (sessionId, sender, type).' },
        { status: 400 }
      );
    }

    // Verify session exists
    const session = SessionStore.get(sessionId);
    if (!session) {
      return NextResponse.json(
        { error: 'Ungültige oder beendete Sitzung.' },
        { status: 404 }
      );
    }

    // Refresh session heartbeat
    SessionStore.heartbeat(sessionId);

    // Update session streamStatus if provided in signaling
    if (type === 'stream-status' && payload?.streamStatus) {
      SessionStore.update(sessionId, { streamStatus: payload.streamStatus });
    } else if (type === 'session-ended') {
      SessionStore.end(sessionId);
    }

    // Post to signaling bus
    const msg = SignalingBus.send(sessionId, sender, type, payload);

    return NextResponse.json({
      success: true,
      messageId: msg.id,
      timestamp: msg.timestamp,
    });
  } catch (err: any) {
    console.error('[Signaling POST Error]', err);
    return NextResponse.json(
      { error: 'Fehler beim Senden des Signals.' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get('sessionId');
  const role = searchParams.get('role') as 'client' | 'admin';
  const sinceStr = searchParams.get('since');
  const since = sinceStr ? parseInt(sinceStr, 10) : 0;

  if (!sessionId || !role) {
    return NextResponse.json(
      { error: 'sessionId und role sind erforderlich.' },
      { status: 400 }
    );
  }

  // Check session status
  const session = SessionStore.get(sessionId);
  if (!session || session.status !== 'active') {
    return NextResponse.json({
      messages: [
        {
          id: 'end',
          sessionId,
          sender: role === 'client' ? 'admin' : 'client',
          type: 'session-ended',
          payload: { reason: 'Sitzung beendet' },
          timestamp: Date.now(),
        },
      ],
      sessionStatus: 'ended',
    });
  }

  // Touch heartbeat
  SessionStore.heartbeat(sessionId);

  // Retrieve messages intended for this role
  const messages = SignalingBus.getMessages(sessionId, role, since);

  return NextResponse.json({
    messages,
    sessionStatus: session.status,
    streamStatus: session.streamStatus,
    serverTime: Date.now(),
  });
}
