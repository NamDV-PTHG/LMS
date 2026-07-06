import { NextResponse } from 'next/server';
import { withRole } from '@/middleware/require-role';
import { syncRuleBasedGroup } from '@/services/learning-group.service';
import { handleApiError } from '@/app/api/error-handler';

// POST /api/learning-groups/:id/sync — manually trigger rule sync
export const POST = withRole(['group_admin', 'group_hrm', 'company_admin', 'hr_manager'], async (_req, { params, user }) => {
  try {
    const result = await syncRuleBasedGroup(params!.id, user.id);
    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    return handleApiError(err);
  }
});
