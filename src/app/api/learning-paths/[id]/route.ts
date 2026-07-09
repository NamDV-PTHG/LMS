import { NextResponse } from 'next/server';
import { withRole } from '@/middleware/require-role';
import { getLearningPath, updateLearningPath, deleteLearningPath } from '@/services/learning-path.service';
import { handleApiError } from '@/app/api/error-handler';
import { logActivity, getClientIp } from '@/lib/activity-logger';
import { prisma } from '@/lib/prisma';

export const GET = withRole(
  ['group_admin', 'company_admin', 'hr_manager'],
  async (_req, { companyId, params }) => {
    try {
      const data = await getLearningPath(params.id, companyId);
      return NextResponse.json({ success: true, data });
    } catch (err) {
      return handleApiError(err);
    }
  },
);

export const PATCH = withRole(
  ['group_admin', 'company_admin', 'hr_manager'],
  async (req, { companyId, params, user }) => {
    try {
      const body = await req.json();
      const data = await updateLearningPath(params.id, companyId, body);

      const dbUser = await prisma.user.findUnique({ where: { id: user.id }, select: { fullName: true } });
      logActivity({
        companyId, userId: user.id, userFullName: dbUser?.fullName ?? '',
        action: 'UPDATE', resource: 'learning_path',
        resourceId: data.id, resourceTitle: data.name,
        ipAddress: getClientIp(req),
      });

      return NextResponse.json({ success: true, data });
    } catch (err) {
      return handleApiError(err);
    }
  },
);

export const DELETE = withRole(
  ['group_admin', 'company_admin', 'hr_manager'],
  async (req, { companyId, params, user }) => {
    try {
      const existing = await getLearningPath(params.id, companyId);
      await deleteLearningPath(params.id, companyId);

      const dbUser = await prisma.user.findUnique({ where: { id: user.id }, select: { fullName: true } });
      logActivity({
        companyId, userId: user.id, userFullName: dbUser?.fullName ?? '',
        action: 'DELETE', resource: 'learning_path',
        resourceId: params.id, resourceTitle: existing.name,
        ipAddress: getClientIp(req),
      });

      return NextResponse.json({ success: true });
    } catch (err) {
      return handleApiError(err);
    }
  },
);
