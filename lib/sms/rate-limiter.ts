interface RateLimitRecord {
  count: number;
  resetTime: number;
}

// In-memory sliding rate limiter maps
const phoneLimiter = new Map<string, RateLimitRecord>();
const ipLimiter = new Map<string, RateLimitRecord>();

const WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_SMS_PER_PHONE = 3;
const MAX_SMS_PER_IP = 5;

/**
 * Checks if the given phone or IP exceeds rate limits.
 */
export function checkRateLimit(ip: string, phoneNumber: string): { allowed: boolean; reason?: string } {
  const now = Date.now();

  // Check IP limit
  const ipRecord = ipLimiter.get(ip);
  if (ipRecord) {
    if (now > ipRecord.resetTime) {
      ipLimiter.set(ip, { count: 1, resetTime: now + WINDOW_MS });
    } else if (ipRecord.count >= MAX_SMS_PER_IP) {
      return {
        allowed: false,
        reason: 'Zu viele Anfragen von dieser IP-Adresse. Bitte warten Sie einige Minuten.',
      };
    } else {
      ipRecord.count += 1;
    }
  } else {
    ipLimiter.set(ip, { count: 1, resetTime: now + WINDOW_MS });
  }

  // Check Phone number limit
  const phoneRecord = phoneLimiter.get(phoneNumber);
  if (phoneRecord) {
    if (now > phoneRecord.resetTime) {
      phoneLimiter.set(phoneNumber, { count: 1, resetTime: now + WINDOW_MS });
    } else if (phoneRecord.count >= MAX_SMS_PER_PHONE) {
      return {
        allowed: false,
        reason: 'Zu viele SMS-Anfragen für diese Telefonnummer. Bitte warten Sie 10 Minuten.',
      };
    } else {
      phoneRecord.count += 1;
    }
  } else {
    phoneLimiter.set(phoneNumber, { count: 1, resetTime: now + WINDOW_MS });
  }

  // Cleanup old expired records periodically
  if (Math.random() < 0.05) {
    for (const [key, record] of phoneLimiter.entries()) {
      if (now > record.resetTime) phoneLimiter.delete(key);
    }
    for (const [key, record] of ipLimiter.entries()) {
      if (now > record.resetTime) ipLimiter.delete(key);
    }
  }

  return { allowed: true };
}
