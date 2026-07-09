import { NextResponse } from 'next/server';
import { withRole } from '@/middleware/require-role';
import { prisma } from '@/lib/prisma';
import { handleApiError } from '@/app/api/error-handler';
import { z } from 'zod';
import { ValidationError } from '@/lib/errors';
import { invalidateOrgCache } from '@/lib/cache';

const schema = z.object({
  targetOrgId: z.string().uuid().optional(),
});

/**
 * POST /api/organizations/[id]/migrate-users
 *
 * Bulk-moves all UserRole records (role=learner) from this org + sub-tree
 * to targetOrgId. If targetOrgId is omitted, UserRole records are deleted
 * (users lose their dept membership but stay in the company).
 */
export const POST = withRole(
  ['group_admin', 'company_admin'],
  async (req, { params, companyId }) => {
    try {
      const orgId = params!.id;
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

      if (parsed.data.targetOrgId) {
        // Move all learner UserRole records to target org
        await prisma.$executeRaw`
          UPDATE "UserRole"
          SET "organizationId" = ${parsed.data.targetOrgId}
          WHERE "organizationId" = ANY(${subTreeIds}::uuid[])
            AND role = 'learner'
        `;
      } else {
        // Remove learner memberships (users not assigned to any specific dept)
        await prisma.userRole.deleteMany({
          where: {
            organizationId: { in: subTreeIds },
            role: 'learner',
          },
        });
      }

      // Also remove dept_head roles from sub-tree orgs
      await prisma.userRole.deleteMany({
        where: {
          organizationId: { in: subTreeIds },
          role: 'dept_head',
        },
      });

      await invalidateOrgCache(companyId);

      return NextResponse.json({ success: true, data: { movedCount: subTreeIds.length } });
    } catch (err) {
      return handleApiError(err);
    }
  },
);
