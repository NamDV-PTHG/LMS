import { prisma } from '@/lib/prisma';
import type { ActivityAction } from '@prisma/client';

export interface LogActivityInput {
  companyId: string;
  userId: string;
  userFullName: string;
  action: ActivityAction;
  resource: string;
  resourceId: string;
  resourceTitle: string;
  details?: Record<string, unknown>;
  ipAddress?: string | null;
}

/**
 * Fire-and-forget activity logging.
 * Never throws — log failure must not block the main operation.
 */
export async function logActivity(data: LogActivityInput): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        companyId:     data.companyId,
        userId:        data.userId,
        userFullName:  data.userFullName || 'Không rõ',
        action:        data.action,
        resource:      data.resource,
        resourceId:    data.resourceId,
        resourceTitle: data.resourceTitle,
        details:       data.details ?? null,
        ipAddress:     data.ipAddress ?? null,
      },
    });
  } catch (err) {
    console.error('[ActivityLogger] Failed to log activity:', err);
  }
}

/** Extract IP address from Next.js request headers */
export function getClientIp(req: { headers: { get: (k: string) => string | null } }): string | null {
  return req.headers.get('x-forwarded-for')?.split(',')[0].trim()
    || req.headers.get('x-real-ip')
    || null;
}
