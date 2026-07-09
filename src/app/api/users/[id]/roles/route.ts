import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/middleware/require-role';
import { assignRole, assignRoleSchema } from '@/services/user.service';
import { handleApiError } from '@/app/api/error-handler';
import { ValidationError } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

export const POST = withRole(
  ['group_admin', 'company_admin', 'dept_head'],
  async (req, { params, user, companyId }) => {
    try {
      const body = await req.json();
      const parsed = assignRoleSchema.safeParse(body);
      if (!parsed.success) {
        throw new ValidationError('Dữ liệu không hợp lệ', parsed.error.flatten().fieldErrors);
      }

      const isGroupAdmin = user.roles.includes('group_admin');
      const role = await assignRole(params!.id, parsed.data, companyId, isGroupAdmin);
      return NextResponse.json({ success: true, data: role }, { status: 201 });
    } catch (err) {
      return handleApiError(err);
    }
  },
);

const removeRoleSchema = z.object({
  role: z.string(),
  organizationId: z.string().uuid(),
});

export const DELETE = withRole(
  ['group_admin', 'company_admin', 'dept_head'],
  async (req, { params }) => {
    try {
      const body = await req.json();
      const parsed = removeRoleSchema.safeParse(body);
      if (!parsed.success) {
        throw new ValidationError('Dữ liệu không hợp lệ', parsed.error.flatten().fieldErrors);
      }

      await prisma.userRole.deleteMany({
        where: {
          userId: params!.id,
          role: parsed.data.role as never,
          organizationId: parsed.data.organizationId,
        },
      });

      return NextResponse.json({ success: true });
    } catch (err) {
      return handleApiError(err);
    }
  },
);
