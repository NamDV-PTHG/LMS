import { NextResponse } from 'next/server';
import { withRole } from '@/middleware/require-role';
import { prisma } from '@/lib/prisma';
import { handleApiError } from '@/app/api/error-handler';
import { sendWelcomeEmail } from '@/services/email.service';
import bcrypt from 'bcryptjs';

function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#!';
  let pwd = '';
  for (let i = 0; i < 10; i++) pwd += chars[Math.floor(Math.random() * chars.length)];
  return pwd;
}

/**
 * POST /api/users/resend-welcome-bulk
 *
 * Gửi lại email thông tin đăng nhập cho toàn bộ user đang hoạt động trong công ty.
 * Tạo mật khẩu tạm mới cho từng user.
 */
export const POST = withRole(
  ['group_admin', 'company_admin'],
  async (_req, { companyId }) => {
    try {
      // Lấy tất cả user thuộc công ty: qua companyId trực tiếp HOẶC qua vai trò (user cũ chưa có companyId)
      const users = await prisma.user.findMany({
        where: {
          isActive: true,
          OR: [
            { companyId },
            {
              roles: {
                some: {
                  organization: {
                    OR: [{ id: companyId }, { companyId }],
                  },
                },
              },
            },
          ],
        },
        select: { id: true, email: true, fullName: true },
        distinct: ['id'],
      });

      const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://lms.phuthaiholdings.com:5980';

      let sent = 0;
      let failed = 0;

      // Xử lý tuần tự để tránh quá tải SMTP (có thể dùng batch nếu cần)
      for (const u of users) {
        try {
          const tempPassword = generateTempPassword();
          const passwordHash = await bcrypt.hash(tempPassword, 10);

          await prisma.user.update({
            where: { id: u.id },
            data: { passwordHash },
          });

          const result = await sendWelcomeEmail(
            u.email,
            u.fullName,
            tempPassword,
            `${baseUrl}/login`,
            `${baseUrl}/app`,
          );

          if (result.success) sent++;
          else failed++;
        } catch {
          failed++;
        }
      }

      return NextResponse.json({
        success: true,
        data: { total: users.length, sent, failed },
      });
    } catch (err) {
      return handleApiError(err);
    }
  },
);
