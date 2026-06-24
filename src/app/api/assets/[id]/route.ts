import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/middleware/require-role';
import { updateAsset, deleteAsset } from '@/services/asset.service';
import { handleApiError } from '@/app/api/error-handler';
import { z } from 'zod';
import { ValidationError } from '@/lib/errors';

const updateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  downloadPolicy: z.enum(['ALLOWED', 'BLOCKED', 'WATERMARK_ONLY']).optional(),
  visibility: z.enum(['DEPT_ONLY', 'COMPANY_WIDE', 'GROUP_WIDE']).optional(),
  watermarkEnabled: z.boolean().optional(),
});

export const PATCH = withAuth(async (req, { params, user, companyId }) => {
  try {
    const body = await req.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) throw new ValidationError('Dữ liệu không hợp lệ', parsed.error.flatten().fieldErrors);

    const isAdmin = user.roles.some((r) => ['group_admin', 'company_admin'].includes(r));
    const updated = await updateAsset(params!.id, user.id, companyId, isAdmin, parsed.data);
    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    return handleApiError(err);
  }
});

export const DELETE = withAuth(async (_req, { params, user, companyId }) => {
  try {
    const isAdmin = user.roles.some((r) => ['group_admin', 'company_admin'].includes(r));
    await deleteAsset(params!.id, user.id, companyId, isAdmin);
    return NextResponse.json({ success: true, data: null });
  } catch (err) {
    return handleApiError(err);
  }
});
