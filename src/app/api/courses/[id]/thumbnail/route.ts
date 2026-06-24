import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/middleware/require-role';
import { minioClient, BUCKET_PRIVATE } from '@/lib/minio';
import { prisma } from '@/lib/prisma';
import { handleApiError } from '@/app/api/error-handler';
import { ForbiddenError, NotFoundError } from '@/lib/errors';

/**
 * POST /api/courses/[id]/thumbnail
 * Upload ảnh thumbnail cho khóa học.
 * Accepts multipart/form-data với field "file".
 */
export const POST = withRole(
  ['group_admin', 'group_hrm', 'company_admin', 'hr_manager', 'instructor'],
  async (req: NextRequest, { params, companyId }) => {
    try {
      const courseId = params!.id;

      // Kiểm tra khóa học tồn tại và thuộc công ty này
      const course = await prisma.course.findUnique({ where: { id: courseId } });
      if (!course) throw new NotFoundError('Khóa học');
      if (course.ownerCompanyId !== companyId) throw new ForbiddenError('Không có quyền chỉnh sửa khóa học này');

      const formData = await req.formData();
      const file = formData.get('file') as File | null;

      if (!file) {
        return NextResponse.json(
          { success: false, error: 'Thiếu file ảnh', code: 'VALIDATION_ERROR' },
          { status: 400 },
        );
      }

      const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
      if (!allowed.includes(file.type)) {
        return NextResponse.json(
          { success: false, error: 'Chỉ chấp nhận ảnh JPG, PNG, WebP, GIF', code: 'VALIDATION_ERROR' },
          { status: 400 },
        );
      }

      if (file.size > 5 * 1024 * 1024) {
        return NextResponse.json(
          { success: false, error: 'Ảnh tối đa 5MB', code: 'VALIDATION_ERROR' },
          { status: 400 },
        );
      }

      const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
      const objectName = `thumbnails/courses/${courseId}/${Date.now()}.${ext}`;

      const buffer = Buffer.from(await file.arrayBuffer());
      await minioClient.putObject(BUCKET_PRIVATE, objectName, buffer, buffer.length, {
        'Content-Type': file.type,
      });

      // Presigned URL 5 năm (thumbnail ít thay đổi)
      const url = await minioClient.presignedGetObject(BUCKET_PRIVATE, objectName, 5 * 365 * 24 * 3600);

      // Cập nhật thumbnailUrl trên Course
      await prisma.course.update({
        where: { id: courseId },
        data: { thumbnailUrl: url },
      });

      return NextResponse.json({ success: true, data: { thumbnailUrl: url } });
    } catch (err) {
      return handleApiError(err);
    }
  },
);
