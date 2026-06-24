import { NextResponse } from 'next/server';
import { withRole } from '@/middleware/require-role';
import { removeMember } from '@/services/learning-group.service';
import { handleApiError } from '@/app/api/error-handler';

export const DELETE = withRole(['group_admin', 'group_hrm'], async (_req, { params }) => {
  try {
    await removeMember(params!.id, params!.userId);
    return NextResponse.json({ success: true });
  } catch (err) {
    return handleApiError(err);
  }
});
