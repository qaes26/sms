import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminPassword, createAdminSession, COOKIE_NAME } from '@/lib/auth/admin-auth';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { password } = body;

    if (!verifyAdminPassword(password)) {
      return NextResponse.json(
        { success: false, error: 'Ungültiges Passwort.' },
        { status: 401 }
      );
    }

    const token = await createAdminSession();

    const response = NextResponse.json({ success: true });
    response.cookies.set({
      name: COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 8 * 60 * 60, // 8 hours
    });

    return response;
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: 'Anmeldefehler.' },
      { status: 500 }
    );
  }
}
