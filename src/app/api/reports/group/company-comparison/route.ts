import { NextResponse } from 'next/server';
import { withRole } from '@/middleware/require-role';
import { getCompanyComparison } from '@/services/report.service';
import { handleApiError } from '@/app/api/error-handler';

export const GET = withRole(['group_admin', 'group_hrm'], async () => {
  try {
    const data = await getCompanyComparison();
    return NextResponse.json({ success: true, data });
  } catch (err) {
    return handleApiError(err);
  }
});
