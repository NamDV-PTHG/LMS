import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/middleware/require-role';
import { prisma } from '@/lib/prisma';
import { getObjectContent, getPresignedDownloadUrl } from '@/lib/minio';
import { handleApiError } from '@/app/api/error-handler';
import { NotFoundError, ValidationError } from '@/lib/errors';

/**
 * GET /api/assets/[id]/manifest
 *
 * Serves an HLS manifest (.m3u8) with all segment paths rewritten to
 * time-limited presigned MinIO URLs. This bypasses the private-bucket
 * access restriction so video.js can fetch segments directly.
 *
 * Falls back to a redirect to the presigned MP4 URL for non-HLS assets.
 */
export const GET = withAuth(async (_req: NextRequest, { params, user }) => {
  try {
    const asset = await prisma.contentAsset.findUnique({ where: { id: params!.id } });
    if (!asset || !asset.isActive) throw new NotFoundError('Asset');
    if (asset.processingStatus !== 'READY') throw new ValidationError('Nội dung chưa sẵn sàng');

    // Non-HLS: redirect to presigned MP4 URL
    if (!asset.hlsPlaylistPath) {
      const mp4Url = await getPresignedDownloadUrl(asset.storagePath);
      return NextResponse.redirect(mp4Url);
    }

    // Fetch raw m3u8 content from MinIO (server-side, no auth needed from browser)
    const m3u8Content = await getObjectContent(asset.hlsPlaylistPath);

    // Derive the folder containing the playlist (so relative segment paths resolve correctly)
    const lastSlash = asset.hlsPlaylistPath.lastIndexOf('/');
    const basePath = lastSlash >= 0 ? asset.hlsPlaylistPath.substring(0, lastSlash + 1) : '';

    // Rewrite each segment / sub-manifest line to a presigned URL
    // TTL: 2 hours — long enough for a full viewing session
    const lines = m3u8Content.split('\n');
    const rewritten: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();

      // Skip comments and blank lines unchanged
      if (!trimmed || trimmed.startsWith('#')) {
        rewritten.push(line);
        continue;
      }

      // Absolute URLs (rare but possible) — sign as-is using the path portion
      let objectPath: string;
      if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        try {
          const u = new URL(trimmed);
          objectPath = u.pathname.replace(/^\/[^/]+\//, ''); // strip /bucket/
        } catch {
          rewritten.push(line);
          continue;
        }
      } else {
        objectPath = trimmed.startsWith('/') ? trimmed.slice(1) : basePath + trimmed;
      }

      const signedUrl = await getPresignedDownloadUrl(objectPath, 2 * 3600);
      rewritten.push(signedUrl);
    }

    return new NextResponse(rewritten.join('\n'), {
      headers: {
        'Content-Type': 'application/vnd.apple.mpegurl',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
});
