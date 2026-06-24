import { NextResponse } from 'next/server';
import { withRole } from '@/middleware/require-role';
import { getOrgFlat } from '@/services/organization.service';

export const GET = withRole(
  ['group_admin', 'group_hrm', 'company_admin', 'hr_manager', 'instructor'],
  async (_req, { companyId }) => {
    const flat = await getOrgFlat(companyId);
    return NextResponse.json({ success: true, data: flat });
  },
);
