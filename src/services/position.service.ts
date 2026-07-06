import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/errors';

export async function getPositions(
  companyId: string,
  opts: { organizationId?: string; isActive?: boolean; search?: string } = {},
) {
  return prisma.jobPosition.findMany({
    where: {
      companyId,
      ...(opts.organizationId ? { organizationId: opts.organizationId } : {}),
      ...(opts.isActive !== undefined ? { isActive: opts.isActive } : {}),
      ...(opts.search ? { title: { contains: opts.search, mode: 'insensitive' } } : {}),
    },
    include: {
      organization: { select: { id: true, name: true } },
      competencyFramework: { select: { id: true, name: true, version: true } },
      learningPath: { select: { id: true, name: true } },
      catalog: { select: { id: true, code: true, title: true } },
      _count: { select: { users: true } },
    },
    orderBy: [{ level: 'asc' }, { title: 'asc' }],
  });
}

export async function getPosition(id: string, companyId: string) {
  const pos = await prisma.jobPosition.findFirst({
    where: { id, companyId },
    include: {
      organization: { select: { id: true, name: true } },
      competencyFramework: {
        include: {
          domains: {
            orderBy: { displayOrder: 'asc' },
            include: { competencies: { orderBy: { displayOrder: 'asc' } } },
          },
        },
      },
      learningPath: {
        include: {
          steps: {
            orderBy: { stepOrder: 'asc' },
            include: { course: { select: { id: true, title: true, estimatedHours: true } } },
          },
        },
      },
      _count: { select: { users: true } },
    },
  });
  if (!pos) throw new AppError('POSITION_NOT_FOUND', 'Không tìm thấy vị trí công việc', 404);
  return pos;
}

export async function createPosition(
  companyId: string,
  data: {
    title: string;
    code?: string;
    level?: string;
    description?: string;
    organizationId?: string;
    competencyFrameworkId?: string;
    learningPathId?: string;
    catalogId?: string | null;
    impliedRole?: string | null;
  },
) {
  if (data.code) {
    const exists = await prisma.jobPosition.findUnique({
      where: { companyId_code: { companyId, code: data.code } },
    });
    if (exists) throw new AppError('POSITION_CODE_EXISTS', 'Mã vị trí đã tồn tại', 409);
  }
  return prisma.jobPosition.create({ data: { companyId, ...data } });
}

export async function updatePosition(
  id: string,
  companyId: string,
  data: {
    title?: string;
    code?: string;
    level?: string;
    description?: string;
    organizationId?: string;
    competencyFrameworkId?: string | null;
    learningPathId?: string | null;
    catalogId?: string | null;
    impliedRole?: string | null;
    isActive?: boolean;
  },
) {
  const pos = await prisma.jobPosition.findFirst({ where: { id, companyId } });
  if (!pos) throw new AppError('POSITION_NOT_FOUND', 'Không tìm thấy vị trí công việc', 404);

  if (data.code && data.code !== pos.code) {
    const exists = await prisma.jobPosition.findUnique({
      where: { companyId_code: { companyId, code: data.code } },
    });
    if (exists) throw new AppError('POSITION_CODE_EXISTS', 'Mã vị trí đã tồn tại', 409);
  }
  return prisma.jobPosition.update({ where: { id }, data });
}

export async function deletePosition(id: string, companyId: string) {
  const pos = await prisma.jobPosition.findFirst({ where: { id, companyId } });
  if (!pos) throw new AppError('POSITION_NOT_FOUND', 'Không tìm thấy vị trí công việc', 404);
  const usersCount = await prisma.user.count({ where: { jobPositionId: id } });
  if (usersCount > 0)
    throw new AppError('POSITION_HAS_USERS', 'Vị trí đang được gán cho nhân viên', 409);
  return prisma.jobPosition.delete({ where: { id } });
}
