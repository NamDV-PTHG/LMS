import { NextResponse } from 'next/server';
import { withAuth } from '@/middleware/require-role';
import { getViewUrl } from '@/services/asset.service';
import { handleApiError } from '@/app/api/error-handler';

export const GET = withAuth(async (_req, { params, user, companyId }) => {
  try {
    const url = await getViewUrl(params!.id, user.id, companyId);
    return NextResponse.json({ success: true, data: { viewUrl: url } });
  } catch (err) {
    return handleApiError(err);
  }
});
