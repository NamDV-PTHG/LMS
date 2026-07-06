import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/errors';
import { enrollUserToPath } from './learning-path.service';

export interface GapItem {
  competencyId: string;
  competencyName: string;
  domainName: string;
  requiredLevel: number;
  currentLevel: number;
  gap: number;
  linkedCourses: { courseId: string; courseTitle: string; targetLevel: number }[];
}

export interface FrameworkGapResult {
  frameworkId: string;
  frameworkName: string;
  weight: number;
  isPrimary: boolean;
  readinessScore: number;
  totalCompetencies: number;
  metCount: number;
  gapItems: GapItem[];
  recommendedLearningPathId: string | null;
  recommendedLearningPathName: string | null;
}

export interface GapAnalysisResult {
  overallReadinessScore: number; // 0–100 — weighted across all frameworks
  totalCompetencies: number;
  metCount: number;
  gapItems: GapItem[];           // union of all gap items (for backward compat display)
  recommendedLearningPathId: string | null;  // primary framework's path (backward compat)
  recommendedLearningPathName: string | null;
  frameworkBreakdown: FrameworkGapResult[]; // per-framework breakdown (NEW)
}

// ── Helper: analyze competencies of one framework for a user ──────────────────

async function analyzeFramework(
  userId: string,
  fw: {
    id: string;
    name: string;
    domains: {
      name: string;
      competencies: {
        id: string;
        name: string;
        requiredLevel: number;
        courseLinks: { courseId: string; targetLevel: number; course: { id: string; title: string } }[];
      }[];
    }[];
  },
  weight: number,
  isPrimary: boolean,
  learningPathId: string | null,
  learningPathName: string | null,
): Promise<FrameworkGapResult> {
  const allCompetencies = fw.domains.flatMap((d) =>
    d.competencies.map((c) => ({ ...c, domainName: d.name })),
  );

  const profiles = await prisma.userCompetencyProfile.findMany({
    where: { userId, competencyId: { in: allCompetencies.map((c) => c.id) } },
  });
  const profileMap = new Map(profiles.map((p) => [p.competencyId, p.currentLevel]));

  let totalWeight = 0;
  let weightedScore = 0;
  let metCount = 0;
  const gapItems: GapItem[] = [];

  for (const comp of allCompetencies) {
    const current = profileMap.get(comp.id) ?? 0;
    const required = comp.requiredLevel;
    const met = current >= required;

    totalWeight += required;
    weightedScore += Math.min(current, required);
    if (met) metCount++;

    if (!met) {
      gapItems.push({
        competencyId: comp.id,
        competencyName: comp.name,
        domainName: comp.domainName,
        requiredLevel: required,
        currentLevel: current,
        gap: Math.max(0, required - current),
        linkedCourses: comp.courseLinks.map((cl) => ({
          courseId: cl.courseId,
          courseTitle: cl.course.title,
          targetLevel: cl.targetLevel,
        })),
      });
    }
  }

  const readinessScore = totalWeight > 0
    ? Math.round((weightedScore / totalWeight) * 100)
    : 100;

  return {
    frameworkId: fw.id,
    frameworkName: fw.name,
    weight,
    isPrimary,
    readinessScore,
    totalCompetencies: allCompetencies.length,
    metCount,
    gapItems,
    recommendedLearningPathId: learningPathId,
    recommendedLearningPathName: learningPathName,
  };
}

// ── Main gap analysis ─────────────────────────────────────────────────────────

