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

export const updateOrgSchema = createOrgSchema.partial().omit({ type: true, code: true }).extend({
  parentId: z.string().uuid().optional().nullable(),
});

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
        take: 100,
        orderBy: { assignedAt: 'asc' },
      },
    },
  });
  if (!org || !org.isActive) throw new NotFoundError('Tổ chức');
  if (!isGroupAdmin && org.companyId !== companyId && org.id !== companyId) {
    throw new ForbiddenError('Không có quyền xem tổ chức này');
  }

  // Group UserRole rows by user — one user can have multiple roles in same org
  const userMap = new Map<string, { id: string; fullName: string; jobTitle: string | null; roles: string[] }>();
  for (const ur of org.users) {
    const existing = userMap.get(ur.user.id);
    if (existing) {
      existing.roles.push(ur.role);
    } else {
      userMap.set(ur.user.id, {
        id: ur.user.id,
        fullName: ur.user.fullName,
        jobTitle: ur.user.jobTitle,
        roles: [ur.role],
      });
    }
  }

  // Rename deptPositions → positions so frontend interface matches
  const { deptPositions, users: _rawUsers, ...orgRest } = org;
  return {
    ...orgRest,
    positions: deptPositions,
    users: Array.from(userMap.values()),
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
      where: {
        isActive: true,
        OR: [
          { companyId },       // dept/team children của công ty
          { id: companyId },   // bản thân khối công ty (root node)
        ],
      },
      select: { id: true, name: true, code: true, type: true, parentId: true },
      orderBy: { displayOrder: 'asc' },
    });
    return orgs;
  });
}

/**
 * Get flat list with user/position counts for org chart stats display.
 * Always includes the company root node itself so the org chart has a proper root.
 */
export async function getOrgFlatWithStats(companyId: string): Promise<OrgFlat[]> {
  const [root, orgs] = await Promise.all([
    // Include the company/group root node itself as the anchor of the tree
    prisma.organization.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        name: true,
        code: true,
        type: true,
        parentId: true,
        _count: { select: { users: true, deptPositions: true } },
      },
    }),
    prisma.organization.findMany({
      where: { companyId, isActive: true, id: { not: companyId } },
      select: {
        id: true,
        name: true,
        code: true,
        type: true,
        parentId: true,
        _count: { select: { users: true, deptPositions: true } },
      },
      orderBy: { displayOrder: 'asc' },
    }),
  ]);

  const toFlat = (o: typeof orgs[0]): OrgFlat => ({
    id: o.id,
    name: o.name,
    code: o.code,
    type: o.type,
    parentId: o.parentId,
    userCount: o._count.users,
    positionCount: o._count.deptPositions,
  });

  // Root node is the anchor of the tree — force parentId=null so it's always a root
  const rootFlat = root ? [{ ...toFlat(root), parentId: null }] : [];
  const flat = [...rootFlat, ...orgs.map(toFlat)];

  // ── Tính tổng subtree (hình cây) ─────────────────────────────
  // userCount/positionCount từ _count chỉ tính thành viên TRỰC TIẾP.
  // Org chart cần hiển thị tổng toàn bộ cây con.
  // Thuật toán: post-order DFS từ lá lên gốc.

  const nodeMap = new Map<string, OrgFlat>(flat.map((n) => [n.id, { ...n }]));
  const childrenOf = new Map<string, string[]>();
  nodeMap.forEach((_, id) => childrenOf.set(id, []));
  nodeMap.forEach((node) => {
    if (node.parentId && childrenOf.has(node.parentId)) {
      childrenOf.get(node.parentId)!.push(node.id);
    }
  });

  // Tính subtree sum bằng DFS đệ quy
  function sumSubtree(id: string): { users: number; positions: number } {
    const node = nodeMap.get(id)!;
    let users = node.userCount ?? 0;
    let positions = node.positionCount ?? 0;
    for (const childId of childrenOf.get(id) ?? []) {
      const childSum = sumSubtree(childId);
      users += childSum.users;
      positions += childSum.positions;
    }
    node.userCount = users;
    node.positionCount = positions;
    return { users, positions };
  }

  // Chạy từ root(s) — node không có parentId trong map
  nodeMap.forEach((node) => {
    if (!node.parentId || !nodeMap.has(node.parentId)) {
      sumSubtree(node.id);
    }
  });

  return Array.from(nodeMap.values());
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

// ── Auto-assign org chart ─────────────────────────────────────

