import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // 1. Check if Twilio is configured (Network Traversal API provides ephemeral TURN credentials)
    const twilioSid =
      process.env.TWILIO_ACCOUNT_SID ||
      (process.env.SMS_API_KEY?.startsWith('AC') ? process.env.SMS_API_KEY : null);
    const twilioAuth = process.env.TWILIO_AUTH_TOKEN || process.env.SMS_API_SECRET;

    if (twilioSid && twilioAuth) {
      try {
        const authHeader = Buffer.from(`${twilioSid}:${twilioAuth}`).toString('base64');
        const res = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Tokens.json`,
          {
            method: 'POST',
            headers: {
              Authorization: `Basic ${authHeader}`,
            },
          }
        );
        if (res.ok) {
          const data = await res.json();
          if (data.ice_servers && Array.isArray(data.ice_servers)) {
            console.log('[ICE API] Successfully fetched ephemeral TURN servers from Twilio');
            return NextResponse.json({
              iceServers: data.ice_servers,
              source: 'twilio',
            });
          }
        }
      } catch (err) {
        console.warn('[ICE API] Twilio Token request exception:', err);
      }
    }

    // 2. Check if Metered API Key is configured
    const meteredKey = process.env.METERED_API_KEY || process.env.NEXT_PUBLIC_METERED_API_KEY;
    const meteredDomain = process.env.METERED_DOMAIN || process.env.NEXT_PUBLIC_METERED_DOMAIN;
    if (meteredKey && meteredDomain) {
      try {
        const res = await fetch(
          `https://${meteredDomain}.metered.ca/api/v1/turn/credentials?apiKey=${meteredKey}`
        );
        if (res.ok) {
          const servers = await res.json();
          if (Array.isArray(servers) && servers.length > 0) {
            console.log('[ICE API] Successfully fetched dynamic TURN credentials from Metered');
            return NextResponse.json({
              iceServers: servers,
              source: 'metered',
            });
          }
        }
      } catch (err) {
        console.warn('[ICE API] Metered API request exception:', err);
      }
    }

    // 3. Fallback: let frontend use environment variables / static config
    return NextResponse.json({
      iceServers: null,
      source: 'env',
    });
  } catch (error: any) {
    console.error('[ICE API Error]', error);
    return NextResponse.json({ iceServers: null, error: error.message }, { status: 500 });
  }
}
