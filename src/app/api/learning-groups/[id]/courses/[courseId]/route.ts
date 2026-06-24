import { NextResponse } from 'next/server';
import { withRole } from '@/middleware/require-role';
import { removeCourse } from '@/services/learning-group.service';
import { handleApiError } from '@/app/api/error-handler';

export const DELETE = withRole(['group_admin', 'group_hrm'], async (_req, { params }) => {
  try {
    await removeCourse(params!.id, params!.courseId);
    return NextResponse.json({ success: true });
  } catch (err) {
    return handleApiError(err);
  }
});
