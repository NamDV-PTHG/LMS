import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/middleware/require-role';
import { getLearningGroups, createLearningGroup, createGroupSchema } from '@/services/learning-group.service';
import { handleApiError } from '@/app/api/error-handler';
import { ValidationError } from '@/lib/errors';

export const GET = withRole(
  ['group_admin', 'group_hrm', 'company_admin', 'hr_manager'],
  async (_req, { user, companyId }) => {
    try {
      const isGroupAdmin = user.roles.includes('group_admin') || user.roles.includes('group_hrm');
      const groups = await getLearningGroups(companyId, isGroupAdmin);
      return NextResponse.json({ success: true, data: groups });
    } catch (err) {
      return handleApiError(err);
    }
  },
);

export const POST = withRole(
  ['group_admin', 'group_hrm', 'company_admin', 'hr_manager'],
  async (req, { user, companyId }) => {
    try {
      const body = await req.json();
      const parsed = createGroupSchema.safeParse(body);
      if (!parsed.success) throw new ValidationError('Dữ liệu không hợp lệ', parsed.error.flatten().fieldErrors);

      const isGroupAdmin = user.roles.includes('group_admin') || user.roles.includes('group_hrm');
      // group_admin creates group-level groups (no companyId); company_admin creates company-scoped groups
      const scopedCompanyId = isGroupAdmin ? undefined : companyId;
      const group = await createLearningGroup(user.id, parsed.data, scopedCompanyId);
      return NextResponse.json({ success: true, data: group }, { status: 201 });
    } catch (err) {
      return handleApiError(err);
    }
  },
);
