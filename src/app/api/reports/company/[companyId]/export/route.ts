import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/middleware/require-role';
import { exportComplianceReport } from '@/services/report.service';
import { handleApiError } from '@/app/api/error-handler';
import { assertSameTenant } from '@/middleware/tenant-guard';
import { ValidationError } from '@/lib/errors';

export const GET = withRole(['company_admin', 'hr_manager', 'group_admin'], async (req, { params, user, companyId }) => {
  try {
    assertSameTenant(params!.companyId, companyId, user.roles.includes('group_admin'));

    const type = req.nextUrl.searchParams.get('type') ?? 'compliance';
    if (type !== 'compliance') throw new ValidationError('Loại báo cáo không hợp lệ');

    const buffer = await exportComplianceReport(params!.companyId);

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="compliance-${params!.companyId}.xlsx"`,
        'Content-Length': buffer.length.toString(),
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
});
