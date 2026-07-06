import { NextResponse } from 'next/server';
import { withRole } from '@/middleware/require-role';
import { listBackupJobs, getBackupConfig } from '@/services/backup.service';
import { handleApiError } from '@/app/api/error-handler';
import { backupQueue } from '@/jobs/backup.job';
import type { BackupType } from '@prisma/client';

export const GET = withRole(['group_admin'], async (_req, _ctx) => {
  try {
    const jobs = await listBackupJobs(30);
    return NextResponse.json({ success: true, data: jobs });
  } catch (err) {
    return handleApiError(err);
  }
});

export const POST = withRole(['group_admin'], async (req, { user }) => {
  try {
    const body = await req.json().catch(() => ({}));
    const type: BackupType = body.type ?? 'FULL';
    const scope: string | undefined = body.scope ?? undefined;

    const config = await getBackupConfig();
    if (!config?.isActive) {
      return NextResponse.json({ success: false, error: 'Backup storage chưa được cấu hình hoặc chưa kích hoạt' }, { status: 400 });
    }

    await backupQueue.add('manual-backup', { type, triggeredById: user.id, scope });
    return NextResponse.json({ success: true, data: { message: 'Backup job đã được thêm vào hàng đợi' } });
  } catch (err) {
    return handleApiError(err);
  }
});
