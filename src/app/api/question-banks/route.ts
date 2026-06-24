import { NextResponse } from 'next/server';
import { withRole } from '@/middleware/require-role';
import { getQuestionBanks, createQuestionBank, createBankSchema } from '@/services/question-bank.service';
import { handleApiError } from '@/app/api/error-handler';
import { ValidationError } from '@/lib/errors';

export const GET = withRole(['company_admin', 'hr_manager', 'instructor', 'group_admin'], async (_req, { companyId }) => {
  try {
    const banks = await getQuestionBanks(companyId);
    return NextResponse.json({ success: true, data: banks });
  } catch (err) {
    return handleApiError(err);
  }
});

export const POST = withRole(['company_admin', 'hr_manager', 'instructor', 'group_admin'], async (req, { companyId }) => {
  try {
    const body = await req.json();
    const parsed = createBankSchema.safeParse(body);
    if (!parsed.success) throw new ValidationError('Dữ liệu không hợp lệ', parsed.error.flatten().fieldErrors);
    const bank = await createQuestionBank(companyId, parsed.data);
    return NextResponse.json({ success: true, data: bank }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
});
