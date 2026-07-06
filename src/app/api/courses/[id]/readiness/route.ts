import { NextResponse } from 'next/server';
import { withRole } from '@/middleware/require-role';
import { getCourseReadiness } from '@/services/course.service';
import { handleApiError } from '@/app/api/error-handler';

/**
 * GET /api/courses/:id/readiness
 * Trả về trạng thái sẵn sàng của tất cả bài học trong khóa học.
 * Dùng để hiển thị badge trong course editor và validate trước khi xuất bản.
 */
export const GET = withRole(
  ['group_admin', 'group_hrm', 'company_admin', 'hr_manager', 'instructor'],
  async (_req, { params }) => {
    try {
      const readiness = await getCourseReadiness(params!.id);
      return NextResponse.json({ success: true, data: readiness });
    } catch (err) {
      return handleApiError(err);
    }
  },
);
