import { Worker, Job } from 'bullmq';
import { createBullMQConnection } from '@/lib/redis';
import { prisma } from '@/lib/prisma';
import { minioClient, BUCKET_TEMP, BUCKET_PRIVATE } from '@/lib/minio';
import { execSync } from 'child_process';
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

async function processAsset(job: Job<AssetProcessingJob>) {
  const { assetId, tempObjectName, companyId, orgId, fileType } = job.data;

  // Mark as PROCESSING
  await prisma.contentAsset.update({
    where: { id: assetId },
    data: { processingStatus: 'PROCESSING' },
  });

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lms-asset-'));

  try {
    // 1. Download from temp bucket
    const inputPath = path.join(tmpDir, 'input');
    await minioClient.fGetObject(BUCKET_TEMP, tempObjectName, inputPath);

    let finalStoragePath: string;
    let hlsPlaylistPath: string | undefined;
    let thumbnailPath: string | undefined;

    if (fileType === 'video') {
      // 2. HLS conversion via FFmpeg
      const hlsDir = path.join(tmpDir, 'hls');
      fs.mkdirSync(hlsDir, { recursive: true });

      try {
        execSync(
          `ffmpeg -i "${inputPath}" -codec:v libx264 -codec:a aac -hls_time 10 -hls_playlist_type vod -hls_segment_filename "${hlsDir}/segment_%03d.ts" "${hlsDir}/playlist.m3u8"`,
          { timeout: 30 * 60 * 1000 }, // 30 min max
        );
      } catch {
        throw new Error('FFmpeg HLS conversion failed');
      }

      // 3. Extract thumbnail
      const thumbPath = path.join(tmpDir, 'thumbnail.jpg');
      try {
        execSync(`ffmpeg -i "${inputPath}" -ss 00:00:01 -vframes 1 "${thumbPath}"`, { timeout: 30000 });
      } catch {
        // Thumbnail is optional — don't fail
      }

      // 4. Upload HLS segments to private bucket
      const hlsBasePath = `${companyId}/${orgId}/videos/hls/${assetId}`;
      const hlsFiles = fs.readdirSync(hlsDir);

      for (const f of hlsFiles) {
        await minioClient.fPutObject(BUCKET_PRIVATE, `${hlsBasePath}/${f}`, path.join(hlsDir, f));
      }

      hlsPlaylistPath = `${hlsBasePath}/playlist.m3u8`;
      finalStoragePath = `${companyId}/${orgId}/videos/raw/${assetId}.mp4`;

      // Upload original to private
      await minioClient.fPutObject(BUCKET_PRIVATE, finalStoragePath, inputPath);

      // Upload thumbnail
      if (fs.existsSync(thumbPath)) {
        thumbnailPath = `${companyId}/${orgId}/videos/thumbnails/${assetId}.jpg`;
        await minioClient.fPutObject(BUCKET_PRIVATE, thumbnailPath, thumbPath);
      }

      // Get video duration
      let durationSeconds: number | undefined;
      try {
        const dur = execSync(
          `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${inputPath}"`,
        ).toString().trim();
        durationSeconds = Math.round(parseFloat(dur));
      } catch {
        // Optional
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
      // Documents / presentations / audio / images
      const ext = path.extname(tempObjectName) || '.pdf';
      finalStoragePath = `${companyId}/${orgId}/documents/${assetId}${ext}`;

      await minioClient.fPutObject(BUCKET_PRIVATE, finalStoragePath, inputPath);

      await prisma.contentAsset.update({
        where: { id: assetId },
        data: { storagePath: finalStoragePath, processingStatus: 'READY' },
      });
    }

    // Clean up temp object
    await minioClient.removeObject(BUCKET_TEMP, tempObjectName);

    console.log(`[AssetProcessor] Asset ${assetId} → READY`);
  } catch (err) {
    console.error(`[AssetProcessor] Asset ${assetId} FAILED:`, err);
    await prisma.contentAsset.update({
      where: { id: assetId },
      data: { processingStatus: 'FAILED' },
    });
    throw err;
  } finally {
    // Cleanup temp dir
    try { fs.rmSync(tmpDir, { recursive: true }); } catch { /* ignore */ }
  }
}

export function startAssetProcessorWorker() {
  const worker = new Worker('asset-processing', processAsset, {
    connection: createBullMQConnection(),
    concurrency: 2,
  });

  worker.on('completed', (job) => {
    console.log(`[Worker] Job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[Worker] Job ${job?.id} failed:`, err.message);
  });

  return worker;
}
