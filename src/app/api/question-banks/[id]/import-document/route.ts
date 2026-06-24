import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/middleware/require-role';
import { createImportJob } from '@/services/question-bank.service';
import { handleApiError } from '@/app/api/error-handler';
import { ValidationError } from '@/lib/errors';

const AI_SERVICE_URL = process.env.AI_SERVICE_URL ?? 'http://localhost:8000';
const NEXTJS_API_KEY = process.env.NEXTJS_API_KEY ?? '';

const ALLOWED_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
]);

export const POST = withRole(['company_admin', 'hr_manager', 'instructor', 'group_admin'], async (req, { params, user, companyId }) => {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const questionTypes = (formData.get('questionTypes') as string) ?? 'mcq,true_false';
    const questionsPerChunk = parseInt((formData.get('questionsPerChunk') as string) ?? '3', 10);
    const difficulty = (formData.get('difficulty') as string) ?? 'medium';

    if (!file) throw new ValidationError('Thiếu file tài liệu');
    if (!ALLOWED_TYPES.has(file.type)) {
      throw new ValidationError('Chỉ hỗ trợ PDF, DOCX, PPTX');
    }
    if (file.size > 20 * 1024 * 1024) throw new ValidationError('File tối đa 20MB');

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const sourceDocId = await createImportJob(
      params!.id, companyId, user.id, file.name, file.type, fileBuffer,
    );

    // Fire-and-forget call to FastAPI
    const aiFormData = new FormData();
    aiFormData.append('file', new Blob([fileBuffer], { type: file.type }), file.name);
    aiFormData.append('source_doc_id', sourceDocId);
    aiFormData.append('bank_id', params!.id);
    aiFormData.append('question_types', questionTypes);
    aiFormData.append('questions_per_chunk', String(questionsPerChunk));
    aiFormData.append('difficulty', difficulty);

    fetch(`${AI_SERVICE_URL}/api/questions/generate-from-document`, {
      method: 'POST',
      headers: { 'X-Internal-Key': NEXTJS_API_KEY },
      body: aiFormData,
    }).catch((err) => console.error('[ImportDocument] FastAPI call failed:', err));

    return NextResponse.json({ success: true, data: { jobId: sourceDocId } }, { status: 202 });
  } catch (err) {
    return handleApiError(err);
  }
});
