import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/middleware/require-role';
import { getQuestions, createQuestion, createQuestionSchema } from '@/services/question-bank.service';
import { handleApiError } from '@/app/api/error-handler';
import { ValidationError } from '@/lib/errors';

export const GET = withRole(['company_admin', 'hr_manager', 'instructor', 'group_admin'], async (req, { params, companyId }) => {
  try {
    const sp = req.nextUrl.searchParams;
    const result = await getQuestions(params!.id, companyId, {
      type: sp.get('type') ?? undefined,
      difficulty: sp.get('difficulty') ?? undefined,
      status: sp.get('status') ?? undefined,
      tag: sp.get('tag') ?? undefined,
      search: sp.get('search') ?? undefined,
      categoryId: sp.get('categoryId') ?? undefined,
      page: sp.get('page') ? parseInt(sp.get('page')!) : undefined,
      limit: sp.get('limit') ? parseInt(sp.get('limit')!) : undefined,
    });
    return NextResponse.json({ success: true, data: result.questions, meta: { total: result.total, page: result.page, limit: result.limit, totalPages: result.totalPages } });
  } catch (err) {
    return handleApiError(err);
  }
});

export const POST = withRole(['company_admin', 'hr_manager', 'instructor', 'group_admin'], async (req, { params, user, companyId }) => {
  try {
    const body = await req.json();
    const parsed = createQuestionSchema.safeParse(body);
    if (!parsed.success) throw new ValidationError('Dữ liệu không hợp lệ', parsed.error.flatten().fieldErrors);
    const question = await createQuestion(params!.id, companyId, user.id, parsed.data);
    return NextResponse.json({ success: true, data: question }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
});
