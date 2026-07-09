import { prisma } from '@/lib/prisma';

const ADMIN_ROLES = ['group_admin', 'company_admin', 'group_hrm', 'hr_manager'];

/**
 * Returns the set of userIds whose data the given user is allowed to see.
 *
 * - Admins (group_admin / company_admin / hr_manager / group_hrm): null → no restriction (see all)
 * - dept_head: self + all users in their department(s) + sub-departments (recursive)
 * - instructor (no dept_head): [userId] only
 * - Multi-role (instructor + dept_head): dept_head logic applies
 *
 * @returns string[] — list of allowed createdById values, or null (= no restriction)
 */
export async function getScopedUserIds(
  userId: string,
  userRoles: string[],
): Promise<string[] | null> {
  // Admins see everything
  if (userRoles.some((r) => ADMIN_ROLES.includes(r))) {
    return null;
  }

  // Find dept_head role → get their organizations
  const isDeptHead = userRoles.includes('dept_head');

  if (!isDeptHead) {
    // Pure instructor (or learner): only own data
    return [userId];
  }

  // dept_head: find all sub-orgs recursively and collect user IDs
  const deptRoles = await prisma.userRole.findMany({
    where: { userId, role: 'dept_head' },
    select: { organizationId: true },
  });

  if (deptRoles.length === 0) {
    return [userId];
  }

  const rootOrgIds = deptRoles.map((r) => r.organizationId);

  // Recursive CTE to get all sub-org IDs
  // Cast id::text so Postgres can compare uuid column with the text[] parameter
  const orgRows = await prisma.$queryRaw<{ id: string }[]>`
    WITH RECURSIVE sub_orgs AS (
      SELECT id FROM "Organization"
      WHERE id::text = ANY(${rootOrgIds})
      UNION ALL
      SELECT o.id FROM "Organization" o
      INNER JOIN sub_orgs s ON o."parentId" = s.id
    )
    SELECT id::text AS id FROM sub_orgs
  `;

  const allOrgIds = orgRows.map((r) => r.id);

  // Get all user IDs within those orgs
  const members = await prisma.userRole.findMany({
    where: { organizationId: { in: allOrgIds } },
    select: { userId: true },
    distinct: ['userId'],
  });

  const memberIds = members.map((m) => m.userId);

  // Always include self
  const result = Array.from(new Set([userId, ...memberIds]));
  return result;
}
