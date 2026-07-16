import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/middleware/require-role';
import {
  getArchiveImpact,
  archiveCourse,
  unarchiveCourse,
} from '@/services/course.service';
import { handleApiError } from '@/app/api/error-handler';

// GET /api/courses/[id]/archive — lấy thông tin ảnh hưởng trước khi dừng
export const GET = withRole(
  ['group_admin', 'company_admin', 'instructor'],
  async (_req: NextRequest, { params, user, companyId }) => {
    try {
      const data = await getArchiveImpact(params!.id, companyId, user.id, user.roles);
      return NextResponse.json({ success: true, data });
    } catch (err) {
      return handleApiError(err);
    }
  },
);

// POST /api/courses/[id]/archive — dừng khóa học
// Body: { revokePublications?: boolean }
export const POST = withRole(
  ['group_admin', 'company_admin', 'instructor'],
  async (req: NextRequest, { params, user, companyId }) => {
    try {
      const body = await req.json().catch(() => ({}));
      const revokePublications = Boolean(body?.revokePublications);
      await archiveCourse(params!.id, companyId, user.id, user.roles, revokePublications);
      return NextResponse.json({ success: true, data: null });
    } catch (err) {
      return handleApiError(err);
    }
  },
);

// DELETE /api/courses/[id]/archive — khôi phục khóa học
export const DELETE = withRole(
  ['group_admin', 'company_admin', 'instructor'],
  async (_req: NextRequest, { params, user, companyId }) => {
    try {
      await unarchiveCourse(params!.id, companyId, user.id, user.roles);
      return NextResponse.json({ success: true, data: null });
    } catch (err) {
      return handleApiError(err);
    }
  },
);
