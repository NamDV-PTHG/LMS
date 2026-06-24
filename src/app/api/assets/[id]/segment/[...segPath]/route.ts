import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { minioClient, BUCKET_PRIVATE } from '@/lib/minio';
import { NotFoundError, ValidationError } from '@/lib/errors';
import { handleApiError } from '@/app/api/error-handler';

/**
 * GET /api/assets/[id]/segment/[...segPath]
 *
 * Proxies HLS segment (.ts) files from private MinIO bucket to the browser.
 * This avoids exposing MinIO port (9000) to the internet — all traffic
 * flows through the Next.js web server on port 80/443.
 *
 * No Bearer auth: UUID + segment path are sufficient protection.
 * Segments expire implicitly when the manifest is regenerated.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string; segPath: string[] } },
) {
  try {
    const asset = await prisma.contentAsset.findUnique({
      where: { id: params.id },
      select: { isActive: true, processingStatus: true, hlsPlaylistPath: true },
    });

    if (!asset || !asset.isActive) throw new NotFoundError('Asset');
    if (asset.processingStatus !== 'READY') throw new ValidationError('Nội dung chưa sẵn sàng');
    if (!asset.hlsPlaylistPath) throw new NotFoundError('HLS segment');

    // Derive HLS base folder from playlist path, e.g.:
    // "companyId/orgId/videos/hls/assetId/playlist.m3u8"
    //  → "companyId/orgId/videos/hls/assetId/"
    const lastSlash = asset.hlsPlaylistPath.lastIndexOf('/');
    const basePath = lastSlash >= 0 ? asset.hlsPlaylistPath.substring(0, lastSlash + 1) : '';

    // segPath is an array like ['segment_000.ts']
    const segFileName = params.segPath.join('/');
    const objectName = basePath + segFileName;

    // Stream from MinIO directly (server-side — no presigned URL needed)
    const stream = await minioClient.getObject(BUCKET_PRIVATE, objectName);

    // Pipe the MinIO stream into the response
    const readable = new ReadableStream({
      start(controller) {
        stream.on('data', (chunk: Buffer) => controller.enqueue(chunk));
        stream.on('end', () => controller.close());
        stream.on('error', (err) => controller.error(err));
      },
    });

    return new NextResponse(readable, {
      headers: {
        'Content-Type': 'video/mp2t',
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
