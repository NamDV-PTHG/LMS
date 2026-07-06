import { NextResponse } from 'next/server';
import { withRole } from '@/middleware/require-role';
import { handleApiError } from '@/app/api/error-handler';
import { prisma } from '@/lib/prisma';

// GET /api/question-categories — danh mục câu hỏi của công ty
export const GET = withRole(
  ['group_admin', 'group_hrm', 'company_admin', 'hr_manager', 'instructor'],
  async (_req, { companyId }) => {
    try {
      const categories = await prisma.questionCategory.findMany({
        where: { companyId, isActive: true },
        orderBy: { displayOrder: 'asc' },
        include: {
          competency: { select: { id: true, name: true } },
          _count: { select: { questions: true } },
        },
      });

      const result = categories.map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        color: c.color,
        displayOrder: c.displayOrder,
        isActive: c.isActive,
        competencyId: c.competencyId,
        competency: c.competency,
        questionCount: c._count.questions,
      }));

      return NextResponse.json({ success: true, data: result });
    } catch (err) {
      return handleApiError(err);
    }
  },
);

// POST /api/question-categories — tạo danh mục mới
export const POST = withRole(
  ['company_admin', 'hr_manager'],
  async (req, { companyId }) => {
    try {
      const body = await req.json();
      const { name, description, color, competencyId, displayOrder } = body;

      if (!name?.trim()) {
        return NextResponse.json(
          { success: false, error: 'Tên danh mục là bắt buộc', code: 'VALIDATION_ERROR' },
          { status: 400 },
        );
      }

      // Validate competencyId belongs to same company if provided
      if (competencyId) {
        const competency = await prisma.competency.findFirst({
          where: {
            id: competencyId,
            domain: { framework: { companyId } },
          },
        });
        if (!competency) {
          return NextResponse.json(
            { success: false, error: 'Năng lực không hợp lệ', code: 'NOT_FOUND' },
            { status: 400 },
          );
        }
      }

      const maxOrder = await prisma.questionCategory.aggregate({
        where: { companyId },
        _max: { displayOrder: true },
      });

      const category = await prisma.questionCategory.create({
        data: {
          companyId,
          name: name.trim(),
          description: description?.trim() || null,
          color: color || null,
          competencyId: competencyId || null,
          displayOrder: displayOrder ?? ((maxOrder._max.displayOrder ?? -1) + 1),
        },
        include: {
          competency: { select: { id: true, name: true } },
        },
      });

      return NextResponse.json({ success: true, data: category }, { status: 201 });
    } catch (err) {
      return handleApiError(err);
    }
  },
);
