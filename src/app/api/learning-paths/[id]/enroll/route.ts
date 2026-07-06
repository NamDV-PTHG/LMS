import { NextResponse } from 'next/server';
import { withRole } from '@/middleware/require-role';
import { enrollUserToPath } from '@/services/learning-path.service';
import { handleApiError } from '@/app/api/error-handler';
import { prisma } from '@/lib/prisma';

// POST /api/learning-paths/[id]/enroll
// Body (one of):
//   { targetType: 'user', userId: string }
//   { targetType: 'department', organizationId: string }
//   { targetType: 'company' }
export const POST = withRole(
  ['group_admin', 'company_admin', 'hr_manager', 'instructor'],
  async (req, { user, companyId, params }) => {
    try {
      const body = await req.json();
      const { targetType = 'user' } = body;

      if (targetType === 'user') {
        const { userId } = body;
        if (!userId) return NextResponse.json({ success: false, error: 'userId là bắt buộc', code: 'VALIDATION_ERROR' }, { status: 400 });
        const data = await enrollUserToPath(userId, params.id, companyId, user.id, { enrollmentType: 'MANUAL' });
        return NextResponse.json({ success: true, data }, { status: 201 });
      }

      // Bulk: find all active users in target scope
      let userWhere: Parameters<typeof prisma.user.findMany>[0]['where'];

      if (targetType === 'department') {
        const { organizationId } = body;
        if (!organizationId) return NextResponse.json({ success: false, error: 'organizationId là bắt buộc', code: 'VALIDATION_ERROR' }, { status: 400 });
        userWhere = { isActive: true, roles: { some: { organizationId } } };
      } else {
        // targetType === 'company'
        userWhere = { isActive: true, roles: { some: { organization: { OR: [{ id: companyId }, { companyId }] } } } };
      }

      const users = await prisma.user.findMany({ where: userWhere, select: { id: true } });
      let enrolled = 0;
      let skipped = 0;
      for (const u of users) {
        try {
          await enrollUserToPath(u.id, params.id, companyId, user.id, { enrollmentType: 'MANUAL' });
          enrolled++;
        } catch {
          skipped++; // already enrolled or other non-fatal error
        }
      }

      return NextResponse.json({ success: true, data: { enrolled, skipped, total: users.length } }, { status: 201 });
    } catch (err) {
      return handleApiError(err);
    }
  },
);
