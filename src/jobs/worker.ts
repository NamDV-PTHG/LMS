/**
 * Main worker entry point — started separately by PM2 (lms-worker).
 * Registers all BullMQ workers.
 */
import { startAssetProcessorWorker } from './asset-processor.job';
import { startTrackingWriterWorker } from './tracking-writer.job';
import { startPositionChangeWorker } from './position-change.job';
import { startBackupWorker, startRestoreWorker } from './backup.job';
import { registerCronJobs } from './cron';

console.log('[Worker] Starting LMS workers...');

const workers = [
  startAssetProcessorWorker(),
  startTrackingWriterWorker(),
  startPositionChangeWorker(),
  startBackupWorker(),
  startRestoreWorker(),
];

registerCronJobs();

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[Worker] SIGTERM — closing workers...');
  await Promise.all(workers.map((w) => w.close()));
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('[Worker] SIGINT — closing workers...');
  await Promise.all(workers.map((w) => w.close()));
  process.exit(0);
});

console.log('[Worker] All workers started successfully');
