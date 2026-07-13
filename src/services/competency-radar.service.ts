import { prisma } from '@/lib/prisma';

export interface RadarDomain {
  name: string;
  currentAvg: number;   // 0–5
  requiredAvg: number;  // 0–5
  competencies: {
    id: string;
    name: string;
    current: number;
    required: number;
    gap: number;
    source: string;
  }[];
}

/** Radar axis entry — normalized so required=1 (outer boundary), current=0..1 */
export interface RadarAxis {
  subject: string;
  required: number;     // always 1.0 (outer boundary = target)
  current: number;      // 0–1, proportion of required achieved
  currentRaw: number;   // actual current level (0–5) — for tooltip
  requiredRaw: number;  // actual required level (0–5) — for tooltip
  fullMark: number;     // always 1
}

/** Per-framework radar data — used in multi-tab display */
export interface FrameworkRadarData {
  frameworkId: string;
  frameworkName: string;
  weight: number;
  isPrimary: boolean;
  readinessScore: number;
  totalCompetencies: number;
  metCount: number;
  domains: RadarDomain[];
  radarAxes: RadarAxis[];
}

export interface CompetencyRadarData {
  userId: string;
  fullName: string;
  positionTitle: string | null;
  frameworkName: string | null;  // primary (or only) framework name — backward compat
  readinessScore: number;        // 0–100 — weighted across all frameworks
  totalCompetencies: number;
  metCount: number;
  domains: RadarDomain[];        // composite domains (all frameworks merged) — backward compat
  radarAxes: RadarAxis[];
  frameworkBreakdown: FrameworkRadarData[]; // NEW — one entry per linked framework
}

// ── Helper: build radar data for a single framework ───────────────────────────

