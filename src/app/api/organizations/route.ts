import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/middleware/require-role';
import { getOrganizations, createOrganization, createOrgSchema } from '@/services/organization.service';
import { handleApiError } from '@/app/api/error-handler';
import { ValidationError } from '@/lib/errors';

export const GET = withRole(
  ['group_admin', 'group_hrm', 'company_admin', 'hr_manager'],
  async (req, { user, companyId }) => {
    const isGroupAdmin = user.roles.includes('group_admin');
    const orgs = await getOrganizations(companyId, isGroupAdmin);
    return NextResponse.json({ success: true, data: orgs });
  },
);

export const POST = withRole(
  ['group_admin', 'company_admin'],
  async (req, { user, companyId }) => {
    try {
      const body = await req.json();
      const parsed = createOrgSchema.safeParse(body);
      if (!parsed.success) {
        throw new ValidationError('Dữ liệu không hợp lệ', parsed.error.flatten().fieldErrors);
      }

      const isGroupAdmin = user.roles.includes('group_admin');
      const org = await createOrganization(parsed.data, companyId, isGroupAdmin);
      return NextResponse.json({ success: true, data: org }, { status: 201 });
    } catch (err) {
      return handleApiError(err);
    }
  },
);
