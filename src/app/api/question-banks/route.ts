import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/middleware/require-role';
import { getQuestionBanks, createQuestionBank, createBankSchema } from '@/services/question-bank.service';
import { handleApiError } from '@/app/api/error-handler';
import { ValidationError } from '@/lib/errors';
import { getScopedUserIds } from '@/services/org-scope.service';
import { logActivity, getClientIp } from '@/lib/activity-logger';
import { prisma } from '@/lib/prisma';

export const GET = withRole(
  ['company_admin', 'hr_manager', 'instructor', 'group_admin', 'dept_head'],
  async (_req, { user, companyId }) => {
    try {
      const userRoles = user.roles.map((r: unknown) =>
        typeof r === 'string' ? r : (r as { role: string }).role
      );
      const scopedUserIds = await getScopedUserIds(user.id, userRoles);
      const banks = await getQuestionBanks(companyId, scopedUserIds);
      return NextResponse.json({ success: true, data: banks });
    } catch (err) {
      return handleApiError(err);
    }
  },
);

export const POST = withRole(
  ['company_admin', 'hr_manager', 'instructor', 'group_admin'],
  async (req: NextRequest, { user, companyId }) => {
    try {
      const body = await req.json();
      const parsed = createBankSchema.safeParse(body);
      if (!parsed.success) throw new ValidationError('Dữ liệu không hợp lệ', parsed.error.flatten().fieldErrors);

      const bank = await createQuestionBank(companyId, parsed.data, user.id);

      const dbUser = await prisma.user.findUnique({ where: { id: user.id }, select: { fullName: true } });
      logActivity({
        companyId, userId: user.id, userFullName: dbUser?.fullName ?? '',
        action: 'CREATE', resource: 'question_bank',
        resourceId: bank.id, resourceTitle: bank.name,
        ipAddress: getClientIp(req),
      });

      return NextResponse.json({ success: true, data: bank }, { status: 201 });
    } catch (err) {
      return handleApiError(err);
    }
  },
);
