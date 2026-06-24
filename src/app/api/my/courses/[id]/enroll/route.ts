import { NextResponse } from 'next/server';
import { withAuth } from '@/middleware/require-role';
import { enrollCourse } from '@/services/enrollment.service';
import { handleApiError } from '@/app/api/error-handler';

export const POST = withAuth(async (_req, { params, user, companyId }) => {
  try {
    const enrollment = await enrollCourse(params!.id, user.id, companyId);
    return NextResponse.json({ success: true, data: enrollment }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
});
