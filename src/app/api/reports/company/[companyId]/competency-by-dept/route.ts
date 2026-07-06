import { NextResponse } from 'next/server';
import { withRole } from '@/middleware/require-role';
import { prisma } from '@/lib/prisma';
import { handleApiError } from '@/app/api/error-handler';

export const GET = withRole(
  ['group_admin', 'company_admin', 'hr_manager'],
  async (_req, { params }) => {
    try {
      const targetCompanyId = params!.companyId;

      // Departments under this company
      const depts = await prisma.organization.findMany({
        where: { companyId: targetCompanyId, type: { in: ['dept', 'team'] }, isActive: true },
        select: { id: true, name: true, type: true },
        orderBy: { name: 'asc' },
      });

      const rows = await Promise.all(
        depts.map(async (dept) => {
          const userRoles = await prisma.userRole.findMany({
            where: { organizationId: dept.id },
            select: { userId: true },
            distinct: ['userId'],
          });
          const userIds = userRoles.map((r) => r.userId);
          if (userIds.length === 0) return { ...dept, userCount: 0, readiness: 0 };

          const profiles = await prisma.userCompetencyProfile.findMany({
            where: { userId: { in: userIds } },
            include: { competency: { select: { requiredLevel: true } } },
          });

          const met = profiles.filter((p) => p.currentLevel >= p.competency.requiredLevel).length;
          const readiness = profiles.length > 0 ? Math.round((met / profiles.length) * 100) : 0;

          return { id: dept.id, name: dept.name, type: dept.type, userCount: userIds.length, readiness };
        }),
      );

      return NextResponse.json({ success: true, data: rows });
    } catch (err) {
      return handleApiError(err);
    }
  },
);
