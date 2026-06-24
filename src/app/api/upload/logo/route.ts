import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/middleware/require-role';
import { minioClient, BUCKET_PRIVATE, getPresignedDownloadUrl } from '@/lib/minio';
import { handleApiError } from '@/app/api/error-handler';

/**
 * POST /api/upload/logo — upload a logo image to MinIO and return its public URL.
 * Accepts multipart/form-data with field "file".
 * Supports JPG, PNG, SVG, WebP, GIF up to 5MB.
 * Returns a presigned URL rewritten to the public MinIO address (MINIO_PUBLIC_URL).
 */
export const POST = withRole(
  ['group_admin', 'company_admin'],
  async (req: NextRequest, { companyId }) => {
    try {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;

      if (!file) {
        return NextResponse.json({ success: false, error: 'Thiếu file', code: 'VALIDATION_ERROR' }, { status: 400 });
      }

      // Accept by extension as fallback when browser sends wrong MIME type
      const ext = (file.name.split('.').pop() ?? '').toLowerCase();
      const extToMime: Record<string, string> = {
        jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
        svg: 'image/svg+xml', webp: 'image/webp', gif: 'image/gif',
      };
      const resolvedMime = extToMime[ext] ?? file.type;

      const allowed = ['image/jpeg', 'image/png', 'image/svg+xml', 'image/webp', 'image/gif'];
      if (!allowed.includes(resolvedMime)) {
        return NextResponse.json(
          { success: false, error: 'Chỉ chấp nhận file ảnh (JPG, PNG, SVG, WebP, GIF)', code: 'VALIDATION_ERROR' },
          { status: 400 },
        );
      }

      if (file.size > 5 * 1024 * 1024) {
        return NextResponse.json(
          { success: false, error: 'File tối đa 5MB', code: 'VALIDATION_ERROR' },
          { status: 400 },
        );
      }

      const objectName = `logos/${companyId}/${Date.now()}.${ext || 'png'}`;

      const buffer = Buffer.from(await file.arrayBuffer());
      await minioClient.putObject(BUCKET_PRIVATE, objectName, buffer, buffer.length, {
        'Content-Type': resolvedMime,
      });

      // Use helper that rewrites host to MINIO_PUBLIC_URL
      const signedUrl = await getPresignedDownloadUrl(objectName, 5 * 365 * 24 * 3600);

      return NextResponse.json({ success: true, data: { url: signedUrl, objectName } });
    } catch (err) {
      return handleApiError(err);
    }
  },
);
