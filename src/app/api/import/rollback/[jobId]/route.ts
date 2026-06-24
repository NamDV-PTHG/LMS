import { NextResponse } from 'next/server';
import { withRole } from '@/middleware/require-role';
import { rollbackImport } from '@/services/import.service';
import { handleApiError } from '@/app/api/error-handler';

export const POST = withRole(
  ['group_admin', 'company_admin'],
  async (_req, { params, companyId }) => {
    try {
      await rollbackImport(params!.jobId, companyId);
      return NextResponse.json({ success: true, data: { message: 'Rollback thành công' } });
    } catch (err) {
      return handleApiError(err);
    }
  },
);
