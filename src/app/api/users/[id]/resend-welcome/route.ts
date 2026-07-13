import { NextResponse } from 'next/server';
import { withRole } from '@/middleware/require-role';
import { prisma } from '@/lib/prisma';
import { handleApiError } from '@/app/api/error-handler';
import { NotFoundError, ForbiddenError } from '@/lib/errors';
import { sendWelcomeEmail } from '@/services/email.service';
import bcrypt from 'bcryptjs';

function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#!';
  let pwd = '';
  for (let i = 0; i < 10; i++) pwd += chars[Math.floor(Math.random() * chars.length)];
  return pwd;
}

/**
 * POST /api/users/[id]/resend-welcome
 *
 * Tạo mật khẩu tạm mới, cập nhật DB và gửi lại email thông tin đăng nhập.
 */
export const POST = withRole(
  ['group_admin', 'company_admin', 'hr_manager'],
  async (req, { params, companyId, user: currentUser }) => {
    try {
      const targetId = params!.id;
      const isGroupAdmin = currentUser.roles.includes('group_admin');

      const target = await prisma.user.findUnique({
        where: { id: targetId },
        select: {
          id: true, email: true, fullName: true, companyId: true, isActive: true,
          roles: { select: { organization: { select: { id: true, companyId: true } } } },
        },
      });

      if (!target) throw new NotFoundError('Người dùng');

      if (!isGroupAdmin) {
        // Kiểm tra tenant: user phải thuộc công ty (qua companyId hoặc qua vai trò)
        const belongsToCompany =
          target.companyId === companyId ||
          target.roles.some(
            (r) => r.organization.id === companyId || r.organization.companyId === companyId,
          );
        if (!belongsToCompany) throw new ForbiddenError('Không có quyền thao tác với người dùng này');
      }

      if (!target.isActive) throw new ForbiddenError('Tài khoản đã bị vô hiệu hóa');

      const tempPassword = generateTempPassword();
      const passwordHash = await bcrypt.hash(tempPassword, 10);

      await prisma.user.update({
        where: { id: targetId },
        data: { passwordHash },
      });

      const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://lms.phuthaiholdings.com:5980';
      const result = await sendWelcomeEmail(
        target.email,
        target.fullName,
        tempPassword,
        `${baseUrl}/login`,
        `${baseUrl}/app`,
      );

      return NextResponse.json({
        success: true,
        data: { emailSent: result.success, emailError: result.error },
      });
    } catch (err) {
      return handleApiError(err);
    }
  },
);
