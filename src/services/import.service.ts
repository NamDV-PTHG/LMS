import * as XLSX from 'xlsx';
import { prisma } from '@/lib/prisma';
import { ValidationError, NotFoundError } from '@/lib/errors';
import { OrgType, RoleType } from '@/types';
import bcrypt from 'bcryptjs';

// ── Types ─────────────────────────────────────────────────────

export interface ImportError {
  row: number;
  column: string;
  value: unknown;
  message: string;
}

export interface ImportWarning {
  row: number;
  column: string;
  value: unknown;
  message: string;
}

export interface ImportResult {
  jobId: string;
  status: 'SUCCESS' | 'FAILED';
  totalRows: number;
  successRows: number;
  errorRows: number;
  errors: ImportError[];
  warnings?: ImportWarning[];
}

interface OrgRow {
  code: string;
  name: string;
  type: string;
  parentCode: string;
  description?: string;
  displayOrder?: number;
}

interface UserRow {
  employeeCode?: string;
  fullName: string;
  email: string;
  orgCode?: string;
  role: string;
  positionCode?: string;
  jobTitle?: string;
  jobLevel?: string;
  password?: string;
}

interface JobPositionRow {
  code: string;
  title: string;
  level?: string;
  catalogCode?: string;
  orgCode?: string;
  competencyFrameworkCode?: string;
  learningPathCode?: string;
  description?: string;
}

// ── Excel helpers ─────────────────────────────────────────────

export function parseExcel(buffer: Buffer, sheetName: string): Record<string, unknown>[] {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const ws = wb.Sheets[sheetName];
  if (!ws) throw new ValidationError(`Sheet "${sheetName}" không tồn tại trong file`);
  return XLSX.utils.sheet_to_json(ws, { defval: '' });
}

/**
 * Topological sort for org rows: parents before children.
 */
export function topologicalSort(rows: OrgRow[]): OrgRow[] {
  const codeMap = new Map(rows.map((r) => [r.code, r]));
  const visited = new Set<string>();
  const result: OrgRow[] = [];

  function visit(code: string) {
    if (visited.has(code)) return;
    visited.add(code);
    const row = codeMap.get(code);
    if (!row) return;
    if (row.parentCode) visit(row.parentCode);
    result.push(row);
  }

  rows.forEach((r) => visit(r.code));
  return result;
}

/**
 * Validate org rows. Returns list of errors.
 */
export function validateOrgRows(rows: OrgRow[]): ImportError[] {
  const errors: ImportError[] = [];
  const codes = new Set<string>();

  rows.forEach((row, i) => {
    const rowNum = i + 2;
    if (!row.code) errors.push({ row: rowNum, column: 'code', value: row.code, message: 'Mã không được trống' });
    if (!row.name) errors.push({ row: rowNum, column: 'name', value: row.name, message: 'Tên không được trống' });
    if (!['group', 'company', 'dept', 'team'].includes(row.type)) {
      errors.push({ row: rowNum, column: 'type', value: row.type, message: 'Loại phải là: dept/team' });
    }
    if (codes.has(row.code)) {
      errors.push({ row: rowNum, column: 'code', value: row.code, message: `Mã "${row.code}" bị trùng` });
    }
    codes.add(row.code);
  });

  return errors;
}

/**
 * Validate user rows. Returns list of errors.
 */
export function validateUserRows(rows: UserRow[]): ImportError[] {
  const errors: ImportError[] = [];
  const emails = new Set<string>();
  const validRoles = ['group_admin', 'group_hrm', 'company_admin', 'hr_manager', 'instructor', 'learner'];

  rows.forEach((row, i) => {
    const rowNum = i + 2;
    if (!row.email || !/\S+@\S+\.\S+/.test(row.email)) {
      errors.push({ row: rowNum, column: 'email', value: row.email, message: 'Email không hợp lệ' });
    }
    if (!row.fullName) {
      errors.push({ row: rowNum, column: 'fullName', value: row.fullName, message: 'Họ tên không được trống' });
    }
    if (!validRoles.includes(row.role)) {
      errors.push({ row: rowNum, column: 'role', value: row.role, message: `Role phải là: ${validRoles.join('/')}` });
    }
    if (!row.orgCode) {
      errors.push({ row: rowNum, column: 'orgCode', value: row.orgCode, message: 'Mã phòng ban (orgCode) không được trống — người dùng sẽ không thuộc phòng ban nào nếu thiếu cột này' });
    }
    if (emails.has(row.email)) {
      errors.push({ row: rowNum, column: 'email', value: row.email, message: `Email "${row.email}" bị trùng` });
    }
    emails.add(row.email);
  });

  return errors;
}

