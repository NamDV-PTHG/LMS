import { NextResponse } from 'next/server';
import { withRole } from '@/middleware/require-role';
import { enrollUserToPath } from '@/services/learning-path.service';
import { handleApiError } from '@/app/api/error-handler';

// POST /api/learning-paths/[id]/enroll  { userId }
export const POST = withRole(
  ['group_admin', 'company_admin', 'hr_manager'],
  async (req, { user, companyId, params }) => {
    try {
      const { userId } = await req.json();
      if (!userId) return NextResponse.json({ success: false, error: 'userId là bắt buộc', code: 'VALIDATION_ERROR' }, { status: 400 });
      const data = await enrollUserToPath(userId, params.id, companyId, user.id, { enrollmentType: 'MANUAL' });
      return NextResponse.json({ success: true, data }, { status: 201 });
    } catch (err) {
      return handleApiError(err);
    }
  },
);
