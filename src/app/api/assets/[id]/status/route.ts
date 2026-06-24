import { NextResponse } from 'next/server';
import { withAuth } from '@/middleware/require-role';
import { getAssetStatus } from '@/services/asset.service';
import { handleApiError } from '@/app/api/error-handler';

export const GET = withAuth(async (_req, { params, companyId }) => {
  try {
    const status = await getAssetStatus(params!.id, companyId);
    return NextResponse.json({ success: true, data: status });
  } catch (err) {
    return handleApiError(err);
  }
});
