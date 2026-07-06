import { NextResponse } from 'next/server';
import { withRole } from '@/middleware/require-role';
import { handleApiError } from '@/app/api/error-handler';
import { prisma } from '@/lib/prisma';

// POST /api/notifications/[id]/read — mark notification as read
export const POST = withRole(
  ['group_admin', 'group_hrm', 'company_admin', 'hr_manager', 'instructor', 'learner'],
  async (req, { user, params }) => {
    try {
      await prisma.notificationRead.upsert({
        where: { notificationId_userId: { notificationId: params.id, userId: user.id } },
        create: { notificationId: params.id, userId: user.id },
        update: {},
      });
      return NextResponse.json({ success: true });
    } catch (err) {
      return handleApiError(err);
    }
  },
);

// POST /api/notifications/read-all — mark all as read
