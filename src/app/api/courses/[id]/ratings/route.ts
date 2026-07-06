import { NextResponse } from 'next/server';
import { withRole } from '@/middleware/require-role';
import { handleApiError } from '@/app/api/error-handler';
import { prisma } from '@/lib/prisma';

// GET /api/courses/[id]/ratings — returns individual ratings with comments
export const GET = withRole(
  ['group_admin', 'group_hrm', 'company_admin', 'hr_manager', 'instructor'],
  async (req, { params }) => {
    try {
      const ratings = await prisma.courseRating.findMany({
        where: { courseId: params.id },
        include: {
          user: { select: { id: true, fullName: true, employeeCode: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      });

      const total = ratings.length;
      const avg = total > 0
        ? Math.round((ratings.reduce((s, r) => s + r.rating, 0) / total) * 10) / 10
        : 0;

      const dist = [1, 2, 3, 4, 5].map((star) => ({
        star,
        count: ratings.filter((r) => r.rating === star).length,
      }));

      return NextResponse.json({ success: true, data: { ratings, total, avg, dist } });
    } catch (err) {
      return handleApiError(err);
    }
  },
);
