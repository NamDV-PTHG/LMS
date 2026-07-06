import { NextResponse } from 'next/server';
import { withRole } from '@/middleware/require-role';
import { prisma } from '@/lib/prisma';
import { handleApiError } from '@/app/api/error-handler';

export const GET = withRole(
  ['group_admin', 'company_admin', 'hr_manager'],
  async (_req, { params, companyId: callerCompanyId }) => {
    try {
      const targetCompanyId = params!.companyId;

      // group_admin can view any company; company_admin/hr_manager only their own
      const company = await prisma.organization.findFirst({
        where: {
          id: targetCompanyId,
          type: 'company',
          ...(callerCompanyId !== targetCompanyId ? {} : {}),
        },
        select: { id: true, name: true },
      });
      if (!company) return NextResponse.json({ success: false, error: 'Không tìm thấy công ty' }, { status: 404 });

      // All users in this company (via UserRole)
      const userRoles = await prisma.userRole.findMany({
        where: { organization: { OR: [{ id: targetCompanyId }, { companyId: targetCompanyId }] } },
        select: { userId: true },
        distinct: ['userId'],
      });
      const userIds = userRoles.map((r) => r.userId);

      // All competency profiles for these users
      const profiles = await prisma.userCompetencyProfile.findMany({
        where: { userId: { in: userIds } },
        include: {
          competency: {
            select: { id: true, name: true, requiredLevel: true, domainId: true, domain: { select: { name: true } } },
          },
        },
      });

      // Group by competency
      const compMap = new Map<string, { name: string; domain: string; required: number; levels: number[] }>();
      for (const p of profiles) {
        if (!compMap.has(p.competencyId)) {
          compMap.set(p.competencyId, {
            name: p.competency.name,
            domain: p.competency.domain.name,
            required: p.competency.requiredLevel,
            levels: [],
          });
        }
        compMap.get(p.competencyId)!.levels.push(p.currentLevel);
      }

      const competencies = Array.from(compMap.entries()).map(([id, c]) => {
        const avg = c.levels.reduce((s, l) => s + l, 0) / (c.levels.length || 1);
        const metCount = c.levels.filter((l) => l >= c.required).length;
        return {
          id,
          name: c.name,
          domain: c.domain,
          required: c.required,
          avgCurrent: Math.round(avg * 10) / 10,
          metCount,
          totalCount: c.levels.length,
          metPct: c.levels.length > 0 ? Math.round((metCount / c.levels.length) * 100) : 0,
        };
      });

      const totalUsers = userIds.length;
      const usersWithProfile = new Set(profiles.map((p) => p.userId)).size;
      const totalMet = competencies.reduce((s, c) => s + c.metCount, 0);
      const totalTotal = competencies.reduce((s, c) => s + c.totalCount, 0);
      const overallReadiness = totalTotal > 0 ? Math.round((totalMet / totalTotal) * 100) : 0;

      return NextResponse.json({
        success: true,
        data: {
          companyId: targetCompanyId,
          companyName: company.name,
          totalUsers,
          usersWithProfile,
          overallReadiness,
          competencies,
        },
      });
    } catch (err) {
      return handleApiError(err);
    }
  },
);
