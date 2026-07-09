import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/middleware/require-role';
import { prisma } from '@/lib/prisma';
import { getPresignedDownloadUrl } from '@/lib/minio';
import { NotFoundError, ValidationError } from '@/lib/errors';
import { handleApiError } from '@/app/api/error-handler';
import mammoth from 'mammoth';

/**
 * GET /api/assets/[id]/html-preview
 *
 * Converts a Word document (DOCX/DOC) stored in MinIO to HTML and returns it.
 * Used to display document content inline in the lesson viewer without
 * requiring learners to download the file.
 *
 * Only supports document types (DOCX, DOC). Returns 400 for other types.
 */
export const GET = withAuth(async (_req: NextRequest, { params }) => {
  try {
    const asset = await prisma.contentAsset.findUnique({ where: { id: params!.id } });
    if (!asset || !asset.isActive) throw new NotFoundError('Asset');
    if (asset.processingStatus !== 'READY') throw new ValidationError('Nội dung chưa sẵn sàng');

    const isWordDoc =
      asset.mimeType?.includes('wordprocessingml') ||
      asset.mimeType?.includes('msword') ||
      asset.mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

    if (!isWordDoc) {
      throw new ValidationError('Chỉ hỗ trợ xem trực tiếp tài liệu định dạng Word (.docx)');
    }

    // Fetch from MinIO server-side (never expose presigned URL to browser)
    const minioUrl = await getPresignedDownloadUrl(asset.storagePath);
    const res = await fetch(minioUrl);
    if (!res.ok) throw new Error('Không thể đọc tài liệu từ kho lưu trữ');

    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Convert DOCX → HTML
    const result = await mammoth.convertToHtml({ buffer });

    return NextResponse.json({
      success: true,
      data: { html: result.value, warnings: result.messages.map((m) => m.message) },
    });
  } catch (err) {
    return handleApiError(err);
  }
});
