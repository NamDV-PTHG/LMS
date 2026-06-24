import { NextRequest, NextResponse } from 'next/server';
import { minioClient, BUCKET_PRIVATE } from '@/lib/minio';

/**
 * GET /api/public/image?key=<objectName>
 *
 * Proxies images (logo, background) from private MinIO bucket to browser.
 * No auth required — used for branding images on login screen.
 *
 * Why needed: MinIO runs on port 9000 which is not exposed to the internet.
 * This proxy routes image traffic through the Next.js web server (port 80/443).
 */
export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get('key');
  if (!key) {
    return new NextResponse('Missing key', { status: 400 });
  }

  // Basic path validation — no traversal
  const sanitized = key.replace(/\.\./g, '').replace(/^\/+/, '');
  if (!sanitized) return new NextResponse('Invalid key', { status: 400 });

  try {
    const stat = await minioClient.statObject(BUCKET_PRIVATE, sanitized);
    const contentType = stat.metaData?.['content-type'] ?? 'application/octet-stream';

    const stream = await minioClient.getObject(BUCKET_PRIVATE, sanitized);

    const readable = new ReadableStream({
      start(controller) {
        stream.on('data', (chunk: Buffer) => controller.enqueue(chunk));
        stream.on('end', () => controller.close());
        stream.on('error', (err) => controller.error(err));
      },
    });

    return new NextResponse(readable, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400', // 1 ngày
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch {
    return new NextResponse('Not found', { status: 404 });
  }
}
