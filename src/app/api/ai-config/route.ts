import { NextResponse } from 'next/server';
import { withRole } from '@/middleware/require-role';
import { getAiConfigs, upsertAiConfig, upsertAiConfigSchema } from '@/services/ai-config.service';
import { handleApiError } from '@/app/api/error-handler';
import { ValidationError } from '@/lib/errors';

export const GET = withRole(['group_admin', 'company_admin'], async (_req, { user, companyId }) => {
  try {
    const configs = await getAiConfigs(companyId);
    return NextResponse.json({ success: true, data: configs });
  } catch (err) {
    return handleApiError(err);
  }
});

export const POST = withRole(['group_admin', 'company_admin'], async (req, { user, companyId }) => {
  try {
    const body = await req.json();
    const parsed = upsertAiConfigSchema.safeParse(body);
    if (!parsed.success) throw new ValidationError('Dữ liệu không hợp lệ', parsed.error.flatten().fieldErrors);

    const cfg = await upsertAiConfig(parsed.data, companyId);
    return NextResponse.json({ success: true, data: cfg }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
});
