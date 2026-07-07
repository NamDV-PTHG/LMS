import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/middleware/require-role';
import { getUserById, updateUser, updateUserSchema } from '@/services/user.service';
import { handleApiError } from '@/app/api/error-handler';
import { ForbiddenError, ValidationError } from '@/lib/errors';

export const GET = withRole(
  ['group_admin', 'company_admin', 'hr_manager'],
  async (_req, { params, user, companyId }) => {
    const isGroupAdmin = user.roles.includes('group_admin');
    const profile = await getUserById(params!.id, companyId, isGroupAdmin);
    return NextResponse.json({ success: true, data: profile });
  },
);

export const PATCH = withRole(
  ['group_admin', 'company_admin', 'hr_manager'],
  async (req, { params, user, companyId }) => {
    try {
      const body = await req.json();
      const parsed = updateUserSchema.safeParse(body);
      if (!parsed.success) {
        throw new ValidationError('Dữ liệu không hợp lệ', parsed.error.flatten().fieldErrors);
      }

      // Chỉ group_admin và company_admin mới được bật/tắt quyền AI
      if (parsed.data.aiEnabled !== undefined) {
        const isAdmin = user.roles.includes('group_admin') || user.roles.includes('company_admin');
        if (!isAdmin) {
          throw new ForbiddenError('Chỉ Admin công ty mới có thể phân quyền sử dụng AI');
        }
      }

      const isGroupAdmin = user.roles.includes('group_admin');
      const updated = await updateUser(params!.id, parsed.data, companyId, isGroupAdmin, user.id);
      return NextResponse.json({ success: true, data: updated });
    } catch (err) {
      return handleApiError(err);
    }
  },
);
