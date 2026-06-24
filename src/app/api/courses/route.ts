import { NextRequest, NextResponse } from 'next/server';
import { withRole, withAuth } from '@/middleware/require-role';
import { getCourses, createCourse, createCourseSchema } from '@/services/course.service';
import { handleApiError } from '@/app/api/error-handler';
import { ValidationError } from '@/lib/errors';

export const GET = withAuth(async (req, { user, companyId }) => {
  const sp = req.nextUrl.searchParams;
  const page = parseInt(sp.get('page') ?? '1', 10);
  const limit = Math.min(parseInt(sp.get('limit') ?? '20', 10), 100);
  const published = sp.has('published') ? sp.get('published') === 'true' : undefined;

  const isGroupAdmin = user.roles.includes('group_admin');
  const result = await getCourses(companyId, isGroupAdmin, { page, limit, published });
  return NextResponse.json({ success: true, data: result.items, meta: result });
});

export const POST = withRole(
  ['group_admin', 'company_admin', 'instructor'],
  async (req, { user, companyId }) => {
    try {
      const body = await req.json();
      const parsed = createCourseSchema.safeParse(body);
      if (!parsed.success) throw new ValidationError('Dữ liệu không hợp lệ', parsed.error.flatten().fieldErrors);

      const course = await createCourse(parsed.data, companyId, user.id);
      return NextResponse.json({ success: true, data: course }, { status: 201 });
    } catch (err) {
      return handleApiError(err);
    }
  },
);
