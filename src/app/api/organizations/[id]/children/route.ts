import { NextResponse } from 'next/server';
import { withRole } from '@/middleware/require-role';
import { getOrgChildren } from '@/services/organization.service';

export const GET = withRole(
  ['group_admin', 'group_hrm', 'company_admin', 'hr_manager', 'instructor'],
  async (_req, { params, companyId }) => {
    const children = await getOrgChildren(params!.id, companyId);
    return NextResponse.json({ success: true, data: children });
  },
);
