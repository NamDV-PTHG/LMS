import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/middleware/require-role';
import {
  getOrganization,
  updateOrganization,
  updateOrgSchema,
} from '@/services/organization.service';
import { handleApiError } from '@/app/api/error-handler';
import { ValidationError, ForbiddenError, NotFoundError } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { invalidateOrgCache } from '@/lib/cache';

export const GET = withRole(
  ['group_admin', 'group_hrm', 'company_admin', 'hr_manager'],
  async (req, { params, user, companyId }) => {
    const isGroupAdmin = user.roles.includes('group_admin');
    const org = await getOrganization(params!.id, companyId, isGroupAdmin);
    return NextResponse.json({ success: true, data: org });
  },
);

export const PATCH = withRole(
  ['group_admin', 'company_admin'],
  async (req, { params, user, companyId }) => {
    try {
      const body = await req.json();
      const parsed = updateOrgSchema.safeParse(body);
      if (!parsed.success) {
        throw new ValidationError('Dữ liệu không hợp lệ', parsed.error.flatten().fieldErrors);
      }

      const isGroupAdmin = user.roles.includes('group_admin');
      const org = await updateOrganization(params!.id, parsed.data, companyId, isGroupAdmin);
      return NextResponse.json({ success: true, data: org });
    } catch (err) {
      return handleApiError(err);
    }
  },
);

export const DELETE = withRole(
  ['group_admin', 'company_admin'],
  async (_req, { params, companyId }) => {
    try {
      const orgId = params!.id;

      const org = await prisma.organization.findUnique({
        where: { id: orgId },
        include: {
          _count: {
            select: { children: true, users: true, deptPositions: true },
          },
        },
      });

      if (!org) throw new NotFoundError('Tổ chức');
      if (org.type === 'company' || org.type === 'group') {
        throw new ForbiddenError('Không thể xóa tổ chức cấp công ty hoặc tập đoàn');
      }

      const courseAssignmentCount = await prisma.courseAssignment.count({
        where: { targetDeptId: orgId },
      });

      const constraints: string[] = [];
      if (org._count.children > 0) constraints.push(`${org._count.children} phòng ban/nhóm con`);
      if (org._count.users > 0) constraints.push(`${org._count.users} thành viên`);
      if (org._count.deptPositions > 0) constraints.push(`${org._count.deptPositions} vị trí công việc`);
      if (courseAssignmentCount > 0) constraints.push(`${courseAssignmentCount} khóa học đang giao`);

      if (constraints.length > 0) {
        return NextResponse.json(
          {
            success: false,
            error: `Không thể xóa vì phòng ban còn: ${constraints.join(', ')}. Hãy dùng "Ngưng hoạt động" thay thế.`,
            code: 'HAS_DEPENDENCIES',
          },
          { status: 409 },
        );
      }

      await prisma.organization.delete({ where: { id: orgId } });
      await invalidateOrgCache(companyId);

      return NextResponse.json({ success: true });
    } catch (err) {
      return handleApiError(err);
    }
  },
);
