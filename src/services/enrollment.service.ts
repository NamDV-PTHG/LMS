import { prisma } from '@/lib/prisma';
import { cacheAside, invalidateMyCoursesCache, TTL, CACHE_KEYS } from '@/lib/cache';
import { NotFoundError, ConflictError, ForbiddenError, ValidationError } from '@/lib/errors';
import { issueCertificate } from './certificate.service';
import { resolveThumbnailUrl } from '@/lib/minio';

// ── UNION 3 nguồn — raw SQL ───────────────────────────────────
// Spec Section 8 / CLAUDE.md nguyên tắc #4

interface CourseRow {
  id: string;
  title: string;
  description: string | null;
  thumbnailUrl: string | null;
  estimatedHours: number | null;
  completionMode: string;
  ownerCompanyId: string;
  ownerCompanyName: string;
  source: 'group_publish' | 'learning_group' | 'company_assign' | 'learning_path';
  deadline: Date | null;
  isMandatory: boolean;
  enrollmentId: string | null;
  completedAt: Date | null;
  progressPercent: number | null;
}

export async function getMyCourses(userId: string, companyId: string): Promise<CourseRow[]> {
  return cacheAside(
    CACHE_KEYS.myCourses(userId),
    TTL.MY_COURSES,
    () => fetchMyCourses(userId, companyId),
  );
}

async function fetchMyCourses(userId: string, companyId: string): Promise<CourseRow[]> {
  const rows = await prisma.$queryRaw<CourseRow[]>`
    WITH user_org AS (
      SELECT ur."organizationId", o."companyId"
      FROM "UserRole" ur
      JOIN "Organization" o ON o.id = ur."organizationId"
      WHERE ur."userId" = ${userId}
    ),

    -- ① group_publish: Tập đoàn publish xuống công ty
    source1 AS (
      SELECT
        c.id, c.title, c.description, c."thumbnailUrl", c."estimatedHours",
        c."completionMode", c."ownerCompanyId", org.name AS "ownerCompanyName",
        'group_publish'::text AS source,
        cp.deadline, cp."isMandatory"
      FROM "CoursePublication" cp
      JOIN "Course" c ON c.id = cp."courseId"
      JOIN "Organization" org ON org.id = c."ownerCompanyId"
      WHERE cp."targetCompanyId" = ${companyId}
        AND cp."revokedAt" IS NULL
        AND c."isPublished" = true
        AND c."isActive" = true
    ),

    -- ② learning_group: Khóa học trong nhóm mà user là thành viên
    source2 AS (
      SELECT
        c.id, c.title, c.description, c."thumbnailUrl", c."estimatedHours",
        c."completionMode", c."ownerCompanyId", org.name AS "ownerCompanyName",
        'learning_group'::text AS source,
        gc.deadline, false::boolean AS "isMandatory"
      FROM "GroupMember" gm
      JOIN "GroupCourse" gc ON gc."groupId" = gm."groupId"
      JOIN "Course" c ON c.id = gc."courseId"
      JOIN "Organization" org ON org.id = c."ownerCompanyId"
      JOIN "LearningGroup" lg ON lg.id = gm."groupId"
      WHERE gm."userId" = ${userId}
        AND gm."removedAt" IS NULL
        AND gm."isActive" = true
        AND lg."isActive" = true
        AND c."isPublished" = true
        AND c."isActive" = true
    ),

    -- ③ company_assign: Assign trực tiếp cho user hoặc phòng ban
    source3 AS (
      SELECT
        c.id, c.title, c.description, c."thumbnailUrl", c."estimatedHours",
        c."completionMode", c."ownerCompanyId", org.name AS "ownerCompanyName",
        'company_assign'::text AS source,
        ca.deadline, ca."isMandatory"
      FROM "CourseAssignment" ca
      JOIN "Course" c ON c.id = ca."courseId"
      JOIN "Organization" org ON org.id = c."ownerCompanyId"
      WHERE (
        ca."targetUserId" = ${userId}
        OR ca."targetDeptId" IN (SELECT "organizationId" FROM user_org)
        OR ca."targetCompanyId" = ${companyId}
      )
        AND c."isPublished" = true
        AND c."isActive" = true
    ),

    -- ④ learning_path: Khóa học từ bước đã unlock trong lộ trình học tập
    source4 AS (
      SELECT
        c.id, c.title, c.description, c."thumbnailUrl", c."estimatedHours",
        c."completionMode", c."ownerCompanyId", org.name AS "ownerCompanyName",
        'learning_path'::text AS source,
        lpse.deadline,
        (lps."stepType" = 'REQUIRED')::boolean AS "isMandatory"
      FROM "LearningPathEnrollment" lpe
      JOIN "LearningPathStepEnrollment" lpse ON lpse."learningPathEnrollmentId" = lpe.id
        AND lpse."isUnlocked" = true
      JOIN "LearningPathStep" lps ON lps.id = lpse."learningPathStepId"
      JOIN "Course" c ON c.id = lps."courseId"
      JOIN "Organization" org ON org.id = c."ownerCompanyId"
      WHERE lpe."userId" = ${userId}
        AND lpe.status IN ('IN_PROGRESS', 'COMPLETED')
        AND c."isPublished" = true
        AND c."isActive" = true
    ),

    -- Union và deduplicate (ưu tiên: group_publish > learning_group > company_assign > learning_path)
    all_courses AS (
      SELECT *, ROW_NUMBER() OVER (
        PARTITION BY id
        ORDER BY CASE source
          WHEN 'group_publish'   THEN 1
          WHEN 'learning_group'  THEN 2
          WHEN 'company_assign'  THEN 3
          WHEN 'learning_path'   THEN 4
        END
      ) AS rn
      FROM (
        SELECT * FROM source1
        UNION ALL
        SELECT * FROM source2
        UNION ALL
        SELECT * FROM source3
        UNION ALL
        SELECT * FROM source4
      ) combined
    )

    SELECT
      ac.id, ac.title, ac.description, ac."thumbnailUrl", ac."estimatedHours",
      ac."completionMode", ac."ownerCompanyId", ac."ownerCompanyName",
      ac.source, ac.deadline, ac."isMandatory",
      e.id AS "enrollmentId",
      e."completedAt",
      -- Tính tiến độ:
      --   • Nếu enrollment đã hoàn thành (completedAt IS NOT NULL) → luôn trả 100
      --   • Ngược lại: tính theo bài học bắt buộc (isRequired = true) để đồng nhất
      --     với logic checkCourseCompletion; nếu không có bài bắt buộc thì dùng tất cả bài
      CASE
        WHEN e."completedAt" IS NOT NULL THEN 100::float
        ELSE (
          SELECT CASE
            WHEN COUNT(l.id) FILTER (WHERE l."isRequired" = true) > 0 THEN
              COALESCE(SUM(lp2."progressPct") FILTER (WHERE l."isRequired" = true), 0)::float
              / COUNT(l.id) FILTER (WHERE l."isRequired" = true)
            WHEN COUNT(l.id) > 0 THEN
              COALESCE(SUM(lp2."progressPct"), 0)::float / COUNT(l.id)
            ELSE 0
          END
          FROM "CourseSection" s
          JOIN "Lesson" l ON l."sectionId" = s.id
          LEFT JOIN "LessonProgress" lp2
            ON lp2."lessonId" = l.id AND lp2."enrollmentId" = e.id
          WHERE s."courseId" = ac.id
        )
      END AS "progressPercent"
    FROM all_courses ac
    LEFT JOIN "Enrollment" e ON e."courseId" = ac.id AND e."userId" = ${userId}
    WHERE ac.rn = 1
    GROUP BY
      ac.id, ac.title, ac.description, ac."thumbnailUrl", ac."estimatedHours",
      ac."completionMode", ac."ownerCompanyId", ac."ownerCompanyName",
      ac.source, ac.deadline, ac."isMandatory",
      e.id, e."completedAt"
    ORDER BY ac."isMandatory" DESC, ac.title
  `;

  return rows.map((r) => ({ ...r, thumbnailUrl: resolveThumbnailUrl(r.thumbnailUrl) }));
}

