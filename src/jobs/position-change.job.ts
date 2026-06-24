import { Worker, Queue } from 'bullmq';
import { createBullMQConnection } from '@/lib/redis';
import { runGapAnalysis, approvePositionChange } from '@/services/gap-analysis.service';
import { prisma } from '@/lib/prisma';
import { enrollUserToPath } from '@/services/learning-path.service';

export const positionChangeQueue = new Queue('position-change', { connection: createBullMQConnection() });

interface PositionChangeJobData {
  positionChangeEventId: string;
  companyId: string;
  autoEnroll: boolean;
}

export function startPositionChangeWorker() {
  const worker = new Worker<PositionChangeJobData>(
    'position-change',
    async (job) => {
      const { positionChangeEventId, companyId, autoEnroll } = job.data;
      console.log(`[PositionChange] Processing event ${positionChangeEventId}`);

      try {
        // Run gap analysis
        const result = await runGapAnalysis(positionChangeEventId);

        // Load company policy
        const policy = await prisma.companyLearningPolicy.findFirst({
          where: { companyId },
        });

        const shouldAutoEnroll = autoEnroll || policy?.autoEnrollOnPositionChange;

        if (shouldAutoEnroll && result.recommendedLearningPathId) {
          const event = await prisma.positionChangeEvent.findUnique({
            where: { id: positionChangeEventId },
          });
          if (event) {
            try {
              await enrollUserToPath(
                event.userId,
                result.recommendedLearningPathId,
                companyId,
                event.changedById,
                {
                  positionChangeEventId,
                  enrollmentType: 'POSITION_CHANGE',
                },
              );
              await prisma.positionChangeEvent.update({
                where: { id: positionChangeEventId },
                data: { status: 'ENROLLED' },
              });
            } catch {
              // Already enrolled — mark as APPROVED instead
              await prisma.positionChangeEvent.update({
                where: { id: positionChangeEventId },
                data: { status: 'APPROVED' },
              });
            }
          }
        } else {
          // Needs HR approval
          await prisma.positionChangeEvent.update({
            where: { id: positionChangeEventId },
            data: { status: 'PENDING_APPROVAL' },
          });
        }
      } catch (err) {
        console.error(`[PositionChange] Error processing event ${positionChangeEventId}:`, err);
        throw err;
      }
    },
    { connection: createBullMQConnection(), concurrency: 5 },
  );

  worker.on('failed', (job, err) => {
    console.error(`[PositionChange] Job ${job?.id} failed:`, err);
  });

  return worker;
}

export async function enqueuePositionChange(
  positionChangeEventId: string,
  companyId: string,
  autoEnroll = false,
) {
  await positionChangeQueue.add(
    'analyze',
    { positionChangeEventId, companyId, autoEnroll },
    { attempts: 3, backoff: { type: 'exponential', delay: 5000 } },
  );
}
