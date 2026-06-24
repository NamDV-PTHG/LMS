import { NextResponse } from 'next/server';
import { withRole } from '@/middleware/require-role';
import { getPositionChanges } from '@/services/gap-analysis.service';
import { handleApiError } from '@/app/api/error-handler';

export const GET = withRole(
  ['group_admin', 'company_admin', 'hr_manager'],
  async (req, { companyId }) => {
    try {
      const { searchParams } = new URL(req.url);
      const data = await getPositionChanges(companyId, {
        userId: searchParams.get('userId') ?? undefined,
        status: searchParams.get('status') ?? undefined,
        page: searchParams.has('page') ? parseInt(searchParams.get('page')!) : undefined,
        limit: searchParams.has('limit') ? parseInt(searchParams.get('limit')!) : undefined,
      });
      return NextResponse.json({ success: true, ...data });
    } catch (err) {
      return handleApiError(err);
    }
  },
);
