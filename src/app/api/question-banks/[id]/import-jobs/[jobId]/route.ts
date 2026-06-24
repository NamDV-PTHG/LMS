import { NextResponse } from 'next/server';
import { withRole } from '@/middleware/require-role';
import { getImportJob } from '@/services/question-bank.service';
import { handleApiError } from '@/app/api/error-handler';

export const GET = withRole(['company_admin', 'hr_manager', 'instructor', 'group_admin'], async (_req, { params, companyId }) => {
  try {
    const job = await getImportJob(params!.jobId, companyId);
    return NextResponse.json({
      success: true,
      data: {
        id: job.id,
        status: job.status,
        filename: job.filename,
        totalChunks: job.totalChunks,
        processedChunks: job.processedChunks,
        questionsGenerated: job.questionsGenerated,
        errorMessage: job.errorMessage,
        uploadedAt: job.uploadedAt,
        processedAt: job.processedAt,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
});
