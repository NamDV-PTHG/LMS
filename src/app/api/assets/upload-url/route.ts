import { NextResponse } from 'next/server';
import { withAuth } from '@/middleware/require-role';
import { getUploadUrl } from '@/services/asset.service';

export const POST = withAuth(async (_req, { user, companyId }) => {
  const result = await getUploadUrl(companyId, user.id);
  return NextResponse.json({ success: true, data: result });
});
