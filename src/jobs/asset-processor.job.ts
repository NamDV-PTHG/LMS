import { Worker, Job } from 'bullmq';
import { createBullMQConnection } from '@/lib/redis';
import { prisma } from '@/lib/prisma';
import { minioClient, BUCKET_TEMP, BUCKET_PRIVATE } from '@/lib/minio';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

interface AssetProcessingJob {
  assetId: string;
  tempObjectName: string;
  companyId: string;
  orgId: string;
  fileType: string;
  mimeType: string;
}

/** Map MIME type → file extension. */
function extFromMime(mimeType: string): string {
  const map: Record<string, string> = {
    'video/mp4':       '.mp4',
    'video/webm':      '.webm',
    'video/quicktime': '.mov',
    'video/x-msvideo': '.avi',
    'video/x-matroska': '.mkv',
    'audio/mpeg':      '.mp3',
    'audio/ogg':       '.ogg',
    'audio/wav':       '.wav',
    'audio/x-wav':     '.wav',
    'audio/mp4':       '.m4a',
    'application/pdf': '.pdf',
    'application/vnd.ms-powerpoint':                                                    '.ppt',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation':       '.pptx',
    'application/msword':                                                               '.doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document':         '.docx',
    'application/vnd.ms-excel':                                                         '.xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':               '.xlsx',
    'image/jpeg':  '.jpg',
    'image/png':   '.png',
    'image/gif':   '.gif',
    'image/webp':  '.webp',
    'image/svg+xml': '.svg',
  };
  return map[mimeType] ?? '';
}

/**
 * Chạy FFmpeg với args dạng array, không dùng shell.
 * Dùng spawn (async) thay execSync để KHÔNG block event loop —
 * nếu block thì BullMQ không thể gia hạn Redis lock → job bị stale.
 */
function runFFmpeg(args: string[], timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    const stderrChunks: Buffer[] = [];

    proc.stderr?.on('data', (chunk: Buffer) => stderrChunks.push(chunk));

    const timer = setTimeout(() => {
      proc.kill('SIGKILL');
      reject(new Error(`FFmpeg timed out after ${Math.round(timeoutMs / 60000)} minutes`));
    }, timeoutMs);

    proc.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve();
      } else {
        const stderr = Buffer.concat(stderrChunks)
          .toString()
          .split('\n')
          .slice(-15)
          .join('\n');
        reject(new Error(`FFmpeg exited with code ${code}:\n${stderr}`));
      }
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

/**
 * Chạy ffprobe để lấy duration, trả về stdout dạng string.
 */
function runFFprobe(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffprobe', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    const stdoutChunks: Buffer[] = [];

    proc.stdout?.on('data', (chunk: Buffer) => stdoutChunks.push(chunk));

    const timer = setTimeout(() => {
      proc.kill('SIGKILL');
      reject(new Error('ffprobe timed out'));
    }, 30_000);

    proc.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve(Buffer.concat(stdoutChunks).toString().trim());
      } else {
        reject(new Error(`ffprobe exited with code ${code}`));
      }
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

