import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/middleware/require-role';
import { handleApiError } from '@/app/api/error-handler';
import { ValidationError } from '@/lib/errors';

const AI_SERVICE_URL = process.env.AI_SERVICE_URL ?? 'http://localhost:8000';

export const POST = withRole(['company_admin', 'hr_manager', 'instructor', 'group_admin'], async (req) => {
  try {
    const body = await req.json();
    if (!body.lessonTitle || !body.sectionContext) {
      throw new ValidationError('Thiếu lessonTitle, sectionContext');
    }

    const res = await fetch(`${AI_SERVICE_URL}/api/scripts/generate-lesson-script`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lesson_title: body.lessonTitle,
        section_context: body.sectionContext,
        course_objectives: body.courseObjectives ?? [],
        duration_mins: body.durationMins ?? 15,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error ?? `AI Service error: ${res.status}`);
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    return handleApiError(err);
  }
});