// ── Import: Org Chart ─────────────────────────────────────────

export async function importOrgChart(
  buffer: Buffer,
  companyId: string,
  createdById: string,
): Promise<ImportResult> {
  const rawRows = parseExcel(buffer, 'OrgChart') as OrgRow[];
  const errors = validateOrgRows(rawRows);

  const jobRecord = await prisma.importJob.create({
    data: {
      companyId,
      importType: 'org_chart',
      fileName: 'import.xlsx',
      totalRows: rawRows.length,
      createdById,
    },
  });

  if (errors.length > 0) {
    await prisma.importJob.update({
      where: { id: jobRecord.id },
      data: { status: 'FAILED', errorRows: errors.length, errorLog: errors as unknown as object },
    });
    return { jobId: jobRecord.id, status: 'FAILED', totalRows: rawRows.length, successRows: 0, errorRows: errors.length, errors };
  }

  const sorted = topologicalSort(rawRows);
  const snapshot = await prisma.organization.findMany({ where: { companyId } });

  await prisma.$transaction(async (tx) => {
    const codeToId = new Map<string, string>();

    for (const row of sorted) {
      const parentId = row.parentCode ? codeToId.get(row.parentCode) : undefined;
      const org = await tx.organization.upsert({
        where: { code_companyId: { code: row.code, companyId } },
        update: { name: row.name, parentId, description: row.description },
        create: {
          code: row.code,
          name: row.name,
          type: row.type as OrgType,
          parentId,
          companyId,
          description: row.description,
        },
      });
      codeToId.set(row.code, org.id);
    }
  });

  await prisma.importJob.update({
    where: { id: jobRecord.id },
    data: { status: 'SUCCESS', successRows: sorted.length, completedAt: new Date(), snapshot: snapshot as unknown as object },
  });

  return { jobId: jobRecord.id, status: 'SUCCESS', totalRows: rawRows.length, successRows: sorted.length, errorRows: 0, errors: [] };
}

// ── Import: Job Positions ─────────────────────────────────────

export async function importJobPositions(
  buffer: Buffer,
  companyId: string,
  createdById: string,
): Promise<ImportResult> {
  const rawRows = parseExcel(buffer, 'JobPositions') as JobPositionRow[];

  const jobRecord = await prisma.importJob.create({
    data: { companyId, importType: 'job_positions', fileName: 'import.xlsx', totalRows: rawRows.length, createdById },
  });

  // Pre-fetch reference data maps for this company
  const [catalogMap, frameworkMap, pathMap] = await Promise.all([
    prisma.jobTitleCatalog.findMany({ where: { companyId }, select: { code: true, id: true } })
      .then((rows) => new Map(rows.map((r) => [r.code, r.id]))),
    prisma.competencyFramework.findMany({ where: { companyId }, select: { code: true, id: true } })
      .then((rows) => new Map(rows.filter((r) => r.code).map((r) => [r.code!, r.id]))),
    prisma.learningPath.findMany({ where: { companyId }, select: { code: true, id: true } })
      .then((rows) => new Map(rows.filter((r) => r.code).map((r) => [r.code!, r.id]))),
  ]);

  let successRows = 0;
  const warnings: ImportWarning[] = [];

  await prisma.$transaction(async (tx) => {
    for (let i = 0; i < rawRows.length; i++) {
      const row = rawRows[i];
      const rowNum = i + 2;
      if (!row.code || !row.title) continue;

      const org = row.orgCode
        ? await tx.organization.findFirst({ where: { code: row.orgCode, companyId } })
        : null;

      if (row.orgCode && !org) {
        warnings.push({ row: rowNum, column: 'orgCode', value: row.orgCode, message: `Không tìm thấy phòng ban "${row.orgCode}" — vị trí sẽ không gắn phòng ban` });
      }

      const catalogId = row.catalogCode ? catalogMap.get(row.catalogCode) : undefined;
      if (row.catalogCode && !catalogId) {
        warnings.push({ row: rowNum, column: 'catalogCode', value: row.catalogCode, message: `Mã chức danh "${row.catalogCode}" không có trong danh mục` });
      }

      const frameworkId = row.competencyFrameworkCode ? frameworkMap.get(row.competencyFrameworkCode) : undefined;
      if (row.competencyFrameworkCode && !frameworkId) {
        warnings.push({ row: rowNum, column: 'competencyFrameworkCode', value: row.competencyFrameworkCode, message: `Mã framework "${row.competencyFrameworkCode}" không tìm thấy` });
      }

      const learningPathId = row.learningPathCode ? pathMap.get(row.learningPathCode) : undefined;
      if (row.learningPathCode && !learningPathId) {
        warnings.push({ row: rowNum, column: 'learningPathCode', value: row.learningPathCode, message: `Mã lộ trình "${row.learningPathCode}" không tìm thấy` });
      }

      await tx.jobPosition.upsert({
        where: { companyId_code: { companyId, code: row.code } },
        update: {
          title: row.title,
          level: row.level || undefined,
          description: row.description || undefined,
          organizationId: org?.id,
          catalogId: catalogId ?? undefined,
          competencyFrameworkId: frameworkId ?? undefined,
          learningPathId: learningPathId ?? undefined,
        },
        create: {
          companyId,
          code: row.code,
          title: row.title,
          level: row.level || undefined,
          description: row.description || undefined,
          organizationId: org?.id,
          catalogId: catalogId ?? undefined,
          competencyFrameworkId: frameworkId ?? undefined,
          learningPathId: learningPathId ?? undefined,
        },
      });
      successRows++;
    }
  });

  await prisma.importJob.update({
    where: { id: jobRecord.id },
    data: {
      status: 'SUCCESS',
      successRows,
      completedAt: new Date(),
      errorLog: warnings.length > 0 ? (warnings as unknown as object) : undefined,
    },
  });

  return { jobId: jobRecord.id, status: 'SUCCESS', totalRows: rawRows.length, successRows, errorRows: 0, errors: [], warnings };
}

