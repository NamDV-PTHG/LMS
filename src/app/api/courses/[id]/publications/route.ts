import { NextResponse } from 'next/server';
import { withRole } from '@/middleware/require-role';
import { prisma } from '@/lib/prisma';
import { handleApiError } from '@/app/api/error-handler';
import { z } from 'zod';
import { ForbiddenError, NotFoundError, ValidationError } from '@/lib/errors';

/**
 * GET /api/courses/:id/publications
 * Danh sách các công ty đang được chia sẻ khóa học này.
 * company_admin/hr_manager chỉ thấy publications của khóa học thuộc công ty mình.
 */
export const GET = withRole(
  ['group_admin', 'group_hrm', 'company_admin', 'hr_manager'],
  async (_req, { params, user, companyId }) => {
    try {
      const courseId = params!.id;
      const isGroupLevel = user.roles.includes('group_admin') || user.roles.includes('group_hrm');

      // Verify quyền truy cập cho company-level user
      if (!isGroupLevel) {
        const course = await prisma.course.findUnique({
          where: { id: courseId, isActive: true },
          select: { ownerCompanyId: true },
        });
        if (!course) throw new NotFoundError('Khóa học');
        if (course.ownerCompanyId !== companyId) {
          throw new ForbiddenError('Bạn chỉ có thể xem chia sẻ của khóa học thuộc công ty mình');
        }
      }

      const publications = await prisma.coursePublication.findMany({
        where: { courseId, revokedAt: null },
        select: {
          id: true,
          isMandatory: true,
          deadline: true,
          publishedAt: true,
          targetCompany: { select: { id: true, name: true, code: true } },
          publisher: { select: { id: true, fullName: true } },
        },
        orderBy: { publishedAt: 'desc' },
      });

      return NextResponse.json({ success: true, data: publications });
    } catch (err) {
      return handleApiError(err);
    }
  },
);

const revokeSchema = z.object({
  publicationId: z.string().uuid(),
});

/**
 * DELETE /api/courses/:id/publications
 * Thu hồi chia sẻ khóa học với một công ty (soft-delete bằng revokedAt).
 */
export const DELETE = withRole(
  ['group_admin', 'group_hrm', 'company_admin', 'hr_manager'],
  async (req, { params, user, companyId }) => {
    try {
      const body = await req.json();
      const parsed = revokeSchema.safeParse(body);
      if (!parsed.success) throw new ValidationError('publicationId không hợp lệ');

      const { publicationId } = parsed.data;
      const courseId = params!.id;
      const isGroupLevel = user.roles.includes('group_admin') || user.roles.includes('group_hrm');

      const pub = await prisma.coursePublication.findUnique({
        where: { id: publicationId },
        select: {
          id: true,
          courseId: true,
          revokedAt: true,
          course: { select: { ownerCompanyId: true } },
        },
      });
      if (!pub || pub.courseId !== courseId) throw new NotFoundError('Bản chia sẻ');
      if (pub.revokedAt) throw new ValidationError('Bản chia sẻ đã bị thu hồi trước đó');

      // company-level user chỉ thu hồi chia sẻ của khóa học thuộc công ty mình
      if (!isGroupLevel && pub.course.ownerCompanyId !== companyId) {
        throw new ForbiddenError('Bạn không có quyền thu hồi chia sẻ này');
      }

      await prisma.coursePublication.update({
        where: { id: publicationId },
        data: { revokedAt: new Date() },
      });

      return NextResponse.json({ success: true, data: null });
    } catch (err) {
      return handleApiError(err);
    }
  },
);
