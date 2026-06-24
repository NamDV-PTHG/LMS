import { NextResponse } from 'next/server';
import { withRole } from '@/middleware/require-role';
import { getUserCompetencyProfile, upsertUserCompetency } from '@/services/competency.service';
import { handleApiError } from '@/app/api/error-handler';

// GET /api/users/[id]/competencies
export const GET = withRole(
  ['group_admin', 'company_admin', 'hr_manager'],
  async (_req, { companyId, params }) => {
    try {
      const data = await getUserCompetencyProfile(params.id, companyId);
      return NextResponse.json({ success: true, data });
    } catch (err) {
      return handleApiError(err);
    }
  },
);

// POST /api/users/[id]/competencies  { competencyId, currentLevel, evidenceNote?, source? }
export const POST = withRole(
  ['group_admin', 'company_admin', 'hr_manager'],
  async (req, { user, companyId, params }) => {
    try {
      const body = await req.json();
      if (!body.competencyId) return NextResponse.json({ success: false, error: 'competencyId là bắt buộc', code: 'VALIDATION_ERROR' }, { status: 400 });
      const data = await upsertUserCompetency(params.id, companyId, {
        ...body,
        assessedById: user.id,
      });
      return NextResponse.json({ success: true, data }, { status: 201 });
    } catch (err) {
      return handleApiError(err);
    }
  },
);
