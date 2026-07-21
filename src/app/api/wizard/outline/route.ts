import { NextResponse } from 'next/server';
import { withRole } from '@/middleware/require-role';
import { handleApiError } from '@/app/api/error-handler';
import { ValidationError } from '@/lib/errors';
import { prisma } from '@/lib/prisma';

/**
 * Extracts the first complete JSON object from an LLM response using
 * bracket-matching (handles trailing text, think blocks, code fences).
 */
function extractJsonObject(text: string): string {
  // Strip thinking tokens (Qwen3-thinking, DeepSeek R1, etc.)
  let s = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  // Strip markdown code fences
  s = s.replace(/^```(?:json)?\s*/im, '').replace(/\s*```\s*$/im, '').trim();

  const start = s.indexOf('{');
  if (start === -1) throw new Error('Phản hồi AI không chứa JSON object');

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (escape) { escape = false; continue; }
    if (ch === '\\' && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) return s.slice(start, i + 1); }
  }
  throw new Error('Phản hồi AI thiếu ngoặc đóng JSON');
}

export const POST = withRole(['company_admin', 'hr_manager', 'instructor', 'group_admin'], async (req) => {
  try {
    const body = await req.json() as {
      topic?: string;
      targetAudience?: string;
      durationHours?: number;
      objectives?: string[];
      documentText?: string;
    };

    if (!body.topic || !body.targetAudience || !body.durationHours) {
      throw new ValidationError('Thiếu thông tin: topic, targetAudience, durationHours');
    }

    // Get active AI config from DB
    const aiConfig = await prisma.aiServiceConfig.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
    });
    if (!aiConfig) {
      throw new Error('Chưa có cấu hình AI nào đang hoạt động. Vào trang "Cấu hình AI" để thêm và kích hoạt.');
    }

    const docSnippet = body.documentText
      ? `\n\nTài liệu tham khảo (trích đoạn):\n${body.documentText.slice(0, 3000)}`
      : '';

    const objectives = (body.objectives ?? []).join('; ') || 'Không có';

    const userPrompt =
      `Tạo outline khóa học với thông tin sau:\n` +
      `- Chủ đề: ${body.topic}\n` +
      `- Đối tượng: ${body.targetAudience}\n` +
      `- Thời lượng: ${body.durationHours} giờ\n` +
      `- Mục tiêu: ${objectives}` +
      docSnippet +
      `\n\nTrả về ĐÚNG một JSON object, không có text nào khác:\n` +
      `{\n` +
      `  "title": "Tên khóa học",\n` +
      `  "description": "Mô tả ngắn 2-3 câu",\n` +
      `  "estimatedHours": ${body.durationHours},\n` +
      `  "sections": [\n` +
      `    {\n` +
      `      "title": "Tên chương",\n` +
      `      "description": "Mô tả chương",\n` +
      `      "estimatedMinutes": 60,\n` +
      `      "lessons": [\n` +
      `        {\n` +
      `          "title": "Tên bài học",\n` +
      `          "contentType": "video",\n` +
      `          "estimatedMinutes": 15,\n` +
      `          "objectives": ["Mục tiêu bài học"],\n` +
      `          "keyPoints": ["Điểm chính 1"]\n` +
      `        }\n` +
      `      ]\n` +
      `    }\n` +
      `  ]\n` +
      `}\n\n` +
      `Quy tắc:\n` +
      `- contentType chỉ dùng: "video" | "document" | "quiz" | "interactive"\n` +
      `- Số chương và bài học phù hợp với thời lượng ${body.durationHours} giờ (mỗi chương 3-5 bài)\n` +
      `- Ngôn ngữ của output PHẢI giống ngôn ngữ của chủ đề và tài liệu đầu vào`;

    // Call LLM directly (same pattern as ai-document-processor.ts)
    const base = aiConfig.endpoint.replace(/\/$/, '');
    const llmHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
    if (aiConfig.apiKey) llmHeaders['Authorization'] = `Bearer ${aiConfig.apiKey}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90_000);

    try {
      const llmRes = await fetch(`${base}/chat/completions`, {
        method: 'POST',
        headers: llmHeaders,
        body: JSON.stringify({
          model: aiConfig.modelName,
          messages: [
            {
              role: 'system',
              content:
                'You are an expert instructional designer. ' +
                'Respond ONLY with valid JSON — no markdown, no explanation, no trailing text.',
            },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.4,
          max_tokens: 4000,
        }),
        signal: controller.signal,
      });

      if (!llmRes.ok) {
        const errText = await llmRes.text().catch(() => '');
        throw new Error(`LLM API lỗi ${llmRes.status}: ${errText.slice(0, 200)}`);
      }

      const llmJson = await llmRes.json() as { choices?: { message?: { content?: string } }[] };
      const content = llmJson.choices?.[0]?.message?.content;
      if (!content) throw new Error('LLM trả về phản hồi trống');

      const jsonStr = extractJsonObject(content);
      const outline = JSON.parse(jsonStr) as unknown;

      return NextResponse.json({ success: true, data: outline });
    } finally {
      clearTimeout(timeout);
    }
  } catch (err) {
    return handleApiError(err);
  }
});
