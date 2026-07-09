import { NextResponse } from 'next/server';
import { withRole } from '@/middleware/require-role';
import { getQuestionBank, updateQuestionBank, deleteQuestionBank, createBankSchema } from '@/services/question-bank.service';
import { handleApiError } from '@/app/api/error-handler';
import { ValidationError } from '@/lib/errors';
import { logActivity, getClientIp } from '@/lib/activity-logger';
import { prisma } from '@/lib/prisma';

export const GET = withRole(['company_admin', 'hr_manager', 'instructor', 'group_admin'], async (_req, { params, companyId }) => {
  try {
    const bank = await getQuestionBank(params!.id, companyId);
    return NextResponse.json({ success: true, data: bank });
  } catch (err) {
    return handleApiError(err);
  }
});

export const PATCH = withRole(['company_admin', 'hr_manager', 'group_admin'], async (req, { params, user, companyId }) => {
  try {
    const body = await req.json();
    const parsed = createBankSchema.partial().safeParse(body);
    if (!parsed.success) throw new ValidationError('Dữ liệu không hợp lệ', parsed.error.flatten().fieldErrors);
    const bank = await updateQuestionBank(params!.id, companyId, parsed.data as Parameters<typeof updateQuestionBank>[2]);

    const dbUser = await prisma.user.findUnique({ where: { id: user.id }, select: { fullName: true } });
    logActivity({
      companyId, userId: user.id, userFullName: dbUser?.fullName ?? '',
      action: 'UPDATE', resource: 'question_bank',
      resourceId: bank.id, resourceTitle: bank.name,
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ success: true, data: bank });
  } catch (err) {
    return handleApiError(err);
  }
});

export const DELETE = withRole(['company_admin', 'group_admin'], async (req, { params, user, companyId }) => {
  try {
    const bank = await getQuestionBank(params!.id, companyId);
    await deleteQuestionBank(params!.id, companyId);

    const dbUser = await prisma.user.findUnique({ where: { id: user.id }, select: { fullName: true } });
    logActivity({
      companyId, userId: user.id, userFullName: dbUser?.fullName ?? '',
      action: 'DELETE', resource: 'question_bank',
      resourceId: params!.id, resourceTitle: bank.name,
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return handleApiError(err);
  }
});
