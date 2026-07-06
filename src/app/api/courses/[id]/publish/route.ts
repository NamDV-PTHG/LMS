import { NextResponse } from 'next/server';
import { withRole } from '@/middleware/require-role';
import { publishCourse, publishCourseSchema } from '@/services/course.service';
import { handleApiError } from '@/app/api/error-handler';
import { ValidationError } from '@/lib/errors';

/**
 * POST /api/courses/:id/publish
 *
 * Hai use case trong cùng một endpoint:
 *   1. Body rỗng hoặc không có targetCompanyIds → xuất bản khóa học (isPublished = true)
 *   2. Body có targetCompanyIds → chia sẻ khóa học với các công ty trong danh sách
 *
 * group_admin có thể làm cả hai.
 * company_admin/hr_manager/instructor chỉ xuất bản (không chia sẻ liên công ty).
 */
export const POST = withRole(
  ['group_admin', 'group_hrm', 'company_admin', 'hr_manager', 'instructor'],
  async (req, { params, user, companyId }) => {
    try {
      // Parse body — cho phép body rỗng
      let body: Record<string, unknown> = {};
      try {
        body = await req.json();
      } catch {
        // body rỗng → xuất bản đơn giản
      }

      const parsed = publishCourseSchema.safeParse(body);
      if (!parsed.success) {
        throw new ValidationError('Dữ liệu không hợp lệ', parsed.error.flatten().fieldErrors);
      }

      const result = await publishCourse(
        params!.id,
        parsed.data,
        companyId,
        user.id,
        user.roles as never,
      );

      return NextResponse.json({ success: true, data: result });
    } catch (err) {
      return handleApiError(err);
    }
  },
);
