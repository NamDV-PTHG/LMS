import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/middleware/require-role';
import { getAssetLogs } from '@/services/asset.service';
import { handleApiError } from '@/app/api/error-handler';

export const GET = withRole(
  ['group_admin', 'company_admin', 'hr_manager', 'instructor'],
  async (req, { params, companyId }) => {
    try {
      const page = parseInt(req.nextUrl.searchParams.get('page') ?? '1', 10);
      const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') ?? '20', 10), 100);
      const result = await getAssetLogs(params!.id, companyId, page, limit);
      return NextResponse.json({ success: true, data: result.items, meta: result });
    } catch (err) {
      return handleApiError(err);
    }
  },
);
