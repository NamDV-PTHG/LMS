import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis';

const WINDOW_SECONDS = 10;
const MAX_REQUESTS = 100;

/**
 * Sliding window rate limiter using Redis.
 * 100 requests per 10 seconds per user (or IP if unauthenticated).
 *
 * Returns null if OK, or a 429 NextResponse if rate limit exceeded.
 */
export async function checkRateLimit(
  req: NextRequest,
  identifier: string,
): Promise<NextResponse | null> {
  const key = `rl:${identifier}`;

  try {
    const now = Date.now();
    const windowStart = now - WINDOW_SECONDS * 1000;

    // Remove old entries outside the window
    await redis.zremrangebyscore(key, 0, windowStart);

    // Count requests in current window
    const count = await redis.zcard(key);

    if (count >= MAX_REQUESTS) {
      return NextResponse.json(
        { success: false, error: 'Quá nhiều yêu cầu. Vui lòng thử lại sau.', code: 'RATE_LIMITED' },
        {
          status: 429,
          headers: {
            'Retry-After': String(WINDOW_SECONDS),
            'X-RateLimit-Limit': String(MAX_REQUESTS),
            'X-RateLimit-Remaining': '0',
          },
        },
      );
    }

    // Add current request
    await redis.zadd(key, now, `${now}-${Math.random()}`);
    await redis.expire(key, WINDOW_SECONDS);

    return null; // OK
  } catch {
    // Redis error — fail open (allow request)
    return null;
  }
}

/**
 * Get a rate-limit identifier from the request.
 * Prefers userId from JWT; falls back to IP.
 */
export function getRateLimitId(req: NextRequest, userId?: string): string {
  if (userId) return `user:${userId}`;
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown';
  return `ip:${ip}`;
}
