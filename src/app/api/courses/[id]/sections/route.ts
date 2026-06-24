import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/middleware/require-role';
import { createSection, createSectionSchema } from '@/services/course.service';
import { handleApiError } from '@/app/api/error-handler';
import { ValidationError } from '@/lib/errors';

export const POST = withRole(
  ['group_admin', 'company_admin', 'instructor'],
  async (req, { params, user, companyId }) => {
    try {
      const body = await req.json();
      const parsed = createSectionSchema.safeParse(body);
      if (!parsed.success) throw new ValidationError('Dữ liệu không hợp lệ', parsed.error.flatten().fieldErrors);

      const section = await createSection(params!.id, parsed.data, companyId, user.id, user.roles);
      return NextResponse.json({ success: true, data: section }, { status: 201 });
    } catch (err) {
      return handleApiError(err);
    }
  },
);
