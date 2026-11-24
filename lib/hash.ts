import crypto from 'node:crypto';
import type { NextRequest } from 'next/server';

/**
 * Hashes an IP address using SHA-256 + salt for voter privacy & duplicate analysis.
 */
export function hashIp(ip: string): string {
  const salt = process.env.IP_HASH_SALT || 'stagevote-salt-live-voting-2026';
  return crypto.createHash('sha256').update(`${salt}:${ip}`).digest('hex');
}

/**
 * Extracts the real client IP from incoming Next.js request headers.
 */
export function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    const ips = forwarded.split(',').map((s) => s.trim());
    if (ips[0]) return ips[0];
  }
  const realIp = req.headers.get('x-real-ip');
  if (realIp) return realIp.trim();

  return '127.0.0.1';
}
