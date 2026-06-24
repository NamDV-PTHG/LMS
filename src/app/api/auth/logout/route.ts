import { NextRequest, NextResponse } from 'next/server';
import { logout } from '@/services/auth.service';
import { handleApiError } from '@/app/api/error-handler';
import { getAuthContext } from '@/lib/auth';

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const user = getAuthContext(req);
    await logout(user.id);

    const response = NextResponse.json({ success: true, data: null });

    // Clear refresh token cookie
    response.cookies.set('refresh_token', '', {
      httpOnly: true,
      maxAge: 0,
      path: '/api/auth',
    });

    return response;
  } catch (err) {
    return handleApiError(err);
  }
}
