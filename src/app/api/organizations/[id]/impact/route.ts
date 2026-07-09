import { NextResponse } from 'next/server';
import { withRole } from '@/middleware/require-role';
import { prisma } from '@/lib/prisma';
import { handleApiError } from '@/app/api/error-handler';

/**
 * GET /api/organizations/[id]/impact
 *
 * Returns the impact of deactivating an org node:
 * - userCount: total users in this org + all sub-orgs (recursive)
 * - courseAssignmentCount: active CourseAssignments targeting any org in sub-tree
 * - subOrgCount: number of active child orgs that will also be deactivated
 */
export const GET = withRole(
  ['group_admin', 'company_admin'],
  async (_req, { params, user, companyId }) => {
    try {
      const orgId = params!.id;

      // Recursive CTE to get all org IDs in sub-tree (including self)
      const subTree = await prisma.$queryRaw<{ id: string }[]>`
        WITH RECURSIVE sub AS (
          SELECT id FROM "Organization" WHERE id = ${orgId} AND "isActive" = true
          UNION ALL
          SELECT o.id FROM "Organization" o
          INNER JOIN sub ON o."parentId" = sub.id
          WHERE o."isActive" = true
        )
        SELECT id FROM sub
      `;

      const subTreeIds = subTree.map((r) => r.id);

      if (!subTreeIds.length) {
        return NextResponse.json({ success: true, data: { userCount: 0, courseAssignmentCount: 0, subOrgCount: 0 } });
      }

      const [uniqueUsers, courseAssignmentCount, subOrgCount] = await Promise.all([
        // Count distinct users via UserRole in sub-tree
        prisma.userRole.groupBy({
          by: ['userId'],
          where: { organizationId: { in: subTreeIds } },
        }).then((g) => g.length),

        // Count active course assignments targeting any org in sub-tree
        prisma.courseAssignment.count({
          where: { targetDeptId: { in: subTreeIds } },
        }),

        // Count sub-orgs (excluding self)
        subTreeIds.length - 1,
      ]);

      return NextResponse.json({
        success: true,
        data: { userCount: uniqueUsers, courseAssignmentCount, subOrgCount },
      });
    } catch (err) {
      return handleApiError(err);
    }
  },
);
