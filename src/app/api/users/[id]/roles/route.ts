import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/middleware/require-role';
import { assignRole, assignRoleSchema } from '@/services/user.service';
import { handleApiError } from '@/app/api/error-handler';
import { ValidationError } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { CACHE_KEYS, TTL } from '@/lib/cache';
import { redisSet } from '@/lib/redis';

export const POST = withRole(
  ['group_admin', 'company_admin', 'dept_head'],
  async (req, { params, user, companyId }) => {
    try {
      const body = await req.json();
      const parsed = assignRoleSchema.safeParse(body);
      if (!parsed.success) {
        throw new ValidationError('Dữ liệu không hợp lệ', parsed.error.flatten().fieldErrors);
      }

      const isGroupAdmin = user.roles.includes('group_admin');
      const role = await assignRole(params!.id, parsed.data, companyId, isGroupAdmin);
      return NextResponse.json({ success: true, data: role }, { status: 201 });
    } catch (err) {
      return handleApiError(err);
    }
  },
);

const removeRoleSchema = z.object({
  role: z.string(),
  organizationId: z.string().uuid(),
});

export const DELETE = withRole(
  ['group_admin', 'company_admin', 'dept_head'],
  async (req, { params }) => {
    try {
      const body = await req.json();
      const parsed = removeRoleSchema.safeParse(body);
      if (!parsed.success) {
        throw new ValidationError('Dữ liệu không hợp lệ', parsed.error.flatten().fieldErrors);
      }

      const userId = params!.id;

      // Kiểm tra còn bao nhiêu vai trò sau khi xóa — không cho xóa vai trò cuối
      const totalRoles = await prisma.userRole.count({ where: { userId } });
      const toDeleteCount = await prisma.userRole.count({
        where: { userId, role: parsed.data.role as never, organizationId: parsed.data.organizationId },
      });
      if (totalRoles - toDeleteCount < 1) {
        throw new ValidationError(
          'Không thể xóa vai trò cuối cùng của người dùng. Thêm vai trò khác trước hoặc vô hiệu hóa tài khoản.',
        );
      }

      await prisma.userRole.deleteMany({
        where: {
          userId,
          role: parsed.data.role as never,
          organizationId: parsed.data.organizationId,
        },
      });

      // Cập nhật cache roles
      const remaining = await prisma.userRole.findMany({ where: { userId }, select: { role: true } });
      await redisSet(CACHE_KEYS.userRoles(userId), remaining.map((r) => r.role), TTL.USER_ROLES);

      return NextResponse.json({ success: true });
    } catch (err) {
      return handleApiError(err);
    }
  },
);
