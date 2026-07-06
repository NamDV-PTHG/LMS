import { prisma } from '@/lib/prisma';
import { cacheAside, TTL, CACHE_KEYS } from '@/lib/cache';
import { redisGet, redisSet } from '@/lib/redis';
import { getOrgTree, OrgNode } from './organization.service';
import { ForbiddenError, NotFoundError } from '@/lib/errors';

// ── Types ─────────────────────────────────────────────────────

export interface MediaFolderNode {
  id: string;
  name: string;
  type: string;
  isVirtualRoot: boolean;
  assetCount: number;
  children: MediaFolderNode[];
}

export interface FolderDownloadPermission {
  allowed: boolean;
  canManage: boolean;
  companyId: string;
}

// ── Constants ─────────────────────────────────────────────────

const MEDIA_LIB_TTL = 5 * 60; // 5 minutes

function mediaLibCacheKey(companyId: string, callerOrgId: string) {
  return `mediaLibTree:${companyId}:${callerOrgId}`;
}

// ── Helpers ───────────────────────────────────────────────────

/**
 * Convert OrgNode tree → MediaFolderNode tree, merging asset counts.
 */
function buildMediaTree(
  node: OrgNode,
  countMap: Map<string, number>,
  companyId: string,
): MediaFolderNode {
  const isVirtualRoot = node.id === companyId;
  return {
    id: node.id,
    name: isVirtualRoot ? 'Dữ liệu chung' : node.name,
    type: node.type,
    isVirtualRoot,
    assetCount: countMap.get(node.id) ?? 0,
    children: (node.children ?? []).map(child =>
      buildMediaTree(child, countMap, companyId),
    ),
  };
}

/**
 * Find a subtree rooted at targetId. Returns null if not found.
 */
function findSubtree(node: MediaFolderNode, targetId: string): MediaFolderNode | null {
  if (node.id === targetId) return node;
  for (const child of node.children) {
    const found = findSubtree(child, targetId);
    if (found) return found;
  }
  return null;
}

// ── Service functions ─────────────────────────────────────────

/**
 * Build the media library folder tree for a company.
 * - Admin roles see the full tree.
 * - Instructors see only their own org subtree.
 * Cached per (companyId, callerOrgId) for 5 minutes.
 */
export async function getMediaLibraryTree(
  companyId: string,
  callerOrgId: string,
  isAdmin: boolean,
): Promise<MediaFolderNode[]> {
  const cacheKey = mediaLibCacheKey(companyId, isAdmin ? '__admin__' : callerOrgId);

  const cached = await redisGet<MediaFolderNode[]>(cacheKey);
  if (cached) return cached;

  // Fetch org tree (already cached 30 min in org service)
  const orgTree = await getOrgTree(companyId, companyId);
  if (!orgTree) return [];

  // Count assets per org — only READY assets (exclude PENDING/FAILED/PROCESSING)
  const counts = await prisma.contentAsset.groupBy({
    by: ['organizationId'],
    where: {
      isActive: true,
      processingStatus: 'READY',
      organization: { OR: [{ companyId }, { id: companyId }] },
    },
    _count: { id: true },
  });
  const countMap = new Map(counts.map(c => [c.organizationId, c._count.id]));

  // Build the full media tree
  let result = buildMediaTree(orgTree, countMap, companyId);

  // Instructors: prune to their own subtree
  if (!isAdmin) {
    const subtree = findSubtree(result, callerOrgId);
    result = subtree ?? {
      id: callerOrgId,
      name: 'Phòng ban của tôi',
      type: 'dept',
      isVirtualRoot: false,
      assetCount: countMap.get(callerOrgId) ?? 0,
      children: [],
    };
  }

  const tree = [result];
  await redisSet(cacheKey, tree, MEDIA_LIB_TTL);
  return tree;
}

/**
 * Check whether a company is permitted to perform folder bulk-downloads.
 * Permission is stored in Organization.metadata.allowFolderDownload (set by group_admin).
 */
export async function getFolderDownloadPermission(
  companyId: string,
  userRoles: string[],
): Promise<FolderDownloadPermission> {
  const isGroupLevel = userRoles.some(r => ['group_admin', 'group_hrm'].includes(r));
  const canManage = userRoles.includes('group_admin');

  if (isGroupLevel) {
    // Group-level roles always have folder download access
    return { allowed: true, canManage, companyId };
  }

  // Company-level roles: check org metadata
  const org = await prisma.organization.findFirst({
    where: { OR: [{ id: companyId }, { companyId, type: 'company' }] },
    select: { metadata: true },
  });

  const meta = (org?.metadata ?? {}) as Record<string, unknown>;
  return {
    allowed: meta.allowFolderDownload === true,
    canManage: false,
    companyId,
  };
}

/**
 * Grant or revoke folder download permission for a company.
 * Only group_admin can call this.
 */
export async function setFolderDownloadPermission(
  targetCompanyId: string,
  allow: boolean,
  callerRoles: string[],
): Promise<void> {
  if (!callerRoles.includes('group_admin')) {
    throw new ForbiddenError('Chỉ group_admin mới được cấp quyền tải thư mục');
  }

  const org = await prisma.organization.findFirst({
    where: { OR: [{ id: targetCompanyId }, { companyId: targetCompanyId, type: 'company' }] },
    select: { id: true, metadata: true },
  });
  if (!org) throw new NotFoundError('Công ty');

  const currentMeta = ((org.metadata ?? {}) as Record<string, unknown>);
  await prisma.organization.update({
    where: { id: org.id },
    data: { metadata: { ...currentMeta, allowFolderDownload: allow } },
  });
}
