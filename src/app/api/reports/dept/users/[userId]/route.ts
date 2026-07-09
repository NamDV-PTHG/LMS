import { NextResponse } from 'next/server';
import { withAuth } from '@/middleware/require-role';
import { getUserReport, getManagedOrgs, getOrgSubtreeIds } from '@/services/report.service';
import { handleApiError } from '@/app/api/error-handler';
import { ForbiddenError, NotFoundError } from '@/lib/errors';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/reports/dept/users/[userId]
 *
 * Returns learning progress detail for a single user.
 * Accessible by dept_head (only for users in their managed orgs),
 * plus company_admin, hr_manager, group_admin.
 */
export const GET = withAuth(async (_req, { params, user, companyId }) => {
  try {
    const targetUserId = params!.userId as string;
    const roles = (user.roles ?? []) as string[];
    const isAdmin = roles.includes('company_admin') || roles.includes('hr_manager') || roles.includes('group_admin');

    if (!isAdmin) {
      // dept_head: verify target user is in one of their managed orgs
      const managed = await getManagedOrgs(user.id);
      if (!managed.length) throw new ForbiddenError('Không có quyền xem thông tin nhân viên này');

      const allSubtreeIds = (
        await Promise.all(managed.map((o) => getOrgSubtreeIds(o.id)))
      ).flat();

      const targetUserRoles = await prisma.userRole.findMany({
        where: { userId: targetUserId, organizationId: { in: allSubtreeIds } },
        select: { id: true },
      });

      if (!targetUserRoles.length) {
        throw new ForbiddenError('Nhân viên này không thuộc bộ phận bạn quản lý');
      }
    }

    const data = await getUserReport(companyId, targetUserId);
    if (!data) throw new NotFoundError('Người dùng');

    return NextResponse.json({ success: true, data });
  } catch (err) {
    return handleApiError(err);
  }
});
