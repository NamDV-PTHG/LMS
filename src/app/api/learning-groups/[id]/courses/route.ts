import { NextResponse } from 'next/server';
import { withRole } from '@/middleware/require-role';
import { addCourse, addCourseSchema } from '@/services/learning-group.service';
import { handleApiError } from '@/app/api/error-handler';
import { ValidationError } from '@/lib/errors';

export const POST = withRole(['group_admin', 'group_hrm'], async (req, { params, user }) => {
  try {
    const body = await req.json();
    const parsed = addCourseSchema.safeParse(body);
    if (!parsed.success) throw new ValidationError('Dữ liệu không hợp lệ', parsed.error.flatten().fieldErrors);

    const gc = await addCourse(params!.id, user.id, parsed.data.courseId, parsed.data.deadline);
    return NextResponse.json({ success: true, data: gc }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
});
