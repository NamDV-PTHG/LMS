import { NextResponse } from 'next/server';
import { withRole } from '@/middleware/require-role';
import { getUserReport } from '@/services/report.service';
import { handleApiError } from '@/app/api/error-handler';
import { assertSameTenant } from '@/middleware/tenant-guard';
import { NotFoundError } from '@/lib/errors';

export const GET = withRole(['company_admin', 'hr_manager', 'group_admin'], async (_req, { params, user, companyId }) => {
  try {
    assertSameTenant(params!.companyId, companyId, user.roles.includes('group_admin'));
    const data = await getUserReport(params!.companyId, params!.userId);
    if (!data) throw new NotFoundError('Người dùng');
    return NextResponse.json({ success: true, data });
  } catch (err) {
    return handleApiError(err);
  }
});
