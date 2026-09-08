import { NextRequest, NextResponse } from 'next/server';
import { validatePhoneNumber } from '@/lib/validation/phone';
import { checkRateLimit } from '@/lib/sms/rate-limiter';
import { getSmsProvider } from '@/lib/sms/sms-provider';
import { SessionStore } from '@/lib/database/session-store';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawPhone = body?.phoneNumber;

    // Validate phone number format
    const validation = validatePhoneNumber(rawPhone);
    if (!validation.isValid || !validation.e164 || !validation.masked) {
      return NextResponse.json(
        {
          success: false,
          error: validation.error || 'Bitte geben Sie eine gültige Telefonnummer ein.',
          message: validation.error || 'Bitte geben Sie eine gültige Telefonnummer ein.',
        },
        { status: 400 }
      );
    }

    // Determine client IP for rate limiting
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';

    // Check rate limiter
    const rateCheck = checkRateLimit(ip, validation.e164);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: rateCheck.reason || 'Zu viele SMS-Anfragen. Bitte versuchen Sie es später erneut.',
        },
        { status: 429 }
      );
    }

    // SMS message text
    const SMS_TEXT = 'عميلنا العزيز، نحن بانتظار الموافقة.';

    // Send SMS via configured server-side provider
    const smsProvider = getSmsProvider();
    const smsResult = await smsProvider.sendSms(validation.e164, SMS_TEXT);

    if (!smsResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Die SMS konnte nicht gesendet werden. Bitte überprüfen Sie Ihre Telefonnummer und versuchen Sie es erneut.',
          providerError: process.env.NODE_ENV === 'development' ? smsResult.error : undefined,
        },
        { status: 502 }
      );
    }

    // Create session in persistent session store
    const session = await SessionStore.create(validation.e164, validation.masked);

    return NextResponse.json({
      success: true,
      sessionId: session.id,
      maskedPhoneNumber: session.maskedPhoneNumber,
      message: 'Die SMS wurde erfolgreich gesendet.',
    });
  } catch (err: any) {
    console.error('[API SMS Send Error]', err);
    return NextResponse.json(
      {
        success: false,
        error: 'Ein technischer Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.',
      },
      { status: 500 }
    );
  }
}
