import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withRole } from '@/middleware/require-role';
import { autoAssignOrgChart } from '@/services/organization.service';
import { handleApiError } from '@/app/api/error-handler';

const schema = z.object({
  preview: z.boolean(),
  forceReassign: z.boolean().optional().default(false),
});

export const POST = withRole(
  ['group_admin', 'company_admin'],
  async (req, { companyId }) => {
    try {
      const body = schema.parse(await req.json());
      const result = await autoAssignOrgChart(companyId, body.preview, body.forceReassign);
      return NextResponse.json({ success: true, data: result });
    } catch (err) {
      return handleApiError(err);
    }
  }
);
