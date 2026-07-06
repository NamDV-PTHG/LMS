import { NextResponse } from 'next/server';
import { withRole } from '@/middleware/require-role';
import { getBackupConfig, saveBackupConfig } from '@/services/backup.service';
import { handleApiError } from '@/app/api/error-handler';

export const GET = withRole(['group_admin'], async (_req, _ctx) => {
  try {
    const config = await getBackupConfig();
    if (!config) return NextResponse.json({ success: true, data: null });
    // Mask secrets
    return NextResponse.json({
      success: true,
      data: {
        ...config,
        minioSecretKey: config.minioSecretKey ? '••••••••' : '',
        gcsKeyJson: config.gcsKeyJson ? '••••••••' : '',
        gdriveKeyJson: config.gdriveKeyJson ? '••••••••' : '',
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
});

export const PUT = withRole(['group_admin'], async (req, _ctx) => {
  try {
    const body = await req.json();
    // Only update secrets if new value provided (not the masked placeholder)
    const existing = await getBackupConfig();
    const data = {
      destination: body.destination,
      isActive: body.isActive ?? false,
      localPath: body.localPath || null,
      minioEndpoint: body.minioEndpoint || null,
      minioPort: body.minioPort ? Number(body.minioPort) : null,
      minioUseSsl: body.minioUseSsl ?? false,
      minioAccessKey: body.minioAccessKey || null,
      minioSecretKey: body.minioSecretKey && body.minioSecretKey !== '••••••••'
        ? body.minioSecretKey
        : existing?.minioSecretKey ?? null,
      minioBucket: body.minioBucket || null,
      minioRegion: body.minioRegion || null,
      gcsProjectId: body.gcsProjectId || null,
      gcsKeyJson: body.gcsKeyJson && body.gcsKeyJson !== '••••••••'
        ? body.gcsKeyJson
        : existing?.gcsKeyJson ?? null,
      gcsBucket: body.gcsBucket || null,
      gdriveFolderId: body.gdriveFolderId || null,
      gdriveKeyJson: body.gdriveKeyJson && body.gdriveKeyJson !== '••••••••'
        ? body.gdriveKeyJson
        : existing?.gdriveKeyJson ?? null,
      gdriveEmail: body.gdriveEmail || null,
      cronSchedule: body.cronSchedule || '0 2 * * *',
      retentionDays: body.retentionDays ? Number(body.retentionDays) : 30,
    };
    const saved = await saveBackupConfig(data);
    return NextResponse.json({ success: true, data: saved });
  } catch (err) {
    return handleApiError(err);
  }
});
