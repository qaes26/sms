import { SmsResult } from '@/lib/types';

export interface ISmsProvider {
  sendSms(to: string, message: string): Promise<SmsResult>;
}

/**
 * Concrete Twilio SMS Provider communicating directly with the official Twilio REST API.
 * Uses HTTP Basic Authentication with Account SID and Auth Token.
 */
export class TwilioSmsProvider implements ISmsProvider {
  private accountSid: string;
  private authToken: string;
  private sender: string;

  constructor() {
    this.accountSid = process.env.SMS_API_KEY || '';
    this.authToken = process.env.SMS_API_SECRET || '';
    this.sender = process.env.SMS_SENDER || '';
  }

  async sendSms(to: string, message: string): Promise<SmsResult> {
    if (!this.accountSid || !this.authToken || !this.sender) {
      console.error('[SMS Provider] Twilio credentials missing: SMS_API_KEY, SMS_API_SECRET, or SMS_SENDER is not set.');
      return {
        success: false,
        error: 'Die SMS-Konfiguration auf dem Server ist unvollständig. Bitte hinterlegen Sie die Twilio-Zugangsdaten.',
      };
    }

    try {
      const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`;
      const authHeader = 'Basic ' + Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64');

      const formData = new URLSearchParams();
      formData.append('To', to);
      formData.append('From', this.sender);
      formData.append('Body', message);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
      });

      const data = await response.json();

      if (response.ok && (data.status === 'queued' || data.status === 'sent' || data.status === 'delivered')) {
        return {
          success: true,
          messageId: data.sid,
        };
      }

      console.error('[SMS Provider] Twilio API error response:', data);
      return {
        success: false,
        error: data.message || 'SMS-Versand durch den Provider fehlgeschlagen.',
      };
    } catch (err: any) {
      console.error('[SMS Provider] Network exception when contacting Twilio API:', err);
      return {
        success: false,
        error: err.message || 'Verbindungsfehler zum SMS-Gateway.',
      };
    }
  }
}

/**
 * Test SMS Provider for development or testing environments where live credentials are not yet entered.
 * Will log the SMS and simulate real-world transmission if in test mode.
 */
export class TestSmsProvider implements ISmsProvider {
  async sendSms(to: string, message: string): Promise<SmsResult> {
    console.log(`[Test SMS Provider] Sending SMS to: ${to}`);
    console.log(`[Test SMS Provider] Content: "${message}"`);
    
    // Simulate brief network delay
    await new Promise((resolve) => setTimeout(resolve, 800));

    // Allow testing failure if number is dummy invalid
    if (to.endsWith('0000')) {
      return {
        success: false,
        error: 'Test-Modus: Nummer für Fehlersimulation konfiguriert.',
      };
    }

    return {
      success: true,
      messageId: `TEST_MSG_${Date.now()}_${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
    };
  }
}

export function getSmsProvider(): ISmsProvider {
  const provider = (process.env.SMS_PROVIDER || '').toLowerCase().trim();

  if (provider === 'test') {
    return new TestSmsProvider();
  }

  // If Twilio credentials are configured, use Twilio
  if (process.env.SMS_API_KEY && process.env.SMS_API_SECRET && process.env.SMS_SENDER) {
    return new TwilioSmsProvider();
  }

  // Fallback to TestSmsProvider so user can test on Vercel without needing Twilio keys yet
  return new TestSmsProvider();
}
