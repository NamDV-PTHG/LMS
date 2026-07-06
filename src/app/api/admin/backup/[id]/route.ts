import { NextResponse } from 'next/server';
import { withRole } from '@/middleware/require-role';
import { getBackupJob } from '@/services/backup.service';
import { handleApiError } from '@/app/api/error-handler';

export const GET = withRole(['group_admin'], async (_req, { params }) => {
  try {
    const job = await getBackupJob(params!.id);
    if (!job) return NextResponse.json({ success: false, error: 'Không tìm thấy backup job' }, { status: 404 });
    return NextResponse.json({ success: true, data: job });
  } catch (err) {
    return handleApiError(err);
  }
});
