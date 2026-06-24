import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/middleware/require-role';
import { getCompanyCompliance } from '@/services/compliance.service';
import { handleApiError } from '@/app/api/error-handler';
import { assertSameTenant } from '@/middleware/tenant-guard';

export const GET = withRole(['company_admin', 'hr_manager', 'group_admin', 'group_hrm'], async (req, { params, user, companyId }) => {
  try {
    const targetCompanyId = params!.companyId;
    assertSameTenant(targetCompanyId, companyId, user.roles.includes('group_admin'));

    const sp = req.nextUrl.searchParams;
    const result = await getCompanyCompliance(targetCompanyId, {
      deptId: sp.get('deptId') ?? undefined,
      courseId: sp.get('courseId') ?? undefined,
      overdueOnly: sp.get('overdueOnly') === 'true',
    });

    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    return handleApiError(err);
  }
});
