import { NextResponse } from 'next/server';
import { withRole } from '@/middleware/require-role';
import { prisma } from '@/lib/prisma';
import { handleApiError } from '@/app/api/error-handler';
import { NotFoundError, ForbiddenError } from '@/lib/errors';

/**
 * GET /api/courses/:id/share-companies
 * Trả về danh sách công ty có thể chia sẻ khóa học này:
 *   - group_admin/group_hrm: tất cả công ty, trừ công ty sở hữu khóa học
 *   - company_admin/hr_manager: tất cả công ty, trừ công ty của chính mình
 *     (và chỉ được gọi nếu khóa học thuộc công ty mình)
 * Mỗi công ty trả về thêm `alreadyShared` để frontend biết đã chia sẻ hay chưa.
 */
export const GET = withRole(
  ['group_admin', 'group_hrm', 'company_admin', 'hr_manager'],
  async (_req, { params, user, companyId }) => {
    try {
      const courseId = params!.id;
      const isGroupLevel = user.roles.includes('group_admin') || user.roles.includes('group_hrm');

      const course = await prisma.course.findUnique({
        where: { id: courseId, isActive: true },
        select: { id: true, ownerCompanyId: true },
      });
      if (!course) throw new NotFoundError('Khóa học');

      // company_admin/hr_manager chỉ được xem danh sách chia sẻ của khóa học mình sở hữu
      if (!isGroupLevel && course.ownerCompanyId !== companyId) {
        throw new ForbiddenError('Bạn chỉ có thể chia sẻ khóa học thuộc công ty của mình');
      }

      // Lấy tất cả công ty (type=company), trừ công ty sở hữu khóa học
      const excludeCompanyId = isGroupLevel ? course.ownerCompanyId : companyId;

      const [allCompanies, existingPubs] = await Promise.all([
        prisma.organization.findMany({
          where: {
            type: 'company',
            isActive: true,
            id: { not: excludeCompanyId },
          },
          select: { id: true, name: true, code: true },
          orderBy: { name: 'asc' },
        }),
        prisma.coursePublication.findMany({
          where: { courseId, revokedAt: null },
          select: { targetCompanyId: true },
        }),
      ]);

      const sharedIds = new Set(existingPubs.map((p) => p.targetCompanyId));

      const result = allCompanies.map((c) => ({
        id: c.id,
        name: c.name,
        code: c.code,
        alreadyShared: sharedIds.has(c.id),
      }));

      return NextResponse.json({ success: true, data: result });
    } catch (err) {
      return handleApiError(err);
    }
  },
);
