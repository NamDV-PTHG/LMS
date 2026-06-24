import { NextResponse } from 'next/server';
import { withRole } from '@/middleware/require-role';
import { prisma } from '@/lib/prisma';
import { NotFoundError, ForbiddenError } from '@/lib/errors';

export const GET = withRole(
  ['group_admin', 'company_admin'],
  async (_req, { params, companyId, user }) => {
    const job = await prisma.importJob.findUnique({ where: { id: params!.jobId } });
    if (!job) throw new NotFoundError('Import job');

    const isGroupAdmin = user.roles.includes('group_admin');
    if (!isGroupAdmin && job.companyId !== companyId) {
      throw new ForbiddenError('Không có quyền xem job này');
    }

    return NextResponse.json({ success: true, data: job });
  },
);
