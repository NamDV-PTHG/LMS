import { NextResponse } from 'next/server';
import { withRole } from '@/middleware/require-role';
import { prisma } from '@/lib/prisma';
import { handleApiError } from '@/app/api/error-handler';

// GET /api/reports/company/[companyId]/ratings — báo cáo đánh giá khóa học của công ty
export const GET = withRole(
  ['group_admin', 'group_hrm', 'company_admin', 'hr_manager'],
  async (_req, { params, user, companyId: reqCompanyId }) => {
    try {
      const targetCompanyId = params!.companyId;
      const isGroupAdmin = user.roles.some((r: string) => ['group_admin', 'group_hrm'].includes(r));
      if (!isGroupAdmin && targetCompanyId !== reqCompanyId) {
        return NextResponse.json({ success: false, error: 'Không có quyền' }, { status: 403 });
      }

      // Lấy tất cả khóa học thuộc công ty + được chia sẻ
      const courses = await prisma.course.findMany({
        where: {
          isActive: true,
          OR: [
            { ownerCompanyId: targetCompanyId },
            { publications: { some: { targetCompanyId, revokedAt: null } } },
          ],
        },
        select: { id: true, title: true },
      });
      const courseIds = courses.map((c) => c.id);

      if (courseIds.length === 0) {
        return NextResponse.json({ success: true, data: { summary: null, topRated: [], bottomRated: [] } });
      }

      // Aggregate ratings
      const ratings = await prisma.courseRating.groupBy({
        by: ['courseId'],
        where: { courseId: { in: courseIds } },
        _avg: { rating: true },
        _count: { rating: true },
      });

      const ratingsMap = new Map(ratings.map((r) => [r.courseId, r]));

      // Tổng kết
      const totalRatings = ratings.reduce((sum, r) => sum + r._count.rating, 0);
      const overallAvg = ratings.length > 0
        ? ratings.reduce((sum, r) => sum + (r._avg.rating ?? 0) * r._count.rating, 0) / totalRatings
        : null;

      // Danh sách khóa học với rating
      const courseList = courses
        .map((c) => {
          const r = ratingsMap.get(c.id);
          return {
            courseId: c.id,
            courseTitle: c.title,
            avgRating: r ? Math.round((r._avg.rating ?? 0) * 10) / 10 : null,
            ratingCount: r ? r._count.rating : 0,
          };
        })
        .filter((c) => c.avgRating !== null);

      const sorted = [...courseList].sort((a, b) => (b.avgRating ?? 0) - (a.avgRating ?? 0));
      const topRated = sorted.slice(0, 5);
      const bottomRated = [...sorted].reverse().slice(0, 5);

      return NextResponse.json({
        success: true,
        data: {
          summary: {
            totalRatings,
            avgRating: overallAvg !== null ? Math.round(overallAvg * 10) / 10 : null,
            ratedCoursesCount: ratings.length,
            totalCoursesCount: courseIds.length,
          },
          topRated,
          bottomRated,
        },
      });
    } catch (err) {
      return handleApiError(err);
    }
  },
);