async function processAsset(job: Job<AssetProcessingJob>) {
  const { assetId, tempObjectName, companyId, orgId, fileType, mimeType } = job.data;
  const attemptNum = (job.attemptsMade ?? 0) + 1;

  console.log(`[AssetProcessor] Asset ${assetId} — attempt ${attemptNum}, type=${fileType}`);

  // Mark as PROCESSING at the start of each attempt
  await prisma.contentAsset.update({
    where: { id: assetId },
    data: { processingStatus: 'PROCESSING' },
  });

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lms-asset-'));

  try {
    // 1. Xác định extension từ mimeType
    const ext = extFromMime(mimeType);
    const inputPath = path.join(tmpDir, `input${ext}`);

    // 2. Download từ temp bucket
    await minioClient.fGetObject(BUCKET_TEMP, tempObjectName, inputPath);

    let finalStoragePath: string;
    let hlsPlaylistPath: string | undefined;
    let thumbnailPath:   string | undefined;
    let durationSeconds: number | undefined;

    if (fileType === 'video') {
      // ── HLS conversion ────────────────────────────────────────
      const hlsDir = path.join(tmpDir, 'hls');
      fs.mkdirSync(hlsDir, { recursive: true });

      // spawn (async) — event loop KHÔNG bị block → BullMQ gia hạn lock được
      await runFFmpeg([
        '-y', '-i', inputPath,
        '-codec:v', 'libx264',
        '-preset', 'fast',                       // Giảm ~60% CPU vs default "medium"
        '-crf', '23',                            // Constant quality, tự điều chỉnh bitrate
        '-vf', "scale=-2:'min(1080,ih)'",        // Cap 1080p, giữ aspect ratio, không upscale
        '-threads', '3',                         // Giới hạn 3 cores/job (2 job × 3 = 6 cores max)
        '-codec:a', 'aac',
        '-b:a', '128k',                          // Audio chuẩn
        '-max_muxing_queue_size', '9999',        // Tránh lỗi memory với video B-frames phức tạp
        '-hls_time', '10',
        '-hls_playlist_type', 'vod',
        '-hls_segment_filename', path.join(hlsDir, 'segment_%03d.ts'),
        path.join(hlsDir, 'playlist.m3u8'),
      ], 20 * 60 * 1000);

      // ── Thumbnail ─────────────────────────────────────────────
      const thumbPath = path.join(tmpDir, 'thumbnail.jpg');
      try {
        await runFFmpeg([
          '-y', '-i', inputPath,
          '-ss', '00:00:02',
          '-vframes', '1',
          thumbPath,
        ], 30_000);
      } catch {
        // Thumbnail là tuỳ chọn — không fail job
      }

      // ── Thời lượng ───────────────────────────────────────────
      try {
        const dur = await runFFprobe([
          '-v', 'error',
          '-show_entries', 'format=duration',
          '-of', 'default=noprint_wrappers=1:nokey=1',
          inputPath,
        ]);
        if (dur && !isNaN(parseFloat(dur))) {
          durationSeconds = Math.round(parseFloat(dur));
        }
      } catch {
        // Optional
      }

      // ── Upload HLS segments ───────────────────────────────────
      const hlsBasePath = `${companyId}/${orgId}/videos/hls/${assetId}`;
      const hlsFiles = fs.readdirSync(hlsDir);
      for (const f of hlsFiles) {
        await minioClient.fPutObject(
          BUCKET_PRIVATE,
          `${hlsBasePath}/${f}`,
          path.join(hlsDir, f),
        );
      }
      hlsPlaylistPath = `${hlsBasePath}/playlist.m3u8`;

      // ── Upload raw video (cho download sau này) ───────────────
      finalStoragePath = `${companyId}/${orgId}/videos/raw/${assetId}${ext}`;
      await minioClient.fPutObject(BUCKET_PRIVATE, finalStoragePath, inputPath);

      // ── Upload thumbnail ──────────────────────────────────────
      if (fs.existsSync(thumbPath)) {
        thumbnailPath = `${companyId}/${orgId}/videos/thumbnails/${assetId}.jpg`;
        await minioClient.fPutObject(BUCKET_PRIVATE, thumbnailPath, thumbPath);
      }

      await prisma.contentAsset.update({
        where: { id: assetId },
        data: {
          storagePath: finalStoragePath,
          hlsPlaylistPath,
          thumbnailPath,
          durationSeconds,
          processingStatus: 'READY',
        },
      });

    } else {
      // ── Documents / Presentations / Audio / Images ────────────
      const typeFolder = {
        document:     'documents',
        presentation: 'presentations',
        audio:        'audio',
        image:        'images',
      }[fileType] ?? 'documents';

      finalStoragePath = `${companyId}/${orgId}/${typeFolder}/${assetId}${ext}`;
      await minioClient.fPutObject(BUCKET_PRIVATE, finalStoragePath, inputPath);

      await prisma.contentAsset.update({
        where: { id: assetId },
        data: { storagePath: finalStoragePath, processingStatus: 'READY' },
      });
    }

    // Xoá file tạm trong temp bucket chỉ khi thành công
    await minioClient.removeObject(BUCKET_TEMP, tempObjectName);
    console.log(`[AssetProcessor] Asset ${assetId} → READY`);

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[AssetProcessor] Asset ${assetId} FAILED (attempt ${attemptNum}):`, msg);

    // Đánh dấu FAILED — BullMQ sẽ retry nếu chưa hết số lần
    await prisma.contentAsset.update({
      where: { id: assetId },
      data: { processingStatus: 'FAILED' },
    });

    throw err; // BullMQ cần exception để trigger retry
  } finally {
    // Dọn dẹp thư mục tạm trên đĩa
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
  }
}

/**
 * Xóa các thư mục temp lms-asset-* cũ hơn 2 giờ (orphan sau khi PM2 force-kill).
 * Gọi khi worker khởi động để tránh disk đầy theo thời gian.
 */
function cleanupOrphanTempDirs() {
  const tmpBase = os.tmpdir();
  try {
    const entries = fs.readdirSync(tmpBase);
    const cutoff = Date.now() - 2 * 60 * 60 * 1000; // >2 giờ = orphan
    for (const entry of entries) {
      if (!entry.startsWith('lms-asset-')) continue;
      const fullPath = path.join(tmpBase, entry);
      try {
        const stat = fs.statSync(fullPath);
        if (stat.ctimeMs < cutoff) {
          fs.rmSync(fullPath, { recursive: true, force: true });
          console.log(`[AssetProcessor] Cleaned orphan temp dir: ${entry}`);
        }
      } catch { /* skip nếu không access được */ }
    }
  } catch { /* skip */ }
}

export function startAssetProcessorWorker() {
  cleanupOrphanTempDirs();

  const worker = new Worker('asset-processing', processAsset, {
    connection: createBullMQConnection(),
    concurrency: 2,
    // lockDuration: thời gian Redis giữ lock trước khi cần gia hạn.
    // Với spawn async, event loop tự do → BullMQ tự gia hạn mỗi lockDuration/2.
    // Đặt 5 phút để có buffer nếu Redis bị chậm tạm thời.
    lockDuration: 5 * 60 * 1000,
    limiter: {
      max: 4,            // Tối đa 4 jobs được START trong khoảng duration
      duration: 60_000,  // mỗi 60 giây — tránh burst khi nhiều công ty upload đồng thời
    },
  });

  worker.on('completed', (job) => {
    console.log(`[Worker] Job ${job.id} completed for asset ${job.data.assetId}`);
  });

  worker.on('failed', (job, err) => {
    const remaining = (job?.opts?.attempts ?? 1) - (job?.attemptsMade ?? 0) - 1;
    if (remaining > 0) {
      console.warn(`[Worker] Job ${job?.id} failed, ${remaining} retry(s) remaining: ${err.message}`);
    } else {
      console.error(`[Worker] Job ${job?.id} permanently failed for asset ${job?.data?.assetId}: ${err.message}`);
    }
  });

  return worker;
}
