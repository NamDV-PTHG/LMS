import { NextResponse } from 'next/server';
import { withAuth } from '@/middleware/require-role';
import { getMyCourse } from '@/services/enrollment.service';
import { handleApiError } from '@/app/api/error-handler';

export const GET = withAuth(async (_req, { params, user, companyId }) => {
  try {
    const course = await getMyCourse(params!.id, user.id, companyId);
    return NextResponse.json({ success: true, data: course });
  } catch (err) {
    return handleApiError(err);
  }
});
