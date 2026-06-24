import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/middleware/require-role';
import {
  getOrganization,
  updateOrganization,
  updateOrgSchema,
} from '@/services/organization.service';
import { handleApiError } from '@/app/api/error-handler';
import { ValidationError } from '@/lib/errors';

export const GET = withRole(
  ['group_admin', 'group_hrm', 'company_admin', 'hr_manager'],
  async (req, { params, user, companyId }) => {
    const isGroupAdmin = user.roles.includes('group_admin');
    const org = await getOrganization(params!.id, companyId, isGroupAdmin);
    return NextResponse.json({ success: true, data: org });
  },
);

export const PATCH = withRole(
  ['group_admin', 'company_admin'],
  async (req, { params, user, companyId }) => {
    try {
      const body = await req.json();
      const parsed = updateOrgSchema.safeParse(body);
      if (!parsed.success) {
        throw new ValidationError('Dữ liệu không hợp lệ', parsed.error.flatten().fieldErrors);
      }

      const isGroupAdmin = user.roles.includes('group_admin');
      const org = await updateOrganization(params!.id, parsed.data, companyId, isGroupAdmin);
      return NextResponse.json({ success: true, data: org });
    } catch (err) {
      return handleApiError(err);
    }
  },
);
