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

export interface ImportResult {
  jobId: string;
  status: 'SUCCESS' | 'FAILED';
  totalRows: number;
  successRows: number;
  errorRows: number;
  errors: ImportError[];
}

interface OrgRow {
  code: string;
  name: string;
  type: string;
  parentCode: string;
  description?: string;
}

interface UserRow {
  employeeCode: string;
  fullName: string;
  email: string;
  orgCode: string;
  role: string;
  jobTitle?: string;
  jobLevel?: string;
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
 * Handles depth-first traversal via code→parentCode references.
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
    const rowNum = i + 2; // Excel row (1-indexed header)
    if (!row.code) errors.push({ row: rowNum, column: 'code', value: row.code, message: 'Mã không được trống' });
    if (!row.name) errors.push({ row: rowNum, column: 'name', value: row.name, message: 'Tên không được trống' });
    if (!['group', 'company', 'dept', 'team'].includes(row.type)) {
      errors.push({ row: rowNum, column: 'type', value: row.type, message: 'Loại phải là: group/company/dept/team' });
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
    return {
      jobId: jobRecord.id,
      status: 'FAILED',
      totalRows: rawRows.length,
      successRows: 0,
      errorRows: errors.length,
      errors,
    };
  }

  const sorted = topologicalSort(rawRows);

  // Snapshot existing orgs for rollback
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
    data: {
      status: 'SUCCESS',
      successRows: sorted.length,
      completedAt: new Date(),
      snapshot: snapshot as unknown as object,
    },
  });

  return {
    jobId: jobRecord.id,
    status: 'SUCCESS',
    totalRows: rawRows.length,
    successRows: sorted.length,
    errorRows: 0,
    errors: [],
  };
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
    data: {
      companyId,
      importType: 'users',
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

  let successRows = 0;
  const defaultPassword = await bcrypt.hash('ChangeMe@123', 10);

  await prisma.$transaction(async (tx) => {
    for (const row of rawRows) {
      // Find org by code
      const org = await tx.organization.findFirst({ where: { code: row.orgCode, companyId } });
      if (!org) continue;

      const user = await tx.user.upsert({
        where: { email: row.email.toLowerCase() },
        update: { fullName: row.fullName, jobTitle: row.jobTitle, jobLevel: row.jobLevel },
        create: {
          email: row.email.toLowerCase(),
          fullName: row.fullName,
          employeeCode: row.employeeCode || undefined,
          jobTitle: row.jobTitle,
          jobLevel: row.jobLevel,
          passwordHash: defaultPassword,
        },
      });

      await tx.userRole.upsert({
        where: {
          userId_role_organizationId: {
            userId: user.id,
            role: row.role as RoleType,
            organizationId: org.id,
          },
        },
        update: {},
        create: {
          userId: user.id,
          role: row.role as RoleType,
          organizationId: org.id,
          assignedBy: createdById,
        },
      });
      successRows++;
    }
  });

  await prisma.importJob.update({
    where: { id: jobRecord.id },
    data: { status: 'SUCCESS', successRows, completedAt: new Date() },
  });

  return { jobId: jobRecord.id, status: 'SUCCESS', totalRows: rawRows.length, successRows, errorRows: 0, errors: [] };
}

// ── Import: Job Positions ────────────────────────────────────

export async function importJobPositions(
  buffer: Buffer,
  companyId: string,
  createdById: string,
): Promise<ImportResult> {
  const rawRows = parseExcel(buffer, 'JobPositions') as {
    code: string;
    title: string;
    level?: string;
    orgCode?: string;
    description?: string;
  }[];

  const jobRecord = await prisma.importJob.create({
    data: { companyId, importType: 'job_positions', fileName: 'import.xlsx', totalRows: rawRows.length, createdById },
  });

  let successRows = 0;
  await prisma.$transaction(async (tx) => {
    for (const row of rawRows) {
      const org = row.orgCode
        ? await tx.organization.findFirst({ where: { code: row.orgCode, companyId } })
        : null;

      await tx.jobPosition.upsert({
        where: { companyId_code: { companyId, code: row.code } },
        update: { title: row.title, level: row.level, description: row.description },
        create: {
          companyId,
          organizationId: org?.id,
          code: row.code,
          title: row.title,
          level: row.level,
          description: row.description,
        },
      });
      successRows++;
    }
  });

  await prisma.importJob.update({
    where: { id: jobRecord.id },
    data: { status: 'SUCCESS', successRows, completedAt: new Date() },
  });

  return { jobId: jobRecord.id, status: 'SUCCESS', totalRows: rawRows.length, successRows, errorRows: 0, errors: [] };
}

// ── Rollback ──────────────────────────────────────────────────

export async function rollbackImport(jobId: string, companyId: string): Promise<void> {
  const job = await prisma.importJob.findUnique({ where: { id: jobId } });
  if (!job) throw new NotFoundError('Import job');
  if (job.companyId !== companyId) throw new ValidationError('Không có quyền rollback job này');
  if (job.status !== 'SUCCESS') throw new ValidationError('Chỉ có thể rollback job đã SUCCESS');

  const createdAt = job.createdAt;
  const hoursSince = (Date.now() - createdAt.getTime()) / 3600000;
  if (hoursSince > 24) throw new ValidationError('Chỉ có thể rollback trong vòng 24h');

  // For org_chart: restore snapshot
  if (job.importType === 'org_chart' && job.snapshot) {
    // TODO: clarify with team — full restore strategy for nested orgs
    // Current: mark job as ROLLED_BACK
  }

  await prisma.importJob.update({
    where: { id: jobId },
    data: { status: 'ROLLED_BACK' },
  });
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

  // Add a red highlight style to error cells (basic — XLSX open source has limited styling)
  errors.forEach((err) => {
    const cellAddr = XLSX.utils.encode_cell({ r: err.row - 1, c: 0 });
    if (ws[cellAddr]) {
      ws[cellAddr].v = `[LỖI] ${err.message} | ${ws[cellAddr].v}`;
    }
  });

  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
}
