import { NextResponse } from 'next/server';
import { withRole } from '@/middleware/require-role';
import { getPosition, updatePosition, deletePosition } from '@/services/position.service';
import { handleApiError } from '@/app/api/error-handler';
import { enrollUserToPath } from '@/services/learning-path.service';
import { prisma } from '@/lib/prisma';

export const GET = withRole(
  ['group_admin', 'company_admin', 'hr_manager', 'instructor'],
  async (_req, { companyId, params }) => {
    try {
      const data = await getPosition(params.id, companyId);
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

      // Capture current learningPathId to detect changes for cascade enrollment
      const before = await prisma.jobPosition.findFirst({
        where: { id: params.id, companyId },
        select: { learningPathId: true },
      });

      const data = await updatePosition(params.id, companyId, {
        title: body.title,
        code: body.code,
        level: body.level,
        description: body.description,
        organizationId: body.organizationId,
        competencyFrameworkId: body.competencyFrameworkId,
        learningPathId: body.learningPathId,
        catalogId: body.catalogId,
        impliedRole: body.impliedRole,
        isActive: body.isActive,
      });

      // If a new learningPathId was assigned, enroll all current holders of this position
      const newPathId: string | undefined =
        body.learningPathId && body.learningPathId !== before?.learningPathId
          ? body.learningPathId
          : undefined;

      if (newPathId) {
        prisma.user
          .findMany({
            where: { jobPositionId: params.id, isActive: true },
            select: { id: true },
          })
          .then((holders) => {
            for (const u of holders) {
              enrollUserToPath(u.id, newPathId, companyId, user.id, {
                enrollmentType: 'POSITION_CHANGE',
              }).catch(() => {});
            }
          })
          .catch(() => {});
      }

      return NextResponse.json({ success: true, data });
    } catch (err) {
      return handleApiError(err);
    }
  },
);

export const DELETE = withRole(
  ['group_admin', 'company_admin', 'hr_manager'],
  async (_req, { companyId, params }) => {
    try {
      await deletePosition(params.id, companyId);
      return NextResponse.json({ success: true });
    } catch (err) {
      return handleApiError(err);
    }
  },
);
