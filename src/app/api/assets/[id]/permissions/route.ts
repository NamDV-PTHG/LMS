import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/middleware/require-role';
import { setAssetPermission } from '@/services/asset.service';
import { handleApiError } from '@/app/api/error-handler';
import { z } from 'zod';
import { ValidationError } from '@/lib/errors';

const permSchema = z.object({
  organizationId: z.string().uuid(),
  canView: z.boolean().default(true),
  canDownload: z.boolean().default(false),
  expiresAt: z.string().datetime().optional(),
});

export const POST = withRole(
  ['group_admin', 'company_admin'],
  async (req, { params, user }) => {
    try {
      const body = await req.json();
      const parsed = permSchema.safeParse(body);
      if (!parsed.success) throw new ValidationError('Dữ liệu không hợp lệ', parsed.error.flatten().fieldErrors);

      const perm = await setAssetPermission(params!.id, parsed.data, user.id);
      return NextResponse.json({ success: true, data: perm });
    } catch (err) {
      return handleApiError(err);
    }
  },
);
