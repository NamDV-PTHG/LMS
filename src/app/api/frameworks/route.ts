import { NextResponse } from 'next/server';
import { withRole } from '@/middleware/require-role';
import { getFrameworks, createFramework } from '@/services/competency.service';
import { handleApiError } from '@/app/api/error-handler';

export const GET = withRole(
  ['group_admin', 'company_admin', 'hr_manager'],
  async (_req, { companyId }) => {
    const data = await getFrameworks(companyId);
    return NextResponse.json({ success: true, data });
  },
);

export const POST = withRole(
  ['group_admin', 'company_admin', 'hr_manager'],
  async (req, { companyId }) => {
    try {
      const body = await req.json();
      if (!body.name?.trim()) return NextResponse.json({ success: false, error: 'Tên là bắt buộc', code: 'VALIDATION_ERROR' }, { status: 400 });
      const data = await createFramework(companyId, body);
      return NextResponse.json({ success: true, data }, { status: 201 });
    } catch (err) {
      return handleApiError(err);
    }
  },
);
