import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/middleware/require-role';
import { createImportJob } from '@/services/question-bank.service';
import { processDocumentWithAI } from '@/services/ai-document-processor';
import { handleApiError } from '@/app/api/error-handler';
import { ValidationError } from '@/lib/errors';
import { prisma } from '@/lib/prisma';

const ALLOWED_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
]);

export const POST = withRole(
  ['company_admin', 'hr_manager', 'instructor', 'group_admin'],
  async (req, { params, user, companyId }) => {
    try {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      const questionTypes = ((formData.get('questionTypes') as string) ?? 'mcq,true_false')
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      const questionsPerChunk = Math.min(
        Math.max(parseInt((formData.get('questionsPerChunk') as string) ?? '3', 10), 1),
        10,
      );
      const difficulty = (formData.get('difficulty') as string) ?? 'medium';

      if (!file) throw new ValidationError('Thiếu file tài liệu');
      if (!ALLOWED_TYPES.has(file.type)) throw new ValidationError('Chỉ hỗ trợ PDF, DOCX, PPTX');
      if (file.size > 20 * 1024 * 1024) throw new ValidationError('File tối đa 20MB');

      // ── Pre-flight: verify an active AI config exists ──────────
      const aiConfig = await prisma.aiServiceConfig.findFirst({
        where: { isActive: true },
        select: { id: true, name: true },
      });
      if (!aiConfig) {
        return NextResponse.json({
          success: false,
          error:
            'Chưa có cấu hình AI nào đang hoạt động. ' +
            'Vui lòng thêm và kích hoạt cấu hình tại trang "Cấu hình AI".',
          code: 'AI_CONFIG_MISSING',
        }, { status: 503 });
      }

      const fileBuffer = Buffer.from(await file.arrayBuffer());

      // Create SourceDocument record → returns jobId for polling
      const sourceDocId = await createImportJob(
        params!.id,
        companyId,
        user.id,
        file.name,
        file.type,
        fileBuffer,
      );

      // ── Fire-and-forget: process document in background ────────
      // Runs async inside the Node.js process — no FastAPI needed.
      setImmediate(() => {
        processDocumentWithAI(
          sourceDocId,
          params!.id,
          user.id,
          fileBuffer,
          file.type,
          questionTypes,
          questionsPerChunk,
          difficulty,
        ).catch((err) => {
          console.error('[ImportDocument] Unexpected error in processor:', err);
        });
      });

      return NextResponse.json({ success: true, data: { jobId: sourceDocId } }, { status: 202 });
    } catch (err) {
      return handleApiError(err);
    }
  },
);
