import { NextResponse } from 'next/server';
import { withRole } from '@/middleware/require-role';
import { getLearningGroupProgress } from '@/services/report.service';
import { handleApiError } from '@/app/api/error-handler';

export const GET = withRole(['group_admin', 'group_hrm'], async (_req, { params }) => {
  try {
    const data = await getLearningGroupProgress(params!.id);
    return NextResponse.json({ success: true, data });
  } catch (err) {
    return handleApiError(err);
  }
});
