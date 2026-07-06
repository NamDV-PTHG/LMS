import { NextResponse } from 'next/server';
import { withRole } from '@/middleware/require-role';
import { handleApiError } from '@/app/api/error-handler';
import { prisma } from '@/lib/prisma';

// GET /api/positions/[id]/frameworks — list all frameworks linked to a position
export const GET = withRole(
  ['group_admin', 'group_hrm', 'company_admin', 'hr_manager'],
  async (_req, { companyId, params }) => {
    try {
      const { id } = params as { id: string };

      const position = await prisma.jobPosition.findFirst({
        where: { id, companyId },
      });
      if (!position) {
        return NextResponse.json({ success: false, error: 'Không tìm thấy vị trí', code: 'NOT_FOUND' }, { status: 404 });
      }

      const frameworks = await prisma.jobPositionFramework.findMany({
        where: { positionId: id },
        include: {
          framework: { select: { id: true, name: true, version: true } },
          learningPath: { select: { id: true, name: true } },
        },
        orderBy: { displayOrder: 'asc' },
      });

      return NextResponse.json({ success: true, data: frameworks });
    } catch (err) {
      return handleApiError(err);
    }
  },
);

// POST /api/positions/[id]/frameworks — add a framework to a position
export const POST = withRole(
  ['company_admin', 'hr_manager'],
  async (req, { companyId, params }) => {
    try {
      const { id } = params as { id: string };
      const body = await req.json();
      const { frameworkId, learningPathId, weight, isPrimary, displayOrder } = body;

      if (!frameworkId) {
        return NextResponse.json({ success: false, error: 'frameworkId là bắt buộc', code: 'VALIDATION_ERROR' }, { status: 400 });
      }

      // Validate position belongs to company
      const position = await prisma.jobPosition.findFirst({ where: { id, companyId } });
      if (!position) {
        return NextResponse.json({ success: false, error: 'Không tìm thấy vị trí', code: 'NOT_FOUND' }, { status: 404 });
      }

      // Validate framework belongs to company
      const framework = await prisma.competencyFramework.findFirst({ where: { id: frameworkId, companyId } });
      if (!framework) {
        return NextResponse.json({ success: false, error: 'Không tìm thấy khung năng lực', code: 'NOT_FOUND' }, { status: 404 });
      }

      // Validate learning path if provided
      if (learningPathId) {
        const path = await prisma.learningPath.findFirst({ where: { id: learningPathId, companyId } });
        if (!path) {
          return NextResponse.json({ success: false, error: 'Không tìm thấy lộ trình học', code: 'NOT_FOUND' }, { status: 404 });
        }
      }

      // If isPrimary, unset other primaries first
      if (isPrimary) {
        await prisma.jobPositionFramework.updateMany({
          where: { positionId: id },
          data: { isPrimary: false },
        });
      }

      // Get max displayOrder if not provided
      const maxOrder = await prisma.jobPositionFramework.aggregate({
        where: { positionId: id },
        _max: { displayOrder: true },
      });

      const pf = await prisma.jobPositionFramework.create({
        data: {
          positionId: id,
          frameworkId,
          learningPathId: learningPathId || null,
          weight: weight ?? 1.0,
          isPrimary: isPrimary ?? false,
          displayOrder: displayOrder ?? ((maxOrder._max.displayOrder ?? -1) + 1),
        },
        include: {
          framework: { select: { id: true, name: true, version: true } },
          learningPath: { select: { id: true, name: true } },
        },
      });

      return NextResponse.json({ success: true, data: pf }, { status: 201 });
    } catch (err) {
      return handleApiError(err);
    }
  },
);
