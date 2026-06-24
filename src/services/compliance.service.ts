import { prisma } from '@/lib/prisma';
import { ForbiddenError, NotFoundError } from '@/lib/errors';

// ── Types ─────────────────────────────────────────────────────

export type ComplianceStatus =
  | 'completed'
  | 'in_progress'
  | 'overdue'
  | 'not_started'
  | 'overdue_not_started';

function getComplianceStatus(
  completedAt: Date | null,
  enrolledAt: Date | null,
  deadline: Date | null,
): ComplianceStatus {
  const now = new Date();
  if (completedAt) return 'completed';
  if (deadline && deadline < now) {
    return enrolledAt ? 'overdue' : 'overdue_not_started';
  }
  return enrolledAt ? 'in_progress' : 'not_started';
}

// ── Service functions ─────────────────────────────────────────

/**
 * Compliance overview for a company.
 * Lists all mandatory courses + completion rate per department.
 */
export async function getCompanyCompliance(
  companyId: string,
  filters: { deptId?: string; courseId?: string; overdueOnly?: boolean },
) {
  // All mandatory enrollments for the company
  const enrollments = await prisma.enrollment.findMany({
    where: {
      isMandatory: true,
      course: {
        OR: [
          { ownerCompanyId: companyId },
          { publications: { some: { targetCompanyId: companyId, revokedAt: null } } },
          { assignments: { some: { targetCompanyId: companyId } } },
        ],
      },
      ...(filters.courseId && { courseId: filters.courseId }),
      user: {
        roles: {
          some: {
            organization: {
              companyId,
              ...(filters.deptId && { id: filters.deptId }),
            },
          },
        },
      },
    },
    include: {
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
          employeeCode: true,
          roles: {
            where: { organization: { companyId } },
            include: { organization: { select: { id: true, name: true } } },
            take: 1,
          },
        },
      },
      course: { select: { id: true, title: true } },
    },
  });

  const rows = enrollments.map((e) => {
    const status = getComplianceStatus(e.completedAt, e.enrolledAt, e.deadline);
    return {
      userId: e.userId,
      userName: e.user.fullName,
      userEmail: e.user.email,
      employeeCode: e.user.employeeCode,
      department: e.user.roles[0]?.organization ?? null,
      courseId: e.courseId,
      courseTitle: e.course.title,
      enrolledAt: e.enrolledAt,
      completedAt: e.completedAt,
      deadline: e.deadline,
      status,
    };
  });

  const filtered = filters.overdueOnly
    ? rows.filter((r) => r.status === 'overdue' || r.status === 'overdue_not_started')
    : rows;

  // Summary by department
  const deptMap = new Map<string, { name: string; total: number; completed: number }>();
  for (const row of filtered) {
    const key = row.department?.id ?? 'unknown';
    if (!deptMap.has(key)) {
      deptMap.set(key, { name: row.department?.name ?? 'Không rõ', total: 0, completed: 0 });
    }
    const dept = deptMap.get(key)!;
    dept.total++;
    if (row.status === 'completed') dept.completed++;
  }

  return {
    rows: filtered,
    summary: Array.from(deptMap.entries()).map(([deptId, d]) => ({
      deptId,
      deptName: d.name,
      total: d.total,
      completed: d.completed,
      rate: d.total > 0 ? Math.round((d.completed / d.total) * 100) : 0,
    })),
    totals: {
      total: filtered.length,
      completed: filtered.filter((r) => r.status === 'completed').length,
      overdue: filtered.filter((r) => r.status === 'overdue' || r.status === 'overdue_not_started').length,
    },
  };
}

/**
 * Individual user compliance within a company.
 */
export async function getUserCompliance(companyId: string, userId: string) {
  // Verify user belongs to company
  const userInCompany = await prisma.userRole.findFirst({
    where: {
      userId,
      organization: { companyId },
    },
  });
  if (!userInCompany) throw new NotFoundError('Nhân viên trong công ty');

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, fullName: true, email: true, employeeCode: true },
  });
  if (!user) throw new NotFoundError('Người dùng');

  const enrollments = await prisma.enrollment.findMany({
    where: {
      userId,
      isMandatory: true,
    },
    include: {
      course: { select: { id: true, title: true, estimatedHours: true } },
      certificate: { select: { code: true, issuedAt: true } },
    },
    orderBy: { deadline: 'asc' },
  });

  return {
    user,
    courses: enrollments.map((e) => ({
      courseId: e.courseId,
      courseTitle: e.course.title,
      estimatedHours: e.course.estimatedHours,
      enrolledAt: e.enrolledAt,
      completedAt: e.completedAt,
      deadline: e.deadline,
      status: getComplianceStatus(e.completedAt, e.enrolledAt, e.deadline),
      certificate: e.certificate ?? null,
    })),
  };
}
