import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/middleware/require-role';
import { updateLessonProgress } from '@/services/enrollment.service';
import { handleApiError } from '@/app/api/error-handler';
import { z } from 'zod';
import { ValidationError } from '@/lib/errors';

const progressSchema = z.object({
  progressPct: z.number().min(0).max(100),
  timeSpentSec: z.number().int().min(0).optional(),
  status: z.enum(['in_progress', 'completed']).optional(),
});

export const POST = withAuth(async (req, { params, user, companyId }) => {
  try {
    const body = await req.json();
    const parsed = progressSchema.safeParse(body);
    if (!parsed.success) throw new ValidationError('Dữ liệu không hợp lệ', parsed.error.flatten().fieldErrors);

    const progress = await updateLessonProgress(
      params!.id,
      params!.lessonId,
      user.id,
      companyId,
      parsed.data,
    );
    return NextResponse.json({ success: true, data: progress });
  } catch (err) {
    return handleApiError(err);
  }
});
