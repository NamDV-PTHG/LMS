import { NextResponse } from 'next/server';
import { withRole } from '@/middleware/require-role';
import { testBackupConnection } from '@/services/backup.service';
import { handleApiError } from '@/app/api/error-handler';

export const POST = withRole(['group_admin'], async (_req, _ctx) => {
  try {
    const result = await testBackupConnection();
    return NextResponse.json({ success: result.ok, error: result.error });
  } catch (err) {
    return handleApiError(err);
  }
});
