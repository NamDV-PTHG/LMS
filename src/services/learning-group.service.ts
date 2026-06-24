import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { NotFoundError, ForbiddenError, ValidationError, ConflictError } from '@/lib/errors';
import { checkEmailDomain } from '@/services/user.service';
import { sendExternalLearnerInviteEmail } from '@/services/email.service';

// ── Schemas ───────────────────────────────────────────────────

export const createGroupSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  type: z.enum(['manual', 'rule_based', 'external']),
  ruleJson: z.any().optional(),
});

export const updateGroupSchema = createGroupSchema.partial();

export const addMemberSchema = z.object({
  identifier: z.string().min(1), // email or employee_code
});

export const addCourseSchema = z.object({
  courseId: z.string().uuid(),
  deadline: z.string().datetime().optional(),
});

// ── Helpers ───────────────────────────────────────────────────

interface RuleCondition {
  field: 'job_level' | 'job_title' | 'company_id' | 'department_id';
  op: 'eq' | 'in' | 'gte' | 'contains';
  value: string | string[];
}

interface RuleJson {
  logic: 'AND' | 'OR';
  conditions: RuleCondition[];
}

function userMatchesRule(
  user: { jobLevel?: string | null; jobTitle?: string | null; roles: { organizationId: string; organization: { companyId?: string | null } }[] },
  rule: RuleJson,
): boolean {
  const results = rule.conditions.map((c) => {
    const val = Array.isArray(c.value) ? c.value : [c.value];
    switch (c.field) {
      case 'job_level': {
        const level = user.jobLevel ?? '';
        return c.op === 'eq' ? level === val[0]
          : c.op === 'in' ? val.includes(level)
          : c.op === 'contains' ? level.includes(val[0])
          : false;
      }
      case 'job_title': {
        const title = user.jobTitle ?? '';
        return c.op === 'eq' ? title === val[0]
          : c.op === 'in' ? val.includes(title)
          : c.op === 'contains' ? title.includes(val[0])
          : false;
      }
      case 'company_id': {
        const companyIds = user.roles.map((r) => r.organization.companyId ?? r.organizationId);
        return c.op === 'eq' ? companyIds.includes(val[0])
          : c.op === 'in' ? val.some((v) => companyIds.includes(v))
          : false;
      }
      case 'department_id': {
        const deptIds = user.roles.map((r) => r.organizationId);
        return c.op === 'eq' ? deptIds.includes(val[0])
          : c.op === 'in' ? val.some((v) => deptIds.includes(v))
          : false;
      }
      default:
        return false;
    }
  });

  return rule.logic === 'AND' ? results.every(Boolean) : results.some(Boolean);
}

// ── Service functions ─────────────────────────────────────────

