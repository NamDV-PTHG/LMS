import { NextResponse } from 'next/server';
import { withAuth } from '@/middleware/require-role';
import { getStreamUrl } from '@/services/asset.service';
import { handleApiError } from '@/app/api/error-handler';

export const GET = withAuth(async (_req, { params, user, companyId }) => {
  try {
    const result = await getStreamUrl(params!.id, user.id, companyId);
    return NextResponse.json({ success: true, data: { streamUrl: result.url, mimeType: result.mimeType } });
  } catch (err) {
    return handleApiError(err);
  }
});
