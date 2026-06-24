import { NextResponse } from 'next/server';
import { withAuth } from '@/middleware/require-role';
import { minioClient, BUCKET_TEMP } from '@/lib/minio';
import { handleApiError } from '@/app/api/error-handler';
import { ValidationError } from '@/lib/errors';

/**
 * POST /api/assets/upload
 * Proxy upload: browser → Next.js (port 5980) → MinIO (localhost:9000).
 * Không cần mở port 9000 ra ngoài, không cần presigned URL.
 */
export const POST = withAuth(async (req, { user }) => {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file || file.size === 0) {
      throw new ValidationError('Thiếu file hoặc file rỗng');
    }

    const sessionId = `${user.id}-${Date.now()}`;
    const tempObjectName = `uploads/${sessionId}/file`;

    const buffer = Buffer.from(await file.arrayBuffer());

    await minioClient.putObject(
      BUCKET_TEMP,
      tempObjectName,
      buffer,
      buffer.length,
      { 'Content-Type': file.type || 'application/octet-stream' },
    );

    return NextResponse.json({
      success: true,
      data: { tempObjectName },
    });
  } catch (err) {
    return handleApiError(err);
  }
});
