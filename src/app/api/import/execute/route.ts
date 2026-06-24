import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/middleware/require-role';
import {
  importOrgChart,
  importUsers,
  importJobPositions,
} from '@/services/import.service';
import { handleApiError } from '@/app/api/error-handler';
import { ValidationError } from '@/lib/errors';

export const POST = withRole(
  ['group_admin', 'company_admin'],
  async (req, { user, companyId }) => {
    try {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      const importType = formData.get('importType') as string | null;

      if (!file || !importType) throw new ValidationError('Thiếu file hoặc importType');

      const buffer = Buffer.from(await file.arrayBuffer());

      let result;
      switch (importType) {
        case 'org_chart':
          result = await importOrgChart(buffer, companyId, user.id);
          break;
        case 'users':
          result = await importUsers(buffer, companyId, user.id);
          break;
        case 'job_positions':
          result = await importJobPositions(buffer, companyId, user.id);
          break;
        default:
          throw new ValidationError(`importType không hợp lệ: ${importType}`);
      }

      return NextResponse.json({ success: true, data: result }, {
        status: result.status === 'SUCCESS' ? 200 : 422,
      });
    } catch (err) {
      return handleApiError(err);
    }
  },
);
