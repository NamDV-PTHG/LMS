import { NextResponse } from 'next/server';
import { withRole } from '@/middleware/require-role';
import { getCompanyByCourse } from '@/services/report.service';
import { handleApiError } from '@/app/api/error-handler';
import { assertSameTenant } from '@/middleware/tenant-guard';

export const GET = withRole(['company_admin', 'hr_manager', 'group_admin'], async (_req, { params, user, companyId }) => {
  try {
    assertSameTenant(params!.companyId, companyId, user.roles.includes('group_admin'));
    const data = await getCompanyByCourse(params!.companyId);
    return NextResponse.json({ success: true, data });
  } catch (err) {
    return handleApiError(err);
  }
});
