import { prisma } from '@/lib/prisma';
import * as XLSX from 'xlsx';

// ── Group-level reports ───────────────────────────────────────

/**
 * Group-wide KPI overview for group_admin.
 */
export async function getGroupOverview() {
  const [totalCompanies, totalUsers, totalCourses, enrollments] = await Promise.all([
    prisma.organization.count({ where: { type: 'company', isActive: true } }),
    prisma.user.count({ where: { isActive: true } }),
    prisma.course.count({ where: { isActive: true } }),
    prisma.enrollment.findMany({
      select: { completedAt: true, enrolledAt: true },
    }),
  ]);

  const completed = enrollments.filter((e) => e.completedAt !== null).length;
  const avgCompletionRate =
    enrollments.length > 0 ? Math.round((completed / enrollments.length) * 100) : 0;

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const activeLearnersThisMonth = await prisma.enrollment.groupBy({
    by: ['userId'],
    where: { enrolledAt: { gte: thirtyDaysAgo } },
  }).then((g) => g.length);

  return {
    totalCompanies,
    totalUsers,
    totalCourses,
    totalEnrollments: enrollments.length,
    avgCompletionRate,
    activeLearnersThisMonth,
  };
}

/**
 * Company-by-company comparison of completion rates.
 */
export async function getCompanyComparison() {
  const companies = await prisma.organization.findMany({
    where: { type: 'company', isActive: true },
    select: { id: true, name: true, companyId: true },
  });

  const rows = await Promise.all(
    companies.map(async (c) => {
      const [total, completed] = await Promise.all([
        prisma.enrollment.count({
          where: { user: { roles: { some: { organization: { companyId: c.id } } } } },
        }),
        prisma.enrollment.count({
          where: {
            completedAt: { not: null },
            user: { roles: { some: { organization: { companyId: c.id } } } },
          },
        }),
      ]);

      return {
        companyId: c.id,
        companyName: c.name,
        totalEnrollments: total,
        completed,
        completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
      };
    }),
  );

  return rows.sort((a, b) => b.completionRate - a.completionRate);
}

// ── Group HRM reports ─────────────────────────────────────────

/**
 * Progress of each member in a learning group, per course.
 */
export async function getLearningGroupProgress(groupId: string) {
  const group = await prisma.learningGroup.findUnique({
    where: { id: groupId },
    include: {
      members: {
        where: { removedAt: null },
        include: {
          user: {
            select: { id: true, fullName: true, email: true },
          },
        },
      },
      courses: {
        include: {
          course: { select: { id: true, title: true } },
        },
      },
    },
  });

  if (!group) return null;

  const memberIds = group.members.map((m) => m.userId);
  const courseIds = group.courses.map((gc) => gc.courseId);

  // Enrollments for these members in these courses
  const enrollments = await prisma.enrollment.findMany({
    where: {
      userId: { in: memberIds },
      courseId: { in: courseIds },
    },
    include: {
      lessonProgresses: { select: { status: true, progressPct: true } },
    },
  });

  // Build matrix: memberId → courseId → progress
  const matrix: Record<string, Record<string, { progressPct: number; completedAt: Date | null; enrolledAt: Date }>> = {};

  for (const e of enrollments) {
    if (!matrix[e.userId]) matrix[e.userId] = {};
    const avgProgress =
      e.lessonProgresses.length > 0
        ? e.lessonProgresses.reduce((s, lp) => s + lp.progressPct, 0) / e.lessonProgresses.length
        : 0;
    matrix[e.userId][e.courseId] = {
      progressPct: Math.round(avgProgress),
      completedAt: e.completedAt,
      enrolledAt: e.enrolledAt,
    };
  }

  return {
    groupId,
    groupName: group.name,
    courses: group.courses.map((gc) => ({ id: gc.courseId, title: gc.course.title, deadline: gc.deadline })),
    members: group.members.map((m) => ({
      userId: m.userId,
      fullName: m.user.fullName,
      email: m.user.email,
      progress: courseIds.reduce<Record<string, { progressPct: number; completedAt: Date | null } | null>>(
        (acc, cId) => {
          acc[cId] = matrix[m.userId]?.[cId] ?? null;
          return acc;
        },
        {},
      ),
    })),
  };
}

// ── Company-level reports ─────────────────────────────────────