function buildFrameworkRadar(
  frameworkId: string,
  frameworkName: string,
  weight: number,
  isPrimary: boolean,
  domains: {
    name: string;
    displayOrder: number;
    competencies: { id: string; name: string; requiredLevel: number; displayOrder: number }[];
  }[],
  profileMap: Map<string, { currentLevel: number; source: string }>,
): FrameworkRadarData {
  let totalWeight = 0;
  let weightedScore = 0;
  let metCount = 0;
  let totalCompetencies = 0;

  const radarDomains: RadarDomain[] = domains.map((domain) => {
    const competencies = domain.competencies.map((comp) => {
      const profile = profileMap.get(comp.id);
      const current = profile?.currentLevel ?? 0;
      const required = comp.requiredLevel;
      const gap = Math.max(0, required - current);
      const met = current >= required;

      totalWeight += required;
      weightedScore += Math.min(current, required);
      if (met) metCount++;
      totalCompetencies++;

      return {
        id: comp.id,
        name: comp.name,
        current,
        required,
        gap,
        source: profile?.source ?? 'none',
      };
    });

    const domainRequired = competencies.reduce((s, c) => s + c.required, 0);
    const domainCurrent = competencies.reduce((s, c) => s + Math.min(c.current, c.required), 0);
    const requiredAvg = competencies.length > 0
      ? Math.round((domainRequired / competencies.length) * 10) / 10
      : 0;
    const currentAvg = competencies.length > 0
      ? Math.round((domainCurrent / competencies.length) * 10) / 10
      : 0;

    return { name: domain.name, currentAvg, requiredAvg, competencies };
  });

  const readinessScore = totalWeight > 0
    ? Math.round((weightedScore / totalWeight) * 100)
    : 100;

  // Normalize: required = 1.0 (outer boundary = target), current = ratio 0–1
  // This makes the "Yêu cầu" polygon always fill the outer edge, and
  // "Hiện tại" lights up within it proportionally.
  const radarAxes: RadarAxis[] = radarDomains.map((d) => ({
    subject: d.name,
    required: 1,
    current: d.requiredAvg > 0 ? Math.min(d.currentAvg / d.requiredAvg, 1) : 0,
    currentRaw: d.currentAvg,
    requiredRaw: d.requiredAvg,
    fullMark: 1,
  }));

  return {
    frameworkId,
    frameworkName,
    weight,
    isPrimary,
    readinessScore,
    totalCompetencies,
    metCount,
    domains: radarDomains,
    radarAxes,
  };
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function getCompetencyRadar(
  userId: string,
  companyId: string,
): Promise<CompetencyRadarData> {
  const user = await prisma.user.findFirst({
    where: {
      id: userId,
      roles: { some: { organization: { OR: [{ id: companyId }, { companyId }] } } },
    },
    include: {
      jobPosition: {
        include: {
          // New multi-framework junction
          frameworks: {
            include: {
              framework: {
                include: {
                  domains: {
                    orderBy: { displayOrder: 'asc' },
                    include: {
                      competencies: { orderBy: { displayOrder: 'asc' } },
                    },
                  },
                },
              },
            },
            orderBy: { displayOrder: 'asc' },
          },
          // Legacy single framework (backward compat)
          competencyFramework: {
            include: {
              domains: {
                orderBy: { displayOrder: 'asc' },
                include: {
                  competencies: { orderBy: { displayOrder: 'asc' } },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!user) {
    return {
      userId,
      fullName: 'Unknown',
      positionTitle: null,
      frameworkName: null,
      readinessScore: 0,
      totalCompetencies: 0,
      metCount: 0,
      domains: [],
      radarAxes: [],
      frameworkBreakdown: [],
    };
  }

  const pos = user.jobPosition;

  if (!pos) {
    return {
      userId,
      fullName: user.fullName,
      positionTitle: null,
      frameworkName: null,
      readinessScore: 100,
      totalCompetencies: 0,
      metCount: 0,
      domains: [],
      radarAxes: [],
      frameworkBreakdown: [],
    };
  }

  // Build unified framework list: prefer junction table, fallback to legacy
  type FwEntry = {
    frameworkId: string;
    frameworkName: string;
    weight: number;
    isPrimary: boolean;
    domains: {
      name: string;
      displayOrder: number;
      competencies: { id: string; name: string; requiredLevel: number; displayOrder: number }[];
    }[];
  };

  let fwList: FwEntry[];

  if (pos.frameworks && pos.frameworks.length > 0) {
    fwList = pos.frameworks.map((pf) => ({
      frameworkId: pf.frameworkId,
      frameworkName: pf.framework.name,
      weight: pf.weight,
      isPrimary: pf.isPrimary,
      domains: pf.framework.domains,
    }));
  } else if (pos.competencyFramework) {
    fwList = [{
      frameworkId: pos.competencyFramework.id,
      frameworkName: pos.competencyFramework.name,
      weight: 1.0,
      isPrimary: true,
      domains: pos.competencyFramework.domains,
    }];
  } else {
    return {
      userId,
      fullName: user.fullName,
      positionTitle: pos.title,
      frameworkName: null,
      readinessScore: 100,
      totalCompetencies: 0,
      metCount: 0,
      domains: [],
      radarAxes: [],
      frameworkBreakdown: [],
    };
  }

  // Load all competency profiles for this user (all frameworks at once)
  const allCompetencyIds = fwList.flatMap((fw) =>
    fw.domains.flatMap((d) => d.competencies.map((c) => c.id)),
  );
  const profiles = await prisma.userCompetencyProfile.findMany({
    where: { userId, competencyId: { in: allCompetencyIds } },
  });
  const profileMap = new Map(profiles.map((p) => [p.competencyId, { currentLevel: p.currentLevel, source: p.source }]));

  // Build per-framework radar
  const frameworkBreakdown: FrameworkRadarData[] = fwList.map((fw) =>
    buildFrameworkRadar(
      fw.frameworkId,
      fw.frameworkName,
      fw.weight,
      fw.isPrimary,
      fw.domains,
      profileMap,
    ),
  );

  // Weighted overall readiness
  const totalFwWeight = fwList.reduce((s, fw) => s + fw.weight, 0);
  const readinessScore = totalFwWeight > 0
    ? Math.round(
        frameworkBreakdown.reduce((s, r) => s + r.readinessScore * r.weight, 0) / totalFwWeight,
      )
    : 100;

  const totalCompetencies = frameworkBreakdown.reduce((s, r) => s + r.totalCompetencies, 0);
  const metCount = frameworkBreakdown.reduce((s, r) => s + r.metCount, 0);

  // Composite domains — merge all frameworks' domains for flat display
  const allDomains = frameworkBreakdown.flatMap((r) => r.domains);

  const primaryFw = frameworkBreakdown.find((r) => r.isPrimary) ?? frameworkBreakdown[0];
  const primaryFrameworkName = primaryFw?.frameworkName ?? null;

  // ── Radar axes strategy ──────────────────────────────────────────────────
  // If the position has ≥3 frameworks: each framework becomes ONE axis
  // (framework name = subject, aggregate readiness of all its competencies)
  // Otherwise: use domains of the primary (or only) framework as axes.
  let topLevelAxes: RadarAxis[];

  if (frameworkBreakdown.length >= 3) {
    // Framework-level axes — one axis per framework
    topLevelAxes = frameworkBreakdown.map((fw) => {
      const allComps = fw.domains.flatMap((d) => d.competencies);
      const requiredRaw =
        allComps.length > 0
          ? allComps.reduce((s, c) => s + c.required, 0) / allComps.length
          : 0;
      const currentRaw =
        allComps.length > 0
          ? allComps.reduce((s, c) => s + Math.min(c.current, c.required), 0) / allComps.length
          : 0;
      return {
        subject: fw.frameworkName,
        required: 1,
        current: requiredRaw > 0 ? Math.min(currentRaw / requiredRaw, 1) : 0,
        currentRaw: Math.round(currentRaw * 10) / 10,
        requiredRaw: Math.round(requiredRaw * 10) / 10,
        fullMark: 1,
      };
    });
  } else {
    // Domain-level axes from primary framework
    topLevelAxes = primaryFw?.radarAxes ?? [];
  }

  return {
    userId,
    fullName: user.fullName,
    positionTitle: pos.title,
    frameworkName: primaryFrameworkName,
    readinessScore,
    totalCompetencies,
    metCount,
    domains: allDomains,
    radarAxes: topLevelAxes,
    frameworkBreakdown,
  };
}
