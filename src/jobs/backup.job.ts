import { Worker, Queue } from 'bullmq';
import { spawn } from 'child_process';
import { Readable } from 'stream';
import { prisma } from '@/lib/prisma';
import { minioClient, BUCKET_PRIVATE } from '@/lib/minio';
import { createBackupAdapter } from '@/lib/backup-storage';
import type { BackupType } from '@prisma/client';
import IORedis from 'ioredis';

const connection = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

export const backupQueue = new Queue('backup', { connection });
export const restoreQueue = new Queue('restore', { connection });

interface RestoreJobData {
  backupJobId: string;
  restoreDb: boolean;
  restoreAssets: boolean;
  scopeCompanyId: string | null;
  reason: string;
}

export function startRestoreWorker() {
  const worker = new Worker<RestoreJobData>(
    'restore',
    async (job) => {
      const { backupJobId, restoreDb, restoreAssets, scopeCompanyId, reason } = job.data;

      const backupJob = await prisma.backupJob.findUnique({ where: { id: backupJobId } });
      if (!backupJob) throw new Error('Backup job không tồn tại');

      const config = await prisma.backupStorageConfig.findUnique({ where: { id: 'singleton' } });
      if (!config) throw new Error('Chưa cấu hình backup storage');

      const adapter = createBackupAdapter(config);

      // Mark as RESTORING and save restore reason
      await prisma.backupJob.update({
        where: { id: backupJobId },
        data: { status: 'RESTORING', restoreNote: reason },
      });

      try {
        await job.updateProgress(5);

        // ── Restore DB ─────────────────────────────────────────
        if (restoreDb && backupJob.dbDumpPath) {
          console.log(`[Restore] Starting DB restore from ${backupJob.dbDumpPath}`);
          const stream = await adapter.downloadStream(backupJob.dbDumpPath);
          await new Promise<void>((resolve, reject) => {
            const proc = spawn(
              'pg_restore',
              ['--clean', '--if-exists', '--no-password', `--dbname=${process.env.DATABASE_URL ?? ''}`],
              { stdio: ['pipe', 'pipe', 'pipe'] },
            );
            proc.stderr.on('data', (d: Buffer) => console.error('[Restore] pg_restore stderr:', d.toString()));
            (stream as Readable).pipe(proc.stdin);
            proc.on('close', (code) => {
              // pg_restore returns non-zero even for warnings — only fail on serious errors
              if (code !== null && code > 1) {
                reject(new Error(`pg_restore exit code ${code}`));
              } else {
                resolve();
              }
            });
            proc.on('error', reject);
          });
          console.log('[Restore] DB restore completed');
          await job.updateProgress(50);
        }

        // ── Restore Assets ─────────────────────────────────────
        if (restoreAssets && backupJob.objectPrefix) {
          const assetPrefix = `${backupJob.objectPrefix}/assets/${scopeCompanyId ? scopeCompanyId + '/' : ''}`;
          console.log(`[Restore] Listing assets under prefix: ${assetPrefix}`);
          const objects = await adapter.listObjects(assetPrefix);
          const fullAssetBase = `${backupJob.objectPrefix}/assets/`;
          let restored = 0;
          for (const obj of objects) {
            // Strip backup prefix to get original MinIO object key
            const destKey = obj.key.startsWith(fullAssetBase)
              ? obj.key.slice(fullAssetBase.length)
              : obj.key;
            if (!destKey) continue;
            const stream = await adapter.downloadStream(obj.key);
            await new Promise<void>((resolve, reject) => {
              minioClient.putObject(BUCKET_PRIVATE, destKey, stream as unknown as Readable, (err) => {
                if (err) reject(err); else resolve();
              });
            });
            restored++;
            if (restored % 10 === 0) {
              const pct = 50 + Math.round((restored / objects.length) * 45);
              await job.updateProgress(Math.min(pct, 95));
            }
          }
          console.log(`[Restore] Assets restored: ${restored} files`);
        }

        await prisma.backupJob.update({
          where: { id: backupJobId },
          data: { status: 'RESTORED', restoredAt: new Date() },
        });
        await job.updateProgress(100);
        console.log(`[Restore] Completed for backup job ${backupJobId}`);
      } catch (err) {
        const msg = (err as Error).message;
        console.error('[Restore] Failed:', msg);
        await prisma.backupJob.update({
          where: { id: backupJobId },
          data: { status: 'FAILED', error: `[Restore] ${msg}` },
        });
        throw err;
      }
    },
    { connection, concurrency: 1 },
  );

  worker.on('failed', (job, err) => {
    console.error(`[Restore] Job ${job?.id} failed:`, err.message);
  });

  return worker;
}

interface BackupJobData {
  type: BackupType;
  triggeredById: string;
  scope?: string; // companyId or null for all
}

