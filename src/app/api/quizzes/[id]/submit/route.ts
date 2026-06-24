import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/middleware/require-role';
import { submitQuiz, submitAnswersSchema } from '@/services/quiz.service';
import { handleApiError } from '@/app/api/error-handler';
import { ValidationError } from '@/lib/errors';

export const POST = withAuth(async (req, { params, user, companyId }) => {
  try {
    const body = await req.json();
    const parsed = submitAnswersSchema.safeParse(body);
    if (!parsed.success) throw new ValidationError('Dữ liệu không hợp lệ', parsed.error.flatten().fieldErrors);

    const result = await submitQuiz(params!.id, user.id, companyId, parsed.data.answers);
    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    return handleApiError(err);
  }
});
