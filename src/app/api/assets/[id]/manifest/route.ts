import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getObjectContent, getPresignedDownloadUrl } from '@/lib/minio';
import { handleApiError } from '@/app/api/error-handler';
import { NotFoundError, ValidationError } from '@/lib/errors';

/**
 * GET /api/assets/[id]/manifest
 *
 * Serves an HLS manifest (.m3u8) with segment paths rewritten to
 * /api/assets/[id]/segment/[filename] — proxied through Next.js.
 *
 * Why proxy instead of direct MinIO URLs:
 * MinIO runs on port 9000 which is typically not exposed to the internet.
 * Routing segments through the Next.js web server (port 80/443) avoids
 * the need to open MinIO's port in the firewall.
 *
 * No Bearer auth: asset UUID is unguessable protection.
 * Falls back to presigned MP4 URL for non-HLS assets.
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const asset = await prisma.contentAsset.findUnique({ where: { id: params.id } });
    if (!asset || !asset.isActive) throw new NotFoundError('Asset');
    if (asset.processingStatus !== 'READY') throw new ValidationError('Nội dung chưa sẵn sàng');

    // Non-HLS: redirect to presigned MP4 URL
    if (!asset.hlsPlaylistPath) {
      const mp4Url = await getPresignedDownloadUrl(asset.storagePath);
      return NextResponse.redirect(mp4Url);
    }

    // Fetch raw m3u8 content from MinIO (server-side)
    const m3u8Content = await getObjectContent(asset.hlsPlaylistPath);

    // Rewrite each segment line to our proxy endpoint.
    // Only rewrite relative filenames (e.g. "segment_000.ts") and strip
    // any absolute MinIO URLs down to just the filename.
    const lines = m3u8Content.split('\n');
    const rewritten = lines.map((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return line;

      let filename: string;
      if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        // Strip to just the filename (last path segment, no query string)
        try {
          const u = new URL(trimmed);
          filename = u.pathname.split('/').pop() ?? trimmed;
        } catch {
          return line;
        }
      } else {
        // Relative path — take the last segment (handles "subdir/segment.ts" too)
        filename = trimmed.split('/').pop() ?? trimmed;
      }

      return `/api/assets/${params.id}/segment/${filename}`;
    });

    return new NextResponse(rewritten.join('\n'), {
      headers: {
        'Content-Type': 'application/vnd.apple.mpegurl',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err) {
    console.error('[Manifest] Error for asset', params.id, ':', err);
    return handleApiError(err);
  }
}