export async function getCompanyOverview(companyId: string) {
  const [totalUsers, totalCourses, enrollments, mandatoryEnrollments] = await Promise.all([
    prisma.user.count({
      where: { isActive: true, roles: { some: { organization: { companyId } } } },
    }),
    prisma.course.count({
      where: { isActive: true, ownerCompanyId: companyId },
    }),
    prisma.enrollment.findMany({
      where: { user: { roles: { some: { organization: { companyId } } } } },
      select: { completedAt: true, isMandatory: true },
    }),
    prisma.enrollment.findMany({
      where: {
        isMandatory: true,
        user: { roles: { some: { organization: { companyId } } } },
      },
      select: { completedAt: true },
    }),
  ]);

  const completed = enrollments.filter((e) => e.completedAt !== null).length;
  const mandatoryCompleted = mandatoryEnrollments.filter((e) => e.completedAt !== null).length;

  return {
    totalUsers,
    totalCourses,
    totalEnrollments: enrollments.length,
    completionRate: enrollments.length > 0 ? Math.round((completed / enrollments.length) * 100) : 0,
    mandatoryComplianceRate:
      mandatoryEnrollments.length > 0
        ? Math.round((mandatoryCompleted / mandatoryEnrollments.length) * 100)
        : 0,
  };
}

export async function getCompanyByDepartment(companyId: string) {
  const depts = await prisma.organization.findMany({
    where: { companyId, type: 'dept', isActive: true },
    select: { id: true, name: true },
  });

  return Promise.all(
    depts.map(async (dept) => {
      const [total, completed, userCount] = await Promise.all([
        prisma.enrollment.count({
          where: { user: { roles: { some: { organizationId: dept.id } } } },
        }),
        prisma.enrollment.count({
          where: {
            completedAt: { not: null },
            user: { roles: { some: { organizationId: dept.id } } },
          },
        }),
        prisma.userRole.groupBy({
          by: ['userId'],
          where: { organizationId: dept.id },
        }).then((g) => g.length),
      ]);

      return {
        deptId: dept.id,
        deptName: dept.name,
        userCount,
        totalEnrollments: total,
        completed,
        completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
      };
    }),
  );
}

export async function getCompanyByCourse(companyId: string) {
  const courses = await prisma.course.findMany({
    where: { ownerCompanyId: companyId, isActive: true },
    select: {
      id: true,
      title: true,
      estimatedHours: true,
      enrollments: {
        select: {
          completedAt: true,
          enrolledAt: true,
          quizAttempts: {
            where: { passedAt: { not: null } },
            select: { score: true, maxScore: true },
          },
          lessonProgresses: { select: { timeSpentSec: true } },
        },
      },
    },
  });

  return courses.map((c) => {
    const enrolled = c.enrollments.length;
    const completed = c.enrollments.filter((e) => e.completedAt !== null).length;
    const allAttempts = c.enrollments.flatMap((e) => e.quizAttempts);
    const avgScore =
      allAttempts.length > 0
        ? Math.round(
            allAttempts.reduce((s, a) => s + (a.maxScore! > 0 ? (a.score! / a.maxScore!) * 100 : 0), 0) /
              allAttempts.length,
          )
        : null;
    const totalTimeSec = c.enrollments.flatMap((e) => e.lessonProgresses).reduce((s, lp) => s + lp.timeSpentSec, 0);

    return {
      courseId: c.id,
      courseTitle: c.title,
      estimatedHours: c.estimatedHours,
      enrolled,
      completed,
      completionRate: enrolled > 0 ? Math.round((completed / enrolled) * 100) : 0,
      avgScorePct: avgScore,
      avgTimeHours: enrolled > 0 ? Math.round((totalTimeSec / enrolled / 3600) * 10) / 10 : 0,
    };
  });
}

