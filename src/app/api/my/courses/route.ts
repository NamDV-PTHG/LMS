import { NextResponse } from 'next/server';
import { withAuth } from '@/middleware/require-role';
import { getMyCourses } from '@/services/enrollment.service';
import { handleApiError } from '@/app/api/error-handler';

export const GET = withAuth(async (_req, { user, companyId }) => {
  try {
    const courses = await getMyCourses(user.id, companyId);
    return NextResponse.json({ success: true, data: courses, meta: { total: courses.length } });
  } catch (err) {
    return handleApiError(err);
  }
});
