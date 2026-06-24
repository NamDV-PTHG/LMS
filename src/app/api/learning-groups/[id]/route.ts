import { NextResponse } from 'next/server';
import { withRole } from '@/middleware/require-role';
import {
  getLearningGroup,
  updateLearningGroup,
  deleteLearningGroup,
  updateGroupSchema,
} from '@/services/learning-group.service';
import { handleApiError } from '@/app/api/error-handler';
import { ValidationError } from '@/lib/errors';

export const GET = withRole(['group_admin', 'group_hrm', 'company_admin', 'hr_manager'], async (_req, { params }) => {
  try {
    const group = await getLearningGroup(params!.id);
    return NextResponse.json({ success: true, data: group });
  } catch (err) {
    return handleApiError(err);
  }
});

export const PATCH = withRole(['group_admin', 'group_hrm', 'company_admin', 'hr_manager'], async (req, { params }) => {
  try {
    const body = await req.json();
    const parsed = updateGroupSchema.safeParse(body);
    if (!parsed.success) throw new ValidationError('Dữ liệu không hợp lệ', parsed.error.flatten().fieldErrors);

    const group = await updateLearningGroup(params!.id, parsed.data);
    return NextResponse.json({ success: true, data: group });
  } catch (err) {
    return handleApiError(err);
  }
});

export const DELETE = withRole(['group_admin'], async (_req, { params }) => {
  try {
    await deleteLearningGroup(params!.id);
    return NextResponse.json({ success: true });
  } catch (err) {
    return handleApiError(err);
  }
});