export type AutoAssignStatus =
  | 'assign'           // parentId=null → tìm được cha
  | 'reassign'         // có cha, sẽ đổi sang cha khác (forceReassign only)
  | 'no_change'        // có cha, cha mới giống cũ (forceReassign only)
  | 'keep_current'     // có cha, không tìm được cha mới (forceReassign only)
  | 'already_assigned' // có cha, bỏ qua (chế độ thường)
  | 'unresolvable';    // parentId=null, không tìm được cha

export interface AutoAssignItem {
  id: string;
  name: string;
  code: string;
  currentParentId: string | null;
  currentParentName: string | null;
  proposedParentId: string | null;
  proposedParentName: string | null;
  proposedParentCode: string | null;
  status: AutoAssignStatus;
}

export interface AutoAssignResult {
  preview: AutoAssignItem[];
  summary: {
    willAssign: number;    // assign + reassign
    noChange: number;      // no_change + already_assigned
    unresolvable: number;
    keepCurrent: number;
  };
}

/**
 * Tự động gắn parentId cho các phòng ban dựa trên cấu trúc mã:
 * "BGD-PC-DES" → thử prefix "BGD-PC" trước, nếu không có → thử "BGD" (walk-up).
 *
 * @param companyId  - ID công ty (tenant)
 * @param preview    - true: chỉ trả kết quả, không ghi DB
 * @param forceReassign - true: xử lý cả org đã có parentId (dùng khi thêm phòng ban cấp giữa)
 */
export async function autoAssignOrgChart(
  companyId: string,
  preview: boolean,
  forceReassign = false,
): Promise<AutoAssignResult> {
  // 1. Lấy toàn bộ org trong công ty + company root node
  const allOrgs = await prisma.organization.findMany({
    where: {
      isActive: true,
      OR: [{ companyId }, { id: companyId }],
    },
    select: { id: true, name: true, code: true, type: true, parentId: true },
  });

  // 2. codeMap (UPPERCASE → org) và idMap (id → org)
  const codeMap = new Map(allOrgs.map((o) => [o.code.toUpperCase(), o]));
  const idMap = new Map(allOrgs.map((o) => [o.id, o]));

  // 3. Phân giải cha cho từng dept/team
  const items: AutoAssignItem[] = [];

  for (const org of allOrgs) {
    if (org.type === 'company' || org.type === 'group') continue;

    const currentParent = org.parentId ? idMap.get(org.parentId) : undefined;

    // Chế độ thường: bỏ qua org đã có parentId
    if (!forceReassign && org.parentId !== null) {
      items.push({
        id: org.id, name: org.name, code: org.code,
        currentParentId: org.parentId,
        currentParentName: currentParent?.name ?? null,
        proposedParentId: null, proposedParentName: null, proposedParentCode: null,
        status: 'already_assigned',
      });
      continue;
    }

    // Walk-up prefix search
    const parts = org.code.toUpperCase().split('-');
    let parent: typeof allOrgs[0] | undefined;
    for (let i = parts.length - 1; i >= 1; i--) {
      const prefix = parts.slice(0, i).join('-');
      const candidate = codeMap.get(prefix);
      if (candidate && candidate.id !== org.id) {
        parent = candidate;
        break;
      }
    }

    let status: AutoAssignStatus;
    if (!parent) {
      status = org.parentId !== null ? 'keep_current' : 'unresolvable';
    } else if (org.parentId === parent.id) {
      status = 'no_change';
    } else if (org.parentId !== null) {
      status = 'reassign';
    } else {
      status = 'assign';
    }

    items.push({
      id: org.id, name: org.name, code: org.code,
      currentParentId: org.parentId,
      currentParentName: currentParent?.name ?? null,
      proposedParentId: parent?.id ?? null,
      proposedParentName: parent?.name ?? null,
      proposedParentCode: parent?.code ?? null,
      status,
    });
  }

  // 4. Thực thi nếu không phải preview
  if (!preview) {
    const toWrite = items.filter((i) => i.status === 'assign' || i.status === 'reassign');
    if (toWrite.length > 0) {
      await prisma.$transaction(
        toWrite.map((i) =>
          prisma.organization.updateMany({
            where: { id: i.id, parentId: i.currentParentId }, // optimistic-lock guard
            data: { parentId: i.proposedParentId! },
          })
        )
      );
      await invalidateOrgCache(companyId);
    }
  }

  const summary = {
    willAssign: items.filter((i) => i.status === 'assign' || i.status === 'reassign').length,
    noChange: items.filter((i) => i.status === 'no_change' || i.status === 'already_assigned').length,
    unresolvable: items.filter((i) => i.status === 'unresolvable').length,
    keepCurrent: items.filter((i) => i.status === 'keep_current').length,
  };

  return { preview: items, summary };
}
