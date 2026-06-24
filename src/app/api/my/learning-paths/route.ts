import { NextResponse } from 'next/server';
import { withRole } from '@/middleware/require-role';
import { prisma } from '@/lib/prisma';
import { handleApiError } from '@/app/api/error-handler';

// GET /api/my/learning-paths — learner views their own learning paths
export const GET = withRole(
  ['learner', 'instructor', 'hr_manager', 'company_admin', 'group_admin'],
  async (_req, { user }) => {
    try {
      const enrollments = await prisma.learningPathEnrollment.findMany({
        where: { userId: user.id },
        include: {
          learningPath: { select: { id: true, name: true, description: true } },
          stepEnrollments: {
            include: {
              step: {
                include: {
                  course: { select: { id: true, title: true, estimatedHours: true, thumbnailUrl: true } },
                },
              },
            },
            orderBy: { step: { stepOrder: 'asc' } },
          },
        },
        orderBy: { startedAt: 'desc' },
      });
      return NextResponse.json({ success: true, data: enrollments });
    } catch (err) {
      return handleApiError(err);
    }
  },
);
