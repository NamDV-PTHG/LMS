import { NextRequest, NextResponse } from 'next/server';
import { withAuth, withRole } from '@/middleware/require-role';
import { getCourse, updateCourse, deleteCourse, updateCourseSchema } from '@/services/course.service';
import { handleApiError } from '@/app/api/error-handler';
import { ValidationError } from '@/lib/errors';
import { logActivity, getClientIp } from '@/lib/activity-logger';
import { prisma } from '@/lib/prisma';

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
  async (req: NextRequest, { params, user, companyId }) => {
    try {
      const body = await req.json();
      const parsed = updateCourseSchema.safeParse(body);
      if (!parsed.success) throw new ValidationError('Dữ liệu không hợp lệ', parsed.error.flatten().fieldErrors);

      const course = await updateCourse(params!.id, parsed.data, companyId, user.id, user.roles);

      const dbUser = await prisma.user.findUnique({ where: { id: user.id }, select: { fullName: true } });
      logActivity({
        companyId, userId: user.id, userFullName: dbUser?.fullName ?? '',
        action: 'UPDATE', resource: 'course',
        resourceId: course.id, resourceTitle: course.title,
        ipAddress: getClientIp(req),
      });

      return NextResponse.json({ success: true, data: course });
    } catch (err) {
      return handleApiError(err);
    }
  },
);

export const DELETE = withRole(
  ['group_admin', 'company_admin', 'instructor'],
  async (req: NextRequest, { params, user, companyId }) => {
    try {
      // getCourse allows archived so we can log the title before deletion
      const course = await getCourse(params!.id, companyId, user.id, user.roles);
      await deleteCourse(params!.id, companyId, user.id, user.roles);

      const dbUser = await prisma.user.findUnique({ where: { id: user.id }, select: { fullName: true } });
      logActivity({
        companyId, userId: user.id, userFullName: dbUser?.fullName ?? '',
        action: 'DELETE', resource: 'course',
        resourceId: params!.id, resourceTitle: course.title,
        ipAddress: getClientIp(req),
      });

      return NextResponse.json({ success: true, data: null });
    } catch (err) {
      return handleApiError(err);
    }
  },
);
