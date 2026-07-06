import { NextResponse } from 'next/server';
import { withRole } from '@/middleware/require-role';
import { prisma } from '@/lib/prisma';
import { handleApiError } from '@/app/api/error-handler';

export const GET = withRole(
  ['group_admin'],
  async () => {
    try {
      const companies = await prisma.organization.findMany({
        where: { type: 'company', isActive: true },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      });

      const rows = await Promise.all(
        companies.map(async (c) => {
          const userRoles = await prisma.userRole.findMany({
            where: { organization: { OR: [{ id: c.id }, { companyId: c.id }] } },
            select: { userId: true },
            distinct: ['userId'],
          });
          const userIds = userRoles.map((r) => r.userId);
          if (userIds.length === 0) return { id: c.id, name: c.name, userCount: 0, readiness: 0, profiledUsers: 0 };

          const profiles = await prisma.userCompetencyProfile.findMany({
            where: { userId: { in: userIds } },
            include: { competency: { select: { requiredLevel: true } } },
          });

          const met = profiles.filter((p) => p.currentLevel >= p.competency.requiredLevel).length;
          const readiness = profiles.length > 0 ? Math.round((met / profiles.length) * 100) : 0;
          const profiledUsers = new Set(profiles.map((p) => p.userId)).size;

          return { id: c.id, name: c.name, userCount: userIds.length, readiness, profiledUsers };
        }),
      );

      return NextResponse.json({ success: true, data: rows });
    } catch (err) {
      return handleApiError(err);
    }
  },
);
