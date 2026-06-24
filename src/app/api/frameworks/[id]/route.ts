import { NextResponse } from 'next/server';
import { withRole } from '@/middleware/require-role';
import { getFramework, updateFramework, deleteFramework } from '@/services/competency.service';
import { handleApiError } from '@/app/api/error-handler';

export const GET = withRole(
  ['group_admin', 'company_admin', 'hr_manager'],
  async (_req, { companyId, params }) => {
    try {
      const data = await getFramework(params.id, companyId);
      return NextResponse.json({ success: true, data });
    } catch (err) {
      return handleApiError(err);
    }
  },
);

export const PATCH = withRole(
  ['group_admin', 'company_admin', 'hr_manager'],
  async (req, { companyId, params }) => {
    try {
      const body = await req.json();
      const data = await updateFramework(params.id, companyId, body);
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
      await deleteFramework(params.id, companyId);
      return NextResponse.json({ success: true });
    } catch (err) {
      return handleApiError(err);
    }
  },
);