export async function getUserReport(companyId: string, userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, fullName: true, email: true, employeeCode: true, jobTitle: true },
  });
  if (!user) return null;

  const enrollments = await prisma.enrollment.findMany({
    where: { userId },
    include: {
      course: {
        include: {
          sections: {
            orderBy: { displayOrder: 'asc' },
            include: {
              lessons: {
                orderBy: { displayOrder: 'asc' },
                select: {
                  id: true, title: true, contentType: true, isRequired: true,
                  estimatedMinutes: true, displayOrder: true,
                },
              },
            },
          },
        },
      },
      certificate: { select: { code: true, issuedAt: true } },
      lessonProgresses: {
        select: { lessonId: true, status: true, progressPct: true, timeSpentSec: true, completedAt: true },
      },
      quizAttempts: {
        select: { lessonId: true, score: true, maxScore: true, passedAt: true, submittedAt: true },
        orderBy: { startedAt: 'desc' },
      },
    },
    orderBy: { enrolledAt: 'desc' },
  });

  return {
    user,
    courses: enrollments.map((e) => {
      const progressMap = new Map(e.lessonProgresses.map((lp) => [lp.lessonId, lp]));
      // Group quiz attempts by lessonId
      const quizMap = new Map<string, typeof e.quizAttempts>();
      for (const qa of e.quizAttempts) {
        const arr = quizMap.get(qa.lessonId) ?? [];
        arr.push(qa);
        quizMap.set(qa.lessonId, arr);
      }

      const allLessons = e.course.sections.flatMap((s) => s.lessons);
      const totalLessons = allLessons.length;
      const completedLessons = allLessons.filter(
        (l) => progressMap.get(l.id)?.status === 'completed',
      ).length;
      const totalTimeSec = e.lessonProgresses.reduce((s, lp) => s + lp.timeSpentSec, 0);
      const progressPct = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
      const bestAttempt = e.quizAttempts.find((a) => a.passedAt);

      return {
        courseId: e.courseId,
        courseTitle: e.course.title,
        enrolledAt: e.enrolledAt,
        completedAt: e.completedAt,
        totalLessons,
        completedLessons,
        progressPct,
        timeSpentHours: Math.round((totalTimeSec / 3600) * 10) / 10,
        certificate: e.certificate ?? null,
        quizBestScore:
          bestAttempt && bestAttempt.maxScore
            ? Math.round((bestAttempt.score! / bestAttempt.maxScore) * 100)
            : null,
        quizAttemptCount: e.quizAttempts.length,
        sections: e.course.sections.map((sec) => ({
          id: sec.id,
          title: sec.title,
          order: sec.displayOrder,
          lessons: sec.lessons.map((les) => {
            const prog = progressMap.get(les.id);
            const attempts = quizMap.get(les.id) ?? [];
            const bestQuiz = attempts.find((a) => a.passedAt) ?? attempts[0] ?? null;
            return {
              id: les.id,
              title: les.title,
              contentType: les.contentType,
              isRequired: les.isRequired,
              estimatedMinutes: les.estimatedMinutes,
              status: (prog?.status ?? 'not_started') as 'completed' | 'in_progress' | 'not_started',
              completedAt: prog?.completedAt ?? null,
              progressPct: prog?.progressPct ?? 0,
              timeSpentMin: prog ? Math.round(prog.timeSpentSec / 60) : 0,
              quiz:
                les.contentType === 'quiz'
                  ? {
                      attempts: attempts.length,
                      bestScore:
                        bestQuiz && bestQuiz.maxScore
                          ? Math.round((bestQuiz.score! / bestQuiz.maxScore) * 100)
                          : null,
                      passed: !!bestQuiz?.passedAt,
                    }
                  : null,
            };
          }),
        })),
      };
    }),
  };
}

// ── Hierarchical department reports ───────────────────────────

/**
 * Returns all org IDs in the sub-tree rooted at orgId (inclusive).
 */
