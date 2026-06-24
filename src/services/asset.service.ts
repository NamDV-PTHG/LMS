import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import {
  getPresignedUploadUrl,
  getPresignedDownloadUrl,
  BUCKET_TEMP,
  BUCKET_PRIVATE,
} from '@/lib/minio';
import { assetProcessingQueue } from '@/lib/queue';
import { CACHE_KEYS, TTL } from '@/lib/cache';
import { redisGet, redisSet } from '@/lib/redis';
import {
  NotFoundError,
  ForbiddenError,
  ValidationError,
} from '@/lib/errors';
import { DownloadPolicy } from '@/types';

// ── Schemas ───────────────────────────────────────────────────

export const confirmUploadSchema = z.object({
  lessonId: z.string().uuid().optional(),
  organizationId: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  fileType: z.enum(['video', 'document', 'presentation', 'audio', 'image']),
  mimeType: z.string(),
  fileSizeBytes: z.number().int().positive(),
  tempObjectName: z.string(), // object name in lms-temp bucket
});

export type ConfirmUploadInput = z.infer<typeof confirmUploadSchema>;

// ── Helpers ───────────────────────────────────────────────────

/**
 * Build the storage path in lms-private bucket.
 * Pattern: {companyId}/{orgId}/{assetType}/{assetId}
 */
function buildStoragePath(
  companyId: string,
  orgId: string,
  assetType: string,
  assetId: string,
  ext: string,
): string {
  return `${companyId}/${orgId}/${assetType}s/${assetId}${ext}`;
}

function getExtFromMime(mimeType: string): string {
  const map: Record<string, string> = {
    'video/mp4': '.mp4', 'video/webm': '.webm',
    'application/pdf': '.pdf',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
    'audio/mpeg': '.mp3', 'audio/ogg': '.ogg',
  };
  return map[mimeType] ?? '';
}

// ── Service functions ─────────────────────────────────────────

/**
 * Step 1: Generate presigned PUT URL → client uploads directly to MinIO temp
 */
export async function getUploadUrl(
  companyId: string,
  userId: string,
): Promise<{ uploadUrl: string; tempObjectName: string }> {
  const sessionId = `${userId}-${Date.now()}`;
  const tempObjectName = `uploads/${sessionId}/file`;
  const uploadUrl = await getPresignedUploadUrl(tempObjectName, 15 * 60);
  return { uploadUrl, tempObjectName };
}

/**
 * Step 2: Confirm upload → create DB record + enqueue processor
 */
export async function confirmUpload(
  input: ConfirmUploadInput,
  companyId: string,
  userId: string,
) {
  // Verify org belongs to company
  const org = await prisma.organization.findUnique({ where: { id: input.organizationId } });
  if (!org || (org.companyId !== companyId && org.id !== companyId)) {
    throw new ForbiddenError('Tổ chức không thuộc công ty này');
  }

  const ext = getExtFromMime(input.mimeType);
  // Placeholder path — will be updated after processing
  const storagePath = buildStoragePath(companyId, input.organizationId, input.fileType, 'PENDING', ext);

  const asset = await prisma.contentAsset.create({
    data: {
      lessonId: input.lessonId,
      organizationId: input.organizationId,
      uploadedById: userId,
      title: input.title,
      description: input.description,
      fileType: input.fileType as never,
      storagePath,
      mimeType: input.mimeType,
      fileSizeBytes: BigInt(input.fileSizeBytes),
      downloadPolicy: 'BLOCKED',
      watermarkEnabled: true,
      visibility: 'DEPT_ONLY',
      processingStatus: 'PENDING',
    },
  });

  // Enqueue processor job
  await assetProcessingQueue.add('process-asset', {
    assetId: asset.id,
    tempObjectName: input.tempObjectName,
    companyId,
    orgId: input.organizationId,
    fileType: input.fileType,
    mimeType: input.mimeType,
  });

  // Serialize BigInt → string for JSON response
  return { ...asset, fileSizeBytes: asset.fileSizeBytes.toString() };
}

/**
 * Get URL for video streaming.
 * - HLS assets: returns our manifest proxy URL (handles segment signing server-side).
 * - MP4/other assets: returns a presigned MinIO URL directly.
 */
