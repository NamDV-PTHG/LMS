import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { Resolver } from 'dns/promises';
import { prisma } from '@/lib/prisma';
import { CACHE_KEYS, TTL } from '@/lib/cache';
import { redisSet } from '@/lib/redis';
import { NotFoundError, ConflictError, ForbiddenError, ValidationError } from '@/lib/errors';
import { RoleType } from '@/types';

// ── Schemas ───────────────────────────────────────────────────

export const createUserSchema = z.object({
  email: z.string().email('Email không hợp lệ').toLowerCase(),
  fullName: z.string().min(1).max(100),
  password: z.string().min(8, 'Mật khẩu tối thiểu 8 ký tự').optional(),
  employeeCode: z.string().max(20).optional(),
  jobTitle: z.string().max(100).optional(),
  jobLevel: z.enum(['staff', 'senior', 'manager', 'director', 'c_level']).optional(),
  organizationId: z.string().uuid('organizationId không hợp lệ'),
  role: z.enum(['group_admin', 'group_hrm', 'company_admin', 'hr_manager', 'instructor', 'learner']),
});

export const updateUserSchema = z.object({
  email: z.string().email('Email không hợp lệ').toLowerCase().optional(),
  fullName: z.string().min(1).max(100).optional(),
  jobTitle: z.string().max(100).optional(),
  jobLevel: z.enum(['staff', 'senior', 'manager', 'director', 'c_level']).optional(),
  jobPositionId: z.string().uuid().optional().nullable(),
  isActive: z.boolean().optional(),
  avatarUrl: z.string().url().optional().nullable(),
});

export const assignRoleSchema = z.object({
  role: z.enum(['group_admin', 'group_hrm', 'company_admin', 'hr_manager', 'instructor', 'learner']),
  organizationId: z.string().uuid(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type AssignRoleInput = z.infer<typeof assignRoleSchema>;

// ── Email domain validation ───────────────────────────────────

// Dùng Resolver riêng với Google DNS vì DNS nội bộ server không hỗ trợ MX lookup
const dnsResolver = new Resolver();
dnsResolver.setServers(['8.8.8.8', '1.1.1.1']);

export async function checkEmailDomain(email: string): Promise<{ valid: boolean; reason?: string }> {
  const parts = email.split('@');
  const domain = parts[1];
  if (!domain) return { valid: false, reason: 'Định dạng email không hợp lệ' };

  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('timeout')), 5000),
  );

  try {
    const records = await Promise.race([dnsResolver.resolveMx(domain), timeout]);
    if (Array.isArray(records) && records.length > 0) {
      return { valid: true };
    }
    return { valid: false, reason: `Tên miền "${domain}" không có máy chủ email (không có MX record)` };
  } catch (err) {
    const msg = (err as Error).message;
    if (msg === 'timeout') {
      return { valid: false, reason: `Không thể xác minh tên miền "${domain}" (timeout 5s)` };
    }
    return { valid: false, reason: `Tên miền "${domain}" không tồn tại hoặc không nhận email` };
  }
}

// ── Service functions ─────────────────────────────────────────

export async function getUsers(
  companyId: string,
  isGroupAdmin: boolean,
  filters: { deptId?: string; role?: string; page: number; limit: number },
) {
  const { deptId, role, page, limit } = filters;

  const where: Record<string, unknown> = {
    isActive: true,
    roles: {
      some: {
        ...(isGroupAdmin
          ? {}
          : {
              organization: {
                OR: [
                  { companyId },       // departments/teams under the company
                  { id: companyId },   // the company org itself
                ],
              },
            }),
        ...(role ? { role: role as RoleType } : {}),
        ...(deptId ? { organizationId: deptId } : {}),
      },
    },
  };

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        fullName: true,
        avatarUrl: true,
        employeeCode: true,
        jobTitle: true,
        jobLevel: true,
        isActive: true,
        createdAt: true,
        roles: {
          select: {
            role: true,
            organizationId: true,
            organization: { select: { name: true, type: true } },
          },
        },
      },
      orderBy: { fullName: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.user.count({ where }),
  ]);

  return { items: users, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getUserById(id: string, companyId: string, isGroupAdmin: boolean) {
  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      roles: {
        include: { organization: { select: { id: true, name: true, type: true, companyId: true } } },
      },
      jobPosition: true,
    },
  });

  if (!user || !user.isActive) throw new NotFoundError('User');

  // Tenant check: user must belong to this company
  if (!isGroupAdmin) {
    const belongsToCompany = user.roles.some(
      (r) => r.organization.id === companyId || (r.organization as { companyId?: string }).companyId === companyId,
    );
    if (!belongsToCompany) throw new ForbiddenError('Không có quyền xem user này');
  }

  return user;
}

