import { NextResponse } from 'next/server';
import { withRole } from '@/middleware/require-role';
import { getUserGapAnalysis } from '@/services/gap-analysis.service';
import { handleApiError } from '@/app/api/error-handler';

// GET /api/users/[id]/gap-analysis
export const GET = withRole(
  ['group_admin', 'company_admin', 'hr_manager'],
  async (_req, { companyId, params }) => {
    try {
      const data = await getUserGapAnalysis(params.id, companyId);
      return NextResponse.json({ success: true, data });
    } catch (err) {
      return handleApiError(err);
    }
  },
);
