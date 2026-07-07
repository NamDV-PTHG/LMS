import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/middleware/require-role';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { handleApiError } from '@/app/api/error-handler';
import { NotFoundError, ValidationError, ConflictError } from '@/lib/errors';
import { sendWelcomeEmail } from '@/services/email.service';
import { checkEmailDomain } from '@/services/user.service';

function generatePassword(): string {
  const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lower = 'abcdefghijklmnopqrstuvwxyz';
  const digits = '0123456789';
  const special = '@#!$';
  const all = upper + lower + digits + special;
  let pwd = upper[Math.floor(Math.random() * upper.length)]
    + lower[Math.floor(Math.random() * lower.length)]
    + digits[Math.floor(Math.random() * digits.length)]
    + special[Math.floor(Math.random() * special.length)];
  for (let i = 4; i < 12; i++) pwd += all[Math.floor(Math.random() * all.length)];
  return pwd.split('').sort(() => Math.random() - 0.5).join('');
}

/**
 * POST /api/organizations/[id]/admin
 * group_admin only: tạo tài khoản company_admin cho công ty vừa được tạo.
 * Body: { email, fullName, password? }
 */
export const POST = withRole(
  ['group_admin'],
  async (req: NextRequest, { params }) => {
    try {
      const orgId = params!.id;

      const org = await prisma.organization.findUnique({ where: { id: orgId } });
      if (!org || !org.isActive) throw new NotFoundError('Tổ chức');
      if (org.type !== 'company' && org.type !== 'group') {
        throw new ValidationError('Chỉ có thể tạo admin cho tổ chức cấp công ty');
      }

      const body = await req.json();
      const { email, fullName, password: providedPassword } = body as {
        email: string;
        fullName: string;
        password?: string;
      };

      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new ValidationError('Email không hợp lệ');
      }
      if (!fullName || fullName.trim().length < 2) {
        throw new ValidationError('Họ tên phải có ít nhất 2 ký tự');
      }

      // Xác thực tên miền email có MX record không
      const domainCheck = await checkEmailDomain(email);
      if (!domainCheck.valid) {
        throw new ValidationError(domainCheck.reason ?? 'Email không hợp lệ');
      }

      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) throw new ConflictError('Email đã tồn tại trong hệ thống');

      const plainPassword = providedPassword?.trim() || generatePassword();
      const passwordHash = await bcrypt.hash(plainPassword, 10);

      const user = await prisma.$transaction(async (tx) => {
        const u = await tx.user.create({
          data: {
            email,
            fullName: fullName.trim(),
            passwordHash,
            isActive: true,
          },
        });
        await tx.userRole.create({
          data: {
            userId: u.id,
            role: 'company_admin',
            organizationId: orgId,
          },
        });
        return u;
      });

      // Send welcome email — await để biết kết quả thực tế
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://lms.phuthaiholdings.com:5980';
      const emailResult = await sendWelcomeEmail(email, fullName.trim(), plainPassword, `${baseUrl}/login`, `${baseUrl}/app`);
      if (!emailResult.success) {
        console.error(`[Admin] Gửi welcome email thất bại cho ${email}:`, emailResult.error);
      }

      return NextResponse.json({
        success: true,
        data: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          emailSent: emailResult.success,
          emailError: emailResult.success ? undefined : emailResult.error,
        },
      }, { status: 201 });
    } catch (err) {
      return handleApiError(err);
    }
  },
);
