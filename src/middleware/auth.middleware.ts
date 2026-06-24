import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';
import { AuthUser } from '@/types';
import { UnauthorizedError } from '@/lib/errors';
import { redisGet } from '@/lib/redis';
import { CACHE_KEYS } from '@/lib/cache';

const JWT_SECRET = process.env.JWT_SECRET ?? 'change-me-in-production';

export interface JwtPayload {
  sub: string;           // userId
  email: string;
  companyId: string;
  organizationId: string;
  roles: string[];
  iat: number;
  exp: number;
}

/**
 * Verify JWT from Authorization header and return the decoded payload.
 * Throws UnauthorizedError if token is missing or invalid.
 */
export function verifyJwt(token: string): JwtPayload {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    throw new UnauthorizedError('Token không hợp lệ hoặc đã hết hạn');
  }
}

/**
 * Extract and verify the Bearer token from a request.
 */
export function extractToken(req: NextRequest): string {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw new UnauthorizedError('Thiếu token xác thực');
  }
  return authHeader.slice(7);
}

/**
 * Get the authenticated user from a request.
 * Tries to load roles from Redis cache first.
 */
export async function getAuthUser(req: NextRequest): Promise<AuthUser> {
  const token = extractToken(req);
  const payload = verifyJwt(token);

  // Try to load up-to-date roles from cache
  const cachedRoles = await redisGet<string[]>(CACHE_KEYS.userRoles(payload.sub));

  return {
    id: payload.sub,
    email: payload.email,
    fullName: '',         // populated from DB when needed
    companyId: payload.companyId,
    organizationId: payload.organizationId,
    roles: (cachedRoles ?? payload.roles) as AuthUser['roles'],
  };
}

/**
 * Sign a new access token.
 */
export function signAccessToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN ?? '15m',
  });
}

/**
 * Sign a refresh token (longer lived, contains only userId).
 */
export function signRefreshToken(userId: string): string {
  return jwt.sign({ sub: userId }, JWT_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
  });
}
