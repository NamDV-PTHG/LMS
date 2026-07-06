import { NextResponse } from 'next/server';
import { withRole } from '@/middleware/require-role';
import { getOrgFlat, getOrgFlatWithStats } from '@/services/organization.service';

export const GET = withRole(
  ['group_admin', 'group_hrm', 'company_admin', 'hr_manager', 'instructor'],
  async (req, { companyId }) => {
    const withStats = req.nextUrl.searchParams.get('withStats') === 'true';
    const flat = withStats ? await getOrgFlatWithStats(companyId) : await getOrgFlat(companyId);
    return NextResponse.json({ success: true, data: flat });
  },
);