export async function runGapAnalysis(
  positionChangeEventId: string,
): Promise<GapAnalysisResult> {
  const event = await prisma.positionChangeEvent.findUnique({
    where: { id: positionChangeEventId },
    include: {
      user: true,
      toPosition: {
        include: {
          // New multi-framework junction table
          frameworks: {
            include: {
              framework: {
                include: {
                  domains: {
                    include: {
                      competencies: {
                        include: {
                          courseLinks: {
                            include: { course: { select: { id: true, title: true } } },
                          },
                        },
                      },
                    },
                  },
                },
              },
              learningPath: { select: { id: true, name: true } },
            },
            orderBy: { displayOrder: 'asc' },
          },
          // Legacy single framework (backward compat)
          competencyFramework: {
            include: {
              domains: {
                include: {
                  competencies: {
                    include: {
                      courseLinks: {
                        include: { course: { select: { id: true, title: true } } },
                      },
                    },
                  },
                },
              },
            },
          },
          learningPath: { select: { id: true, name: true } },
        },
      },
    },
  });

  if (!event) throw new AppError('EVENT_NOT_FOUND', 'Không tìm thấy sự kiện đổi vị trí', 404);

  const pos = event.toPosition;

  // Build unified framework list: prefer new junction table, fallback to legacy
  type PFEntry = {
    frameworkId: string;
    framework: typeof pos.competencyFramework & NonNullable<unknown>;
    weight: number;
    isPrimary: boolean;
    learningPathId: string | null;
    learningPathName: string | null;
    displayOrder: number;
  };

  let pfList: PFEntry[];

  if (pos.frameworks && pos.frameworks.length > 0) {
    pfList = pos.frameworks.map((pf) => ({
      frameworkId: pf.frameworkId,
      framework: pf.framework,
      weight: pf.weight,
      isPrimary: pf.isPrimary,
      learningPathId: pf.learningPathId ?? null,
      learningPathName: pf.learningPath?.name ?? null,
      displayOrder: pf.displayOrder,
    }));
  } else if (pos.competencyFramework) {
    // Legacy fallback
    pfList = [{
      frameworkId: pos.competencyFramework.id,
      framework: pos.competencyFramework,
      weight: 1.0,
      isPrimary: true,
      learningPathId: pos.learningPathId ?? null,
      learningPathName: pos.learningPath?.name ?? null,
      displayOrder: 0,
    }];
  } else {
    // No framework — readiness 100%
    const result: GapAnalysisResult = {
      overallReadinessScore: 100,
      totalCompetencies: 0,
      metCount: 0,
      gapItems: [],
      recommendedLearningPathId: pos.learningPathId ?? null,
      recommendedLearningPathName: pos.learningPath?.name ?? null,
      frameworkBreakdown: [],
    };
    await prisma.positionChangeEvent.update({
      where: { id: positionChangeEventId },
      data: { status: 'GAP_ANALYZED', gapAnalysisResult: result as unknown as object },
    });
    return result;
  }

  // Analyze each framework
  const frameworkBreakdown: FrameworkGapResult[] = await Promise.all(
    pfList.map((pf) =>
      analyzeFramework(
        event.userId,
        pf.framework,
        pf.weight,
        pf.isPrimary,
        pf.learningPathId,
        pf.learningPathName,
      ),
    ),
  );

  // Weighted overall readiness
  const totalWeight = pfList.reduce((s, pf) => s + pf.weight, 0);
  const overallReadinessScore = totalWeight > 0
    ? Math.round(
        frameworkBreakdown.reduce((s, r) => s + r.readinessScore * r.weight, 0) / totalWeight,
      )
    : 100;

  // Union gap items + totals
  const allGapItems = frameworkBreakdown.flatMap((r) => r.gapItems);
  const totalCompetencies = frameworkBreakdown.reduce((s, r) => s + r.totalCompetencies, 0);
  const metCount = frameworkBreakdown.reduce((s, r) => s + r.metCount, 0);

  // Primary framework's path for backward-compat field
  const primaryFw = frameworkBreakdown.find((r) => r.isPrimary) ?? frameworkBreakdown[0];

  const result: GapAnalysisResult = {
    overallReadinessScore,
    totalCompetencies,
    metCount,
    gapItems: allGapItems,
    recommendedLearningPathId: primaryFw?.recommendedLearningPathId ?? pos.learningPathId ?? null,
    recommendedLearningPathName: primaryFw?.recommendedLearningPathName ?? pos.learningPath?.name ?? null,
    frameworkBreakdown,
  };

  await prisma.positionChangeEvent.update({
    where: { id: positionChangeEventId },
    data: { status: 'GAP_ANALYZED', gapAnalysisResult: result as unknown as object },
  });

  return result;
}