export async function getStreamUrl(
  assetId: string,
  userId: string,
  companyId: string,
): Promise<{ url: string; mimeType: string }> {
  const asset = await prisma.contentAsset.findUnique({ where: { id: assetId } });
  if (!asset || !asset.isActive) throw new NotFoundError('Asset');
  if (asset.processingStatus !== 'READY') {
    throw new ValidationError('Nội dung chưa sẵn sàng để phát');
  }

  await logAccess(assetId, userId, 'stream_start');

  if (asset.hlsPlaylistPath) {
    // HLS: proxy through our manifest endpoint which rewrites segment URLs
    return { url: `/api/assets/${assetId}/manifest`, mimeType: 'application/x-mpegURL' };
  }

  // MP4 / other formats: presigned direct URL (cached)
  const cacheKey = CACHE_KEYS.signedUrl(assetId, userId);
  const cached = await redisGet<string>(cacheKey);
  if (cached) return { url: cached, mimeType: asset.mimeType ?? 'video/mp4' };

  const signedUrl = await getPresignedDownloadUrl(asset.storagePath);
  await redisSet(cacheKey, signedUrl, TTL.SIGNED_URL);

  return { url: signedUrl, mimeType: asset.mimeType ?? 'video/mp4' };
}

/**
 * Get signed URL for PDF viewing (TTL 20 min).
 */
export async function getViewUrl(
  assetId: string,
  userId: string,
  companyId: string,
): Promise<string> {
  const asset = await prisma.contentAsset.findUnique({ where: { id: assetId } });
  if (!asset || !asset.isActive) throw new NotFoundError('Asset');
  if (asset.processingStatus !== 'READY') {
    throw new ValidationError('Nội dung chưa sẵn sàng');
  }

  const cacheKey = CACHE_KEYS.signedUrl(`${assetId}-view`, userId);
  const cached = await redisGet<string>(cacheKey);
  if (cached) return cached;

  const signedUrl = await getPresignedDownloadUrl(asset.storagePath);
  await redisSet(cacheKey, signedUrl, TTL.SIGNED_URL);
  await logAccess(assetId, userId, 'view_request');

  return signedUrl;
}

/**
 * Handle download request — check policy → return URL or error.
 */
export async function handleDownload(
  assetId: string,
  userId: string,
  companyId: string,
): Promise<{ url?: string; requiresWatermark?: boolean; policy: string }> {
  const asset = await prisma.contentAsset.findUnique({ where: { id: assetId } });
  if (!asset || !asset.isActive) throw new NotFoundError('Asset');

  await logAccess(assetId, userId, 'download_attempt');

  if (asset.downloadPolicy === 'BLOCKED') {
    throw new ForbiddenError('Tài liệu này không cho phép tải về');
  }

  if (asset.downloadPolicy === 'WATERMARK_ONLY') {
    // Frontend or AI service should apply watermark before download
    await logAccess(assetId, userId, 'download_success');
    return { requiresWatermark: true, policy: 'WATERMARK_ONLY' };
  }

  // ALLOWED
  const url = await getPresignedDownloadUrl(asset.storagePath, 5 * 60); // 5 min
  await logAccess(assetId, userId, 'download_success');
  return { url, policy: 'ALLOWED' };
}

/**
 * Log heartbeat (stream keep-alive every 30s).
 */
export async function logHeartbeat(assetId: string, userId: string): Promise<void> {
  await logAccess(assetId, userId, 'stream_heartbeat');
}

async function logAccess(
  assetId: string,
  userId: string,
  action: 'view_request' | 'stream_start' | 'stream_heartbeat' | 'download_attempt' | 'download_success' | 'signed_url_expired',
) {
  await prisma.assetAccessLog.create({
    data: { assetId, userId, action },
  });
}

