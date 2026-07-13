import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/middleware/require-role';
import { assignCourse, assignCourseSchema } from '@/services/course.service';
import { handleApiError } from '@/app/api/error-handler';
import { ValidationError } from '@/lib/errors';
import { prisma } from '@/lib/prisma';

export const GET = withRole(
  ['group_admin', 'company_admin', 'hr_manager'],
  async (req, { params, companyId }) => {
    try {
      const assignments = await prisma.courseAssignment.findMany({
        where: {
          courseId: params!.id,
          assignedBy: { companyId },   // chỉ lấy lịch sử giao của công ty hiện tại
        },
        include: {
          assignedBy: { select: { id: true, fullName: true } },
        },
        orderBy: { assignedAt: 'desc' },
        take: 50,
      });

      // Enrich target names
      const enriched = await Promise.all(
        assignments.map(async (a) => {
          let targetLabel = 'Toàn công ty';
          if (a.targetUserId) {
            const u = await prisma.user.findUnique({ where: { id: a.targetUserId }, select: { fullName: true, email: true } });
            targetLabel = u ? `${u.fullName} (${u.email})` : a.targetUserId;
          } else if (a.targetDeptId) {
            const org = await prisma.organization.findUnique({ where: { id: a.targetDeptId }, select: { name: true } });
            targetLabel = org ? org.name : a.targetDeptId;
          } else if (a.targetCompanyId) {
            const org = await prisma.organization.findUnique({ where: { id: a.targetCompanyId }, select: { name: true } });
            targetLabel = org ? org.name : a.targetCompanyId;
          }
          return {
            id: a.id,
            targetType: a.targetUserId ? 'user' : a.targetDeptId ? 'dept' : 'company',
            targetLabel,
            assignedBy: a.assignedBy,
            isMandatory: a.isMandatory,
            deadline: a.deadline,
            assignedAt: a.assignedAt,
          };
        }),
      );

      return NextResponse.json({ success: true, data: enriched });
    } catch (err) {
      return handleApiError(err);
    }
  },
);

export const POST = withRole(
  ['group_admin', 'company_admin', 'hr_manager'],
  async (req, { params, user, companyId }) => {
    try {
      const body = await req.json();
      const parsed = assignCourseSchema.safeParse({ ...body, courseId: params!.id });
      if (!parsed.success) throw new ValidationError('Dữ liệu không hợp lệ', parsed.error.flatten().fieldErrors);

      const assignment = await assignCourse(parsed.data, companyId, user.id);
      return NextResponse.json({ success: true, data: assignment }, { status: 201 });
    } catch (err) {
      return handleApiError(err);
    }
  },
);
