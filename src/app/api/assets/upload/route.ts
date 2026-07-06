import { NextResponse } from 'next/server';
import { Readable } from 'stream';
import { withAuth } from '@/middleware/require-role';
import { minioClient, BUCKET_TEMP } from '@/lib/minio';
import { handleApiError } from '@/app/api/error-handler';
import { ValidationError } from '@/lib/errors';

// Max sizes per file category (bytes)
const MAX_SIZES: Record<string, number> = {
  video:        3 * 1024 * 1024 * 1024, // 3 GB
  audio:        500 * 1024 * 1024,       // 500 MB
  document:     200 * 1024 * 1024,       // 200 MB
  presentation: 200 * 1024 * 1024,       // 200 MB
  image:        50 * 1024 * 1024,        // 50 MB
  default:      200 * 1024 * 1024,       // 200 MB
};

/**
 * POST /api/assets/upload
 * Proxy upload: browser → Next.js → MinIO (streaming, không buffer toàn bộ file vào RAM).
 *
 * Client gửi file dưới dạng raw binary body (không phải FormData) với các headers:
 *   Content-Type: <mime type của file>
 *   Content-Length: <file size in bytes>
 *   X-File-Type: video | audio | document | presentation | image
 */
export const POST = withAuth(async (req, { user }) => {
  try {
    const contentType = req.headers.get('content-type') ?? 'application/octet-stream';
    const fileType    = req.headers.get('x-file-type') ?? 'default';
    const rawLength   = req.headers.get('content-length');
    const contentLength = rawLength ? parseInt(rawLength, 10) : NaN;

    if (!contentLength || isNaN(contentLength) || contentLength <= 0) {
      throw new ValidationError('Thiếu Content-Length hoặc file rỗng');
    }

    // File size guard
    const maxSize = MAX_SIZES[fileType] ?? MAX_SIZES.default;
    if (contentLength > maxSize) {
      const maxMB = Math.round(maxSize / 1024 / 1024);
      throw new ValidationError(`File quá lớn. Tối đa ${maxMB} MB cho loại "${fileType}"`);
    }

    if (!req.body) throw new ValidationError('Không có dữ liệu file');

    const sessionId     = `${user.id}-${Date.now()}`;
    const tempObjectName = `uploads/${sessionId}/file`;

    // Stream body trực tiếp vào MinIO — không đọc toàn bộ file vào RAM
    const nodeStream = Readable.fromWeb(
      req.body as import('stream/web').ReadableStream<Uint8Array>,
    );

    await minioClient.putObject(
      BUCKET_TEMP,
      tempObjectName,
      nodeStream,
      contentLength,
      { 'Content-Type': contentType },
    );

    return NextResponse.json({ success: true, data: { tempObjectName } });
  } catch (err) {
    return handleApiError(err);
  }
});
