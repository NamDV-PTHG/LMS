import { NextResponse } from 'next/server';
import { withRole } from '@/middleware/require-role';
import { addDomain } from '@/services/competency.service';
import { handleApiError } from '@/app/api/error-handler';

export const POST = withRole(
  ['group_admin', 'company_admin', 'hr_manager'],
  async (req, { companyId, params }) => {
    try {
      const body = await req.json();
      if (!body.name?.trim()) return NextResponse.json({ success: false, error: 'Tên là bắt buộc', code: 'VALIDATION_ERROR' }, { status: 400 });
      const data = await addDomain(params.id, companyId, body);
      return NextResponse.json({ success: true, data }, { status: 201 });
    } catch (err) {
      return handleApiError(err);
    }
  },
);
