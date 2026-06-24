import { NextResponse } from 'next/server';
import { withRole } from '@/middleware/require-role';
import { createPositionChange } from '@/services/gap-analysis.service';
import { enqueuePositionChange } from '@/jobs/position-change.job';
import { handleApiError } from '@/app/api/error-handler';

// POST /api/users/[id]/position-change  { toPositionId, effectiveDate, notes }
export const POST = withRole(
  ['group_admin', 'company_admin', 'hr_manager'],
  async (req, { user, companyId, params }) => {
    try {
      const body = await req.json();
      if (!body.toPositionId) return NextResponse.json({ success: false, error: 'toPositionId là bắt buộc', code: 'VALIDATION_ERROR' }, { status: 400 });
      if (!body.effectiveDate) return NextResponse.json({ success: false, error: 'effectiveDate là bắt buộc', code: 'VALIDATION_ERROR' }, { status: 400 });

      const event = await createPositionChange(params.id, companyId, user.id, {
        toPositionId: body.toPositionId,
        effectiveDate: new Date(body.effectiveDate),
        notes: body.notes,
      });

      // Kick off gap analysis asynchronously
      await enqueuePositionChange(event.id, companyId, body.autoEnroll ?? false);

      return NextResponse.json({ success: true, data: event }, { status: 201 });
    } catch (err) {
      return handleApiError(err);
    }
  },
);
