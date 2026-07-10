import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { cacheAside, invalidateCourseCache, TTL, CACHE_KEYS } from '@/lib/cache';
import { NotFoundError, ForbiddenError, ConflictError, ValidationError } from '@/lib/errors';
import { RoleType } from '@/types';
import { resolveThumbnailUrl } from '@/lib/minio';

// ── Schemas ───────────────────────────────────────────────────

export const createCourseSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  thumbnailUrl: z.string().url().optional(),
  estimatedHours: z.number().positive().optional(),
  completionMode: z.enum(['ALL_LESSONS', 'REQUIRED_ONLY', 'QUIZ_PASS']).default('ALL_LESSONS'),
  minimumPassingScore: z.number().int().min(0).max(100).optional(),
});

export const updateCourseSchema = createCourseSchema.partial();

export const createSectionSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  displayOrder: z.number().int().min(1).optional(), // auto-calculated if omitted
  estimatedMinutes: z.number().int().positive().optional(),
  deadlineOffsetDays: z.number().int().positive().optional(),
  isRequired: z.boolean().default(true),
});

export const createLessonSchema = z.object({
  title: z.string().min(1).max(200),
  displayOrder: z.number().int().min(1).optional(), // auto-calculated if omitted
  contentType: z.enum(['video', 'document', 'quiz', 'text', 'presentation', 'audio', 'pdf', 'image']),
  estimatedMinutes: z.number().int().positive().optional(),
  requiredMinutes: z.number().int().positive().optional(),
  deadlineOffsetDays: z.number().int().positive().optional(),
  availableAfterDays: z.number().int().positive().optional(),
  isRequired: z.boolean().default(true),
  prerequisiteLessonId: z.string().uuid().optional(),
});

export const publishCourseSchema = z.object({
  targetCompanyIds: z.array(z.string().uuid()).optional(),  // group_admin publish to companies
  isMandatory: z.boolean().default(false),
  deadline: z.string().datetime().optional(),
});

export type CreateCourseInput = z.infer<typeof createCourseSchema>;
export type UpdateCourseInput = z.infer<typeof updateCourseSchema>;
export type CreateSectionInput = z.infer<typeof createSectionSchema>;
export type CreateLessonInput = z.infer<typeof createLessonSchema>;
export type PublishCourseInput = z.infer<typeof publishCourseSchema>;

// ── Helpers ───────────────────────────────────────────────────

async function assertCourseAccess(
  courseId: string,
  companyId: string,
  userId: string,
  roles: RoleType[],
  requireEdit = false,
) {
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course || !course.isActive) throw new NotFoundError('Khóa học');

  const isGroupAdmin = roles.includes('group_admin');
  if (isGroupAdmin) return course;

  if (course.ownerCompanyId !== companyId) {
    // Khóa học từ công ty khác — cho phép xem nếu đã được chia sẻ (publish) sang công ty này
    // và user là company_admin hoặc hr_manager (cần xem để giao cho bộ phận/học viên)
    const isAdminOrHR = roles.some((r) => ['company_admin', 'hr_manager'].includes(r));
    if (isAdminOrHR) {
      const publication = await prisma.coursePublication.findUnique({
        where: { courseId_targetCompanyId: { courseId, targetCompanyId: companyId } },
        select: { id: true },
      });
      if (publication) {
        if (requireEdit) throw new ForbiddenError('Không thể chỉnh sửa khóa học từ công ty khác');
        return course;
      }
    }
    throw new ForbiddenError('Không có quyền truy cập khóa học này');
  }

  if (requireEdit) {
    const canEdit = roles.some((r) => ['company_admin', 'instructor'].includes(r));
    if (!canEdit && course.createdById !== userId) {
      throw new ForbiddenError('Không có quyền chỉnh sửa khóa học này');
    }
  }

  return course;
}

// ── Service functions ─────────────────────────────────────────

