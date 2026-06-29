import { NextResponse } from 'next/server';
import { withRole } from '@/middleware/require-role';
import { prisma } from '@/lib/prisma';
import { handleApiError } from '@/app/api/error-handler';
import { ForbiddenError, NotFoundError } from '@/lib/errors';

// GET /api/courses/[id]/publications — danh sách công ty đang được chia sẻ
export const GET = withRole(
  ['group_admin', 'company_admin', 'instructor'],
  async (_req, { params, user }) => {
    try {
      const courseId = params!.id;

      // Kiểm tra khóa học tồn tại
      const course = await prisma.course.findUnique({ where: { id: courseId } });
      if (!course || !course.isActive) throw new NotFoundError('Khóa học');

      const publications = await prisma.coursePublication.findMany({
        where: { courseId, revokedAt: null },
        include: {
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

// DELETE /api/courses/[id]/publications — thu hồi chia sẻ (body: { publicationId })
export const DELETE = withRole(
  ['group_admin'],
  async (req, { params, user }) => {
    try {
      const courseId = params!.id;
      const body = await req.json().catch(() => ({}));
      const { publicationId } = body as { publicationId?: string };

      if (!publicationId) {
        return NextResponse.json({ success: false, error: 'Thiếu publicationId' }, { status: 400 });
      }

      const pub = await prisma.coursePublication.findUnique({ where: { id: publicationId } });
      if (!pub || pub.courseId !== courseId) throw new NotFoundError('Chia sẻ');

      await prisma.coursePublication.update({
        where: { id: publicationId },
        data: { revokedAt: new Date() },
      });

      return NextResponse.json({ success: true });
    } catch (err) {
      return handleApiError(err);
    }
  },
);