export async function createUser(input: CreateUserInput, companyId: string, isGroupAdmin = false) {
  // Verify email domain has MX records (email address must be deliverable)
  const domainCheck = await checkEmailDomain(input.email);
  if (!domainCheck.valid) {
    throw new ValidationError(domainCheck.reason ?? 'Email không hợp lệ', {
      email: [domainCheck.reason ?? 'Email không hợp lệ'],
    });
  }

  // Check email unique
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw new ConflictError('Email đã tồn tại');

  if (input.employeeCode) {
    const existingCode = await prisma.user.findUnique({ where: { employeeCode: input.employeeCode } });
    if (existingCode) throw new ConflictError('Mã nhân viên đã tồn tại');
  }

  // Verify org belongs to company (group_admin có thể tạo user cho bất kỳ công ty nào)
  if (!isGroupAdmin) {
    const org = await prisma.organization.findUnique({ where: { id: input.organizationId } });
    if (!org || (org.companyId !== companyId && org.id !== companyId)) {
      throw new ForbiddenError('Tổ chức không thuộc công ty này');
    }
  }

  const passwordHash = await bcrypt.hash(input.password ?? 'ChangeMe@123', 10);

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: input.email,
        fullName: input.fullName,
        passwordHash,
        employeeCode: input.employeeCode,
        jobTitle: input.jobTitle,
        jobLevel: input.jobLevel,
      },
    });

    await tx.userRole.create({
      data: {
        userId: user.id,
        role: input.role as RoleType,
        organizationId: input.organizationId,
      },
    });

    return user;
  });
}

export async function updateUser(id: string, input: UpdateUserInput, companyId: string, isGroupAdmin: boolean) {
  await getUserById(id, companyId, isGroupAdmin); // throws if not found or not authorized

  // Check email uniqueness if changing
  if (input.email) {
    const existing = await prisma.user.findFirst({ where: { email: input.email, id: { not: id } } });
    if (existing) throw new ConflictError('Email đã được sử dụng bởi tài khoản khác');
  }

  return prisma.user.update({
    where: { id },
    data: {
      ...input,
      jobPositionId: input.jobPositionId ?? undefined,
      // Detect position change via Prisma middleware in jobs (future Sprint 5)
    },
  });
}

export async function assignRole(userId: string, input: AssignRoleInput, companyId: string, isGroupAdmin: boolean) {
  await getUserById(userId, companyId, isGroupAdmin);

  const role = await prisma.userRole.upsert({
    where: {
      userId_role_organizationId: {
        userId,
        role: input.role as RoleType,
        organizationId: input.organizationId,
      },
    },
    update: {},
    create: {
      userId,
      role: input.role as RoleType,
      organizationId: input.organizationId,
    },
  });

  // Invalidate cached roles
  const roles = await prisma.userRole.findMany({
    where: { userId },
    select: { role: true },
  });
  await redisSet(CACHE_KEYS.userRoles(userId), roles.map((r) => r.role), TTL.USER_ROLES);

  return role;
}

export async function removeRole(userId: string, roleId: string, companyId: string, isGroupAdmin: boolean) {
  await getUserById(userId, companyId, isGroupAdmin);

  const roleRecord = await prisma.userRole.findUnique({ where: { id: roleId } });
  if (!roleRecord || roleRecord.userId !== userId) throw new NotFoundError('Role');

  await prisma.userRole.delete({ where: { id: roleId } });

  // Invalidate cached roles
  const roles = await prisma.userRole.findMany({
    where: { userId },
    select: { role: true },
  });
  await redisSet(CACHE_KEYS.userRoles(userId), roles.map((r) => r.role), TTL.USER_ROLES);
}
