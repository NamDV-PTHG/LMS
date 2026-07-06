import { NextResponse } from 'next/server';
import { withRole } from '@/middleware/require-role';
import { getMediaLibraryTree } from '@/services/media-library.service';
import { handleApiError } from '@/app/api/error-handler';

export const GET = withRole(
  ['company_admin', 'hr_manager', 'instructor', 'group_admin', 'group_hrm'],
  async (_req, { user, companyId }) => {
    try {
      const isAdmin = user.roles.some(r =>
        ['company_admin', 'hr_manager', 'group_admin', 'group_hrm'].includes(r),
      );
      const tree = await getMediaLibraryTree(companyId, user.organizationId, isAdmin);
      return NextResponse.json({ success: true, data: { tree } });
    } catch (err) {
      return handleApiError(err);
    }
  },
);
