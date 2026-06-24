import { Worker, Job } from 'bullmq';
import { createBullMQConnection } from '@/lib/redis';
import { prisma } from '@/lib/prisma';

interface VideoEventJob {
  assetId: string;
  userId: string;
  enrollmentId?: string;
  sessionId: string;
  eventType: string;
  watchPositionSec?: number;
  durationSec?: number;
  playbackSpeed?: number;
  deviceType?: string;
  receivedAt: string;
}

interface DocEventJob {
  assetId: string;
  userId: string;
  enrollmentId?: string;
  sessionId: string;
  eventType: string;
  pageNumber?: number;
  totalPages?: number;
  timeOnPageSec?: number;
  scrollDepthPct?: number;
  receivedAt: string;
}

const videoEventBuffer: VideoEventJob[] = [];
const docEventBuffer: DocEventJob[] = [];

const BATCH_SIZE = parseInt(process.env.TRACKING_BATCH_SIZE ?? '100', 10);
const FLUSH_INTERVAL = parseInt(process.env.TRACKING_FLUSH_INTERVAL_MS ?? '10000', 10);

async function flushVideoEvents() {
  if (!videoEventBuffer.length) return;
  const batch = videoEventBuffer.splice(0, BATCH_SIZE);
  try {
    await prisma.videoWatchEvent.createMany({
      data: batch.map((e) => ({
        assetId: e.assetId,
        userId: e.userId,
        enrollmentId: e.enrollmentId,
        sessionId: e.sessionId,
        eventType: e.eventType as never,
        watchPositionSec: e.watchPositionSec,
        durationSec: e.durationSec,
        playbackSpeed: e.playbackSpeed ?? 1.0,
        deviceType: e.deviceType,
        createdAt: new Date(e.receivedAt),
      })),
    });
  } catch (err) {
    console.error('[TrackingWriter] Video batch error:', err);
    // Re-add failed batch
    videoEventBuffer.unshift(...batch);
  }
}

async function flushDocEvents() {
  if (!docEventBuffer.length) return;
  const batch = docEventBuffer.splice(0, BATCH_SIZE);
  try {
    await prisma.documentViewEvent.createMany({
      data: batch.map((e) => ({
        assetId: e.assetId,
        userId: e.userId,
        enrollmentId: e.enrollmentId,
        sessionId: e.sessionId,
        eventType: e.eventType as never,
        pageNumber: e.pageNumber,
        totalPages: e.totalPages,
        timeOnPageSec: e.timeOnPageSec,
        scrollDepthPct: e.scrollDepthPct,
        createdAt: new Date(e.receivedAt),
      })),
    });
  } catch (err) {
    console.error('[TrackingWriter] Doc batch error:', err);
    docEventBuffer.unshift(...batch);
  }
}

export function startTrackingWriterWorker() {
  const worker = new Worker(
    'tracking',
    async (job: Job) => {
      if (job.name === 'video-event') {
        videoEventBuffer.push(job.data as VideoEventJob);
        if (videoEventBuffer.length >= BATCH_SIZE) await flushVideoEvents();
      } else if (job.name === 'document-event') {
        docEventBuffer.push(job.data as DocEventJob);
        if (docEventBuffer.length >= BATCH_SIZE) await flushDocEvents();
      }
    },
    { connection: createBullMQConnection(), concurrency: 5 },
  );

  // Flush remaining events every FLUSH_INTERVAL ms
  const flushTimer = setInterval(async () => {
    await Promise.all([flushVideoEvents(), flushDocEvents()]);
  }, FLUSH_INTERVAL);

  worker.on('closed', () => clearInterval(flushTimer));

  return worker;
}
