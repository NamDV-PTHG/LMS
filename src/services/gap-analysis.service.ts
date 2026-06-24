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

export interface GapAnalysisResult {
  overallReadinessScore: number; // 0–100
  totalCompetencies: number;
  metCount: number;
  gapItems: GapItem[];
  recommendedLearningPathId: string | null;
  recommendedLearningPathName: string | null;
}

export async function runGapAnalysis(
  positionChangeEventId: string,
): Promise<GapAnalysisResult> {
  const event = await prisma.positionChangeEvent.findUnique({
    where: { id: positionChangeEventId },
    include: {
      user: true,
      toPosition: {
        include: {
          competencyFramework: {
            include: {
              domains: {
                include: {
                  competencies: {
                    include: {
                      courseLinks: {
                        include: {
                          course: { select: { id: true, title: true } },
                        },
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

  const framework = event.toPosition.competencyFramework;

  if (!framework) {
    // No framework linked — readiness = 100% (nothing required)
    const result: GapAnalysisResult = {
      overallReadinessScore: 100,
      totalCompetencies: 0,
      metCount: 0,
      gapItems: [],
      recommendedLearningPathId: event.toPosition.learningPathId,
      recommendedLearningPathName: event.toPosition.learningPath?.name ?? null,
    };
    await prisma.positionChangeEvent.update({
      where: { id: positionChangeEventId },
      data: {
        status: 'GAP_ANALYZED',
        gapAnalysisResult: result as unknown as object,
      },
    });
    return result;
  }

  // Collect all competencies in the framework
  const allCompetencies = framework.domains.flatMap((d) =>
    d.competencies.map((c) => ({ ...c, domainName: d.name })),
  );

  // Load user's current profile
  const profiles = await prisma.userCompetencyProfile.findMany({
    where: {
      userId: event.userId,
      competencyId: { in: allCompetencies.map((c) => c.id) },
    },
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
    const gap = Math.max(0, required - current);

    totalWeight += required; // weight proportional to required level
    weightedScore += Math.min(current, required);
    if (met) metCount++;

    if (!met) {
      gapItems.push({
        competencyId: comp.id,
        competencyName: comp.name,
        domainName: comp.domainName,
        requiredLevel: required,
        currentLevel: current,
        gap,
        linkedCourses: comp.courseLinks.map((cl) => ({
          courseId: cl.courseId,
          courseTitle: cl.course.title,
          targetLevel: cl.targetLevel,
        })),
      });
    }
  }

  const overallReadinessScore = totalWeight > 0
    ? Math.round((weightedScore / totalWeight) * 100)
    : 100;

  const result: GapAnalysisResult = {
    overallReadinessScore,
    totalCompetencies: allCompetencies.length,
    metCount,
    gapItems,
    recommendedLearningPathId: event.toPosition.learningPathId,
    recommendedLearningPathName: event.toPosition.learningPath?.name ?? null,
  };

  await prisma.positionChangeEvent.update({
    where: { id: positionChangeEventId },
    data: {
      status: 'GAP_ANALYZED',
      gapAnalysisResult: result as unknown as object,
    },
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

  // Filter by company via user → roles → organization
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

export async function approvePositionChange(
  eventId: string,
  companyId: string,
  approverId: string,
) {
  const event = await prisma.positionChangeEvent.findFirst({
    where: { id: eventId, user: { companyId } },
  });
  if (!event) throw new AppError('EVENT_NOT_FOUND', 'Không tìm thấy sự kiện đổi vị trí', 404);
  if (event.status !== 'PENDING_APPROVAL')
    throw new AppError('INVALID_STATUS', 'Sự kiện không ở trạng thái chờ duyệt', 400);

  await prisma.positionChangeEvent.update({
    where: { id: eventId },
    data: { status: 'APPROVED' },
  });

  // Auto-enroll to learning path if position has one
  const position = await prisma.jobPosition.findUnique({
    where: { id: event.toPositionId },
    select: { learningPathId: true },
  });

  if (position?.learningPathId) {
    try {
      await enrollUserToPath(event.userId, position.learningPathId, companyId, approverId, {
        positionChangeEventId: eventId,
        enrollmentType: 'POSITION_CHANGE',
      });
      await prisma.positionChangeEvent.update({
        where: { id: eventId },
        data: { status: 'ENROLLED' },
      });
    } catch {
      // Already enrolled or path not found — not fatal
    }
  }

  // Update user's position
  await prisma.user.update({
    where: { id: event.userId },
    data: { jobPositionId: event.toPositionId },
  });

  return prisma.positionChangeEvent.findUnique({ where: { id: eventId } });
}

export async function getUserGapAnalysis(userId: string, companyId: string) {
  const user = await prisma.user.findFirst({
    where: { id: userId, companyId },
    include: { jobPosition: true },
  });
  if (!user) throw new AppError('USER_NOT_FOUND', 'Không tìm thấy người dùng', 404);

  // Latest analyzed event
  const latestEvent = await prisma.positionChangeEvent.findFirst({
    where: { userId, status: { in: ['GAP_ANALYZED', 'PENDING_APPROVAL', 'APPROVED', 'ENROLLED', 'COMPLETED'] } },
    include: {
      toPosition: { select: { id: true, title: true, code: true } },
    },
    orderBy: { changedAt: 'desc' },
  });

  return { user, latestEvent };
}
