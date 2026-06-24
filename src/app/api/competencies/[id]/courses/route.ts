import { NextResponse } from 'next/server';
import { withRole } from '@/middleware/require-role';
import { linkCourse, unlinkCourse } from '@/services/competency.service';
import { handleApiError } from '@/app/api/error-handler';

// POST /api/competencies/[id]/courses  { courseId, targetLevel }
export const POST = withRole(
  ['group_admin', 'company_admin', 'hr_manager'],
  async (req, { companyId, params }) => {
    try {
      const { courseId, targetLevel } = await req.json();
      if (!courseId) return NextResponse.json({ success: false, error: 'courseId là bắt buộc', code: 'VALIDATION_ERROR' }, { status: 400 });
      const data = await linkCourse(params.id, companyId, courseId, targetLevel ?? 1);
      return NextResponse.json({ success: true, data }, { status: 201 });
    } catch (err) {
      return handleApiError(err);
    }
  },
);

// DELETE /api/competencies/[id]/courses  { courseId }
export const DELETE = withRole(
  ['group_admin', 'company_admin', 'hr_manager'],
  async (req, { companyId, params }) => {
    try {
      const { courseId } = await req.json();
      await unlinkCourse(params.id, companyId, courseId);
      return NextResponse.json({ success: true });
    } catch (err) {
      return handleApiError(err);
    }
  },
);
