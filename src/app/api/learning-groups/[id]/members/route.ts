import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withRole } from '@/middleware/require-role';
import { addMember, addMemberSchema, toggleMemberActive } from '@/services/learning-group.service';
import { handleApiError } from '@/app/api/error-handler';
import { ValidationError } from '@/lib/errors';

export const POST = withRole(['group_admin', 'group_hrm', 'company_admin', 'hr_manager'], async (req, { params, user }) => {
  try {
    const body = await req.json();
    const parsed = addMemberSchema.safeParse(body);
    if (!parsed.success) throw new ValidationError('Thiếu identifier (email hoặc mã nhân viên)');

    const result = await addMember(params!.id, user.id, parsed.data.identifier);
    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
});

const toggleActiveSchema = z.object({
  userId: z.string().uuid(),
  isActive: z.boolean(),
});

export const PATCH = withRole(['group_admin', 'group_hrm', 'company_admin', 'hr_manager'], async (req, { params }) => {
  try {
    const body = await req.json();
    const parsed = toggleActiveSchema.safeParse(body);
    if (!parsed.success) throw new ValidationError('Thiếu userId hoặc isActive');

    const member = await toggleMemberActive(params!.id, parsed.data.userId, parsed.data.isActive);
    return NextResponse.json({ success: true, data: member });
  } catch (err) {
    return handleApiError(err);
  }
});
