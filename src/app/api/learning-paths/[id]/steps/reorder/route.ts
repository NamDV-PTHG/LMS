import { NextResponse } from 'next/server';
import { withRole } from '@/middleware/require-role';
import { reorderSteps } from '@/services/learning-path.service';
import { handleApiError } from '@/app/api/error-handler';

// POST /api/learning-paths/[id]/steps/reorder  { stepIds: string[] }
export const POST = withRole(
  ['group_admin', 'company_admin', 'hr_manager'],
  async (req, { companyId, params }) => {
    try {
      const { stepIds } = await req.json();
      if (!Array.isArray(stepIds)) return NextResponse.json({ success: false, error: 'stepIds phải là mảng', code: 'VALIDATION_ERROR' }, { status: 400 });
      await reorderSteps(params.id, companyId, stepIds);
      return NextResponse.json({ success: true });
    } catch (err) {
      return handleApiError(err);
    }
  },
);
