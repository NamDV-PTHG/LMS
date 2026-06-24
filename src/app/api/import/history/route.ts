import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/middleware/require-role';
import { prisma } from '@/lib/prisma';

export const GET = withRole(
  ['group_admin', 'company_admin'],
  async (req, { companyId, user }) => {
    const isGroupAdmin = user.roles.includes('group_admin');
    const page = parseInt(req.nextUrl.searchParams.get('page') ?? '1', 10);
    const limit = parseInt(req.nextUrl.searchParams.get('limit') ?? '20', 10);

    const where = isGroupAdmin ? {} : { companyId };

    const [items, total] = await Promise.all([
      prisma.importJob.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.importJob.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: items,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  },
);
