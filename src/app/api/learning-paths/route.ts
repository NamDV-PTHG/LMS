import { NextResponse } from 'next/server';
import { withRole } from '@/middleware/require-role';
import { getLearningPaths, createLearningPath } from '@/services/learning-path.service';
import { handleApiError } from '@/app/api/error-handler';

export const GET = withRole(
  ['group_admin', 'company_admin', 'hr_manager'],
  async (req, { companyId }) => {
    const { searchParams } = new URL(req.url);
    const isActive = searchParams.has('isActive') ? searchParams.get('isActive') === 'true' : undefined;
    const data = await getLearningPaths(companyId, isActive);
    return NextResponse.json({ success: true, data });
  },
);

export const POST = withRole(
  ['group_admin', 'company_admin', 'hr_manager'],
  async (req, { companyId }) => {
    try {
      const body = await req.json();
      if (!body.name?.trim()) return NextResponse.json({ success: false, error: 'Tên là bắt buộc', code: 'VALIDATION_ERROR' }, { status: 400 });
      const data = await createLearningPath(companyId, body);
      return NextResponse.json({ success: true, data }, { status: 201 });
    } catch (err) {
      return handleApiError(err);
    }
  },
);