// ── Import: Users ─────────────────────────────────────────────

export async function importUsers(
  buffer: Buffer,
  companyId: string,
  createdById: string,
): Promise<ImportResult> {
  const rawRows = parseExcel(buffer, 'Users') as UserRow[];
  const errors = validateUserRows(rawRows);

  const jobRecord = await prisma.importJob.create({
    data: { companyId, importType: 'users', fileName: 'import.xlsx', totalRows: rawRows.length, createdById },
  });

  if (errors.length > 0) {
    await prisma.importJob.update({
      where: { id: jobRecord.id },
      data: { status: 'FAILED', errorRows: errors.length, errorLog: errors as unknown as object },
    });
    return { jobId: jobRecord.id, status: 'FAILED', totalRows: rawRows.length, successRows: 0, errorRows: errors.length, errors };
  }

  let successRows = 0;
  const warnings: ImportWarning[] = [];
  const defaultHashedPwd = await bcrypt.hash('ChangeMe@123', 10);

  // Pre-build position map for this company
  const positionMap = await prisma.jobPosition.findMany({
    where: { companyId },
    select: {
      id: true, code: true,
      competencyFrameworkId: true,
      learningPathId: true,
      competencyFramework: {
        include: {
          domains: { include: { competencies: { select: { id: true } } } },
        },
      },
    },
  }).then((rows) => new Map(rows.filter((r) => r.code).map((r) => [r.code!, r])));

  for (let i = 0; i < rawRows.length; i++) {
    const row = rawRows[i];
    const rowNum = i + 2;

    // Find org
    const org = row.orgCode
      ? await prisma.organization.findFirst({ where: { code: row.orgCode, companyId } })
      : null;

    if (row.orgCode && !org) {
      warnings.push({ row: rowNum, column: 'orgCode', value: row.orgCode, message: `Phòng ban "${row.orgCode}" không tìm thấy` });
    }

    // Find position
    const position = row.positionCode ? positionMap.get(row.positionCode) : undefined;
    if (row.positionCode && !position) {
      warnings.push({ row: rowNum, column: 'positionCode', value: row.positionCode, message: `Vị trí "${row.positionCode}" không tìm thấy` });
    }

    // Determine password
    const passwordHash = row.password && row.password.length >= 8
      ? await bcrypt.hash(row.password, 10)
      : defaultHashedPwd;

    // Upsert user (User model has no companyId — association is via UserRole)
    const user = await prisma.user.upsert({
      where: { email: row.email.toLowerCase() },
      update: {
        fullName: row.fullName,
        jobTitle: row.jobTitle || undefined,
        jobLevel: row.jobLevel || undefined,
        jobPositionId: position?.id ?? undefined,
      },
      create: {
        email: row.email.toLowerCase(),
        fullName: row.fullName,
        employeeCode: row.employeeCode || undefined,
        jobTitle: row.jobTitle || undefined,
        jobLevel: row.jobLevel || undefined,
        passwordHash,
        jobPositionId: position?.id ?? undefined,
      },
    });

    // Assign role in org
    if (org) {
      await prisma.userRole.upsert({
        where: { userId_role_organizationId: { userId: user.id, role: row.role as RoleType, organizationId: org.id } },
        update: {},
        create: { userId: user.id, role: row.role as RoleType, organizationId: org.id, assignedBy: createdById },
      });
    }

    // Auto-init UserCompetencyProfile (level=0) for all competencies in position's framework
    if (position?.competencyFramework) {
      const allCompetencies = position.competencyFramework.domains.flatMap((d) => d.competencies);
      for (const comp of allCompetencies) {
        await prisma.userCompetencyProfile.upsert({
          where: { userId_competencyId: { userId: user.id, competencyId: comp.id } },
          update: {}, // Don't overwrite existing assessments
          create: { userId: user.id, competencyId: comp.id, currentLevel: 0, source: 'SYSTEM' },
        });
      }
    }

    // Auto-enroll user into position's learning path (if any and not already enrolled)
    if (position?.learningPathId) {
      const existingEnrollment = await prisma.learningPathEnrollment.findFirst({
        where: { userId: user.id, learningPathId: position.learningPathId },
      });

      if (!existingEnrollment) {
        // Fetch path steps
        const pathSteps = await prisma.learningPathStep.findMany({
          where: { learningPathId: position.learningPathId },
          orderBy: { stepOrder: 'asc' },
        });

        const pathEnrollment = await prisma.learningPathEnrollment.create({
          data: {
            userId: user.id,
            learningPathId: position.learningPathId,
            status: 'IN_PROGRESS',
            startedAt: new Date(),
          },
        });

        // Create step enrollments — smart skip if user already completed the course
        const completedCourseIds = new Set(
          (await prisma.enrollment.findMany({
            where: { userId: user.id, completedAt: { not: null } },
            select: { courseId: true },
          })).map((e) => e.courseId),
        );

        let completedCount = 0;
        for (let s = 0; s < pathSteps.length; s++) {
          const step = pathSteps[s];
          const isCompleted = completedCourseIds.has(step.courseId);
          const isUnlocked = s === 0 || isCompleted;

          await prisma.learningPathStepEnrollment.create({
            data: {
              learningPathEnrollmentId: pathEnrollment.id,
              learningPathStepId: step.id,
              status: isCompleted ? 'completed' : 'not_started',
              isUnlocked,
              completedAt: isCompleted ? new Date() : null,
            },
          });
          if (isCompleted) completedCount++;
        }

        const progressPct = pathSteps.length > 0 ? Math.round((completedCount / pathSteps.length) * 100) : 0;
        if (progressPct > 0) {
          await prisma.learningPathEnrollment.update({
            where: { id: pathEnrollment.id },
            data: { progressPct },
          });
        }
      }
    }

    successRows++;
  }

  await prisma.importJob.update({
    where: { id: jobRecord.id },
    data: {
      status: 'SUCCESS',
      successRows,
      completedAt: new Date(),
      errorLog: warnings.length > 0 ? (warnings as unknown as object) : undefined,
    },
  });

  return { jobId: jobRecord.id, status: 'SUCCESS', totalRows: rawRows.length, successRows, errorRows: 0, errors: [], warnings };
}