export async function getLearningGroups(companyId?: string, isGroupAdmin = false) {
  const where: { isActive: boolean; companyId?: string | null } = { isActive: true };
  if (!isGroupAdmin && companyId) {
    // company_admin / hr_manager only sees groups scoped to their company
    where.companyId = companyId;
  }
  return prisma.learningGroup.findMany({
    where,
    include: {
      _count: { select: { members: true, courses: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getLearningGroup(groupId: string) {
  const group = await prisma.learningGroup.findUnique({
    where: { id: groupId },
    include: {
      members: {
        where: { removedAt: null },
        include: {
          user: {
            select: { id: true, fullName: true, email: true, employeeCode: true, jobTitle: true, isExternal: true },
          },
        },
        orderBy: { addedAt: 'asc' },
      },
      courses: {
        include: {
          course: {
            select: { id: true, title: true, thumbnailUrl: true, estimatedHours: true },
          },
        },
        orderBy: { assignedAt: 'asc' },
      },
    },
  });

  if (!group) throw new NotFoundError('Learning Group');
  return group;
}

export async function createLearningGroup(
  createdById: string,
  data: z.infer<typeof createGroupSchema>,
  companyId?: string,
) {
  return prisma.learningGroup.create({
    data: {
      name: data.name,
      description: data.description,
      type: data.type,
      ruleJson: data.ruleJson ?? undefined,
      createdById,
      companyId: companyId ?? null,
    },
  });
}

export async function updateLearningGroup(
  groupId: string,
  data: z.infer<typeof updateGroupSchema>,
) {
  await prisma.learningGroup.findUniqueOrThrow({ where: { id: groupId } });

  return prisma.learningGroup.update({
    where: { id: groupId },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.type !== undefined && { type: data.type }),
      ...(data.ruleJson !== undefined && { ruleJson: data.ruleJson }),
    },
  });
}

export async function deleteLearningGroup(groupId: string) {
  await prisma.learningGroup.update({
    where: { id: groupId },
    data: { isActive: false },
  });
}

// Generate a secure temporary password
function generateTempPassword(): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghjkmnpqrstuvwxyz';
  const digits = '23456789';
  const special = '@#$!';
  const all = upper + lower + digits + special;
  let pwd = [
    upper[Math.floor(Math.random() * upper.length)],
    lower[Math.floor(Math.random() * lower.length)],
    digits[Math.floor(Math.random() * digits.length)],
    special[Math.floor(Math.random() * special.length)],
  ];
  for (let i = 0; i < 8; i++) {
    pwd.push(all[Math.floor(Math.random() * all.length)]);
  }
  return pwd.sort(() => Math.random() - 0.5).join('');
}

/**
 * Find and add a member by email or employee_code.
 * For external groups: validates email MX record, then auto-creates user if not found.
 * group_hrm cannot see full user lists — they must provide identifier.
 */
export async function addMember(
  groupId: string,
  addedById: string,
  identifier: string,
): Promise<{ member: object; wasCreated: boolean; emailSent: boolean }> {
  const group = await prisma.learningGroup.findUnique({
    where: { id: groupId },
    include: { courses: { include: { course: { select: { id: true, title: true } } } } },
  });
  if (!group) throw new NotFoundError('Learning Group');

  // ── External group flow ──────────────────────────────────────
  if (group.type === 'external') {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(identifier)) {
      throw new ValidationError('Nhóm ngoài hệ thống chỉ hỗ trợ thêm bằng địa chỉ email');
    }

    // Validate email domain (MX record)
    const domainCheck = await checkEmailDomain(identifier);
    if (!domainCheck.valid) {
      throw new ValidationError(domainCheck.reason ?? 'Email không hợp lệ');
    }

    const email = identifier.toLowerCase();
    let user = await prisma.user.findUnique({ where: { email } });

    let wasCreated = false;
    let emailSent = false;
    let tempPassword: string | undefined;
    let resolvedOrganizationId: string | undefined;

    if (!user) {
      // Determine organizationId for new external user
      // Use group's companyId org if set; otherwise use addedBy's organization
      if (group.companyId) {
        resolvedOrganizationId = group.companyId;
      } else {
        const adderRole = await prisma.userRole.findFirst({ where: { userId: addedById } });
        if (!adderRole) throw new ValidationError('Không xác định được tổ chức cho người dùng mới');
        resolvedOrganizationId = adderRole.organizationId;
      }

      tempPassword = generateTempPassword();
      const passwordHash = await bcrypt.hash(tempPassword, 10);
      const fullName = email.split('@')[0];

      user = await prisma.user.create({
        data: {
          email,
          passwordHash,
          fullName,
          isExternal: true,
          mustChangePassword: true,
        },
      });

      await prisma.userRole.create({
        data: { userId: user.id, role: 'learner', organizationId: resolvedOrganizationId, assignedBy: addedById },
      });

      wasCreated = true;
    }

    // Derive companyId for GroupMember record
    const memberRole = await prisma.userRole.findFirst({
      where: { userId: user.id },
      include: { organization: { select: { id: true, companyId: true } } },
    });
    const memberCompanyId =
      memberRole?.organization.companyId ??
      memberRole?.organization.id ??
      group.companyId ??
      resolvedOrganizationId ??
      '';

    const existing = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: user.id } },
    });

    let member;
    if (existing) {
      if (existing.removedAt === null && existing.isActive) throw new ConflictError('Thành viên đã có trong nhóm');
      member = await prisma.groupMember.update({
        where: { id: existing.id },
        data: { removedAt: null, isActive: true, addedById, addedAt: new Date() },
      });
    } else {
      member = await prisma.groupMember.create({
        data: { groupId, userId: user.id, companyId: memberCompanyId, addedById },
      });
    }

    // Send invitation email (async, non-blocking)
    if (wasCreated && tempPassword) {
      const loginUrl = process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
      const courseNames = group.courses.map((gc) => gc.course.title);
      sendExternalLearnerInviteEmail(
        email,
        user.fullName,
        tempPassword,
        loginUrl,
        group.name,
        courseNames,
      ).then((result) => {
        if (!result.success) console.warn('[Email] Gửi email mời ngoài hệ thống thất bại:', result.error);
        else emailSent = true;
      }).catch((err) => console.error('[Email] External invite error:', err));
    }

    return { member, wasCreated, emailSent };
  }

  // ── Standard (manual / rule_based) flow ─────────────────────
  const user = await prisma.user.findFirst({
    where: {
      isActive: true,
      OR: [{ email: identifier }, { employeeCode: identifier }],
    },
    include: {
      roles: {
        include: { organization: { select: { companyId: true } } },
      },
    },
  });

  if (!user) throw new NotFoundError('Không tìm thấy người dùng với email hoặc mã nhân viên này');

  // Derive companyId from user roles
  const companyId =
    user.roles.find((r) => r.organization.companyId)?.organization.companyId ??
    user.roles[0]?.organizationId ??
    '';

  const existing = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId: user.id } },
  });

  if (existing) {
    if (existing.removedAt === null) throw new ConflictError('Thành viên đã có trong nhóm');
    // Re-add removed member
    return {
      member: await prisma.groupMember.update({
        where: { id: existing.id },
        data: { removedAt: null, addedById, addedAt: new Date() },
      }),
      wasCreated: false,
      emailSent: false,
    };
  }

  return {
    member: await prisma.groupMember.create({
      data: { groupId, userId: user.id, companyId, addedById },
    }),
    wasCreated: false,
    emailSent: false,
  };
}

