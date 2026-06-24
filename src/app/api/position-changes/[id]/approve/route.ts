import { NextResponse } from 'next/server';
import { withRole } from '@/middleware/require-role';
import { approvePositionChange } from '@/services/gap-analysis.service';
import { handleApiError } from '@/app/api/error-handler';

// POST /api/position-changes/[id]/approve
export const POST = withRole(
  ['group_admin', 'company_admin', 'hr_manager'],
  async (_req, { user, companyId, params }) => {
    try {
      const data = await approvePositionChange(params.id, companyId, user.id);
      return NextResponse.json({ success: true, data });
    } catch (err) {
      return handleApiError(err);
    }
  },
);
