import { NextResponse } from 'next/server';
import { withRole } from '@/middleware/require-role';
import { addStep } from '@/services/learning-path.service';
import { handleApiError } from '@/app/api/error-handler';

export const POST = withRole(
  ['group_admin', 'company_admin', 'hr_manager'],
  async (req, { companyId, params }) => {
    try {
      const body = await req.json();
      if (!body.courseId) return NextResponse.json({ success: false, error: 'courseId là bắt buộc', code: 'VALIDATION_ERROR' }, { status: 400 });
      const data = await addStep(params.id, companyId, body);
      return NextResponse.json({ success: true, data }, { status: 201 });
    } catch (err) {
      return handleApiError(err);
    }
  },
);
