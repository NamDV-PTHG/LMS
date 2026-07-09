import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/middleware/require-role';
import { prisma } from '@/lib/prisma';
import { handleApiError } from '@/app/api/error-handler';

export const GET = withRole(
  ['group_admin', 'company_admin'],
  async (req: NextRequest, { companyId }) => {
    try {
      const sp = req.nextUrl.searchParams;
      const page = Math.max(1, parseInt(sp.get('page') ?? '1', 10));
      const limit = Math.min(100, parseInt(sp.get('limit') ?? '20', 10));
      const resource = sp.get('resource') ?? undefined;
      const userId = sp.get('userId') ?? undefined;
      const action = sp.get('action') ?? undefined;

      const where = {
        companyId,
        ...(resource && { resource }),
        ...(userId && { userId }),
        ...(action && { action: action as 'CREATE' | 'UPDATE' | 'DELETE' }),
      };

      const [total, items] = await Promise.all([
        prisma.activityLog.count({ where }),
        prisma.activityLog.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
      ]);

      return NextResponse.json({
        success: true,
        data: items,
        meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
      });
    } catch (err) {
      return handleApiError(err);
    }
  },
);
