import { NextResponse } from 'next/server';
import { withAuth } from '@/middleware/require-role';
import { unlinkAssetFromLesson } from '@/services/asset.service';
import { handleApiError } from '@/app/api/error-handler';

/**
 * DELETE /api/lessons/:lessonId/assets/:assetId
 * Gỡ liên kết asset khỏi bài học.
 * KHÔNG xóa ContentAsset hay file MinIO — chỉ xóa junction record.
 */
export const DELETE = withAuth(async (_req, { params }) => {
  try {
    await unlinkAssetFromLesson(params!.lessonId, params!.assetId);
    return NextResponse.json({ success: true, data: null });
  } catch (err) {
    return handleApiError(err);
  }
});