// ── Single course for learner ────────────────────────────────

export async function getMyCourse(courseId: string, userId: string, companyId: string) {
  const courses = await getMyCourses(userId, companyId);
  const course = courses.find((c) => c.id === courseId);
  if (!course) throw new NotFoundError('Khóa học');

  // Full detail with sections/lessons, assets, and progress
  const detail = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      sections: {
        orderBy: { displayOrder: 'asc' },
        include: {
          lessons: {
            orderBy: { displayOrder: 'asc' },
            include: {
              progresses: {
                where: { enrollment: { userId } },
                take: 1,
              },
              // Tất cả assets READY — dùng [0] cho player, toàn bộ cho danh sách đính kèm
              // Direct FK (legacy): ContentAsset.lessonId
              assets: {
                where: { processingStatus: 'READY' },
                orderBy: { createdAt: 'asc' },
                select: { id: true, title: true, fileType: true, mimeType: true, durationSeconds: true },
              },
              // Junction table (preferred): LessonAsset → ContentAsset
              linkedAssets: {
                where: { asset: { processingStatus: 'READY' } },
                include: {
                  asset: {
                    select: { id: true, title: true, fileType: true, mimeType: true, durationSeconds: true },
                  },
                },
                orderBy: { createdAt: 'asc' },
              },
            },
          },
        },
      },
    },
  });

  // Map sections/lessons sang shape mà frontend expect (sections ở root level)
  const sections = (detail?.sections ?? []).map((sec) => ({
    id: sec.id,
    title: sec.title,
    order: sec.displayOrder,
    lessons: sec.lessons.map((les) => ({
      id: les.id,
      title: les.title,
      contentType: les.contentType,
      order: les.displayOrder,
      isRequired: les.isRequired,
      estimatedMinutes: les.estimatedMinutes,
      // Gộp tất cả assets từ cả 2 nguồn, loại trùng
      ...(() => {
        const seen = new Set<string>();
        const all: { id: string; title: string; fileType: string; mimeType: string; durationSeconds: number | null }[] = [];
        for (const a of les.assets) {
          if (!seen.has(a.id)) { seen.add(a.id); all.push(a); }
        }
        for (const la of les.linkedAssets) {
          if (!seen.has(la.asset.id)) { seen.add(la.asset.id); all.push(la.asset); }
        }
        const first = all[0] ?? null;
        return {
          durationSeconds: first?.durationSeconds ?? null,
          assetId: first?.id ?? null,
          // Tất cả tài liệu đính kèm — hiển thị trong section "Tài liệu đính kèm"
          attachments: all.map((a) => ({ id: a.id, title: a.title, fileType: a.fileType, mimeType: a.mimeType })),
        };
      })(),
      // quizId = lessonId (QuizConfig unique per lesson)
      quizId: les.contentType === 'quiz' ? les.id : null,
      textContent: null,
      progress: les.progresses[0]
        ? {
            completedAt: les.progresses[0].completedAt,
            progressPct: les.progresses[0].progressPct,
            status: les.progresses[0].status,
          }
        : null,
    })),
  }));

  return { ...course, sections };
}

