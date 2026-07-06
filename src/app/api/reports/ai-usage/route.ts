import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/middleware/require-role';
import { getAiUsageReport } from '@/services/ai-usage.service';
import { handleApiError } from '@/app/api/error-handler';

// GET /api/reports/ai-usage?from=YYYY-MM-DD&to=YYYY-MM-DD&companyId=...
export const GET = withRole(
  ['group_admin', 'company_admin', 'hr_manager'],
  async (req: NextRequest, { user, companyId: callerCompanyId }) => {
    try {
      const { searchParams } = new URL(req.url);
      const fromStr = searchParams.get('from');
      const toStr   = searchParams.get('to');

      const now = new Date();
      const from = fromStr ? new Date(fromStr) : new Date(now.getFullYear(), now.getMonth(), 1);
      const to   = toStr   ? new Date(toStr + 'T23:59:59Z') : now;

      const isGroupAdmin = user.roles.includes('group_admin');

      // group_admin can filter by specific company; company_admin is locked to their company
      const companyId = isGroupAdmin
        ? (searchParams.get('companyId') ?? undefined)
        : callerCompanyId;

      const data = await getAiUsageReport({ companyId, from, to });

      return NextResponse.json({ success: true, data });
    } catch (err) {
      return handleApiError(err);
    }
  },
);
