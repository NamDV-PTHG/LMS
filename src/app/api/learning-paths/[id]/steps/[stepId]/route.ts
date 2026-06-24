import { NextResponse } from 'next/server';
import { withRole } from '@/middleware/require-role';
import { updateStep, removeStep } from '@/services/learning-path.service';
import { handleApiError } from '@/app/api/error-handler';

export const PATCH = withRole(
  ['group_admin', 'company_admin', 'hr_manager'],
  async (req, { companyId, params }) => {
    try {
      const body = await req.json();
      const data = await updateStep(params.stepId, companyId, body);
      return NextResponse.json({ success: true, data });
    } catch (err) {
      return handleApiError(err);
    }
  },
);

export const DELETE = withRole(
  ['group_admin', 'company_admin', 'hr_manager'],
  async (_req, { companyId, params }) => {
    try {
      await removeStep(params.stepId, companyId);
      return NextResponse.json({ success: true });
    } catch (err) {
      return handleApiError(err);
    }
  },
);
