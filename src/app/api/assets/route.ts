import { NextRequest, NextResponse } from 'next/server';
import { withRole, withAuth } from '@/middleware/require-role';
import { getAssets, confirmUpload, confirmUploadSchema } from '@/services/asset.service';
import { handleApiError } from '@/app/api/error-handler';
import { ValidationError } from '@/lib/errors';

export const GET = withAuth(async (req, { user, companyId }) => {
  const sp = req.nextUrl.searchParams;
  const orgId = sp.get('orgId') ?? undefined;
  const type = sp.get('type') ?? undefined;
  const lessonId = sp.get('lessonId') ?? undefined;
  const page = parseInt(sp.get('page') ?? '1', 10);
  const limit = Math.min(parseInt(sp.get('limit') ?? '20', 10), 100);

  const result = await getAssets(companyId, { orgId, type, lessonId, page, limit });
  return NextResponse.json({ success: true, data: result.items, meta: result });
});

export const POST = withAuth(async (req, { user, companyId }) => {
  try {
    const body = await req.json();
    const parsed = confirmUploadSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError('Dữ liệu không hợp lệ', parsed.error.flatten().fieldErrors);
    }

    const asset = await confirmUpload(parsed.data, companyId, user.id);
    return NextResponse.json({ success: true, data: asset }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
});
