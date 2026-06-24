import { NextResponse } from 'next/server';
import { withRole } from '@/middleware/require-role';
import { testAiConnection } from '@/services/ai-config.service';
import { handleApiError } from '@/app/api/error-handler';

export const POST = withRole(['group_admin', 'company_admin'], async (_req, { params }) => {
  try {
    const result = await testAiConnection(params!.id);
    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    return handleApiError(err);
  }
});
