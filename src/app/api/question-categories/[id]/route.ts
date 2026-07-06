import { NextResponse } from 'next/server';
import { withRole } from '@/middleware/require-role';
import { handleApiError } from '@/app/api/error-handler';
import { prisma } from '@/lib/prisma';

// PATCH /api/question-categories/[id]
export const PATCH = withRole(
  ['company_admin', 'hr_manager'],
  async (req, { companyId, params }) => {
    try {
      const { id } = params as { id: string };
      const body = await req.json();
      const { name, description, color, competencyId, displayOrder, isActive } = body;

      const existing = await prisma.questionCategory.findFirst({
        where: { id, companyId },
      });
      if (!existing) {
        return NextResponse.json(
          { success: false, error: 'Không tìm thấy danh mục', code: 'NOT_FOUND' },
          { status: 404 },
        );
      }

      if (competencyId) {
        const competency = await prisma.competency.findFirst({
          where: { id: competencyId, domain: { framework: { companyId } } },
        });
        if (!competency) {
          return NextResponse.json(
            { success: false, error: 'Năng lực không hợp lệ', code: 'NOT_FOUND' },
            { status: 400 },
          );
        }
      }

      const updated = await prisma.questionCategory.update({
        where: { id },
        data: {
          ...(name !== undefined && { name: name.trim() }),
          ...(description !== undefined && { description: description?.trim() || null }),
          ...(color !== undefined && { color: color || null }),
          ...(competencyId !== undefined && { competencyId: competencyId || null }),
          ...(displayOrder !== undefined && { displayOrder }),
          ...(isActive !== undefined && { isActive }),
        },
        include: {
          competency: { select: { id: true, name: true } },
          _count: { select: { questions: true } },
        },
      });

      return NextResponse.json({ success: true, data: updated });
    } catch (err) {
      return handleApiError(err);
    }
  },
);

// DELETE /api/question-categories/[id]
export const DELETE = withRole(
  ['company_admin', 'hr_manager'],
  async (_req, { companyId, params }) => {
    try {
      const { id } = params as { id: string };

      const existing = await prisma.questionCategory.findFirst({
        where: { id, companyId },
        include: { _count: { select: { questions: true } } },
      });
      if (!existing) {
        return NextResponse.json(
          { success: false, error: 'Không tìm thấy danh mục', code: 'NOT_FOUND' },
          { status: 404 },
        );
      }

      if (existing._count.questions > 0) {
        return NextResponse.json(
          {
            success: false,
            error: `Không thể xóa: danh mục đang có ${existing._count.questions} câu hỏi. Hãy chuyển câu hỏi sang danh mục khác trước.`,
            code: 'IN_USE',
          },
          { status: 409 },
        );
      }

      await prisma.questionCategory.delete({ where: { id } });
      return NextResponse.json({ success: true });
    } catch (err) {
      return handleApiError(err);
    }
  },
);
