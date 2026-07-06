import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { cacheAside, invalidateOrgCache, TTL, CACHE_KEYS } from '@/lib/cache';
import { NotFoundError, ConflictError, ForbiddenError } from '@/lib/errors';
import { OrgType } from '@/types';

// ── Schemas ───────────────────────────────────────────────────

export const createOrgSchema = z.object({
  name: z.string().min(1).max(100),
  code: z.string().min(1).max(20).toUpperCase(),
  type: z.enum(['group', 'company', 'dept', 'team']),
  parentId: z.string().uuid().optional(),
  description: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  displayOrder: z.number().int().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const updateOrgSchema = createOrgSchema.partial().omit({ type: true, code: true });

export type CreateOrgInput = z.infer<typeof createOrgSchema>;
export type UpdateOrgInput = z.infer<typeof updateOrgSchema>;

// ── Types for tree/flat ───────────────────────────────────────

export interface OrgNode {
  id: string;
  name: string;
  code: string;
  type: string;
  parentId: string | null;
  companyId: string | null;
  displayOrder: number;
  description: string | null;
  isActive: boolean;
  metadata: unknown;
  userCount?: number;
  children?: OrgNode[];
}

export interface OrgFlat {
  id: string;
  name: string;
  code: string;
  type: string;
  parentId: string | null;
  userCount?: number;
  positionCount?: number;
}

// ── Query helpers ─────────────────────────────────────────────

async function fetchOrgTree(rootId: string): Promise<OrgNode | null> {
  // Fetch all orgs under this root recursively via CTE
  const orgs = await prisma.$queryRaw<OrgNode[]>`
    WITH RECURSIVE org_tree AS (
      SELECT id, name, code, type, "parentId", "companyId",
             "displayOrder", description, "isActive", metadata
      FROM "Organization"
      WHERE id = ${rootId}
      UNION ALL
      SELECT o.id, o.name, o.code, o.type, o."parentId", o."companyId",
             o."displayOrder", o.description, o."isActive", o.metadata
      FROM "Organization" o
      INNER JOIN org_tree ot ON o."parentId" = ot.id
      WHERE o."isActive" = true
    )
    SELECT * FROM org_tree ORDER BY "displayOrder"
  `;

  if (!orgs.length) return null;

  // Build nested tree
  const map = new Map<string, OrgNode>();
  orgs.forEach((o) => map.set(o.id, { ...o, children: [] }));

  let root: OrgNode | null = null;
  map.forEach((node) => {
    if (node.parentId && map.has(node.parentId)) {
      map.get(node.parentId)!.children!.push(node);
    } else {
      root = node;
    }
  });

  return root;
}

// ── Service functions ─────────────────────────────────────────

export async function getOrganizations(companyId: string, isGroupAdmin: boolean) {
  if (isGroupAdmin) {
    return prisma.organization.findMany({
      where: { isActive: true },
      orderBy: [{ companyId: 'asc' }, { displayOrder: 'asc' }],
    });
  }
  return prisma.organization.findMany({
    where: {
      isActive: true,
      OR: [
        { id: companyId },      // bản thân company org
        { companyId },          // các dept/team thuộc công ty
      ],
    },
    orderBy: { displayOrder: 'asc' },
  });
}

export async function getOrganization(id: string, companyId: string, isGroupAdmin: boolean) {
  const org = await prisma.organization.findUnique({
    where: { id },
    include: {
      deptPositions: {
        select: {
          id: true, title: true, code: true, level: true,
          _count: { select: { users: true } },
        },
        orderBy: { title: 'asc' },
        take: 20,
      },
      users: {
        select: {
          role: true,
          user: { select: { id: true, fullName: true, jobTitle: true } },
        },
        take: 20,
        orderBy: { assignedAt: 'asc' },
      },
    },
  });
  if (!org || !org.isActive) throw new NotFoundError('Tổ chức');
  if (!isGroupAdmin && org.companyId !== companyId && org.id !== companyId) {
    throw new ForbiddenError('Không có quyền xem tổ chức này');
  }

  return {
    ...org,
    users: org.users.map((ur) => ({
      id: ur.user.id,
      fullName: ur.user.fullName,
      jobTitle: ur.user.jobTitle,
      role: ur.role,
    })),
  };
}

export async function createOrganization(input: CreateOrgInput, companyId: string, isGroupAdmin: boolean) {
  if (input.type === 'group') {
    if (!isGroupAdmin) throw new ForbiddenError('Chỉ group_admin mới được tạo tổ chức cấp group');
  } else if (input.type === 'company') {
    if (!isGroupAdmin) throw new ForbiddenError('Chỉ group_admin mới được tạo công ty con');
  }

  // For group/company orgs companyId is self-referential (set after creation).
  // For dept/team, inherit the caller's companyId.
  const isDeptOrTeam = input.type !== 'group' && input.type !== 'company';
  const orgCompanyId = isDeptOrTeam ? companyId : null;

  // Check unique code (for dept/team within company; for company/group globally)
  const existing = isDeptOrTeam
    ? await prisma.organization.findFirst({ where: { code: input.code, companyId: orgCompanyId } })
    : await prisma.organization.findFirst({ where: { code: input.code, type: input.type } });
  if (existing) throw new ConflictError(`Mã tổ chức "${input.code}" đã tồn tại`);

  if (isDeptOrTeam) {
    const org = await prisma.organization.create({
      data: { ...input, companyId: orgCompanyId },
    });
    await invalidateOrgCache(companyId);
    return org;
  }

  // For group / company: create first, then set companyId = own id
  const org = await prisma.$transaction(async (tx) => {
    const created = await tx.organization.create({
      data: { ...input, companyId: null },
    });
    // company org's companyId = its own id (enables standard tenant queries)
    if (created.type === 'company') {
      return tx.organization.update({
        where: { id: created.id },
        data: { companyId: created.id },
      });
    }
    return created;
  });

  await invalidateOrgCache(org.companyId ?? org.id);
  return org;
}

export async function updateOrganization(
  id: string,
  input: UpdateOrgInput,
  companyId: string,
  isGroupAdmin: boolean,
) {
  const org = await prisma.organization.findUnique({ where: { id } });
  if (!org || !org.isActive) throw new NotFoundError('Tổ chức');
  if (!isGroupAdmin && org.companyId !== companyId && org.id !== companyId) {
    throw new ForbiddenError('Không có quyền chỉnh sửa tổ chức này');
  }

  const updated = await prisma.organization.update({ where: { id }, data: input });
  await invalidateOrgCache(org.companyId ?? companyId);
  return updated;
}

/**
 * Get full org tree for a root org (cached 30 min).
 */
export async function getOrgTree(rootId: string, companyId: string) {
  return cacheAside(
    CACHE_KEYS.orgTree(companyId),
    TTL.ORG_TREE,
    () => fetchOrgTree(rootId),
  );
}

/**
 * Get flat list of org nodes for React Flow rendering (cached).
 */
export async function getOrgFlat(companyId: string): Promise<OrgFlat[]> {
  return cacheAside(CACHE_KEYS.orgFlat(companyId), TTL.ORG_TREE, async () => {
    const orgs = await prisma.organization.findMany({
      where: { companyId, isActive: true },
      select: { id: true, name: true, code: true, type: true, parentId: true },
      orderBy: { displayOrder: 'asc' },
    });
    return orgs;
  });
}

/**
 * Get flat list with user/position counts for org chart stats display.
 */
export async function getOrgFlatWithStats(companyId: string): Promise<OrgFlat[]> {
  const orgs = await prisma.organization.findMany({
    where: { companyId, isActive: true },
    select: {
      id: true,
      name: true,
      code: true,
      type: true,
      parentId: true,
      _count: { select: { users: true, deptPositions: true } },
    },
    orderBy: { displayOrder: 'asc' },
  });
  return orgs.map((o) => ({
    id: o.id,
    name: o.name,
    code: o.code,
    type: o.type,
    parentId: o.parentId,
    userCount: o._count.users,
    positionCount: o._count.deptPositions,
  }));
}

/**
 * Get direct children of an org node (for lazy load).
 */
export async function getOrgChildren(parentId: string, companyId: string) {
  return prisma.organization.findMany({
    where: { parentId, companyId, isActive: true },
    include: {
      _count: { select: { users: true } },
    },
    orderBy: { displayOrder: 'asc' },
  });
}
