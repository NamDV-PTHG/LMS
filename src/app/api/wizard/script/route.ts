import { NextResponse } from 'next/server';
import { withRole } from '@/middleware/require-role';
import { handleApiError } from '@/app/api/error-handler';
import { ValidationError } from '@/lib/errors';
import { prisma } from '@/lib/prisma';

function extractJsonObject(text: string): string {
  let s = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
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
      lessonTitle?: string;
      sectionContext?: string;
      courseObjectives?: string[];
      durationMins?: number;
    };

    if (!body.lessonTitle || !body.sectionContext) {
      throw new ValidationError('Thiếu lessonTitle, sectionContext');
    }

    const aiConfig = await prisma.aiServiceConfig.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
    });
    if (!aiConfig) {
      throw new Error('Chưa có cấu hình AI nào đang hoạt động.');
    }

    const durationMins = body.durationMins ?? 15;
    const objectives = (body.courseObjectives ?? []).join('; ') || 'Không có';

    const userPrompt =
      `Tạo nội dung script bài học:\n` +
      `- Tên bài học: ${body.lessonTitle}\n` +
      `- Thuộc chương: ${body.sectionContext}\n` +
      `- Thời lượng: ${durationMins} phút\n` +
      `- Mục tiêu khóa học: ${objectives}\n\n` +
      `Trả về ĐÚNG một JSON object, không có text nào khác:\n` +
      `{\n` +
      `  "lessonTitle": "${body.lessonTitle}",\n` +
      `  "summary": "Tóm tắt bài học 2-3 câu",\n` +
      `  "script": [\n` +
      `    {\n` +
      `      "segment": "Mở đầu",\n` +
      `      "durationMins": 2,\n` +
      `      "content": "Nội dung phân đoạn này...",\n` +
      `      "speakerNotes": "Ghi chú cho người trình bày"\n` +
      `    }\n` +
      `  ],\n` +
      `  "keyTakeaways": ["Điểm chính 1", "Điểm chính 2"],\n` +
      `  "discussionQuestions": ["Câu hỏi thảo luận 1"]\n` +
      `}\n\n` +
      `Quy tắc:\n` +
      `- Chia script thành 3-5 phân đoạn (Mở đầu, Nội dung chính, Kết luận...)\n` +
      `- Tổng durationMins của các phân đoạn phải bằng ${durationMins}\n` +
      `- Ngôn ngữ PHẢI giống ngôn ngữ của tên bài học`;

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
                'You are an expert instructional designer and content writer. ' +
                'Respond ONLY with valid JSON — no markdown, no explanation, no trailing text.',
            },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.5,
          max_tokens: 3000,
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
      const script = JSON.parse(jsonStr) as unknown;

      return NextResponse.json({ success: true, data: script });
    } finally {
      clearTimeout(timeout);
    }
  } catch (err) {
    return handleApiError(err);
  }
});
