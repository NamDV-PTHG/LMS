import { NextResponse } from 'next/server';
import { withAuth } from '@/middleware/require-role';
import { getManagedOrgs } from '@/services/report.service';
import { handleApiError } from '@/app/api/error-handler';

/**
 * GET /api/reports/dept
 *
 * Returns all org nodes the current user manages (has dept_head role in).
 * Also accessible to company_admin and hr_manager (sees all depts in company).
 */
export const GET = withAuth(async (_req, { user, companyId }) => {
  try {
    const roles = (user.roles ?? []) as string[];
    const isAdmin = roles.includes('company_admin') || roles.includes('hr_manager') || roles.includes('group_admin');

    if (isAdmin) {
      // Admin sees all dept/team orgs in the company
      const { prisma } = await import('@/lib/prisma');
      const orgs = await prisma.organization.findMany({
        where: {
          isActive: true,
          type: { in: ['dept', 'team'] },
          OR: [{ id: companyId }, { companyId }],
        },
        select: { id: true, name: true, type: true, parentId: true },
        orderBy: { displayOrder: 'asc' },
      });
      return NextResponse.json({ success: true, data: orgs });
    }

    const orgs = await getManagedOrgs(user.id);
    return NextResponse.json({ success: true, data: orgs });
  } catch (err) {
    return handleApiError(err);
  }
});