/**
 * Toggle active/inactive status of a member in a group.
 * Inactive members remain in the group but won't see group courses.
 */
export async function toggleMemberActive(groupId: string, userId: string, isActive: boolean) {
  const member = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
  });
  if (!member || member.removedAt !== null) throw new NotFoundError('Thành viên');

  return prisma.groupMember.update({
    where: { id: member.id },
    data: { isActive },
  });
}

export async function removeMember(groupId: string, userId: string) {
  const member = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
  });
  if (!member || member.removedAt !== null) throw new NotFoundError('Thành viên');

  return prisma.groupMember.update({
    where: { id: member.id },
    data: { removedAt: new Date() },
  });
}

export async function addCourse(groupId: string, assignedById: string, courseId: string, deadline?: string) {
  const group = await prisma.learningGroup.findUnique({ where: { id: groupId } });
  if (!group) throw new NotFoundError('Learning Group');

  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) throw new NotFoundError('Khóa học');

  const existing = await prisma.groupCourse.findUnique({
    where: { groupId_courseId: { groupId, courseId } },
  });
  if (existing) throw new ConflictError('Khóa học đã được gán cho nhóm này');

  return prisma.groupCourse.create({
    data: {
      groupId,
      courseId,
      assignedById,
      deadline: deadline ? new Date(deadline) : undefined,
    },
  });
}

export async function removeCourse(groupId: string, courseId: string) {
  const gc = await prisma.groupCourse.findUnique({
    where: { groupId_courseId: { groupId, courseId } },
  });
  if (!gc) throw new NotFoundError('Khóa học trong nhóm');

  await prisma.groupCourse.delete({ where: { id: gc.id } });
}

/**
 * Sync rule-based groups: evaluate ruleJson against all active users.
 * Add matching users not in group, remove non-matching users.
 * Called by cron job or manually.
 */
export async function syncRuleBasedGroup(groupId: string, syncedById: string): Promise<{ added: number; removed: number }> {
  const group = await prisma.learningGroup.findUnique({ where: { id: groupId } });
  if (!group || group.type !== 'rule_based' || !group.ruleJson) {
    throw new ValidationError('Nhóm không phải rule-based hoặc chưa cấu hình rule');
  }

  const rule = group.ruleJson as RuleJson;

  const allUsers = await prisma.user.findMany({
    where: { isActive: true },
    select: {
      id: true,
      jobLevel: true,
      jobTitle: true,
      roles: {
        select: {
          organizationId: true,
          organization: { select: { companyId: true } },
        },
      },
    },
  });

  const currentMembers = await prisma.groupMember.findMany({
    where: { groupId, removedAt: null },
    select: { userId: true, id: true },
  });
  const currentMemberIds = new Set(currentMembers.map((m) => m.userId));

  const matchingUserIds = new Set(
    allUsers.filter((u) => userMatchesRule(u, rule)).map((u) => u.id),
  );

  let added = 0;
  let removed = 0;

  // Add new matching users
  for (const user of allUsers) {
    if (matchingUserIds.has(user.id) && !currentMemberIds.has(user.id)) {
      const companyId =
        user.roles.find((r) => r.organization.companyId)?.organization.companyId ??
        user.roles[0]?.organizationId ??
        '';

      await prisma.groupMember.upsert({
        where: { groupId_userId: { groupId, userId: user.id } },
        update: { removedAt: null, addedById: syncedById, addedAt: new Date() },
        create: { groupId, userId: user.id, companyId, addedById: syncedById },
      });
      added++;
    }
  }

  // Remove non-matching users
  for (const member of currentMembers) {
    if (!matchingUserIds.has(member.userId)) {
      await prisma.groupMember.update({
        where: { id: member.id },
        data: { removedAt: new Date() },
      });
      removed++;
    }
  }

  return { added, removed };
}
