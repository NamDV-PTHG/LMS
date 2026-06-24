import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/errors';

// ─── Framework ───────────────────────────────────────────────────────────────

export async function getFrameworks(companyId: string) {
  return prisma.competencyFramework.findMany({
    where: { companyId },
    include: { _count: { select: { domains: true, positions: true } } },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getFramework(id: string, companyId: string) {
  const fw = await prisma.competencyFramework.findFirst({
    where: { id, companyId },
    include: {
      domains: {
        orderBy: { displayOrder: 'asc' },
        include: {
          competencies: { orderBy: { displayOrder: 'asc' } },
        },
      },
    },
  });
  if (!fw) throw new AppError('FRAMEWORK_NOT_FOUND', 'Không tìm thấy khung năng lực', 404);
  return fw;
}

export async function createFramework(
  companyId: string,
  data: { name: string; description?: string; version?: string },
) {
  return prisma.competencyFramework.create({
    data: { companyId, ...data },
  });
}

export async function updateFramework(
  id: string,
  companyId: string,
  data: { name?: string; description?: string; version?: string; isActive?: boolean; publishedAt?: Date | null },
) {
  const fw = await prisma.competencyFramework.findFirst({ where: { id, companyId } });
  if (!fw) throw new AppError('FRAMEWORK_NOT_FOUND', 'Không tìm thấy khung năng lực', 404);
  return prisma.competencyFramework.update({ where: { id }, data });
}

export async function deleteFramework(id: string, companyId: string) {
  const fw = await prisma.competencyFramework.findFirst({ where: { id, companyId } });
  if (!fw) throw new AppError('FRAMEWORK_NOT_FOUND', 'Không tìm thấy khung năng lực', 404);
  const linked = await prisma.jobPosition.count({ where: { competencyFrameworkId: id } });
  if (linked > 0) throw new AppError('FRAMEWORK_IN_USE', 'Khung năng lực đang được dùng bởi vị trí công việc', 409);
  return prisma.competencyFramework.delete({ where: { id } });
}

// ─── Domain ──────────────────────────────────────────────────────────────────

async function assertFrameworkOwner(frameworkId: string, companyId: string) {
  const fw = await prisma.competencyFramework.findFirst({ where: { id: frameworkId, companyId } });
  if (!fw) throw new AppError('FRAMEWORK_NOT_FOUND', 'Không tìm thấy khung năng lực', 404);
  return fw;
}

export async function addDomain(
  frameworkId: string,
  companyId: string,
  data: { name: string; description?: string; weight?: number },
) {
  await assertFrameworkOwner(frameworkId, companyId);
  const lastOrder = await prisma.competencyDomain.aggregate({
    where: { frameworkId },
    _max: { displayOrder: true },
  });
  const displayOrder = (lastOrder._max.displayOrder ?? 0) + 1;
  return prisma.competencyDomain.create({ data: { frameworkId, displayOrder, ...data } });
}

export async function updateDomain(
  domainId: string,
  companyId: string,
  data: { name?: string; description?: string; weight?: number; displayOrder?: number },
) {
  const domain = await prisma.competencyDomain.findUnique({
    where: { id: domainId },
    include: { framework: true },
  });
  if (!domain || domain.framework.companyId !== companyId)
    throw new AppError('DOMAIN_NOT_FOUND', 'Không tìm thấy lĩnh vực', 404);
  return prisma.competencyDomain.update({ where: { id: domainId }, data });
}

export async function deleteDomain(domainId: string, companyId: string) {
  const domain = await prisma.competencyDomain.findUnique({
    where: { id: domainId },
    include: { framework: true },
  });
  if (!domain || domain.framework.companyId !== companyId)
    throw new AppError('DOMAIN_NOT_FOUND', 'Không tìm thấy lĩnh vực', 404);
  return prisma.competencyDomain.delete({ where: { id: domainId } });
}

// ─── Competency ───────────────────────────────────────────────────────────────

export async function addCompetency(
  domainId: string,
  companyId: string,
  data: {
    name: string;
    description?: string;
    requiredLevel: number;
    levelDescriptions: Record<string, string>;
  },
) {
  const domain = await prisma.competencyDomain.findUnique({
    where: { id: domainId },
    include: { framework: true },
  });
  if (!domain || domain.framework.companyId !== companyId)
    throw new AppError('DOMAIN_NOT_FOUND', 'Không tìm thấy lĩnh vực', 404);

  const lastOrder = await prisma.competency.aggregate({
    where: { domainId },
    _max: { displayOrder: true },
  });
  const displayOrder = (lastOrder._max.displayOrder ?? 0) + 1;
  return prisma.competency.create({ data: { domainId, displayOrder, ...data } });
}

export async function updateCompetency(
  competencyId: string,
  companyId: string,
  data: {
    name?: string;
    description?: string;
    requiredLevel?: number;
    levelDescriptions?: Record<string, string>;
    displayOrder?: number;
  },
) {
  const comp = await prisma.competency.findUnique({
    where: { id: competencyId },
    include: { domain: { include: { framework: true } } },
  });
  if (!comp || comp.domain.framework.companyId !== companyId)
    throw new AppError('COMPETENCY_NOT_FOUND', 'Không tìm thấy năng lực', 404);
  return prisma.competency.update({ where: { id: competencyId }, data });
}

export async function deleteCompetency(competencyId: string, companyId: string) {
  const comp = await prisma.competency.findUnique({
    where: { id: competencyId },
    include: { domain: { include: { framework: true } } },
  });
  if (!comp || comp.domain.framework.companyId !== companyId)
    throw new AppError('COMPETENCY_NOT_FOUND', 'Không tìm thấy năng lực', 404);
  return prisma.competency.delete({ where: { id: competencyId } });
}

// ─── Course Links ─────────────────────────────────────────────────────────────

export async function linkCourse(
  competencyId: string,
  companyId: string,
  courseId: string,
  targetLevel: number,
) {
  const comp = await prisma.competency.findUnique({
    where: { id: competencyId },
    include: { domain: { include: { framework: true } } },
  });
  if (!comp || comp.domain.framework.companyId !== companyId)
    throw new AppError('COMPETENCY_NOT_FOUND', 'Không tìm thấy năng lực', 404);

  const course = await prisma.course.findFirst({ where: { id: courseId, ownerCompanyId: companyId } });
  if (!course) throw new AppError('COURSE_NOT_FOUND', 'Không tìm thấy khóa học', 404);

  return prisma.competencyCourseLink.upsert({
    where: { competencyId_courseId: { competencyId, courseId } },
    create: { competencyId, courseId, targetLevel },
    update: { targetLevel },
  });
}

export async function unlinkCourse(competencyId: string, companyId: string, courseId: string) {
  const comp = await prisma.competency.findUnique({
    where: { id: competencyId },
    include: { domain: { include: { framework: true } } },
  });
  if (!comp || comp.domain.framework.companyId !== companyId)
    throw new AppError('COMPETENCY_NOT_FOUND', 'Không tìm thấy năng lực', 404);
  return prisma.competencyCourseLink.deleteMany({ where: { competencyId, courseId } });
}

// ─── User Competency Profile ──────────────────────────────────────────────────

export async function getUserCompetencyProfile(userId: string, companyId: string) {
  // Verify user belongs to company
  const user = await prisma.user.findFirst({ where: { id: userId, companyId } });
  if (!user) throw new AppError('USER_NOT_FOUND', 'Không tìm thấy người dùng', 404);

  return prisma.userCompetencyProfile.findMany({
    where: { userId },
    include: {
      competency: {
        include: { domain: { include: { framework: true } } },
      },
    },
    orderBy: { assessedAt: 'desc' },
  });
}

export async function upsertUserCompetency(
  userId: string,
  assessorCompanyId: string,
  data: {
    competencyId: string;
    currentLevel: number;
    evidenceNote?: string;
    source?: 'SELF' | 'MANAGER' | 'QUIZ' | 'SYSTEM';
    assessedById?: string;
  },
) {
  const user = await prisma.user.findFirst({ where: { id: userId, companyId: assessorCompanyId } });
  if (!user) throw new AppError('USER_NOT_FOUND', 'Không tìm thấy người dùng', 404);

  if (data.currentLevel < 0 || data.currentLevel > 5)
    throw new AppError('INVALID_LEVEL', 'Cấp độ phải từ 0 đến 5', 400);

  return prisma.userCompetencyProfile.upsert({
    where: { userId_competencyId: { userId, competencyId: data.competencyId } },
    create: {
      userId,
      competencyId: data.competencyId,
      currentLevel: data.currentLevel,
      evidenceNote: data.evidenceNote,
      source: data.source ?? 'MANAGER',
      assessedById: data.assessedById,
    },
    update: {
      currentLevel: data.currentLevel,
      evidenceNote: data.evidenceNote,
      source: data.source ?? 'MANAGER',
      assessedById: data.assessedById,
      assessedAt: new Date(),
    },
  });
}
