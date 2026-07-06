import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { getAuthUser } from '@/middleware/auth.middleware';
import { prisma } from '@/lib/prisma';
import { redisDel } from '@/lib/redis';
import { handleApiError } from '@/app/api/error-handler';
import { ValidationError, UnauthorizedError } from '@/lib/errors';

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Vui lòng nhập mật khẩu hiện tại'),
  newPassword: z
    .string()
    .min(8, 'Mật khẩu mới phải có ít nhất 8 ký tự')
    .regex(/[A-Z]/, 'Mật khẩu phải có ít nhất 1 chữ hoa')
    .regex(/[0-9]/, 'Mật khẩu phải có ít nhất 1 chữ số'),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const authUser = await getAuthUser(req);

    const body = await req.json();
    const parsed = changePasswordSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError('Dữ liệu không hợp lệ', parsed.error.flatten().fieldErrors);
    }

    const user = await prisma.user.findUnique({ where: { id: authUser.id } });
    if (!user || !user.isActive) throw new UnauthorizedError('Tài khoản không hợp lệ');

    const valid = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
    if (!valid) throw new ValidationError('Mật khẩu hiện tại không đúng');

    const newHash = await bcrypt.hash(parsed.data.newPassword, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newHash, mustChangePassword: false },
    });

    // Invalidate refresh token to force re-login with new password
    await redisDel(`refresh:${user.id}`);

    return NextResponse.json({ success: true });
  } catch (err) {
    return handleApiError(err);
  }
}
