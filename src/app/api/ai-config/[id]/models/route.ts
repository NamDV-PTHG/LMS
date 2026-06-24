import { NextResponse } from 'next/server';
import { withRole } from '@/middleware/require-role';
import { getAiConfig, getAvailableModels } from '@/services/ai-config.service';
import { handleApiError } from '@/app/api/error-handler';

// GET /api/ai-config/:id/models — list models available on the Ollama endpoint
export const GET = withRole(['group_admin', 'company_admin'], async (_req, { params }) => {
  try {
    const cfg = await getAiConfig(params!.id);
    const models = await getAvailableModels(cfg.endpoint, cfg.apiKey ?? undefined);
    return NextResponse.json({ success: true, data: { models } });
  } catch (err) {
    return handleApiError(err);
  }
});
