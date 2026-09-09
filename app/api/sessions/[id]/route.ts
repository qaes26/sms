import { NextRequest, NextResponse } from 'next/server';
import { SessionStore } from '@/lib/database/session-store';

interface Params {
  params: {
    id: string;
  };
}

export async function GET(req: NextRequest, { params }: Params) {
  const session = await SessionStore.get(params.id);
  if (!session) {
    return NextResponse.json({ error: 'Sitzung nicht gefunden.' }, { status: 404 });
  }

  return NextResponse.json({
    id: session.id,
    maskedPhoneNumber: session.maskedPhoneNumber,
    status: session.status,
    streamStatus: session.streamStatus,
    createdAt: session.createdAt,
    endedAt: session.endedAt,
  });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const body = await req.json();
    const session = await SessionStore.get(params.id);

    if (!session) {
      return NextResponse.json({ error: 'Sitzung nicht gefunden.' }, { status: 404 });
    }

    if (body.heartbeat) {
      await SessionStore.heartbeat(params.id);
    }

    if (body.streamStatus) {
      await SessionStore.update(params.id, { streamStatus: body.streamStatus });
    }

    if (body.status) {
      await SessionStore.update(params.id, { status: body.status });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: 'Fehler beim Aktualisieren.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const ended = await SessionStore.end(params.id);
  return NextResponse.json({ success: ended });
}
