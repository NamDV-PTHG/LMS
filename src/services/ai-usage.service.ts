import { prisma } from '@/lib/prisma';

export interface AiUsageTotals {
  requests: number;
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  costUsd: number | null;
  activeUsers: number;
}

export interface AiUsageDailyPoint {
  date: string;
  requests: number;
  totalTokens: number;
  costUsd: number | null;
}

export interface AiUsageTopUser {
  userId: string;
  fullName: string;
  email: string;
  requests: number;
  totalTokens: number;
  costUsd: number | null;
}

export interface AiUsageFeature {
  feature: string;
  requests: number;
  totalTokens: number;
  pct: number;
}

export interface AiUsageRecentLog {
  id: string;
  createdAt: string;
  userName: string | null;
  feature: string;
  modelName: string;
  totalTokens: number;
  costUsd: number | null;
  status: string;
  durationMs: number | null;
}

export interface AiUsageReport {
  totals: AiUsageTotals;
  dailyUsage: AiUsageDailyPoint[];
  topUsers: AiUsageTopUser[];
  featureBreakdown: AiUsageFeature[];
  recentLogs: AiUsageRecentLog[];
}

export async function getAiUsageReport(opts: {
  companyId?: string;
  from: Date;
  to: Date;
}): Promise<AiUsageReport> {
  const { companyId, from, to } = opts;

  const where = {
    createdAt: { gte: from, lte: to },
    ...(companyId ? { companyId } : {}),
  };

  // ── 1. Totals ─────────────────────────────────────────────────
  const agg = await prisma.aiUsageLog.aggregate({
    where,
    _count: { id: true },
    _sum: { totalTokens: true, promptTokens: true, completionTokens: true, costUsd: true },
  });

  const activeUsersResult = await prisma.aiUsageLog.groupBy({
    by: ['userId'],
    where: { ...where, userId: { not: null } },
    _count: { id: true },
  });

  const hasCost = agg._sum.costUsd !== null;

  // ── 2. Daily usage ────────────────────────────────────────────
  // Use raw SQL for date truncation
  const dailyRaw = await prisma.$queryRaw<
    { day: Date; requests: bigint; total_tokens: bigint; cost_usd: number | null }[]
  >`
    SELECT
      DATE_TRUNC('day', "createdAt" AT TIME ZONE 'UTC') AS day,
      COUNT(*) AS requests,
      SUM("totalTokens") AS total_tokens,
      ${companyId
        ? prisma.$queryRaw`SUM("costUsd")::float`
        : prisma.$queryRaw`SUM("costUsd")::float`
      }
    FROM "AiUsageLog"
    WHERE "createdAt" >= ${from} AND "createdAt" <= ${to}
      ${companyId ? prisma.$queryRaw`AND "companyId" = ${companyId}` : prisma.$queryRaw``}
    GROUP BY day
    ORDER BY day ASC
  `;

  // Fallback: Prisma groupBy since raw might have issues
  const allLogs = await prisma.aiUsageLog.findMany({
    where,
    select: { createdAt: true, totalTokens: true, costUsd: true },
    orderBy: { createdAt: 'asc' },
  });

  const dailyMap = new Map<string, AiUsageDailyPoint>();
  for (const log of allLogs) {
    const day = log.createdAt.toISOString().slice(0, 10);
    const existing = dailyMap.get(day) ?? { date: day, requests: 0, totalTokens: 0, costUsd: null };
    existing.requests += 1;
    existing.totalTokens += log.totalTokens;
    if (log.costUsd !== null) {
      existing.costUsd = (existing.costUsd ?? 0) + log.costUsd;
    }
    dailyMap.set(day, existing);
  }

  void dailyRaw; // unused — using in-memory aggregation above

  const dailyUsage = Array.from(dailyMap.values());

  // ── 3. Top users ──────────────────────────────────────────────
  const userGroups = await prisma.aiUsageLog.groupBy({
    by: ['userId'],
    where: { ...where, userId: { not: null } },
    _count: { id: true },
    _sum: { totalTokens: true, costUsd: true },
    orderBy: { _sum: { totalTokens: 'desc' } },
    take: 10,
  });

  const userIds = userGroups.map((g) => g.userId!);
  const users = userIds.length > 0
    ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, fullName: true, email: true } })
    : [];
  const userMap = new Map(users.map((u) => [u.id, u]));

  const topUsers: AiUsageTopUser[] = userGroups.map((g) => {
    const u = userMap.get(g.userId ?? '');
    return {
      userId: g.userId ?? '',
      fullName: u?.fullName ?? 'N/A',
      email: u?.email ?? '',
      requests: g._count.id,
      totalTokens: g._sum.totalTokens ?? 0,
      costUsd: g._sum.costUsd ?? null,
    };
  });

  // ── 4. Feature breakdown ──────────────────────────────────────
  const featureGroups = await prisma.aiUsageLog.groupBy({
    by: ['feature'],
    where,
    _count: { id: true },
    _sum: { totalTokens: true },
    orderBy: { _count: { id: 'desc' } },
  });

  const totalRequests = agg._count.id;
  const featureBreakdown: AiUsageFeature[] = featureGroups.map((g) => ({
    feature: g.feature,
    requests: g._count.id,
    totalTokens: g._sum.totalTokens ?? 0,
    pct: totalRequests > 0 ? Math.round((g._count.id / totalRequests) * 100) : 0,
  }));

  // ── 5. Recent logs ────────────────────────────────────────────
  const recent = await prisma.aiUsageLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 25,
    include: { user: { select: { fullName: true } } },
  });

  const recentLogs: AiUsageRecentLog[] = recent.map((l) => ({
    id: l.id,
    createdAt: l.createdAt.toISOString(),
    userName: l.user?.fullName ?? null,
    feature: l.feature,
    modelName: l.modelName,
    totalTokens: l.totalTokens,
    costUsd: l.costUsd,
    status: l.status,
    durationMs: l.durationMs,
  }));

  return {
    totals: {
      requests: totalRequests,
      totalTokens: agg._sum.totalTokens ?? 0,
      promptTokens: agg._sum.promptTokens ?? 0,
      completionTokens: agg._sum.completionTokens ?? 0,
      costUsd: hasCost ? (agg._sum.costUsd ?? 0) : null,
      activeUsers: activeUsersResult.length,
    },
    dailyUsage,
    topUsers,
    featureBreakdown,
    recentLogs,
  };
}
