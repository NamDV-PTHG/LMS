import { NextResponse } from 'next/server';
import { withRole } from '@/middleware/require-role';
import { updateSection } from '@/services/course.service';
import { handleApiError } from '@/app/api/error-handler';
import { z } from 'zod';
import { ValidationError } from '@/lib/errors';

const updateSectionSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
});

export const PATCH = withRole(
  ['group_admin', 'company_admin', 'instructor'],
  async (req, { params, user, companyId }) => {
    try {
      const body = await req.json();
      const parsed = updateSectionSchema.safeParse(body);
      if (!parsed.success) throw new ValidationError('Dữ liệu không hợp lệ', parsed.error.flatten().fieldErrors);
      const section = await updateSection(params!.id, params!.sId, parsed.data, companyId, user.id, user.roles);
      return NextResponse.json({ success: true, data: section });
    } catch (err) {
      return handleApiError(err);
    }
  },
);