export async function getAssets(
  companyId: string,
  filters: { orgId?: string; type?: string; lessonId?: string; page: number; limit: number },
) {
  const { orgId, type, lessonId, page, limit } = filters;

  // Cho phép cả org thuộc company (companyId match) lẫn org là company chính (id match)
  // Cần thiết cho group_admin: org của họ có companyId=null nhưng org.id === companyId
  const where: Record<string, unknown> = {
    isActive: true,
    organization: { OR: [{ companyId }, { id: companyId }] },
    ...(orgId ? { organizationId: orgId } : {}),
    ...(type ? { fileType: type } : {}),
    ...(lessonId ? { lessonId } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.contentAsset.findMany({
      where,
      select: {
        id: true, title: true, description: true, fileType: true,
        mimeType: true, fileSizeBytes: true, durationSeconds: true,
        downloadPolicy: true, visibility: true, processingStatus: true,
        watermarkEnabled: true, thumbnailPath: true, createdAt: true, updatedAt: true,
        organization: { select: { id: true, name: true } },
        uploader: { select: { id: true, fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.contentAsset.count({ where }),
  ]);

  const serialized = items.map((item) => ({
    ...item,
    fileSizeBytes: item.fileSizeBytes.toString(),
  }));
  return { items: serialized, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function updateAsset(
  assetId: string,
  userId: string,
  companyId: string,
  isAdmin: boolean,
  data: { title?: string; description?: string; downloadPolicy?: DownloadPolicy; visibility?: string; watermarkEnabled?: boolean },
) {
  const asset = await prisma.contentAsset.findUnique({
    where: { id: assetId },
    include: { organization: true },
  });
  if (!asset || !asset.isActive) throw new NotFoundError('Asset');

  // Ownership check kép
  const isOwner = asset.uploadedById === userId;
  const sameCompany = asset.organization.companyId === companyId;

  if (!isAdmin && !isOwner && !sameCompany) {
    throw new ForbiddenError('Không có quyền chỉnh sửa asset này');
  }

  // Policy changes require admin
  if ((data.downloadPolicy !== undefined || data.visibility !== undefined) && !isAdmin && !isOwner) {
    throw new ForbiddenError('Chỉ admin mới được đổi download policy / visibility');
  }

  const updated = await prisma.contentAsset.update({ where: { id: assetId }, data });
  return { ...updated, fileSizeBytes: updated.fileSizeBytes.toString() };
}

export async function deleteAsset(
  assetId: string,
  userId: string,
  companyId: string,
  isAdmin: boolean,
) {
  const asset = await prisma.contentAsset.findUnique({
    where: { id: assetId },
    include: { organization: true },
  });
  if (!asset || !asset.isActive) throw new NotFoundError('Asset');

  const isOwner = asset.uploadedById === userId;
  const sameCompany = asset.organization.companyId === companyId;
  if (!isAdmin && !isOwner && !sameCompany) {
    throw new ForbiddenError('Không có quyền xóa asset này');
  }

  const deleted = await prisma.contentAsset.update({
    where: { id: assetId },
    data: { isActive: false },
  });
  return { ...deleted, fileSizeBytes: deleted.fileSizeBytes.toString() };
}

export async function getAssetStatus(assetId: string, companyId: string) {
  const asset = await prisma.contentAsset.findUnique({
    where: { id: assetId },
    select: { id: true, processingStatus: true, hlsPlaylistPath: true, thumbnailPath: true },
  });
  if (!asset) throw new NotFoundError('Asset');
  return asset;
}

export async function getAssetLogs(
  assetId: string,
  companyId: string,
  page: number,
  limit: number,
) {
  const [items, total] = await Promise.all([
    prisma.assetAccessLog.findMany({
      where: { assetId },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.assetAccessLog.count({ where: { assetId } }),
  ]);
  return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function setAssetPermission(
  assetId: string,
  input: { organizationId: string; canView: boolean; canDownload: boolean; expiresAt?: string },
  grantedById: string,
) {
  return prisma.assetPermission.upsert({
    where: {
      id: `${assetId}-${input.organizationId}`,
    },
    update: {
      canView: input.canView,
      canDownload: input.canDownload,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
    },
    create: {
      assetId,
      organizationId: input.organizationId,
      canView: input.canView,
      canDownload: input.canDownload,
      grantedById,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
    },
  });
}

export async function rateAsset(
  assetId: string,
  userId: string,
  rating: number,
  comment?: string,
) {
  if (rating < 1 || rating > 5) throw new ValidationError('Rating phải từ 1–5');
  return prisma.contentRating.upsert({
    where: { assetId_userId: { assetId, userId } },
    update: { rating, comment },
    create: { assetId, userId, rating, comment },
  });
}
