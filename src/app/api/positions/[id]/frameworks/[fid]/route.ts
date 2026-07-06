import { NextResponse } from 'next/server';
import { withRole } from '@/middleware/require-role';
import { handleApiError } from '@/app/api/error-handler';
import { prisma } from '@/lib/prisma';

// PATCH /api/positions/[id]/frameworks/[fid]
export const PATCH = withRole(
  ['company_admin', 'hr_manager'],
  async (req, { companyId, params }) => {
    try {
      const { id, fid } = params as { id: string; fid: string };
      const body = await req.json();
      const { learningPathId, weight, isPrimary, displayOrder } = body;

      // Verify ownership
      const pf = await prisma.jobPositionFramework.findFirst({
        where: { id: fid, positionId: id, position: { companyId } },
      });
      if (!pf) {
        return NextResponse.json({ success: false, error: 'Không tìm thấy', code: 'NOT_FOUND' }, { status: 404 });
      }

      // Validate learning path if changing
      if (learningPathId !== undefined && learningPathId !== null) {
        const path = await prisma.learningPath.findFirst({ where: { id: learningPathId, companyId } });
        if (!path) {
          return NextResponse.json({ success: false, error: 'Không tìm thấy lộ trình học', code: 'NOT_FOUND' }, { status: 404 });
        }
      }

      // If setting isPrimary, unset others
      if (isPrimary) {
        await prisma.jobPositionFramework.updateMany({
          where: { positionId: id, id: { not: fid } },
          data: { isPrimary: false },
        });
      }

      const updated = await prisma.jobPositionFramework.update({
        where: { id: fid },
        data: {
          ...(learningPathId !== undefined && { learningPathId: learningPathId || null }),
          ...(weight !== undefined && { weight }),
          ...(isPrimary !== undefined && { isPrimary }),
          ...(displayOrder !== undefined && { displayOrder }),
        },
        include: {
          framework: { select: { id: true, name: true, version: true } },
          learningPath: { select: { id: true, name: true } },
        },
      });

      return NextResponse.json({ success: true, data: updated });
    } catch (err) {
      return handleApiError(err);
    }
  },
);

// DELETE /api/positions/[id]/frameworks/[fid]
export const DELETE = withRole(
  ['company_admin', 'hr_manager'],
  async (_req, { companyId, params }) => {
    try {
      const { id, fid } = params as { id: string; fid: string };

      const pf = await prisma.jobPositionFramework.findFirst({
        where: { id: fid, positionId: id, position: { companyId } },
      });
      if (!pf) {
        return NextResponse.json({ success: false, error: 'Không tìm thấy', code: 'NOT_FOUND' }, { status: 404 });
      }

      await prisma.jobPositionFramework.delete({ where: { id: fid } });
      return NextResponse.json({ success: true });
    } catch (err) {
      return handleApiError(err);
    }
  },
);
