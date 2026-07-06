import { NextResponse } from 'next/server';
import { withAuth } from '@/middleware/require-role';
import { linkAssetToLesson } from '@/services/asset.service';
import { handleApiError } from '@/app/api/error-handler';
import { z } from 'zod';
import { ValidationError } from '@/lib/errors';

const linkSchema = z.object({
  assetId: z.string().uuid(),
});

/**
 * POST /api/lessons/:lessonId/assets
 * Gắn một asset đã có sẵn trong LMS vào bài học.
 * Asset phải có processingStatus = READY và thuộc company của người dùng.
 */
export const POST = withAuth(async (req, { params, companyId }) => {
  try {
    const body = await req.json();
    const parsed = linkSchema.safeParse(body);
    if (!parsed.success) throw new ValidationError('assetId không hợp lệ');

    const link = await linkAssetToLesson(params!.lessonId, parsed.data.assetId, companyId);
    return NextResponse.json({ success: true, data: link }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
});
