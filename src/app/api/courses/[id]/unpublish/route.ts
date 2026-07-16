import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/middleware/require-role';
import { unpublishCourse } from '@/services/course.service';
import { handleApiError } from '@/app/api/error-handler';

// POST /api/courses/[id]/unpublish — đưa khóa học về bản nháp
// Chỉ khả dụng khi enrollment count = 0; lỗi 409 nếu có học viên đang đăng ký
export const POST = withRole(
  ['group_admin', 'company_admin', 'instructor'],
  async (_req: NextRequest, { params, user, companyId }) => {
    try {
      await unpublishCourse(params!.id, companyId, user.id, user.roles);
      return NextResponse.json({ success: true, data: null });
    } catch (err) {
      return handleApiError(err);
    }
  },
);
