import { NextResponse } from 'next/server';
import { withAuth } from '@/middleware/require-role';
import { handleDownload } from '@/services/asset.service';
import { handleApiError } from '@/app/api/error-handler';

const PRIVILEGED_ROLES = ['company_admin', 'hr_manager', 'group_admin', 'group_hrm'] as const;

export const POST = withAuth(async (_req, { params, user, companyId }) => {
  try {
    // Privileged roles bypass per-asset download policy restrictions
    const isPrivileged = user.roles.some(r => (PRIVILEGED_ROLES as readonly string[]).includes(r));
    const result = await handleDownload(params!.id, user.id, companyId, isPrivileged);
    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    return handleApiError(err);
  }
});
