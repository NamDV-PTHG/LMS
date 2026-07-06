import { prisma } from '@/lib/prisma';
import { createBackupAdapter } from '@/lib/backup-storage';
import type { BackupDestination, BackupType } from '@prisma/client';

export async function getBackupConfig() {
  return prisma.backupStorageConfig.findUnique({ where: { id: 'singleton' } });
}

export async function saveBackupConfig(data: {
  destination: BackupDestination;
  isActive: boolean;
  minioEndpoint?: string | null;
  minioPort?: number | null;
  minioUseSsl?: boolean;
  minioAccessKey?: string | null;
  minioSecretKey?: string | null;
  minioBucket?: string | null;
  minioRegion?: string | null;
  gcsProjectId?: string | null;
  gcsKeyJson?: string | null;
  gcsBucket?: string | null;
  gdriveFolderId?: string | null;
  gdriveKeyJson?: string | null;
  gdriveEmail?: string | null;
  cronSchedule?: string;
  retentionDays?: number;
}) {
  return prisma.backupStorageConfig.upsert({
    where: { id: 'singleton' },
    create: { id: 'singleton', ...data },
    update: data,
  });
}

export async function testBackupConnection(): Promise<{ ok: boolean; error?: string }> {
  const config = await getBackupConfig();
  if (!config) return { ok: false, error: 'Chưa cấu hình backup storage' };
  const adapter = createBackupAdapter(config);
  return adapter.testConnection();
}

export async function listBackupJobs(limit = 20) {
  return prisma.backupJob.findMany({
    orderBy: { startedAt: 'desc' },
    take: limit,
    include: { triggeredBy: { select: { fullName: true, email: true } } },
  });
}

export async function getBackupJob(id: string) {
  return prisma.backupJob.findUnique({
    where: { id },
    include: { triggeredBy: { select: { fullName: true, email: true } } },
  });
}
