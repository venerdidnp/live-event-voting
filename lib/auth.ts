import crypto from 'node:crypto';
import { cookies } from 'next/headers';

const SESSION_COOKIE_NAME = 'admin_session';

function getSecretKey(): string {
  return process.env.ADMIN_SESSION_SECRET || 'stagevote-default-admin-session-secret-change-me!';
}

/**
 * Creates an HMAC SHA-256 signed admin session token.
 */
export function createAdminSessionToken(): string {
  const payload = {
    role: 'admin',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24, // 24 hours
  };
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', getSecretKey())
    .update(data)
    .digest('base64url');
  return `${data}.${signature}`;
}

/**
 * Verifies an HMAC SHA-256 admin session token.
 */
export function verifyAdminSessionToken(token: string | undefined | null): boolean {
  if (!token) return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;

  const [data, signature] = parts;
  const expectedSignature = crypto
    .createHmac('sha256', getSecretKey())
    .update(data)
    .digest('base64url');

  try {
    const isValid = crypto.timingSafeEqual(
      Buffer.from(signature, 'utf8'),
      Buffer.from(expectedSignature, 'utf8')
    );
    if (!isValid) return false;

    const decoded = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
    if (decoded.role !== 'admin') return false;
    if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) return false;

    return true;
  } catch {
    return false;
  }
}

/**
 * Checks admin authentication from Next.js server cookie store.
 */
export async function isAuthenticatedAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  return verifyAdminSessionToken(token);
}

export { SESSION_COOKIE_NAME };
