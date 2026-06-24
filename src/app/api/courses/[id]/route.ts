import { NextRequest, NextResponse } from 'next/server';
import { withAuth, withRole } from '@/middleware/require-role';
import { getCourse, updateCourse, deleteCourse, updateCourseSchema } from '@/services/course.service';
import { handleApiError } from '@/app/api/error-handler';
import { ValidationError } from '@/lib/errors';

export const GET = withAuth(async (_req, { params, user, companyId }) => {
  try {
    const course = await getCourse(params!.id, companyId, user.id, user.roles);
    return NextResponse.json({ success: true, data: course });
  } catch (err) {
    return handleApiError(err);
  }
});

export const PATCH = withRole(
  ['group_admin', 'company_admin', 'instructor'],
  async (req, { params, user, companyId }) => {
    try {
      const body = await req.json();
      const parsed = updateCourseSchema.safeParse(body);
      if (!parsed.success) throw new ValidationError('Dữ liệu không hợp lệ', parsed.error.flatten().fieldErrors);

      const course = await updateCourse(params!.id, parsed.data, companyId, user.id, user.roles);
      return NextResponse.json({ success: true, data: course });
    } catch (err) {
      return handleApiError(err);
    }
  },
);

export const DELETE = withRole(
  ['group_admin', 'company_admin', 'instructor'],
  async (_req, { params, user, companyId }) => {
    try {
      await deleteCourse(params!.id, companyId, user.id, user.roles);
      return NextResponse.json({ success: true, data: null });
    } catch (err) {
      return handleApiError(err);
    }
  },
);
