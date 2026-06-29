import { NextResponse } from 'next/server';
import { withAuth } from '@/middleware/require-role';
import { prisma } from '@/lib/prisma';
import { handleApiError } from '@/app/api/error-handler';
import { NotFoundError, ValidationError } from '@/lib/errors';

// POST /api/my/courses/[id]/rate — gửi đánh giá sau khi hoàn thành khóa học
export const POST = withAuth(async (req, { params, user }) => {
  try {
    const courseId = params!.id;
    const body = await req.json().catch(() => ({}));
    const { rating, comment } = body as { rating?: unknown; comment?: unknown };

    if (!rating || typeof rating !== 'number' || rating < 1 || rating > 5 || !Number.isInteger(rating)) {
      throw new ValidationError('rating phải là số nguyên từ 1 đến 5');
    }

    // Kiểm tra enrollment tồn tại
    const enrollment = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId: user.id, courseId } },
    });
    if (!enrollment) throw new NotFoundError('Enrollment');

    // Upsert rating (1 người 1 đánh giá / khóa học)
    const result = await prisma.courseRating.upsert({
      where: { courseId_userId: { courseId, userId: user.id } },
      create: {
        courseId,
        userId: user.id,
        enrollmentId: enrollment.id,
        rating,
        comment: typeof comment === 'string' ? comment.trim().slice(0, 2000) : null,
      },
      update: {
        rating,
        comment: typeof comment === 'string' ? comment.trim().slice(0, 2000) : null,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    return handleApiError(err);
  }
});

// GET /api/my/courses/[id]/rate — kiểm tra đã đánh giá chưa
export const GET = withAuth(async (_req, { params, user }) => {
  try {
    const courseId = params!.id;
    const existing = await prisma.courseRating.findUnique({
      where: { courseId_userId: { courseId, userId: user.id } },
    });
    return NextResponse.json({ success: true, data: existing ?? null });
  } catch (err) {
    return handleApiError(err);
  }
});
