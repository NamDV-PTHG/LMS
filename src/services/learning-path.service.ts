import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/errors';

// ─── Learning Path CRUD ───────────────────────────────────────────────────────

export async function getLearningPaths(companyId: string, isActive?: boolean, scopedUserIds?: string[] | null) {
  return prisma.learningPath.findMany({
    where: {
      companyId,
      ...(isActive !== undefined ? { isActive } : {}),
      ...(scopedUserIds != null ? { createdById: { in: scopedUserIds } } : {}),
    },
    include: {
      _count: { select: { steps: true, enrollments: true } },
      positions: { select: { id: true, title: true, code: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getLearningPath(id: string, companyId: string) {
  const lp = await prisma.learningPath.findFirst({
    where: { id, companyId },
    include: {
      steps: {
        orderBy: { stepOrder: 'asc' },
        include: {
          course: {
            select: { id: true, title: true, description: true, estimatedHours: true, thumbnailUrl: true },
          },
          prerequisiteStep: { select: { id: true, stepOrder: true } },
        },
      },
      positions: { select: { id: true, title: true, code: true } },
      _count: { select: { enrollments: true } },
    },
  });
  if (!lp) throw new AppError('LEARNING_PATH_NOT_FOUND', 'Không tìm thấy lộ trình học tập', 404);
  return lp;
}

export async function createLearningPath(
  companyId: string,
  data: { name: string; description?: string; totalDeadlineDays?: number },
  userId?: string,
) {
  return prisma.learningPath.create({ data: { companyId, createdById: userId ?? null, ...data } });
}

export async function updateLearningPath(
  id: string,
  companyId: string,
  data: { name?: string; description?: string; totalDeadlineDays?: number; isActive?: boolean },
) {
  const lp = await prisma.learningPath.findFirst({ where: { id, companyId } });
  if (!lp) throw new AppError('LEARNING_PATH_NOT_FOUND', 'Không tìm thấy lộ trình học tập', 404);
  return prisma.learningPath.update({ where: { id }, data });
}

export async function deleteLearningPath(id: string, companyId: string) {
  const lp = await prisma.learningPath.findFirst({ where: { id, companyId } });
  if (!lp) throw new AppError('LEARNING_PATH_NOT_FOUND', 'Không tìm thấy lộ trình học tập', 404);
  const enrollCount = await prisma.learningPathEnrollment.count({ where: { learningPathId: id } });
  if (enrollCount > 0)
    throw new AppError('PATH_HAS_ENROLLMENTS', 'Lộ trình đang có học viên đăng ký', 409);
  // Steps cascade deleted via DB constraint
  return prisma.learningPath.delete({ where: { id } });
}

// ─── Steps ────────────────────────────────────────────────────────────────────

async function assertPathOwner(pathId: string, companyId: string) {
  const lp = await prisma.learningPath.findFirst({ where: { id: pathId, companyId } });
  if (!lp) throw new AppError('LEARNING_PATH_NOT_FOUND', 'Không tìm thấy lộ trình học tập', 404);
  return lp;
}

export async function addStep(
  pathId: string,
  companyId: string,
  data: {
    courseId: string;
    stepType?: 'REQUIRED' | 'ELECTIVE' | 'ADVANCED';
    deadlineOffsetDays?: number;
    availableAfterDays?: number;
    estimatedHours?: number;
    prerequisiteStepId?: string;
  },
) {
  await assertPathOwner(pathId, companyId);

  // Verify course belongs to same company
  const course = await prisma.course.findFirst({ where: { id: data.courseId, ownerCompanyId: companyId } });
  if (!course) throw new AppError('COURSE_NOT_FOUND', 'Không tìm thấy khóa học', 404);

  const lastOrder = await prisma.learningPathStep.aggregate({
    where: { learningPathId: pathId },
    _max: { stepOrder: true },
  });
  const stepOrder = (lastOrder._max.stepOrder ?? 0) + 1;

  return prisma.learningPathStep.create({
    data: { learningPathId: pathId, stepOrder, ...data },
    include: { course: { select: { id: true, title: true, estimatedHours: true } } },
  });
}

export async function updateStep(
  stepId: string,
  companyId: string,
  data: {
    stepType?: 'REQUIRED' | 'ELECTIVE' | 'ADVANCED';
    deadlineOffsetDays?: number;
    availableAfterDays?: number;
    estimatedHours?: number;
    prerequisiteStepId?: string | null;
    stepOrder?: number;
  },
) {
  const step = await prisma.learningPathStep.findUnique({
    where: { id: stepId },
    include: { learningPath: true },
  });
  if (!step || step.learningPath.companyId !== companyId)
    throw new AppError('STEP_NOT_FOUND', 'Không tìm thấy bước học tập', 404);

  return prisma.learningPathStep.update({ where: { id: stepId }, data });
}

export async function removeStep(stepId: string, companyId: string) {
  const step = await prisma.learningPathStep.findUnique({
    where: { id: stepId },
    include: { learningPath: true, dependentSteps: true },
  });
  if (!step || step.learningPath.companyId !== companyId)
    throw new AppError('STEP_NOT_FOUND', 'Không tìm thấy bước học tập', 404);
  if (step.dependentSteps.length > 0)
    throw new AppError('STEP_HAS_DEPENDENTS', 'Bước này là điều kiện tiên quyết cho bước khác', 409);
  return prisma.learningPathStep.delete({ where: { id: stepId } });
}

export async function reorderSteps(pathId: string, companyId: string, stepIds: string[]) {
  await assertPathOwner(pathId, companyId);
  await prisma.$transaction(
    stepIds.map((id, idx) =>
      prisma.learningPathStep.update({ where: { id }, data: { stepOrder: idx + 1 } }),
    ),
  );
}

// ─── Enrollment (admin-triggered) ─────────────────────────────────────────────

export async function enrollUserToPath(
  userId: string,
  pathId: string,
  companyId: string,
  enrolledById: string,
  opts: { positionChangeEventId?: string; enrollmentType?: 'MANUAL' | 'POSITION_CHANGE' | 'SELF' } = {},
) {
  const lp = await prisma.learningPath.findFirst({ where: { id: pathId, companyId, isActive: true } });
  if (!lp) throw new AppError('LEARNING_PATH_NOT_FOUND', 'Không tìm thấy lộ trình học tập', 404);

  const user = await prisma.user.findFirst({
    where: { id: userId, roles: { some: { organization: { OR: [{ id: companyId }, { companyId }] } } } },
  });
  if (!user) throw new AppError('USER_NOT_FOUND', 'Không tìm thấy người dùng', 404);

  const existing = await prisma.learningPathEnrollment.findUnique({
    where: { userId_learningPathId: { userId, learningPathId: pathId } },
  });
  if (existing) throw new AppError('ALREADY_ENROLLED', 'Học viên đã được đăng ký lộ trình này', 409);

  const totalDeadline = lp.totalDeadlineDays
    ? new Date(Date.now() + lp.totalDeadlineDays * 86400000)
    : undefined;

  // Load steps ordered
  const steps = await prisma.learningPathStep.findMany({
    where: { learningPathId: pathId },
    orderBy: { stepOrder: 'asc' },
  });

  const pathEnrollment = await prisma.learningPathEnrollment.create({
    data: {
      userId,
      learningPathId: pathId,
      enrollmentType: opts.enrollmentType ?? 'MANUAL',
      positionChangeEventId: opts.positionChangeEventId,
      totalDeadline,
      approvedById: enrolledById,
      approvedAt: new Date(),
    },
  });

  // Create step enrollments — first step unlocked immediately, rest locked
  if (steps.length > 0) {
    await prisma.learningPathStepEnrollment.createMany({
      data: steps.map((s, idx) => ({
        learningPathEnrollmentId: pathEnrollment.id,
        learningPathStepId: s.id,
        isUnlocked: idx === 0 && !s.prerequisiteStepId,
        unlockedAt: idx === 0 && !s.prerequisiteStepId ? new Date() : undefined,
        deadline: s.deadlineOffsetDays
          ? new Date(Date.now() + s.deadlineOffsetDays * 86400000)
          : undefined,
      })),
    });
  }

  return pathEnrollment;
}

// ─── Progress update (called after course completion) ─────────────────────────

export async function onCourseCompleted(userId: string, courseId: string) {
  // Find any locked step enrollments for this course that should be unlocked
  const stepEnrollments = await prisma.learningPathStepEnrollment.findMany({
    where: {
      pathEnrollment: { userId },
      step: { courseId },
    },
    include: {
      step: true,
      pathEnrollment: { include: { learningPath: { include: { steps: true } } } },
    },
  });

  for (const se of stepEnrollments) {
    if (se.completedAt) continue;

    await prisma.learningPathStepEnrollment.update({
      where: { id: se.id },
      data: { completedAt: new Date(), status: 'completed' },
    });

    // Unlock next step(s) that have this step as prerequisite
    const pathId = se.step.learningPathId;
    const nextSteps = await prisma.learningPathStep.findMany({
      where: { learningPathId: pathId, prerequisiteStepId: se.learningPathStepId },
    });

    for (const ns of nextSteps) {
      await prisma.learningPathStepEnrollment.updateMany({
        where: {
          learningPathEnrollmentId: se.learningPathEnrollmentId,
          learningPathStepId: ns.id,
        },
        data: { isUnlocked: true, unlockedAt: new Date() },
      });
    }

    // Also unlock by availableAfterDays=0 (no delay required)
    const noDelaySteps = await prisma.learningPathStep.findMany({
      where: {
        learningPathId: pathId,
        prerequisiteStepId: null,
        availableAfterDays: 0,
        stepOrder: { gt: se.step.stepOrder },
      },
    });

    for (const nd of noDelaySteps) {
      await prisma.learningPathStepEnrollment.updateMany({
        where: {
          learningPathEnrollmentId: se.learningPathEnrollmentId,
          learningPathStepId: nd.id,
          isUnlocked: false,
        },
        data: { isUnlocked: true, unlockedAt: new Date() },
      });
    }

    // Recalculate path progress
    await recalculatePathProgress(se.learningPathEnrollmentId);
  }
}

async function recalculatePathProgress(pathEnrollmentId: string) {
  const allSteps = await prisma.learningPathStepEnrollment.findMany({
    where: { learningPathEnrollmentId: pathEnrollmentId },
    include: { step: true },
  });

  const requiredSteps = allSteps.filter((s) => s.step.stepType === 'REQUIRED');
  const completedRequired = requiredSteps.filter((s) => s.completedAt).length;
  const progressPct = requiredSteps.length > 0
    ? Math.round((completedRequired / requiredSteps.length) * 100)
    : 0;

  const allRequiredDone = requiredSteps.length > 0 && completedRequired === requiredSteps.length;

  await prisma.learningPathEnrollment.update({
    where: { id: pathEnrollmentId },
    data: {
      progressPct,
      ...(allRequiredDone ? { completedAt: new Date(), status: 'COMPLETED' } : {}),
    },
  });
}

// ─── Unlock steps by availableAfterDays (daily cron) ─────────────────────────

export async function unlockDueSteps() {
  const now = new Date();

  // Find all IN_PROGRESS path enrollments
  const pathEnrollments = await prisma.learningPathEnrollment.findMany({
    where: { status: 'IN_PROGRESS' },
    include: {
      stepEnrollments: {
        where: { isUnlocked: false },
        include: { step: true },
      },
    },
  });

  for (const pe of pathEnrollments) {
    for (const se of pe.stepEnrollments) {
      const step = se.step;
      if (step.availableAfterDays == null) continue;

      const unlockDate = new Date(pe.startedAt.getTime() + step.availableAfterDays * 86400000);
      if (now >= unlockDate) {
        await prisma.learningPathStepEnrollment.update({
          where: { id: se.id },
          data: { isUnlocked: true, unlockedAt: now },
        });
      }
    }
  }
}
