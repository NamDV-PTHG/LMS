import { NextRequest, NextResponse } from 'next/server';
import { withRole, withAuth } from '@/middleware/require-role';
import { getCourses, createCourse, createCourseSchema } from '@/services/course.service';
import { handleApiError } from '@/app/api/error-handler';
import { ValidationError } from '@/lib/errors';
import { getScopedUserIds } from '@/services/org-scope.service';
import { logActivity, getClientIp } from '@/lib/activity-logger';
import { prisma } from '@/lib/prisma';

export const GET = withAuth(async (req, { user, companyId }) => {
  const sp = req.nextUrl.searchParams;
  const page = parseInt(sp.get('page') ?? '1', 10);
  const limit = Math.min(parseInt(sp.get('limit') ?? '20', 10), 100);
  const published = sp.has('published') ? sp.get('published') === 'true' : undefined;
  const includeShared = sp.get('includeShared') === 'true';

  const userRoles = user.roles.map((r: unknown) =>
    typeof r === 'string' ? r : (r as { role: string }).role
  );
  const isGroupAdmin = userRoles.includes('group_admin');

  // Restrict scope for instructor/dept_head
  const scopedUserIds = await getScopedUserIds(user.id, userRoles);

  const result = await getCourses(companyId, isGroupAdmin, { page, limit, published, includeShared }, scopedUserIds);
  return NextResponse.json({ success: true, data: result.items, meta: result });
});

export const POST = withRole(
  ['group_admin', 'company_admin', 'instructor'],
  async (req: NextRequest, { user, companyId }) => {
    try {
      const body = await req.json();
      const parsed = createCourseSchema.safeParse(body);
      if (!parsed.success) throw new ValidationError('Dữ liệu không hợp lệ', parsed.error.flatten().fieldErrors);

      const course = await createCourse(parsed.data, companyId, user.id);

      const dbUser = await prisma.user.findUnique({ where: { id: user.id }, select: { fullName: true } });
      logActivity({
        companyId, userId: user.id, userFullName: dbUser?.fullName ?? '',
        action: 'CREATE', resource: 'course',
        resourceId: course.id, resourceTitle: course.title,
        ipAddress: getClientIp(req),
      });

      return NextResponse.json({ success: true, data: course }, { status: 201 });
    } catch (err) {
      return handleApiError(err);
    }
  },
);
