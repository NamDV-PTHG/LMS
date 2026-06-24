import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/middleware/require-role';
import { handleApiError } from '@/app/api/error-handler';
import { ValidationError } from '@/lib/errors';

const AI_SERVICE_URL = process.env.AI_SERVICE_URL ?? 'http://localhost:8000';

export const POST = withRole(['company_admin', 'hr_manager', 'instructor', 'group_admin'], async (req) => {
  try {
    const body = await req.json();
    if (!body.topic || !body.targetAudience || !body.durationHours) {
      throw new ValidationError('Thiếu thông tin: topic, targetAudience, durationHours');
    }

    const res = await fetch(`${AI_SERVICE_URL}/api/scripts/generate-course-outline`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topic: body.topic,
        target_audience: body.targetAudience,
        objectives: body.objectives ?? [],
        duration_hours: body.durationHours,
        document_text: body.documentText ?? null,
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
