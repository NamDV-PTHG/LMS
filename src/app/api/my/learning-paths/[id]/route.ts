import { NextResponse } from 'next/server';
import { withRole } from '@/middleware/require-role';
import { prisma } from '@/lib/prisma';
import { handleApiError } from '@/app/api/error-handler';

// GET /api/my/learning-paths/[id] — detail view of one enrollment
export const GET = withRole(
  ['learner', 'instructor', 'hr_manager', 'company_admin', 'group_admin'],
  async (_req, { user, params }) => {
    try {
      const enrollment = await prisma.learningPathEnrollment.findFirst({
        where: { id: params.id, userId: user.id },
        include: {
          learningPath: {
            select: { id: true, name: true, description: true, totalDeadlineDays: true },
          },
          stepEnrollments: {
            include: {
              step: {
                include: {
                  course: {
                    select: {
                      id: true,
                      title: true,
                      description: true,
                      estimatedHours: true,
                      thumbnailUrl: true,
                    },
                  },
                  prerequisiteStep: { select: { id: true, stepOrder: true } },
                },
              },
              courseEnrollment: {
                select: { id: true, progressPct: true, completedAt: true },
              },
            },
            orderBy: { step: { stepOrder: 'asc' } },
          },
        },
      });

      if (!enrollment) {
        return NextResponse.json({ success: false, error: 'Không tìm thấy lộ trình', code: 'NOT_FOUND' }, { status: 404 });
      }

      return NextResponse.json({ success: true, data: enrollment });
    } catch (err) {
      return handleApiError(err);
    }
  },
);
