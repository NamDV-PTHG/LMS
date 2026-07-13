import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/middleware/require-role';
import { handleApiError } from '@/app/api/error-handler';
import { prisma } from '@/lib/prisma';
import { ForbiddenError } from '@/lib/errors';

/**
 * GET /api/reports/company/[companyId]/competency-by-position
 *
 * Returns all positions (with framework) for a company,
 * each with the list of users assigned and their current competency levels per domain.
 *
 * Response shape:
 * {
 *   positionId, positionTitle, frameworkName,
 *   axes: [{ domainId, domainName, requiredAvg }],   // 0–5 scale
 *   users: [{ userId, fullName, employeeCode, levels: number[] }]
 * }[]
 */
export const GET = withRole(
  ['group_admin', 'group_hrm', 'company_admin', 'hr_manager'],
  async (req: NextRequest, { params, companyId: callerCompanyId, user }) => {
    try {
      const targetCompanyId = params!.companyId as string;
      const roles = (user.roles ?? []) as string[];
      const isGroupAdmin = roles.includes('group_admin') || roles.includes('group_hrm');

      // Only group_admin can query other companies
      if (!isGroupAdmin && targetCompanyId !== callerCompanyId) {
        throw new ForbiddenError('Không có quyền truy cập công ty này');
      }

      // Load all active positions in this company that have a framework (legacy or junction)
      const positions = await prisma.jobPosition.findMany({
        where: {
          companyId: targetCompanyId,
          isActive: true,
          OR: [
            { competencyFrameworkId: { not: null } },
            { frameworks: { some: {} } },
          ],
        },
        include: {
          competencyFramework: {
            include: {
              domains: {
                orderBy: { displayOrder: 'asc' },
                include: { competencies: { orderBy: { displayOrder: 'asc' } } },
              },
            },
          },
          frameworks: {
            orderBy: { displayOrder: 'asc' },
            include: {
              framework: {
                include: {
                  domains: {
                    orderBy: { displayOrder: 'asc' },
                    include: { competencies: { orderBy: { displayOrder: 'asc' } } },
                  },
                },
              },
            },
          },
          users: {
            where: { isActive: true },
            select: {
              id: true,
              fullName: true,
              employeeCode: true,
              competencyProfiles: {
                select: { competencyId: true, currentLevel: true },
              },
            },
          },
        },
        orderBy: { title: 'asc' },
      });

      const result = positions
        .map((pos) => {
          // Resolve domains — prefer junction table (multi-framework), fallback to legacy
          type DomainEntry = {
            id: string;
            name: string;
            competencies: { id: string; requiredLevel: number }[];
          };

          let domains: DomainEntry[] = [];

          if (pos.frameworks && pos.frameworks.length > 0) {
            // Use primary framework if set, else first
            const primary = pos.frameworks.find((f) => f.isPrimary) ?? pos.frameworks[0];
            domains = primary.framework.domains.map((d) => ({
              id: d.id,
              name: d.name,
              competencies: d.competencies.map((c) => ({ id: c.id, requiredLevel: c.requiredLevel })),
            }));
          } else if (pos.competencyFramework) {
            domains = pos.competencyFramework.domains.map((d) => ({
              id: d.id,
              name: d.name,
              competencies: d.competencies.map((c) => ({ id: c.id, requiredLevel: c.requiredLevel })),
            }));
          }

          if (domains.length === 0) return null;

          // Build axes: one per domain, requiredAvg = avg of competencies' requiredLevel
          const axes = domains
            .filter((d) => d.competencies.length > 0)
            .map((d) => {
              const requiredAvg =
                d.competencies.reduce((s, c) => s + c.requiredLevel, 0) / d.competencies.length;
              return {
                domainId: d.id,
                domainName: d.name,
                requiredAvg: Math.round(requiredAvg * 10) / 10,
              };
            });

          if (axes.length === 0) return null;

          // Build per-user data
          const allCompetencyIds = domains.flatMap((d) => d.competencies.map((c) => c.id));

          const users = pos.users
            .filter((u) => u.id)
            .map((u) => {
              const profileMap = new Map(
                u.competencyProfiles
                  .filter((p) => allCompetencyIds.includes(p.competencyId))
                  .map((p) => [p.competencyId, p.currentLevel]),
              );

              // Current level per domain = avg of competencies' currentLevel (0 if no profile)
              const levels = domains
                .filter((d) => d.competencies.length > 0)
                .map((d) => {
                  const sum = d.competencies.reduce(
                    (s, c) => s + (profileMap.get(c.id) ?? 0),
                    0,
                  );
                  return Math.round((sum / d.competencies.length) * 10) / 10;
                });

              // Overall readiness for this user vs this position
              let totalRequired = 0;
              let totalAchieved = 0;
              for (const d of domains) {
                for (const c of d.competencies) {
                  totalRequired += c.requiredLevel;
                  totalAchieved += Math.min(profileMap.get(c.id) ?? 0, c.requiredLevel);
                }
              }
              const readinessPct =
                totalRequired > 0 ? Math.round((totalAchieved / totalRequired) * 100) : 0;

              return {
                userId: u.id,
                fullName: u.fullName,
                employeeCode: u.employeeCode,
                levels,
                readinessPct,
              };
            });

          const frameworkName =
            pos.frameworks.find((f) => f.isPrimary)?.framework.name ??
            pos.frameworks[0]?.framework.name ??
            pos.competencyFramework?.name ??
            null;

          return {
            positionId: pos.id,
            positionTitle: pos.title,
            frameworkName,
            axes,
            users,
          };
        })
        .filter(Boolean);

      return NextResponse.json({ success: true, data: result });
    } catch (err) {
      return handleApiError(err);
    }
  },
);
