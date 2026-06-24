import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { handleApiError } from '@/app/api/error-handler';
import { sendPasswordResetEmail } from '@/services/email.service';

const schema = z.object({
  email: z.string().email('Email không hợp lệ'),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      // Always return success to prevent email enumeration
      return NextResponse.json({ success: true, data: { message: 'Nếu email tồn tại, chúng tôi sẽ gửi hướng dẫn đặt lại mật khẩu.' } });
    }

    const email = parsed.data.email.toLowerCase();
    const user = await prisma.user.findUnique({ where: { email } });

    if (user && user.isActive) {
      // Delete any existing unused tokens for this user
      await prisma.passwordResetToken.deleteMany({
        where: { userId: user.id, usedAt: null },
      });

      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await prisma.passwordResetToken.create({
        data: { userId: user.id, token, expiresAt },
      });

      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://lms.phuthaiholdings.com:5980';
      const resetUrl = `${appUrl}/reset-password?token=${token}`;

      // Send email async — don't block response
      sendPasswordResetEmail(user.email, user.fullName, resetUrl)
        .catch((e) => console.error('[Email] Gửi reset email thất bại:', e));
    }

    // Always return same response (don't leak whether email exists)
    return NextResponse.json({
      success: true,
      data: { message: 'Nếu email tồn tại trong hệ thống, chúng tôi sẽ gửi hướng dẫn đặt lại mật khẩu.' },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
