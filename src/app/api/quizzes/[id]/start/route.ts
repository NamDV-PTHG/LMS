import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/middleware/require-role';
import { startQuiz } from '@/services/quiz.service';
import { handleApiError } from '@/app/api/error-handler';
import { ValidationError } from '@/lib/errors';

export const GET = withAuth(async (req, { params, user }) => {
  try {
    const enrollmentId = req.nextUrl.searchParams.get('enrollmentId');
    if (!enrollmentId) throw new ValidationError('Thiếu enrollmentId');

    const session = await startQuiz(params!.id, user.id, enrollmentId);
    return NextResponse.json({ success: true, data: session });
  } catch (err) {
    return handleApiError(err);
  }
});
