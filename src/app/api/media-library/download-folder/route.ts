import { NextResponse } from 'next/server';
import JSZip from 'jszip';
import { withRole } from '@/middleware/require-role';
import { getFolderAssetsForDownload } from '@/services/asset.service';
import { getFolderDownloadPermission } from '@/services/media-library.service';
import { minioClient, BUCKET_PRIVATE } from '@/lib/minio';
import { handleApiError } from '@/app/api/error-handler';
import { ForbiddenError, ValidationError } from '@/lib/errors';
import { prisma } from '@/lib/prisma';

/** Convert a MinIO readable stream to a Node.js Buffer. */
async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (chunk: Buffer) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}

/**
 * POST /api/media-library/download-folder
 * body: { orgId: string }
 *
 * Creates and returns a ZIP archive of all non-video READY assets
 * within the selected org and all its descendants.
 *
 * Permission:
 *  - group_admin / group_hrm : always allowed
 *  - company_admin / hr_manager : only if group_admin has granted allowFolderDownload
 */
export const POST = withRole(
  ['company_admin', 'hr_manager', 'group_admin', 'group_hrm'],
  async (req, { user, companyId }) => {
    try {
      const body = await req.json();
      const { orgId } = body as { orgId?: string };
      if (!orgId) throw new ValidationError('Thiếu orgId');

      // Permission check for company-level roles
      const isGroupLevel = user.roles.some(r => ['group_admin', 'group_hrm'].includes(r));
      if (!isGroupLevel) {
        const perm = await getFolderDownloadPermission(companyId, user.roles as string[]);
        if (!perm.allowed) {
          throw new ForbiddenError(
            'Công ty chưa được cấp quyền tải thư mục. Vui lòng liên hệ quản trị viên tập đoàn.',
          );
        }
      }

      // Fetch folder name for ZIP filename
      const orgRow = await prisma.organization.findUnique({
        where: { id: orgId },
        select: { name: true, id: true },
      });
      const folderName = orgRow?.id === companyId ? 'Du-lieu-chung' : (orgRow?.name ?? 'thu-muc');

      // Gather all eligible assets in the subtree
      const assets = await getFolderAssetsForDownload(orgId, companyId);
      if (assets.length === 0) {
        throw new ValidationError('Thư mục này không có tài liệu nào để tải');
      }

      // Build ZIP: group by org subfolder
      const zip = new JSZip();

      await Promise.all(
        assets.map(async (asset) => {
          try {
            const stream = await minioClient.getObject(BUCKET_PRIVATE, asset.storagePath);
            const buf = await streamToBuffer(stream);

            // Determine file extension from storagePath
            const extMatch = asset.storagePath.match(/(\.[^.]+)$/);
            const ext = extMatch ? extMatch[1] : '';

            // Sanitize filename
            const safeName = asset.title.replace(/[/\\?%*:|"<>]/g, '_');
            const fileName = `${safeName}${ext}`;

            // Group into subfolder by org name (flat structure within subfolder)
            const subFolder = asset.orgName.replace(/[/\\?%*:|"<>]/g, '_');
            const folder = zip.folder(subFolder);
            if (folder) {
              folder.file(fileName, buf);
            } else {
              zip.file(fileName, buf);
            }
          } catch {
            // Skip files that can't be retrieved (e.g., not yet processed)
          }
        }),
      );

      const zipBuffer = await zip.generateAsync({
        type: 'nodebuffer',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
      });

      const safeZipName = folderName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-');

      return new NextResponse(zipBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename="${safeZipName}.zip"`,
          'Content-Length': String(zipBuffer.length),
        },
      });
    } catch (err) {
      return handleApiError(err);
    }
  },
);
