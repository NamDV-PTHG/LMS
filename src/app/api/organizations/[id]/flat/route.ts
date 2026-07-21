import { NextResponse } from 'next/server';
import { withRole } from '@/middleware/require-role';
import { getOrgFlat, getOrgFlatWithStats } from '@/services/organization.service';
import { prisma } from '@/lib/prisma';

export const GET = withRole(
  ['group_admin', 'group_hrm', 'company_admin', 'hr_manager', 'instructor'],
  async (req, { params, companyId, user }) => {
    const orgId = params!.id;

    // Resolve the actual companyId: if orgId is a dept/team, look up its companyId.
    // If orgId is already a company/group root, companyId field is null and id IS the root.
    let resolvedCompanyId = orgId;
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { id: true, companyId: true, type: true },
    });
    if (org?.companyId) {
      // orgId is a dept or team — use its company as the root for the flat list
      resolvedCompanyId = org.companyId;
    }

    // Tenant guard: non-group roles may only view their own company's org chart.
    const isGroupLevel =
      user.roles.includes('group_admin') || user.roles.includes('group_hrm');
    if (!isGroupLevel && resolvedCompanyId !== companyId) {
      return NextResponse.json({ success: false, error: 'Không có quyền truy cập' }, { status: 403 });
    }

    const withStats = req.nextUrl.searchParams.get('withStats') === 'true';
    const flat = withStats
      ? await getOrgFlatWithStats(resolvedCompanyId)
      : await getOrgFlat(resolvedCompanyId);
    return NextResponse.json({ success: true, data: flat });
  },
);