export async function getOrgSubtreeIds(orgId: string): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    WITH RECURSIVE sub AS (
      SELECT id FROM "Organization" WHERE id = ${orgId} AND "isActive" = true
      UNION ALL
      SELECT o.id FROM "Organization" o
      INNER JOIN sub ON o."parentId" = sub.id
      WHERE o."isActive" = true
    )
    SELECT id FROM sub
  `;
  return rows.map((r) => r.id);
}

/**
 * Returns all org nodes the user manages (has dept_head role in).
 */
export async function getManagedOrgs(userId: string) {
  const roles = await prisma.userRole.findMany({
    where: { userId, role: 'dept_head' },
    include: {
      organization: { select: { id: true, name: true, type: true, parentId: true } },
    },
  });
  return roles.map((r) => r.organization);
}

/**
 * Aggregate stats for direct children of an org node.
 * Used for the drill-down view: Director sees depts, Dept Head sees teams.
 */
export async function getDeptChildrenStats(orgId: string) {
  const children = await prisma.organization.findMany({
    where: { parentId: orgId, isActive: true },
    select: { id: true, name: true, type: true },
    orderBy: { displayOrder: 'asc' },
  });

  const results = await Promise.all(
    children.map(async (child) => {
      const subTreeIds = await getOrgSubtreeIds(child.id);

      const [memberCount, enrolled, completed, leader] = await Promise.all([
        prisma.userRole
          .groupBy({ by: ['userId'], where: { organizationId: { in: subTreeIds } } })
          .then((g) => g.length),

        prisma.enrollment.count({
          where: { user: { roles: { some: { organizationId: { in: subTreeIds } } } } },
        }),

        prisma.enrollment.count({
          where: {
            completedAt: { not: null },
            user: { roles: { some: { organizationId: { in: subTreeIds } } } },
          },
        }),

        // Leader = first user with dept_head role in this specific child org
        prisma.userRole.findFirst({
          where: { organizationId: child.id, role: 'dept_head' },
          include: { user: { select: { id: true, fullName: true, jobTitle: true } } },
        }),
      ]);

      // Average progress: completedLessons / totalLessons across all enrollments in sub-tree
      // Must use course structure (not just LessonProgress rows) — unvisited lessons have no row
      const enrollmentsInSubtree = await prisma.enrollment.findMany({
        where: {
          user: { roles: { some: { organizationId: { in: subTreeIds } } } },
        },
        include: {
          course: {
            include: { sections: { include: { lessons: { select: { id: true } } } } },
          },
          lessonProgresses: { select: { status: true } },
        },
      });
      let totalLessonsInSubtree = 0;
      let completedLessonsInSubtree = 0;
      for (const e of enrollmentsInSubtree) {
        totalLessonsInSubtree += e.course.sections.reduce((s, sec) => s + sec.lessons.length, 0);
        completedLessonsInSubtree += e.lessonProgresses.filter((lp) => lp.status === 'completed').length;
      }
      const avgProgress =
        totalLessonsInSubtree > 0
          ? Math.round((completedLessonsInSubtree / totalLessonsInSubtree) * 100)
          : 0;

      const hasChildren = await prisma.organization.count({
        where: { parentId: child.id, isActive: true },
      });

      return {
        orgId: child.id,
        orgName: child.name,
        orgType: child.type,
        hasChildren: hasChildren > 0,
        leader: leader ? { id: leader.user.id, fullName: leader.user.fullName, jobTitle: leader.user.jobTitle } : null,
        memberCount,
        enrolled,
        completed,
        completionRate: enrolled > 0 ? Math.round((completed / enrolled) * 100) : 0,
        avgProgress,
      };
    }),
  );

  return results;
}

/**
 * Flat list of all employees in the sub-tree of orgId.
 * Used for the "Xem tất cả nhân viên" view.
 */
export async function getDeptEmployees(orgId: string) {
  const subTreeIds = await getOrgSubtreeIds(orgId);

  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      roles: { some: { organizationId: { in: subTreeIds } } },
    },
    select: {
      id: true,
      fullName: true,
      email: true,
      employeeCode: true,
      jobTitle: true,
      jobPosition: { select: { title: true } },
    },
    orderBy: { fullName: 'asc' },
  });

  const enrollmentStats = await Promise.all(
    users.map(async (u) => {
      const enrollments = await prisma.enrollment.findMany({
        where: { userId: u.id },
        include: {
          course: {
            include: {
              sections: {
                include: { lessons: { select: { id: true } } },
              },
            },
          },
          lessonProgresses: { select: { status: true } },
        },
      });

      const totalCourses = enrollments.length;
      const completedCourses = enrollments.filter((e) => e.completedAt !== null).length;
      let totalLessons = 0;
      let completedLessons = 0;
      for (const e of enrollments) {
        const cnt = e.course.sections.reduce((s, sec) => s + sec.lessons.length, 0);
        totalLessons += cnt;
        completedLessons += e.lessonProgresses.filter((lp) => lp.status === 'completed').length;
      }
      return { userId: u.id, totalCourses, completedCourses, totalLessons, completedLessons };
    }),
  );

  const statsMap = new Map(enrollmentStats.map((s) => [s.userId, s]));

  return users.map((u) => {
    const stats = statsMap.get(u.id)!;
    return {
      id: u.id,
      fullName: u.fullName,
      email: u.email,
      employeeCode: u.employeeCode,
      jobTitle: u.jobPosition?.title ?? u.jobTitle,
      enrolled: stats.totalCourses,
      completed: stats.completedCourses,
      completionRate: stats.totalCourses > 0 ? Math.round((stats.completedCourses / stats.totalCourses) * 100) : 0,
      totalLessons: stats.totalLessons,
      completedLessons: stats.completedLessons,
      lessonProgress: stats.totalLessons > 0 ? Math.round((stats.completedLessons / stats.totalLessons) * 100) : 0,
    };
  });
}

// ── Export ────────────────────────────────────────────────────

export async function exportComplianceReport(companyId: string): Promise<Buffer> {
  const { rows } = await (await import('./compliance.service')).getCompanyCompliance(companyId, {});

  const wsData = [
    ['Họ tên', 'Email', 'Mã NV', 'Phòng ban', 'Khóa học', 'Ngày đăng ký', 'Ngày hoàn thành', 'Hạn chót', 'Trạng thái'],
    ...rows.map((r) => [
      r.userName,
      r.userEmail,
      r.employeeCode ?? '',
      r.department?.name ?? '',
      r.courseTitle,
      r.enrolledAt ? new Date(r.enrolledAt).toLocaleDateString('vi-VN') : '',
      r.completedAt ? new Date(r.completedAt).toLocaleDateString('vi-VN') : '',
      r.deadline ? new Date(r.deadline).toLocaleDateString('vi-VN') : '',
      r.status,
    ]),
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Style header row (column widths)
  ws['!cols'] = [20, 25, 12, 18, 30, 14, 14, 14, 20].map((w) => ({ wch: w }));
  XLSX.utils.book_append_sheet(wb, ws, 'Compliance');

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}
