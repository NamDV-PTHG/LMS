import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/middleware/require-role';
import { prisma } from '@/lib/prisma';
import { getPresignedDownloadUrl } from '@/lib/minio';
import { NotFoundError, ValidationError } from '@/lib/errors';
import { handleApiError } from '@/app/api/error-handler';

/**
 * GET /api/assets/[id]/content
 *
 * Proxy endpoint: fetches asset content from MinIO server-side and streams
 * it to the browser over HTTPS.
 *
 * Why: MinIO runs over HTTP (port 9000) but the LMS is served over HTTPS.
 * Browsers block mixed content — they refuse to load HTTP resources on an
 * HTTPS page. Proxying through Next.js keeps everything on one HTTPS origin.
 *
 * Supports Range requests so PDF.js and video players can seek efficiently.
 */
export const GET = withAuth(async (req: NextRequest, { params }) => {
  try {
    const asset = await prisma.contentAsset.findUnique({ where: { id: params!.id } });
    if (!asset || !asset.isActive) throw new NotFoundError('Asset');
    if (asset.processingStatus !== 'READY') {
      throw new ValidationError('Nội dung chưa sẵn sàng');
    }

    // Get a short-lived presigned URL — used only server-side, never sent to browser
    const minioUrl = await getPresignedDownloadUrl(asset.storagePath);

    // Forward Range header so PDF.js and video players can request partial content
    const fetchHeaders: HeadersInit = {};
    const range = req.headers.get('range');
    if (range) fetchHeaders['Range'] = range;

    const minioRes = await fetch(minioUrl, { headers: fetchHeaders });

    const responseHeaders = new Headers();
    responseHeaders.set('Content-Type', asset.mimeType ?? 'application/octet-stream');
    responseHeaders.set('Accept-Ranges', 'bytes');
    responseHeaders.set('Cache-Control', 'private, max-age=900');
    // Prevent download
    responseHeaders.set('Content-Disposition', 'inline');

    const contentLength = minioRes.headers.get('content-length');
    if (contentLength) responseHeaders.set('Content-Length', contentLength);

    const contentRange = minioRes.headers.get('content-range');
    if (contentRange) responseHeaders.set('Content-Range', contentRange);

    return new NextResponse(minioRes.body, {
      status: minioRes.status,
      headers: responseHeaders,
    });
  } catch (err) {
    return handleApiError(err);
  }
});
