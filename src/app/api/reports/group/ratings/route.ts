import { NextResponse } from 'next/server';
import { withRole } from '@/middleware/require-role';
import { prisma } from '@/lib/prisma';
import { handleApiError } from '@/app/api/error-handler';

// GET /api/reports/group/ratings — tổng quan đánh giá toàn tập đoàn
export const GET = withRole(
  ['group_admin', 'group_hrm'],
  async (_req, { }) => {
    try {
      const [totalRatings, avgResult, topRated] = await Promise.all([
        prisma.courseRating.count(),
        prisma.courseRating.aggregate({ _avg: { rating: true } }),
        prisma.courseRating.groupBy({
          by: ['courseId'],
          _avg: { rating: true },
          _count: { rating: true },
          having: { rating: { _count: { gte: 1 } } },
          orderBy: { _avg: { rating: 'desc' } },
          take: 5,
        }),
      ]);

      // Lấy tên khóa học cho top rated
      const courseIds = topRated.map((r) => r.courseId);
      const courses = await prisma.course.findMany({
        where: { id: { in: courseIds } },
        select: { id: true, title: true, ownerCompany: { select: { name: true } } },
      });
      const courseMap = new Map(courses.map((c) => [c.id, c]));

      const topRatedWithTitle = topRated.map((r) => {
        const c = courseMap.get(r.courseId);
        return {
          courseId: r.courseId,
          courseTitle: c?.title ?? 'N/A',
          companyName: c?.ownerCompany?.name ?? 'N/A',
          avgRating: Math.round((r._avg.rating ?? 0) * 10) / 10,
          ratingCount: r._count.rating,
        };
      });

      return NextResponse.json({
        success: true,
        data: {
          totalRatings,
          avgRating: avgResult._avg.rating !== null
            ? Math.round((avgResult._avg.rating ?? 0) * 10) / 10
            : null,
          topRated: topRatedWithTitle,
        },
      });
    } catch (err) {
      return handleApiError(err);
    }
  },
);