export async function createPositionChange(
  userId: string,
  companyId: string,
  changedById: string,
  data: {
    toPositionId: string;
    effectiveDate: Date;
    notes?: string;
  },
) {
  const user = await prisma.user.findFirst({
    where: { id: userId, companyId },
    select: { id: true, jobPositionId: true },
  });
  if (!user) throw new AppError('USER_NOT_FOUND', 'Không tìm thấy người dùng', 404);

  const toPosition = await prisma.jobPosition.findFirst({
    where: { id: data.toPositionId, companyId },
  });
  if (!toPosition) throw new AppError('POSITION_NOT_FOUND', 'Không tìm thấy vị trí mới', 404);

  return prisma.positionChangeEvent.create({
    data: {
      userId,
      fromPositionId: user.jobPositionId,
      toPositionId: data.toPositionId,
      changedById,
      effectiveDate: data.effectiveDate,
      notes: data.notes,
      status: 'PENDING_GAP_ANALYSIS',
    },
  });
}

export async function getPositionChanges(
  companyId: string,
  opts: {
    userId?: string;
    status?: string;
    page?: number;
    limit?: number;
  } = {},
) {
  const page = opts.page ?? 1;
  const limit = opts.limit ?? 20;
  const skip = (page - 1) * limit;

  const where = {
    user: {
      roles: {
        some: {
          organization: {
            OR: [{ id: companyId }, { companyId }],
          },
        },
      },
    },
    ...(opts.userId ? { userId: opts.userId } : {}),
    ...(opts.status ? { status: opts.status as never } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.positionChangeEvent.findMany({
      where,
      include: {
        user: { select: { id: true, fullName: true, email: true, employeeCode: true } },
        fromPosition: { select: { id: true, title: true, code: true } },
        toPosition: { select: { id: true, title: true, code: true } },
        changedBy: { select: { id: true, fullName: true } },
      },
      orderBy: { changedAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.positionChangeEvent.count({ where }),
  ]);

  return { items, total, page, limit };
}

/**
 * Apply an approved position change:
 * - Update user.jobPositionId
 * - Pause old learning path enrollments
 * - Update UserRole if position has impliedRole
 * - Enroll in ALL learning paths linked via JobPositionFramework (sorted by displayOrder)
 * - Backward compat: also enroll legacy position.learningPathId if frameworks list is empty
 * - Create notification
 */
async function applyPositionChange(eventId: string, event: {
  userId: string;
  toPositionId: string;
  fromPositionId: string | null;
}, approverId: string, companyId: string) {
  const position = await prisma.jobPosition.findUnique({
    where: { id: event.toPositionId },
    select: {
      learningPathId: true,
      impliedRole: true,
      organizationId: true,
      title: true,
      frameworks: {
        select: { learningPathId: true, displayOrder: true },
        orderBy: { displayOrder: 'asc' },
      },
    },
  });

  // 1. Update user's jobPositionId
  await prisma.user.update({
    where: { id: event.userId },
    data: { jobPositionId: event.toPositionId, jobPositionChangedAt: new Date() },
  });

  // 2. Pause old learning path enrollments (IN_PROGRESS → PAUSED)
  await prisma.learningPathEnrollment.updateMany({
    where: { userId: event.userId, status: 'IN_PROGRESS' },
    data: { status: 'PAUSED', pausedAt: new Date(), pausedReason: 'POSITION_CHANGE' },
  });

  // 3. Update UserRole if position implies a role
  if (position?.impliedRole && position.organizationId) {
    await prisma.userRole.upsert({
      where: {
        userId_role_organizationId: {
          userId: event.userId,
          role: position.impliedRole as never,
          organizationId: position.organizationId,
        },
      },
      create: {
        userId: event.userId,
        role: position.impliedRole as never,
        organizationId: position.organizationId,
        assignedBy: approverId,
      },
      update: {},
    });
  }

  // 4. Collect paths to enroll — prefer frameworks[], fallback to legacy learningPathId
  const pathsToEnroll: string[] = [];

  if (position?.frameworks && position.frameworks.length > 0) {
    for (const pf of position.frameworks) {
      if (pf.learningPathId) pathsToEnroll.push(pf.learningPathId);
    }
  } else if (position?.learningPathId) {
    pathsToEnroll.push(position.learningPathId);
  }

  let enrolledAtLeastOne = false;
  for (const pathId of pathsToEnroll) {
    try {
      await enrollUserToPath(event.userId, pathId, companyId, approverId, {
        positionChangeEventId: eventId,
        enrollmentType: 'POSITION_CHANGE',
      });
      enrolledAtLeastOne = true;
    } catch {
      // Already enrolled or path not found — not fatal, continue with remaining paths
    }
  }

  if (enrolledAtLeastOne) {
    await prisma.positionChangeEvent.update({
      where: { id: eventId },
      data: { status: 'ENROLLED' },
    });
  }

  // 5. Create notification for the user
  const positionTitle = position?.title ?? 'vị trí mới';
  const pathCount = pathsToEnroll.length;
  await prisma.notification.create({
    data: {
      companyId,
      targetType: 'user',
      targetId: event.userId,
      title: 'Thay đổi vị trí công việc',
      body: `Bạn đã được chuyển sang ${positionTitle}. ${pathCount > 0 ? `${pathCount} lộ trình học tập đã được ghi danh trong mục "Lộ trình của tôi".` : ''}`,
      createdById: approverId,
    },
  });
}

export async function approvePositionChange(
  eventId: string,
  companyId: string,
  approverId: string,
) {
  const event = await prisma.positionChangeEvent.findFirst({
    where: {
      id: eventId,
      user: { roles: { some: { organization: { OR: [{ id: companyId }, { companyId }] } } } },
    },
  });
  if (!event) throw new AppError('EVENT_NOT_FOUND', 'Không tìm thấy sự kiện đổi vị trí', 404);
  if (!['PENDING_APPROVAL', 'GAP_ANALYZED'].includes(event.status))
    throw new AppError('INVALID_STATUS', 'Sự kiện không ở trạng thái chờ duyệt', 400);

  const isEffectiveFuture = event.effectiveDate > new Date();

  if (isEffectiveFuture) {
    await prisma.positionChangeEvent.update({
      where: { id: eventId },
      data: { status: 'PENDING_EFFECTIVE', approvedById: approverId, approvedAt: new Date() },
    });
  } else {
    await prisma.positionChangeEvent.update({
      where: { id: eventId },
      data: { status: 'APPROVED', approvedById: approverId, approvedAt: new Date() },
    });
    await applyPositionChange(eventId, event, approverId, companyId);
  }

  return prisma.positionChangeEvent.findUnique({ where: { id: eventId } });
}

export async function getUserGapAnalysis(userId: string, companyId: string) {
  const user = await prisma.user.findFirst({
    where: { id: userId, companyId },
    include: { jobPosition: true },
  });
  if (!user) throw new AppError('USER_NOT_FOUND', 'Không tìm thấy người dùng', 404);

  const latestEvent = await prisma.positionChangeEvent.findFirst({
    where: { userId, status: { in: ['GAP_ANALYZED', 'PENDING_APPROVAL', 'APPROVED', 'ENROLLED', 'COMPLETED'] } },
    include: {
      toPosition: { select: { id: true, title: true, code: true } },
    },
    orderBy: { changedAt: 'desc' },
  });

  return { user, latestEvent };
}
