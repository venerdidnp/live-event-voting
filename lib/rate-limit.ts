/**
 * In-memory sliding window rate limiter.
 * Default: 30 requests per 60 seconds per client IP.
 * Loose enough for NAT / venue Wi-Fi while protecting against automated bots.
 */

interface RateLimitRecord {
  timestamps: number[];
}

const rateLimitStore = new Map<string, RateLimitRecord>();

// Clean up stale entries periodically
setInterval(() => {
  const now = Date.now();
  const windowMs = 60 * 1000;
  for (const [key, record] of rateLimitStore.entries()) {
    record.timestamps = record.timestamps.filter((ts) => now - ts < windowMs);
    if (record.timestamps.length === 0) {
      rateLimitStore.delete(key);
    }
  }
}, 60 * 1000);

export function checkRateLimit(
  key: string,
  limit: number = 30,
  windowMs: number = 60 * 1000
): { allowed: boolean; remaining: number } {
  const now = Date.now();
  let record = rateLimitStore.get(key);

  if (!record) {
    record = { timestamps: [] };
    rateLimitStore.set(key, record);
  }

  // Filter timestamps within current sliding window
  record.timestamps = record.timestamps.filter((ts) => now - ts < windowMs);

  if (record.timestamps.length >= limit) {
    return { allowed: false, remaining: 0 };
  }

  record.timestamps.push(now);
  return { allowed: true, remaining: limit - record.timestamps.length };
}
