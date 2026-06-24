import cron from 'node-cron';
import { autoSubmitExpiredAttempts } from '@/services/quiz.service';
import { prisma } from '@/lib/prisma';
import { syncRuleBasedGroup } from '@/services/learning-group.service';
import { unlockDueSteps } from '@/services/learning-path.service';

const SYSTEM_USER_ID = process.env.SYSTEM_USER_ID ?? 'system';

/**
 * Register all cron jobs.
 * Called once when the worker process starts.
 */
export function registerCronJobs() {
  // Auto-submit quiz attempts that exceeded time limit (every 5 min)
  cron.schedule('*/5 * * * *', async () => {
    try {
      const count = await autoSubmitExpiredAttempts();
      if (count > 0) console.log(`[Cron] Auto-submitted ${count} expired quiz attempts`);
    } catch (err) {
      console.error('[Cron] autoSubmitExpiredAttempts error:', err);
    }
  });

  // Sync rule-based learning groups (every hour)
  cron.schedule('0 * * * *', async () => {
    try {
      const ruleGroups = await prisma.learningGroup.findMany({
        where: { type: 'rule_based', isActive: true, ruleJson: { not: null } },
        select: { id: true, name: true },
      });

      for (const group of ruleGroups) {
        try {
          const result = await syncRuleBasedGroup(group.id, SYSTEM_USER_ID);
          if (result.added > 0 || result.removed > 0) {
            console.log(`[Cron] Synced group "${group.name}": +${result.added} added, -${result.removed} removed`);
          }
        } catch (err) {
          console.error(`[Cron] Failed to sync group ${group.id}:`, err);
        }
      }
    } catch (err) {
      console.error('[Cron] syncRuleBasedGroups error:', err);
    }
  });

  // Unlock learning path steps when availableAfterDays has passed (daily at 01:00)
  cron.schedule('0 1 * * *', async () => {
    try {
      await unlockDueSteps();
      console.log('[Cron] Unlocked due learning path steps');
    } catch (err) {
      console.error('[Cron] unlockDueSteps error:', err);
    }
  });

  console.log('[Cron] Jobs registered (quiz auto-submit every 5min, group sync every hour, path step unlock daily)');
}
