import { NextRequest, NextResponse } from 'next/server';
import { refresh } from '@/services/auth.service';
import { handleApiError } from '@/app/api/error-handler';
import { UnauthorizedError } from '@/lib/errors';

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    // Accept from cookie or Authorization header
    const cookieToken = req.cookies.get('refresh_token')?.value;
    const bodyToken = (await req.json().catch(() => ({}))).refreshToken as string | undefined;
    const refreshToken = cookieToken ?? bodyToken;

    if (!refreshToken) {
      throw new UnauthorizedError('Thiếu refresh token');
    }

    const result = await refresh(refreshToken);

    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    return handleApiError(err);
  }
}
