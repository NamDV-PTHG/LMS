import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/middleware/require-role';
import { prisma } from '@/lib/prisma';
import { handleApiError } from '@/app/api/error-handler';

// GET /api/job-title-catalog/config — fetch company's custom categories & levels
export const GET = withRole(
  ['group_admin', 'company_admin', 'hr_manager'],
  async (_req, { companyId }) => {
    try {
      const [categories, levels] = await Promise.all([
        prisma.companyJobCategory.findMany({
          where: { companyId, isActive: true },
          orderBy: { displayOrder: 'asc' },
        }),
        prisma.companyJobLevel.findMany({
          where: { companyId, isActive: true },
          orderBy: { displayOrder: 'asc' },
        }),
      ]);
      return NextResponse.json({ success: true, data: { categories, levels } });
    } catch (err) {
      return handleApiError(err);
    }
  },
);

// PUT /api/job-title-catalog/config — bulk replace categories & levels
// Body: { categories: string[], levels: { code: string, label: string }[] }
export const PUT = withRole(
  ['company_admin', 'hr_manager'],
  async (req: NextRequest, { companyId }) => {
    try {
      const body = await req.json();
      const { categories = [], levels = [] } = body as {
        categories: string[];
        levels: { code: string; label: string }[];
      };

      await prisma.$transaction(async (tx) => {
        // Replace categories
        await tx.companyJobCategory.deleteMany({ where: { companyId } });
        if (categories.length > 0) {
          await tx.companyJobCategory.createMany({
            data: categories.map((name: string, i: number) => ({
              companyId,
              name: name.trim(),
              displayOrder: i,
            })),
          });
        }

        // Replace levels
        await tx.companyJobLevel.deleteMany({ where: { companyId } });
        if (levels.length > 0) {
          await tx.companyJobLevel.createMany({
            data: levels.map((l: { code: string; label: string }, i: number) => ({
              companyId,
              code: l.code.trim(),
              label: l.label.trim(),
              displayOrder: i,
            })),
          });
        }
      });

      return NextResponse.json({ success: true });
    } catch (err) {
      return handleApiError(err);
    }
  },
);
