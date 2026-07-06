import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/errors';

export async function getCatalogs(
  companyId: string,
  opts: { search?: string; category?: string; level?: string; isActive?: boolean } = {},
) {
  return prisma.jobTitleCatalog.findMany({
    where: {
      companyId,
      ...(opts.isActive !== undefined ? { isActive: opts.isActive } : {}),
      ...(opts.category ? { category: opts.category } : {}),
      ...(opts.level ? { level: opts.level } : {}),
      ...(opts.search
        ? {
            OR: [
              { title: { contains: opts.search, mode: 'insensitive' } },
              { code: { contains: opts.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    include: {
      _count: { select: { positions: true } },
    },
    orderBy: [{ displayOrder: 'asc' }, { title: 'asc' }],
  });
}

export async function createCatalogEntry(
  companyId: string,
  data: {
    code: string;
    title: string;
    level?: string;
    category?: string;
    description?: string;
    displayOrder?: number;
  },
) {
  const exists = await prisma.jobTitleCatalog.findUnique({
    where: { companyId_code: { companyId, code: data.code } },
  });
  if (exists) throw new AppError('CATALOG_CODE_EXISTS', 'Mã chức danh đã tồn tại trong công ty', 409);

  return prisma.jobTitleCatalog.create({ data: { companyId, ...data } });
}

export async function updateCatalogEntry(
  id: string,
  companyId: string,
  data: {
    code?: string;
    title?: string;
    level?: string;
    category?: string;
    description?: string;
    isActive?: boolean;
    displayOrder?: number;
  },
) {
  const entry = await prisma.jobTitleCatalog.findFirst({ where: { id, companyId } });
  if (!entry) throw new AppError('CATALOG_NOT_FOUND', 'Không tìm thấy chức danh', 404);

  if (data.code && data.code !== entry.code) {
    const exists = await prisma.jobTitleCatalog.findUnique({
      where: { companyId_code: { companyId, code: data.code } },
    });
    if (exists) throw new AppError('CATALOG_CODE_EXISTS', 'Mã chức danh đã tồn tại trong công ty', 409);
  }

  return prisma.jobTitleCatalog.update({ where: { id }, data });
}

export async function deleteCatalogEntry(id: string, companyId: string) {
  const entry = await prisma.jobTitleCatalog.findFirst({
    where: { id, companyId },
    include: { positions: { select: { id: true, title: true } } },
  });
  if (!entry) throw new AppError('CATALOG_NOT_FOUND', 'Không tìm thấy chức danh', 404);

  if (entry.positions.length > 0) {
    throw new AppError(
      'CATALOG_IN_USE',
      `Đang được dùng bởi ${entry.positions.length} vị trí`,
      400,
    );
  }

  return prisma.jobTitleCatalog.delete({ where: { id } });
}
