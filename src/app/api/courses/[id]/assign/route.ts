import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/middleware/require-role';
import { assignCourse, assignCourseSchema } from '@/services/course.service';
import { handleApiError } from '@/app/api/error-handler';
import { ValidationError } from '@/lib/errors';

export const POST = withRole(
  ['group_admin', 'company_admin', 'hr_manager'],
  async (req, { params, user, companyId }) => {
    try {
      const body = await req.json();
      const parsed = assignCourseSchema.safeParse({ ...body, courseId: params!.id });
      if (!parsed.success) throw new ValidationError('Dữ liệu không hợp lệ', parsed.error.flatten().fieldErrors);

      const assignment = await assignCourse(parsed.data, companyId, user.id);
      return NextResponse.json({ success: true, data: assignment }, { status: 201 });
    } catch (err) {
      return handleApiError(err);
    }
  },
);