// ── Rollback ──────────────────────────────────────────────────

export async function rollbackImport(jobId: string, companyId: string): Promise<void> {
  const job = await prisma.importJob.findUnique({ where: { id: jobId } });
  if (!job) throw new NotFoundError('Import job');
  if (job.companyId !== companyId) throw new ValidationError('Không có quyền rollback job này');
  if (job.status !== 'SUCCESS') throw new ValidationError('Chỉ có thể rollback job đã SUCCESS');

  const hoursSince = (Date.now() - job.createdAt.getTime()) / 3600000;
  if (hoursSince > 24) throw new ValidationError('Chỉ có thể rollback trong vòng 24h');

  await prisma.importJob.update({ where: { id: jobId }, data: { status: 'ROLLED_BACK' } });
}

// ── Error file generation ─────────────────────────────────────

export function generateErrorFile(
  originalBuffer: Buffer,
  errors: ImportError[],
  sheetName: string,
): Buffer {
  const wb = XLSX.read(originalBuffer, { type: 'buffer' });
  const ws = wb.Sheets[sheetName];
  if (!ws) return originalBuffer;

  errors.forEach((err) => {
    const cellAddr = XLSX.utils.encode_cell({ r: err.row - 1, c: 0 });
    if (ws[cellAddr]) {
      ws[cellAddr].v = `[LỖI] ${err.message} | ${ws[cellAddr].v}`;
    }
  });

  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
}
