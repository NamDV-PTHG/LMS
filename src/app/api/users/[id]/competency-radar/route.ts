import { NextResponse } from 'next/server';
import { withRole } from '@/middleware/require-role';
import { getCompetencyRadar } from '@/services/competency-radar.service';
import { handleApiError } from '@/app/api/error-handler';

export const GET = withRole(
  ['group_admin', 'company_admin', 'hr_manager'],
  async (_req, { params, companyId }) => {
    try {
      const radar = await getCompetencyRadar(params!.id, companyId);
      return NextResponse.json({ success: true, data: radar });
    } catch (err) {
      return handleApiError(err);
    }
  },
);
