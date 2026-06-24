import { NextRequest, NextResponse } from 'next/server';

// Routes that don't require any processing
const PUBLIC_PATHS = [
  '/api/auth/login',
  '/api/auth/refresh',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/public',
  '/verify',
  '/_next',
  '/favicon.ico',
];

/**
 * Next.js Edge Middleware — chỉ làm routing guard nhẹ.
 * Xác thực JWT thực sự và rate-limit được xử lý trong API route handlers
 * (withAuth / withRole HOF) vì chúng cần Node.js runtime (ioredis, jsonwebtoken).
 */
export function middleware(req: NextRequest): NextResponse {
  const { pathname } = req.nextUrl;

  // Public paths — pass through
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Pass through — auth enforced at route level via withAuth()
  return NextResponse.next();
}

export const config = {
  matcher: ['/api/:path*'],
};
