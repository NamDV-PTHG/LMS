import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/middleware/require-role';
import { getLearningPaths, createLearningPath } from '@/services/learning-path.service';
import { handleApiError } from '@/app/api/error-handler';
import { getScopedUserIds } from '@/services/org-scope.service';
import { logActivity, getClientIp } from '@/lib/activity-logger';
import { prisma } from '@/lib/prisma';

export const GET = withRole(
  ['group_admin', 'company_admin', 'hr_manager', 'instructor', 'dept_head'],
  async (req, { user, companyId }) => {
    const { searchParams } = new URL(req.url);
    const isActive = searchParams.has('isActive') ? searchParams.get('isActive') === 'true' : undefined;

    const userRoles = user.roles.map((r: unknown) =>
      typeof r === 'string' ? r : (r as { role: string }).role
    );
    const scopedUserIds = await getScopedUserIds(user.id, userRoles);

    const data = await getLearningPaths(companyId, isActive, scopedUserIds);
    return NextResponse.json({ success: true, data });
  },
);

export const POST = withRole(
  ['group_admin', 'company_admin', 'hr_manager'],
  async (req: NextRequest, { user, companyId }) => {
    try {
      const body = await req.json();
      if (!body.name?.trim()) return NextResponse.json({ success: false, error: 'Tên là bắt buộc', code: 'VALIDATION_ERROR' }, { status: 400 });

      const data = await createLearningPath(companyId, body, user.id);

      const dbUser = await prisma.user.findUnique({ where: { id: user.id }, select: { fullName: true } });
      logActivity({
        companyId, userId: user.id, userFullName: dbUser?.fullName ?? '',
        action: 'CREATE', resource: 'learning_path',
        resourceId: data.id, resourceTitle: data.name,
        ipAddress: getClientIp(req),
      });

      return NextResponse.json({ success: true, data }, { status: 201 });
    } catch (err) {
      return handleApiError(err);
    }
  },
);
