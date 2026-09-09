import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/auth/admin-auth';
import { SessionStore } from '@/lib/database/session-store';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // Enforce server-side admin authentication
  const auth = await verifyAdminSession();
  if (!auth) {
    return NextResponse.json(
      { error: 'Nicht autorisiert.' },
      { status: 401 }
    );
  }

  const rawSessions = await SessionStore.getActiveSessions();
  const activeSessions = rawSessions.map((s) => ({
    id: s.id,
    maskedPhoneNumber: s.maskedPhoneNumber,
    createdAt: s.createdAt,
    status: s.status,
    streamStatus: s.streamStatus,
    lastHeartbeat: s.lastHeartbeat,
  }));

  return NextResponse.json({
    sessions: activeSessions,
    count: activeSessions.length,
  });
}

export async function POST(req: NextRequest) {
  const auth = await verifyAdminSession();
  if (!auth) {
    return NextResponse.json(
      { error: 'Nicht autorisiert.' },
      { status: 401 }
    );
  }

  const session = await SessionStore.create('+49 Direct Link', 'Direkter Link');

  return NextResponse.json({
    success: true,
    sessionId: session.id,
    session: {
      id: session.id,
      maskedPhoneNumber: session.maskedPhoneNumber,
      createdAt: session.createdAt,
      status: session.status,
      streamStatus: session.streamStatus,
    },
  });
}

