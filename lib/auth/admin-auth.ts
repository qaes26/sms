import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { AdminAuthPayload } from '@/lib/types';

const COOKIE_NAME = 'admin_session_token';
const DEFAULT_SECRET = 'antigravity-secure-admin-secret-key-fallback-32chars!';

function getSecretKey(): Uint8Array {
  const secret = process.env.ADMIN_JWT_SECRET || DEFAULT_SECRET;
  return new TextEncoder().encode(secret.padEnd(32, '!'));
}

/**
 * Validates the admin password against environment variable ADMIN_PASSWORD.
 */
export function verifyAdminPassword(password: string): boolean {
  const expected = process.env.ADMIN_PASSWORD || 'AdminSecure2025!';
  if (!password || typeof password !== 'string') return false;
  return password === expected;
}

/**
 * Creates an encrypted/signed JWT session token for authenticated admin.
 */
export async function createAdminSession(): Promise<string> {
  const key = getSecretKey();
  const token = await new SignJWT({ role: 'admin', authenticatedAt: Date.now() })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(key);

  return token;
}

/**
 * Verifies the admin JWT token from cookie or header.
 */
export async function verifyAdminSession(token?: string): Promise<AdminAuthPayload | null> {
  try {
    let rawToken = token;
    if (!rawToken) {
      const cookieStore = cookies();
      rawToken = cookieStore.get(COOKIE_NAME)?.value;
    }

    if (!rawToken) return null;

    const key = getSecretKey();
    const { payload } = await jwtVerify(rawToken, key);

    if (payload.role === 'admin') {
      return payload as unknown as AdminAuthPayload;
    }
    return null;
  } catch (err) {
    return null;
  }
}

export { COOKIE_NAME };
