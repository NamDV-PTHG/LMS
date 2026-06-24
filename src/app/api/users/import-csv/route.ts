import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/middleware/require-role';
import { importUsers } from '@/services/import.service';
import { handleApiError } from '@/app/api/error-handler';
import { ValidationError } from '@/lib/errors';

export const POST = withRole(
  ['group_admin', 'company_admin'],
  async (req, { user, companyId }) => {
    try {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      if (!file) throw new ValidationError('Thiếu file');

      const buffer = Buffer.from(await file.arrayBuffer());
      const result = await importUsers(buffer, companyId, user.id);

      return NextResponse.json({ success: true, data: result }, {
        status: result.status === 'SUCCESS' ? 200 : 422,
      });
    } catch (err) {
      return handleApiError(err);
    }
  },
);
