import { NextResponse } from 'next/server';
import { withRole } from '@/middleware/require-role';
import { removeRole } from '@/services/user.service';
import { handleApiError } from '@/app/api/error-handler';

export const DELETE = withRole(
  ['group_admin', 'company_admin'],
  async (_req, { params, user, companyId }) => {
    try {
      const isGroupAdmin = user.roles.includes('group_admin');
      await removeRole(params!.id, params!.roleId, companyId, isGroupAdmin);
      return NextResponse.json({ success: true, data: null });
    } catch (err) {
      return handleApiError(err);
    }
  },
);
