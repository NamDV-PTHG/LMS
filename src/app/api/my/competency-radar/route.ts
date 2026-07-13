import { NextResponse } from 'next/server';
import { withRole } from '@/middleware/require-role';
import { getCompetencyRadar } from '@/services/competency-radar.service';
import { handleApiError } from '@/app/api/error-handler';

export const GET = withRole(
  ['group_admin', 'company_admin', 'hr_manager', 'instructor', 'learner'],
  async (_req, { user, companyId }) => {
    try {
      const radar = await getCompetencyRadar(user.id, companyId);
      return NextResponse.json({ success: true, data: radar });
    } catch (err) {
      return handleApiError(err);
    }
  },
);
