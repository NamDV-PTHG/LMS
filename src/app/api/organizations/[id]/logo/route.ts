import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/middleware/require-role';
import { minioClient, BUCKET_PRIVATE, getPresignedDownloadUrl } from '@/lib/minio';
import { prisma } from '@/lib/prisma';
import { handleApiError } from '@/app/api/error-handler';
import { ForbiddenError, NotFoundError } from '@/lib/errors';

/**
 * POST /api/organizations/[id]/logo
 * Upload a logo image, store it in MinIO, and save the public URL into
 * the organization's metadata.logoUrl field.
 * The logo URL is what the branding API returns for the login screen.
 */
export const POST = withRole(
  ['group_admin', 'company_admin'],
  async (req: NextRequest, { params, user, companyId }) => {
    try {
      const orgId = params!.id;
      const isGroupAdmin = user.roles.includes('group_admin');

      const org = await prisma.organization.findUnique({ where: { id: orgId } });
      if (!org || !org.isActive) throw new NotFoundError('Tổ chức');

      // company_admin can only update their own company
      if (!isGroupAdmin && org.id !== companyId && org.companyId !== companyId) {
        throw new ForbiddenError('Không có quyền cập nhật logo tổ chức này');
      }

      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      if (!file) {
        return NextResponse.json({ success: false, error: 'Thiếu file', code: 'VALIDATION_ERROR' }, { status: 400 });
      }

      const ext = (file.name.split('.').pop() ?? '').toLowerCase();
      const extToMime: Record<string, string> = {
        jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
        svg: 'image/svg+xml', webp: 'image/webp', gif: 'image/gif',
      };
      const resolvedMime = extToMime[ext] ?? file.type;

      const allowed = ['image/jpeg', 'image/png', 'image/svg+xml', 'image/webp', 'image/gif'];
      if (!allowed.includes(resolvedMime)) {
        return NextResponse.json(
          { success: false, error: 'Chỉ chấp nhận ảnh JPG, PNG, SVG, WebP, GIF', code: 'VALIDATION_ERROR' },
          { status: 400 },
        );
      }

      if (file.size > 5 * 1024 * 1024) {
        return NextResponse.json(
          { success: false, error: 'File tối đa 5MB', code: 'VALIDATION_ERROR' },
          { status: 400 },
        );
      }

      const objectName = `logos/${orgId}/${Date.now()}.${ext || 'png'}`;
      const buffer = Buffer.from(await file.arrayBuffer());

      await minioClient.putObject(BUCKET_PRIVATE, objectName, buffer, buffer.length, {
        'Content-Type': resolvedMime,
      });

      // 5-year presigned URL, rewritten to public address
      const logoUrl = await getPresignedDownloadUrl(objectName, 5 * 365 * 24 * 3600);

      // Merge logoUrl into existing metadata (preserve other keys)
      const currentMeta = (org.metadata as Record<string, unknown>) ?? {};
      await prisma.organization.update({
        where: { id: orgId },
        data: { metadata: { ...currentMeta, logoUrl } },
      });

      return NextResponse.json({ success: true, data: { logoUrl } });
    } catch (err) {
      return handleApiError(err);
    }
  },
);
