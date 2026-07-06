import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getMe } from '@/services/auth.service';
import { handleApiError } from '@/app/api/error-handler';
import { getAuthUser } from '@/middleware/auth.middleware';
import { ValidationError, UnauthorizedError } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { redisDel } from '@/lib/redis';

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const authUser = await getAuthUser(req);
    const profile = await getMe(authUser.id);
    return NextResponse.json({ success: true, data: profile });
  } catch (err) {
    return handleApiError(err);
  }
}

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Vui lòng nhập mật khẩu hiện tại'),
  newPassword: z
    .string()
    .min(8, 'Mật khẩu mới phải có ít nhất 8 ký tự')
    .regex(/[A-Z]/, 'Mật khẩu phải có ít nhất 1 chữ hoa')
    .regex(/[0-9]/, 'Mật khẩu phải có ít nhất 1 chữ số'),
});

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  try {
    const authUser = await getAuthUser(req);
    const body = await req.json();
    const parsed = changePasswordSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError('Dữ liệu không hợp lệ', parsed.error.flatten().fieldErrors);
    }

    const user = await prisma.user.findUnique({ where: { id: authUser.id } });
    if (!user) throw new UnauthorizedError();

    const valid = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
    if (!valid) {
      throw new ValidationError('Mật khẩu hiện tại không đúng', {
        currentPassword: ['Mật khẩu hiện tại không đúng'],
      });
    }

    const passwordHash = await bcrypt.hash(parsed.data.newPassword, 10);
    await prisma.user.update({ where: { id: authUser.id }, data: { passwordHash, mustChangePassword: false } });

    // Invalidate refresh token to force re-login with new password
    await redisDel(`refresh:${authUser.id}`);

    return NextResponse.json({ success: true, data: { message: 'Đổi mật khẩu thành công' } });
  } catch (err) {
    return handleApiError(err);
  }
}
