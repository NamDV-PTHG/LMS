import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/middleware/require-role';
import { getDeleteImpact } from '@/services/course.service';
import { handleApiError } from '@/app/api/error-handler';

// GET /api/courses/[id]/delete-impact — kiểm tra tác động trước khi xóa vĩnh viễn
export const GET = withRole(
  ['group_admin', 'company_admin', 'instructor'],
  async (_req: NextRequest, { params, user, companyId }) => {
    try {
      const data = await getDeleteImpact(params!.id, companyId, user.id, user.roles);
      return NextResponse.json({ success: true, data });
    } catch (err) {
      return handleApiError(err);
    }
  },
);
