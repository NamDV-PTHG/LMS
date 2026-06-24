import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { login } from '@/services/auth.service';
import { handleApiError } from '@/app/api/error-handler';
import { ValidationError } from '@/lib/errors';

const loginSchema = z.object({
  email: z.string().email('Email không hợp lệ'),
  password: z.string().min(1, 'Vui lòng nhập mật khẩu'),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      throw new ValidationError('Dữ liệu không hợp lệ', parsed.error.flatten().fieldErrors);
    }

    const result = await login(parsed.data.email, parsed.data.password);

    const response = NextResponse.json({ success: true, data: result }, { status: 200 });

    // Set refresh token in httpOnly cookie
    response.cookies.set('refresh_token', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60,
      path: '/api/auth',
    });

    return response;
  } catch (err) {
    return handleApiError(err);
  }
}