export function startBackupWorker() {
  const worker = new Worker<BackupJobData>(
    'backup',
    async (job) => {
      const { type, triggeredById, scope } = job.data;

      const config = await prisma.backupStorageConfig.findUnique({ where: { id: 'singleton' } });
      if (!config || !config.isActive) throw new Error('Backup storage chưa được cấu hình hoặc chưa kích hoạt');

      const adapter = createBackupAdapter(config);
      const dateStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
      const timeStr = new Date().toISOString().slice(0, 19).replace('T', '_').replace(/:/g, '-');
      const prefix = `backups/${dateStr}/${timeStr}`;

      // Create job record
      const backupJob = await prisma.backupJob.create({
        data: {
          type,
          status: 'RUNNING',
          triggeredById,
          scope,
          destination: config.destination,
          objectPrefix: prefix,
          startedAt: new Date(),
        },
      });

      let totalSize = BigInt(0);
      let totalFiles = 0;

      try {
        // ── DB Dump ────────────────────────────────────────────
        if (type === 'FULL' || type === 'DB_ONLY') {
          await job.updateProgress(5);
          const dbUrl = process.env.DATABASE_URL ?? '';
          const dbDumpKey = `${prefix}/db/dump.pgdump`;

          const dumpStream = await new Promise<Readable>((resolve, reject) => {
            const proc = spawn('pg_dump', [dbUrl, '-Fc', '--no-password'], { stdio: ['ignore', 'pipe', 'pipe'] });
            proc.stderr.on('data', (d: Buffer) => console.error('[Backup] pg_dump stderr:', d.toString()));
            proc.on('error', reject);
            resolve(proc.stdout as unknown as Readable);
          });

          await adapter.uploadStream(dbDumpKey, dumpStream, 'application/octet-stream');
          totalFiles++;

          await prisma.backupJob.update({
            where: { id: backupJob.id },
            data: { dbDumpPath: dbDumpKey },
          });
          await job.updateProgress(30);
        }

        // ── Assets per company ─────────────────────────────────
        if (type === 'FULL' || type === 'ASSETS_ONLY') {
          const companies = scope
            ? [{ id: scope }]
            : await prisma.organization.findMany({ where: { type: 'company', isActive: true }, select: { id: true } });

          let companyIdx = 0;
          for (const company of companies) {
            companyIdx++;
            const objects: { name?: string; size?: number }[] = [];

            await new Promise<void>((resolve, reject) => {
              const stream = minioClient.listObjects(BUCKET_PRIVATE, company.id + '/', true);
              stream.on('data', (obj) => objects.push(obj));
              stream.on('end', resolve);
              stream.on('error', reject);
            });

            for (const obj of objects) {
              if (!obj.name) continue;
              const destKey = `${prefix}/assets/${obj.name}`;
              const srcStream = await minioClient.getObject(BUCKET_PRIVATE, obj.name);
              await adapter.uploadStream(destKey, srcStream as unknown as Readable);
              totalSize += BigInt(obj.size ?? 0);
              totalFiles++;
            }

            const pct = 30 + Math.round((companyIdx / companies.length) * 65);
            await job.updateProgress(pct);
          }
        }

        // ── Cleanup old backups ────────────────────────────────
        if (config.retentionDays > 0) {
          const cutoff = new Date(Date.now() - config.retentionDays * 86400000);
          const oldJobs = await prisma.backupJob.findMany({
            where: { status: 'COMPLETED', completedAt: { lt: cutoff } },
            select: { id: true, objectPrefix: true },
          });
          for (const old of oldJobs) {
            if (old.objectPrefix) {
              try {
                const listed = await adapter.listObjects(old.objectPrefix + '/');
                for (const obj of listed) {
                  await adapter.deleteObject(obj.key).catch(() => {});
                }
              } catch { /* ignore */ }
            }
            await prisma.backupJob.delete({ where: { id: old.id } }).catch(() => {});
          }
        }

        await prisma.backupJob.update({
          where: { id: backupJob.id },
          data: { status: 'COMPLETED', completedAt: new Date(), sizeBytes: totalSize, fileCount: totalFiles },
        });

        await job.updateProgress(100);
        console.log(`[Backup] Completed: ${totalFiles} files, ${totalSize} bytes → ${prefix}`);
      } catch (err) {
        await prisma.backupJob.update({
          where: { id: backupJob.id },
          data: { status: 'FAILED', error: (err as Error).message, completedAt: new Date() },
        });
        throw err;
      }
    },
    { connection, concurrency: 1 },
  );

  worker.on('failed', (job, err) => {
    console.error(`[Backup] Job ${job?.id} failed:`, err.message);
  });

  return worker;
}
