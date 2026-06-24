import { NextResponse } from 'next/server';
import { withRole } from '@/middleware/require-role';
import { updateLesson } from '@/services/course.service';
import { handleApiError } from '@/app/api/error-handler';
import { z } from 'zod';
import { ValidationError } from '@/lib/errors';

const updateLessonSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  estimatedMinutes: z.number().int().positive().optional(),
});

export const PATCH = withRole(
  ['group_admin', 'company_admin', 'instructor'],
  async (req, { params, user, companyId }) => {
    try {
      const body = await req.json();
      const parsed = updateLessonSchema.safeParse(body);
      if (!parsed.success) throw new ValidationError('Dữ liệu không hợp lệ', parsed.error.flatten().fieldErrors);
      const lesson = await updateLesson(params!.id, params!.sId, params!.lessonId, parsed.data, companyId, user.id, user.roles);
      return NextResponse.json({ success: true, data: lesson });
    } catch (err) {
      return handleApiError(err);
    }
  },
);
