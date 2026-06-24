import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/middleware/require-role';
import { getOrgTree } from '@/services/organization.service';

export const GET = withRole(
  ['group_admin', 'group_hrm', 'company_admin', 'hr_manager', 'instructor'],
  async (req, { params, companyId }) => {
    const tree = await getOrgTree(params!.id, companyId);
    return NextResponse.json({ success: true, data: tree });
  },
);
