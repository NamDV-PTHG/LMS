import { NextResponse } from 'next/server';
import { withRole } from '@/middleware/require-role';
import { upsertAiConfig, upsertAiConfigSchema, deleteAiConfig } from '@/services/ai-config.service';
import { handleApiError } from '@/app/api/error-handler';
import { ValidationError } from '@/lib/errors';

export const PATCH = withRole(['group_admin', 'company_admin'], async (req, { params, companyId }) => {
  try {
    const body = await req.json();
    const parsed = upsertAiConfigSchema.partial().safeParse(body);
    if (!parsed.success) throw new ValidationError('Dữ liệu không hợp lệ', parsed.error.flatten().fieldErrors);

    const cfg = await upsertAiConfig(parsed.data as Parameters<typeof upsertAiConfig>[0], companyId, params!.id);
    return NextResponse.json({ success: true, data: cfg });
  } catch (err) {
    return handleApiError(err);
  }
});

export const DELETE = withRole(['group_admin'], async (_req, { params }) => {
  try {
    await deleteAiConfig(params!.id);
    return NextResponse.json({ success: true });
  } catch (err) {
    return handleApiError(err);
  }
});
