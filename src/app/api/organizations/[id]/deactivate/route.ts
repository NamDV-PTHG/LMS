import { NextResponse } from 'next/server';
import { withRole } from '@/middleware/require-role';
import { prisma } from '@/lib/prisma';
import { handleApiError } from '@/app/api/error-handler';
import { z } from 'zod';
import { ValidationError, ForbiddenError } from '@/lib/errors';
import { invalidateOrgCache } from '@/lib/cache';

const schema = z.object({
  targetOrgId: z.string().uuid().optional(),
  migrateCourseAssignments: z.boolean().default(false),
});

/**
 * POST /api/organizations/[id]/deactivate
 *
 * Soft-deactivates an org node and all its descendants.
 * Optionally migrates learner UserRole records to another org.
 * All historical Enrollment/LessonProgress data is preserved.
 */
export const POST = withRole(
  ['group_admin', 'company_admin'],
  async (req, { params, companyId }) => {
    try {
      const orgId = params!.id;

      // Prevent deactivating the company itself
      const org = await prisma.organization.findUnique({ where: { id: orgId } });
      if (!org) throw new ForbiddenError('Không tìm thấy tổ chức');
      if (org.type === 'company' || org.type === 'group') {
        throw new ForbiddenError('Không thể vô hiệu hóa tổ chức cấp công ty hoặc tập đoàn');
      }

      const body = await req.json();
      const parsed = schema.safeParse(body);
      if (!parsed.success) throw new ValidationError('Dữ liệu không hợp lệ');

      // Get sub-tree IDs
      const subTree = await prisma.$queryRaw<{ id: string }[]>`
        WITH RECURSIVE sub AS (
          SELECT id FROM "Organization" WHERE id = ${orgId} AND "isActive" = true
          UNION ALL
          SELECT o.id FROM "Organization" o
          INNER JOIN sub ON o."parentId" = sub.id
          WHERE o."isActive" = true
        )
        SELECT id FROM sub
      `;
      const subTreeIds = subTree.map((r) => r.id);

      await prisma.$transaction(async (tx) => {
        // 1. Migrate or remove learner UserRole records
        if (parsed.data.targetOrgId) {
          await tx.$executeRaw`
            UPDATE "UserRole"
            SET "organizationId" = ${parsed.data.targetOrgId}
            WHERE "organizationId" = ANY(${subTreeIds}::uuid[])
              AND role = 'learner'
          `;
        } else {
          await tx.userRole.deleteMany({
            where: { organizationId: { in: subTreeIds }, role: 'learner' },
          });
        }

        // 2. Remove dept_head roles from deactivated orgs
        await tx.userRole.deleteMany({
          where: { organizationId: { in: subTreeIds }, role: 'dept_head' },
        });

        // 3. Optionally migrate course assignments
        if (parsed.data.migrateCourseAssignments && parsed.data.targetOrgId) {
          await tx.$executeRaw`
            UPDATE "CourseAssignment"
            SET "targetDeptId" = ${parsed.data.targetOrgId}
            WHERE "targetDeptId" = ANY(${subTreeIds}::uuid[])
          `;
        }

        // 4. Soft-deactivate all orgs in sub-tree
        await tx.organization.updateMany({
          where: { id: { in: subTreeIds } },
          data: { isActive: false },
        });
      });

      await invalidateOrgCache(companyId);

      return NextResponse.json({ success: true, data: { deactivatedCount: subTreeIds.length } });
    } catch (err) {
      return handleApiError(err);
    }
  },
);
