import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/middleware/require-role';
import { publishCourse, publishCourseSchema } from '@/services/course.service';
import { handleApiError } from '@/app/api/error-handler';
import { ValidationError } from '@/lib/errors';

export const POST = withRole(
  ['group_admin', 'company_admin', 'instructor'],
  async (req, { params, user, companyId }) => {
    try {
      const body = await req.json().catch(() => ({}));
      const parsed = publishCourseSchema.safeParse(body);
      if (!parsed.success) throw new ValidationError('Dữ liệu không hợp lệ', parsed.error.flatten().fieldErrors);

      const course = await publishCourse(params!.id, parsed.data, companyId, user.id, user.roles);
      return NextResponse.json({ success: true, data: course });
    } catch (err) {
      return handleApiError(err);
    }
  },
);
