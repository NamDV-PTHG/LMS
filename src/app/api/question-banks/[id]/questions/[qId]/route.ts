import { NextResponse } from 'next/server';
import { withRole } from '@/middleware/require-role';
import { updateQuestion, deleteQuestion, submitForReview, approveQuestion, rejectQuestion, updateQuestionSchema } from '@/services/question-bank.service';
import { handleApiError } from '@/app/api/error-handler';
import { ValidationError } from '@/lib/errors';

export const PATCH = withRole(['company_admin', 'hr_manager', 'instructor', 'group_admin'], async (req, { params, companyId }) => {
  try {
    const body = await req.json();

    // Workflow actions
    if (body.action === 'submit_review') {
      const q = await submitForReview(params!.qId, companyId);
      return NextResponse.json({ success: true, data: q });
    }
    if (body.action === 'approve') {
      const q = await approveQuestion(params!.qId, companyId);
      return NextResponse.json({ success: true, data: q });
    }
    if (body.action === 'reject') {
      if (!body.comment) throw new ValidationError('Cần nhập lý do từ chối');
      const q = await rejectQuestion(params!.qId, companyId, body.comment);
      return NextResponse.json({ success: true, data: q });
    }

    // Regular update
    const parsed = updateQuestionSchema.safeParse(body);
    if (!parsed.success) throw new ValidationError('Dữ liệu không hợp lệ', parsed.error.flatten().fieldErrors);
    const q = await updateQuestion(params!.qId, companyId, parsed.data);
    return NextResponse.json({ success: true, data: q });
  } catch (err) {
    return handleApiError(err);
  }
});

export const DELETE = withRole(['company_admin', 'hr_manager', 'instructor', 'group_admin'], async (_req, { params, companyId }) => {
  try {
    await deleteQuestion(params!.qId, companyId);
    return NextResponse.json({ success: true });
  } catch (err) {
    return handleApiError(err);
  }
});
