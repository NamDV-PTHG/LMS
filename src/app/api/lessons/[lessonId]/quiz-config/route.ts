import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/middleware/require-role';
import { prisma } from '@/lib/prisma';
import { handleApiError } from '@/app/api/error-handler';
import { ValidationError } from '@/lib/errors';
import { z } from 'zod';

const quizConfigSchema = z.object({
  bankIds:          z.array(z.string()).min(1),
  totalQuestions:   z.number().int().min(1),
  easyCount:        z.number().int().min(0),
  mediumCount:      z.number().int().min(0),
  hardCount:        z.number().int().min(0),
  passingScore:     z.number().min(0).max(100),
  timeLimitMins:    z.number().int().positive().nullable(),
  maxAttempts:      z.number().int().min(1),
  shuffleQuestions: z.boolean(),
  shuffleOptions:   z.boolean(),
});

// GET /api/lessons/:lessonId/quiz-config
export const GET = withRole(['company_admin', 'hr_manager', 'instructor', 'group_admin'], async (_req, { params }) => {
  try {
    const cfg = await prisma.quizConfig.findUnique({ where: { lessonId: params!.lessonId } });
    return NextResponse.json({ success: true, data: cfg });
  } catch (err) {
    return handleApiError(err);
  }
});

// PUT /api/lessons/:lessonId/quiz-config — create or replace
export const PUT = withRole(['company_admin', 'hr_manager', 'instructor', 'group_admin'], async (req, { params }) => {
  try {
    const body = await req.json();
    const parsed = quizConfigSchema.safeParse(body);
    if (!parsed.success) throw new ValidationError('Dữ liệu không hợp lệ', parsed.error.flatten().fieldErrors);

    const { totalQuestions, easyCount, mediumCount, hardCount } = parsed.data;
    if (easyCount + mediumCount + hardCount !== totalQuestions) {
      throw new ValidationError(`easy(${easyCount})+medium(${mediumCount})+hard(${hardCount}) phải bằng totalQuestions(${totalQuestions})`);
    }

    const cfg = await prisma.quizConfig.upsert({
      where: { lessonId: params!.lessonId },
      update: parsed.data,
      create: { lessonId: params!.lessonId, ...parsed.data },
    });

    return NextResponse.json({ success: true, data: cfg });
  } catch (err) {
    return handleApiError(err);
  }
});
