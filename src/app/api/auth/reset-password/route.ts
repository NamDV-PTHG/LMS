import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { handleApiError } from '@/app/api/error-handler';
import { ValidationError } from '@/lib/errors';

const schema = z.object({
  token: z.string().min(1, 'Token không hợp lệ'),
  newPassword: z.string().min(8, 'Mật khẩu tối thiểu 8 ký tự'),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError('Dữ liệu không hợp lệ', parsed.error.flatten().fieldErrors);
    }

    const { token, newPassword } = parsed.data;

    const resetToken = await prisma.passwordResetToken.findUnique({ where: { token } });

    if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
      return NextResponse.json({
        success: false,
        error: 'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn. Vui lòng yêu cầu lại.',
        code: 'TOKEN_INVALID',
      }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash },
      }),
      prisma.passwordResetToken.update({
        where: { token },
        data: { usedAt: new Date() },
      }),
    ]);

    return NextResponse.json({ success: true, data: { message: 'Mật khẩu đã được đặt lại thành công.' } });
  } catch (err) {
    return handleApiError(err);
  }
}