export async function getCourses(
  companyId: string,
  isGroupAdmin: boolean,
  filters: { page: number; limit: number; published?: boolean; includeShared?: boolean },
  scopedUserIds?: string[] | null,
) {
  const { page, limit, published, includeShared } = filters;

  // scopedUserIds = null → no restriction (admins)
  // scopedUserIds = string[] → filter by createdById IN [...]
  const creatorFilter = scopedUserIds != null
    ? { createdById: { in: scopedUserIds } }
    : {};

  // Với group_admin: xem tất cả khóa học
  // Với company_admin/instructor: xem khóa học của công ty + khóa học được chia sẻ
  let where: Record<string, unknown>;

  if (isGroupAdmin) {
    where = {
      isActive: true,
      ...(published !== undefined ? { isPublished: published } : {}),
    };
  } else if (includeShared) {
    // Lấy danh sách courseId được chia sẻ với công ty này
    const sharedPubs = await prisma.coursePublication.findMany({
      where: { targetCompanyId: companyId, revokedAt: null },
      select: { courseId: true },
    });
    const sharedCourseIds = sharedPubs.map((p) => p.courseId);

    where = {
      isActive: true,
      ...creatorFilter,
      ...(published !== undefined ? { isPublished: published } : {}),
      OR: [
        { ownerCompanyId: companyId },
        ...(sharedCourseIds.length > 0 ? [{ id: { in: sharedCourseIds } }] : []),
      ],
    };
  } else {
    where = {
      isActive: true,
      ownerCompanyId: companyId,
      ...creatorFilter,
      ...(published !== undefined ? { isPublished: published } : {}),
    };
  }

  const [items, total] = await Promise.all([
    prisma.course.findMany({
      where,
      select: {
        id: true, title: true, description: true, thumbnailUrl: true,
        estimatedHours: true, completionMode: true, isPublished: true,
        createdAt: true, updatedAt: true,
        ownerCompany: { select: { id: true, name: true } },
        _count: { select: { sections: true, enrollments: true } },
        publications: {
          where: { targetCompanyId: companyId, revokedAt: null },
          select: { id: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.course.count({ where }),
  ]);

  // Gắn flag isShared và resolve thumbnailUrl cho mỗi khóa học
  const itemsWithFlag = items.map((c) => ({
    ...c,
    thumbnailUrl: resolveThumbnailUrl(c.thumbnailUrl),
    isShared: c.isPublished && c.ownerCompanyId !== companyId,
    publications: undefined, // không expose raw relation
  }));

  return { items: itemsWithFlag, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getCourse(courseId: string, companyId: string, userId: string, roles: RoleType[]) {
  await assertCourseAccess(courseId, companyId, userId, roles);

  const result = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      ownerCompany: { select: { id: true, name: true } },
      sections: {
        orderBy: { displayOrder: 'asc' },
        include: {
          lessons: { orderBy: { displayOrder: 'asc' } },
        },
      },
      _count: { select: { enrollments: true } },
    },
  });

  if (!result) return result;
  return { ...result, thumbnailUrl: resolveThumbnailUrl(result.thumbnailUrl) };
}

export async function createCourse(input: CreateCourseInput, companyId: string, userId: string) {
  const course = await prisma.course.create({
    data: {
      ...input,
      ownerCompanyId: companyId,
      createdById: userId,
    },
  });
  return course;
}

export async function updateCourse(
  courseId: string,
  input: UpdateCourseInput,
  companyId: string,
  userId: string,
  roles: RoleType[],
) {
  await assertCourseAccess(courseId, companyId, userId, roles, true);
  const updated = await prisma.course.update({ where: { id: courseId }, data: input });
  await invalidateCourseCache(courseId);
  return updated;
}

export async function deleteCourse(
  courseId: string,
  companyId: string,
  userId: string,
  roles: RoleType[],
) {
  const course = await assertCourseAccess(courseId, companyId, userId, roles, true);

  const enrollCount = await prisma.enrollment.count({ where: { courseId } });
  if (enrollCount > 0) throw new ConflictError('Không thể xóa khóa học đã có học viên');

  await prisma.course.update({ where: { id: courseId }, data: { isActive: false } });
  await invalidateCourseCache(courseId);
}

// Các loại content cần có asset READY trước khi xuất bản
const CONTENT_TYPES_NEED_ASSET = new Set(['video', 'document', 'pdf', 'audio', 'presentation', 'image']);

export async function getCourseReadiness(courseId: string) {
  const sections = await prisma.courseSection.findMany({
    where: { courseId },
    orderBy: { displayOrder: 'asc' },
    include: {
      lessons: {
        orderBy: { displayOrder: 'asc' },
        include: {
          assets: {
            where: { isActive: true },
            select: { processingStatus: true },
          },
        },
      },
    },
  });

  type LessonBrief = { id: string; title: string; contentType: string; reason: string };
  const notReady: LessonBrief[]   = [];
  const processing: LessonBrief[] = [];
  let total = 0;
  let ready = 0;

  for (const sec of sections) {
    for (const les of sec.lessons) {
      total++;
      if (!CONTENT_TYPES_NEED_ASSET.has(les.contentType)) { ready++; continue; }

      const statuses = les.assets.map(a => a.processingStatus);
      if (statuses.includes('READY')) { ready++; continue; }
      if (statuses.includes('PROCESSING') || statuses.includes('PENDING')) {
        processing.push({ id: les.id, title: les.title, contentType: les.contentType, reason: 'Đang xử lý' });
      } else if (statuses.length === 0) {
        notReady.push({ id: les.id, title: les.title, contentType: les.contentType, reason: 'Chưa có file' });
      } else {
        // tất cả đều FAILED
        notReady.push({ id: les.id, title: les.title, contentType: les.contentType, reason: 'Xử lý thất bại' });
      }
    }
  }

  return {
    isReady: sections.length > 0 && total > 0 && notReady.length === 0 && processing.length === 0,
    sectionsCount: sections.length,
    totalLessons: total,
    readyLessons: ready,
    notReadyLessons: notReady,
    processingLessons: processing,
  };
}

export async function publishCourse(
  courseId: string,
  input: PublishCourseInput,
  companyId: string,
  userId: string,
  roles: RoleType[],
) {
  const course = await assertCourseAccess(courseId, companyId, userId, roles, true);
  const isGroupAdmin = roles.includes('group_admin');

  // ── Kiểm tra nội dung sẵn sàng trước khi xuất bản ──────────
  const readiness = await getCourseReadiness(courseId);

  if (readiness.sectionsCount === 0) {
    throw new ValidationError('Khóa học chưa có chương nào. Thêm ít nhất 1 chương trước khi xuất bản.');
  }
  if (readiness.totalLessons === 0) {
    throw new ValidationError('Khóa học chưa có bài học nào. Thêm ít nhất 1 bài học trước khi xuất bản.');
  }
  if (readiness.processingLessons.length > 0) {
    const names = readiness.processingLessons.slice(0, 3).map(l => `"${l.title}"`).join(', ');
    const more  = readiness.processingLessons.length > 3 ? ` và ${readiness.processingLessons.length - 3} bài khác` : '';
    throw new ValidationError(`Còn ${readiness.processingLessons.length} bài học đang xử lý: ${names}${more}. Vui lòng chờ hoàn tất.`);
  }
  if (readiness.notReadyLessons.length > 0) {
    const names = readiness.notReadyLessons.slice(0, 3).map(l => `"${l.title}" (${l.reason})`).join(', ');
    const more  = readiness.notReadyLessons.length > 3 ? ` và ${readiness.notReadyLessons.length - 3} bài khác` : '';
    throw new ValidationError(`${readiness.notReadyLessons.length} bài học chưa có nội dung sẵn sàng: ${names}${more}.`);
  }

  // Publish internally (company_admin/instructor marks as published)
  await prisma.course.update({ where: { id: courseId }, data: { isPublished: true } });

  // group_admin can additionally publish to other companies
  if (isGroupAdmin && input.targetCompanyIds?.length) {
    await prisma.coursePublication.createMany({
      data: input.targetCompanyIds.map((targetCompanyId) => ({
        courseId,
        targetCompanyId,
        publishedById: userId,
        isMandatory: input.isMandatory,
        deadline: input.deadline ? new Date(input.deadline) : null,
      })),
      skipDuplicates: true,
    });
  }

  await invalidateCourseCache(courseId);
  return prisma.course.findUnique({ where: { id: courseId } });
}

// ── Sections ──────────────────────────────────────────────────

export async function createSection(
  courseId: string,
  input: CreateSectionInput,
  companyId: string,
  userId: string,
  roles: RoleType[],
) {
  await assertCourseAccess(courseId, companyId, userId, roles, true);

  // Auto-calculate displayOrder if not provided
  const displayOrder = input.displayOrder ?? (
    await prisma.courseSection.count({ where: { courseId } }) + 1
  );

  return prisma.courseSection.create({ data: { ...input, displayOrder, courseId } });
}

export async function updateSection(
  courseId: string,
  sectionId: string,
  input: { title?: string; description?: string },
  companyId: string,
  userId: string,
  roles: RoleType[],
) {
  await assertCourseAccess(courseId, companyId, userId, roles, true);
  const section = await prisma.courseSection.findUnique({ where: { id: sectionId } });
  if (!section || section.courseId !== courseId) throw new NotFoundError('Section');
  return prisma.courseSection.update({ where: { id: sectionId }, data: input });
}

// ── Lessons ───────────────────────────────────────────────────

export async function createLesson(
  courseId: string,
  sectionId: string,
  input: CreateLessonInput,
  companyId: string,
  userId: string,
  roles: RoleType[],
) {
  await assertCourseAccess(courseId, companyId, userId, roles, true);

  const section = await prisma.courseSection.findUnique({ where: { id: sectionId } });
  if (!section || section.courseId !== courseId) throw new NotFoundError('Section');

  if (input.prerequisiteLessonId) {
    const prereq = await prisma.lesson.findUnique({ where: { id: input.prerequisiteLessonId } });
    if (!prereq || prereq.sectionId !== sectionId) {
      throw new ValidationError('prerequisiteLessonId không hợp lệ');
    }
  }

  // Auto-calculate displayOrder if not provided
  const displayOrder = input.displayOrder ?? (
    await prisma.lesson.count({ where: { sectionId } }) + 1
  );

  return prisma.lesson.create({ data: { ...input, displayOrder, sectionId } });
}

export async function updateLesson(
  courseId: string,
  sectionId: string,
  lessonId: string,
  input: { title?: string; estimatedMinutes?: number },
  companyId: string,
  userId: string,
  roles: RoleType[],
) {
  await assertCourseAccess(courseId, companyId, userId, roles, true);
  const lesson = await prisma.lesson.findUnique({ where: { id: lessonId } });
  if (!lesson || lesson.sectionId !== sectionId) throw new NotFoundError('Lesson');
  return prisma.lesson.update({ where: { id: lessonId }, data: input });
}

// ── Course assignment (Cơ chế ③) ─────────────────────────────

export const assignCourseSchema = z.object({
  courseId: z.string().uuid(),
  targetUserId: z.string().uuid().optional(),
  targetDeptId: z.string().uuid().optional(),
  targetCompanyId: z.string().uuid().optional(),
  deadline: z.string().datetime().optional(),
  isMandatory: z.boolean().default(false),
});

export type AssignCourseInput = z.infer<typeof assignCourseSchema>;

export async function assignCourse(
  input: AssignCourseInput,
  companyId: string,
  userId: string,
) {
  const course = await prisma.course.findUnique({ where: { id: input.courseId } });
  if (!course || !course.isActive || !course.isPublished) throw new NotFoundError('Khóa học');

  return prisma.courseAssignment.create({
    data: {
      courseId: input.courseId,
      targetUserId: input.targetUserId,
      targetDeptId: input.targetDeptId,
      targetCompanyId: input.targetCompanyId ?? companyId,
      assignedById: userId,
      deadline: input.deadline ? new Date(input.deadline) : null,
      isMandatory: input.isMandatory,
    },
  });
}
