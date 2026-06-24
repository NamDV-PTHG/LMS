import { NextResponse } from 'next/server';
import { withRole } from '@/middleware/require-role';
import { updateDomain, deleteDomain } from '@/services/competency.service';
import { handleApiError } from '@/app/api/error-handler';

export const PATCH = withRole(
  ['group_admin', 'company_admin', 'hr_manager'],
  async (req, { companyId, params }) => {
    try {
      const body = await req.json();
      const data = await updateDomain(params.dId, companyId, body);
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
      await deleteDomain(params.dId, companyId);
      return NextResponse.json({ success: true });
    } catch (err) {
      return handleApiError(err);
    }
  },
);
