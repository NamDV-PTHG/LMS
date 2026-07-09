import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/middleware/require-role';
import { getDeptChildrenStats, getDeptEmployees, getManagedOrgs } from '@/services/report.service';
import { handleApiError } from '@/app/api/error-handler';
import { ForbiddenError } from '@/lib/errors';

/**
 * GET /api/reports/dept/[orgId]?view=children|employees
 *
 * - view=children (default): aggregate stats for direct children of orgId
 * - view=employees: flat list of all employees in sub-tree of orgId
 *
 * Access: dept_head of this org (or parent), company_admin, hr_manager, group_admin
 */
export const GET = withAuth(async (req: NextRequest, { params, user, companyId }) => {
  try {
    const orgId = params!.orgId as string;
    const view = new URL(req.url).searchParams.get('view') ?? 'children';

    const roles = (user.roles ?? []) as string[];
    const isAdmin = roles.includes('company_admin') || roles.includes('hr_manager') || roles.includes('group_admin');

    if (!isAdmin) {
      // Verify user manages this org (or a parent of it)
      const managed = await getManagedOrgs(user.id);
      const managedIds = managed.map((o) => o.id);

      // Check if orgId or any ancestor of orgId is in managedIds
      const { prisma } = await import('@/lib/prisma');
      const orgAncestors = await prisma.$queryRaw<{ id: string }[]>`
        WITH RECURSIVE ancestors AS (
          SELECT id, "parentId" FROM "Organization" WHERE id = ${orgId}
          UNION ALL
          SELECT o.id, o."parentId" FROM "Organization" o
          INNER JOIN ancestors a ON o.id = a."parentId"
        )
        SELECT id FROM ancestors
      `;
      const ancestorIds = orgAncestors.map((r) => r.id);

      const hasAccess = ancestorIds.some((id) => managedIds.includes(id));
      if (!hasAccess) throw new ForbiddenError('Không có quyền xem báo cáo bộ phận này');
    }

    if (view === 'employees') {
      const data = await getDeptEmployees(orgId);
      return NextResponse.json({ success: true, data });
    }

    const data = await getDeptChildrenStats(orgId);
    return NextResponse.json({ success: true, data });
  } catch (err) {
    return handleApiError(err);
  }
});
