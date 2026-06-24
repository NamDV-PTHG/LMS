import { NextResponse } from 'next/server';
import { withRole } from '@/middleware/require-role';
import { getGroupOverview } from '@/services/report.service';
import { handleApiError } from '@/app/api/error-handler';

export const GET = withRole(['group_admin'], async () => {
  try {
    const data = await getGroupOverview();
    return NextResponse.json({ success: true, data });
  } catch (err) {
    return handleApiError(err);
  }
});
