import { NextResponse } from 'next/server';
import { withRole } from '@/middleware/require-role';
import { getBackupJob, getBackupConfig } from '@/services/backup.service';
import { handleApiError } from '@/app/api/error-handler';
import { restoreQueue } from '@/jobs/backup.job';
import { prisma } from '@/lib/prisma';

export const POST = withRole(['group_admin'], async (req, { params }) => {
  try {
    const body = await req.json().catch(() => ({}));
    const restoreDb: boolean = body.restoreDb ?? false;
    const restoreAssets: boolean = body.restoreAssets ?? false;
    const scopeCompanyId: string | null = body.scopeCompanyId ?? null;
    const reason: string = body.reason ?? '';

    if (!restoreDb && !restoreAssets) {
      return NextResponse.json({ success: false, error: 'Vui lòng chọn ít nhất một phần để khôi phục' }, { status: 400 });
    }

    const backupJob = await getBackupJob(params!.id);
    if (!backupJob || backupJob.status !== 'COMPLETED') {
      return NextResponse.json({ success: false, error: 'Backup không tồn tại hoặc chưa hoàn thành' }, { status: 400 });
    }

    const config = await getBackupConfig();
    if (!config) return NextResponse.json({ success: false, error: 'Chưa cấu hình backup storage' }, { status: 400 });

    // Pre-mark as RESTORING + save reason so UI reflects immediately
    await prisma.backupJob.update({
      where: { id: params!.id },
      data: { status: 'RESTORING', restoreNote: reason },
    });

    // Enqueue to BullMQ restore worker (tracked, survived worker restart)
    await restoreQueue.add('restore', {
      backupJobId: params!.id,
      restoreDb,
      restoreAssets,
      scopeCompanyId,
      reason,
    });

    return NextResponse.json({ success: true, data: { message: 'Quá trình khôi phục đã bắt đầu' } });
  } catch (err) {
    return handleApiError(err);
  }
});
