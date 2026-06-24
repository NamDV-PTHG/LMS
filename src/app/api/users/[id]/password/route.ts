import { NextResponse } from 'next/server';
import { withRole } from '@/middleware/require-role';
import { prisma } from '@/lib/prisma';
import { handleApiError } from '@/app/api/error-handler';
import { ValidationError } from '@/lib/errors';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

const schema = z.object({
  password: z.string().min(8, 'Mật khẩu tối thiểu 8 ký tự'),
});

export const PATCH = withRole(
  ['group_admin', 'company_admin'],
  async (req, { params, user, companyId }) => {
    try {
      const body = await req.json();
      const parsed = schema.safeParse(body);
      if (!parsed.success) {
        throw new ValidationError('Mật khẩu không hợp lệ', parsed.error.flatten().fieldErrors);
      }

      const isGroupAdmin = user.roles.includes('group_admin');

      // Verify target user exists and belongs to company (unless group_admin)
      const targetUser = await prisma.user.findUnique({
        where: { id: params!.id },
        include: { roles: { include: { organization: true } } },
      });
      if (!targetUser) {
        throw new ValidationError('Không tìm thấy người dùng');
      }
      if (!isGroupAdmin) {
        const inCompany = targetUser.roles.some(
          (r) => r.organization.companyId === companyId || r.organization.id === companyId,
        );
        if (!inCompany) throw new ValidationError('Không có quyền đổi mật khẩu người dùng này');
      }

      const passwordHash = await bcrypt.hash(parsed.data.password, 10);
      await prisma.user.update({ where: { id: params!.id }, data: { passwordHash } });

      return NextResponse.json({ success: true, data: { message: 'Đã đổi mật khẩu thành công' } });
    } catch (err) {
      return handleApiError(err);
    }
  },
);
