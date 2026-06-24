import { NextResponse } from 'next/server';
import { withRole } from '@/middleware/require-role';
import { getUserCompliance } from '@/services/compliance.service';
import { handleApiError } from '@/app/api/error-handler';
import { assertSameTenant } from '@/middleware/tenant-guard';

export const GET = withRole(['company_admin', 'hr_manager', 'group_admin', 'group_hrm'], async (_req, { params, user, companyId }) => {
  try {
    assertSameTenant(params!.companyId, companyId, user.roles.includes('group_admin'));
    const result = await getUserCompliance(params!.companyId, params!.userId);
    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    return handleApiError(err);
  }
});
