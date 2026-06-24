import { Queue } from 'bullmq';
import { createBullMQConnection } from './redis';

const connection = { connection: createBullMQConnection() };

export const assetProcessingQueue = new Queue('asset-processing', connection);
export const trackingQueue = new Queue('tracking', connection);
export const notificationQueue = new Queue('notifications', connection);

export const QUEUE_NAMES = {
  ASSET_PROCESSING: 'asset-processing',
  TRACKING: 'tracking',
  NOTIFICATIONS: 'notifications',
} as const;