// ── Enrollment ───────────────────────────────────────────────

export async function enrollCourse(courseId: string, userId: string, companyId: string) {
  // Verify user has access to this course
  const courses = await getMyCourses(userId, companyId);
  const course = courses.find((c) => c.id === courseId);
  if (!course) throw new ForbiddenError('Bạn không có quyền truy cập khóa học này');

  const existing = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
  });
  if (existing) throw new ConflictError('Bạn đã đăng ký khóa học này rồi');

  const enrollment = await prisma.enrollment.create({
    data: {
      userId,
      courseId,
      source: course.source,
      deadline: course.deadline,
      isMandatory: course.isMandatory,
    },
  });

  await invalidateMyCoursesCache(userId);
  return enrollment;
}

// ── Lesson Progress ──────────────────────────────────────────

export async function updateLessonProgress(
  courseId: string,
  lessonId: string,
  userId: string,
  companyId: string,
  data: {
    progressPct: number;
    timeSpentSec?: number;
    status?: 'in_progress' | 'completed';
  },
) {
  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
  });
  if (!enrollment) throw new ForbiddenError('Chưa đăng ký khóa học này');

  const lesson = await prisma.lesson.findUnique({ where: { id: lessonId } });
  if (!lesson) throw new NotFoundError('Bài học');

  // Determine status from progressPct if not provided
  let status = data.status;
  if (!status) {
    status = data.progressPct >= 100 ? 'completed' : 'in_progress';
  }

  const progress = await prisma.lessonProgress.upsert({
    where: { enrollmentId_lessonId: { enrollmentId: enrollment.id, lessonId } },
    update: {
      progressPct: data.progressPct,
      timeSpentSec: { increment: data.timeSpentSec ?? 0 },
      status,
      startedAt: undefined,   // keep existing
      completedAt: status === 'completed' ? new Date() : null,
    },
    create: {
      enrollmentId: enrollment.id,
      lessonId,
      progressPct: data.progressPct,
      timeSpentSec: data.timeSpentSec ?? 0,
      status,
      startedAt: new Date(),
      completedAt: status === 'completed' ? new Date() : null,
    },
  });

  // Check if course is complete
  await checkCourseCompletion(enrollment.id, courseId, userId);
  await invalidateMyCoursesCache(userId);

  return progress;
}

// ── Auto-complete logic ──────────────────────────────────────

async function checkCourseCompletion(enrollmentId: string, courseId: string, userId: string) {
  const enrollment = await prisma.enrollment.findUnique({ where: { id: enrollmentId } });
  if (!enrollment || enrollment.completedAt) return; // already completed

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: { sections: { include: { lessons: { where: { isRequired: true } } } } },
  });
  if (!course) return;

  const requiredLessons = course.sections.flatMap((s) => s.lessons.map((l) => l.id));

  if (requiredLessons.length === 0) return;

  const completedCount = await prisma.lessonProgress.count({
    where: {
      enrollmentId,
      lessonId: { in: requiredLessons },
      status: 'completed',
    },
  });

  if (completedCount >= requiredLessons.length) {
    await prisma.enrollment.update({
      where: { id: enrollmentId },
      data: { completedAt: new Date() },
    });

    // Auto-issue certificate
    await issueCertificate(enrollmentId).catch((err) =>
      console.error('[Enrollment] Certificate issue failed:', err),
    );
  }
}
