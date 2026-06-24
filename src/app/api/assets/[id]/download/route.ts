import { NextResponse } from 'next/server';
import { withAuth } from '@/middleware/require-role';
import { handleDownload } from '@/services/asset.service';
import { handleApiError } from '@/app/api/error-handler';

export const POST = withAuth(async (_req, { params, user, companyId }) => {
  try {
    const result = await handleDownload(params!.id, user.id, companyId);
    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    return handleApiError(err);
  }
});
