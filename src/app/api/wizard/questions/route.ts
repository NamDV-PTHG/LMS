import { NextResponse } from 'next/server';
import { withRole } from '@/middleware/require-role';
import { handleApiError } from '@/app/api/error-handler';
import { prisma } from '@/lib/prisma';

interface RawQuestion {
  type: string;
  content: string;
  difficulty: string;
  options?: { content: string; isCorrect: boolean }[];
  correctAnswer?: string;
  explanation?: string;
  tags?: string[];
}

/** Bracket-matching JSON array extractor — same logic as ai-document-processor.ts */
function extractJsonArray(text: string): string {
  let s = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  s = s.replace(/^```(?:json)?\s*/im, '').replace(/\s*```\s*$/im, '').trim();

  const start = s.indexOf('[');
  if (start === -1) throw new Error('Phản hồi AI không chứa JSON array');

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (escape) { escape = false; continue; }
    if (ch === '\\' && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '[') depth++;
    else if (ch === ']') { depth--; if (depth === 0) return s.slice(start, i + 1); }
  }
  throw new Error('Phản hồi AI thiếu ngoặc đóng JSON array');
}

function splitIntoChunks(text: string, maxChars = 2000): string[] {
  const chunks: string[] = [];
  const paragraphs = text.split(/\n{2,}/).filter((p) => p.trim().length > 20);
  let current = '';
  for (const para of paragraphs) {
    if ((current + para).length > maxChars && current.length > 0) {
      chunks.push(current.trim());
      current = para;
    } else {
      current += (current ? '\n\n' : '') + para;
    }
  }
  if (current.trim().length > 30) chunks.push(current.trim());
  if (chunks.length === 0) {
    for (let i = 0; i < text.length; i += maxChars) {
      const slice = text.slice(i, i + maxChars).trim();
      if (slice.length > 30) chunks.push(slice);
    }
  }
  return chunks;
}

export const POST = withRole(['company_admin', 'hr_manager', 'instructor', 'group_admin'], async (req) => {
  try {
    const body = await req.json() as {
      text?: string;
      questionTypes?: string[];
      questionsPerChunk?: number;
      difficulty?: string;
    };

    if (!body.text || body.text.trim().length < 30) {
      return NextResponse.json(
        { success: false, error: 'Không có nội dung script để sinh câu hỏi. Hãy sinh script bài học ở bước 3 trước.' },
        { status: 400 },
      );
    }

    const aiConfig = await prisma.aiServiceConfig.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
    });
    if (!aiConfig) {
      return NextResponse.json(
        { success: false, error: 'Chưa có cấu hình AI nào đang hoạt động. Vào trang "Cấu hình AI" để thêm và kích hoạt.' },
        { status: 400 },
      );
    }

    const questionTypes = body.questionTypes ?? ['mcq', 'true_false'];
    const questionsPerChunk = body.questionsPerChunk ?? 2;
    const difficulty = body.difficulty ?? 'medium';

    const typeDesc: Record<string, string> = {
      mcq: 'multiple choice with 4 options (exactly 1 correct)',
      true_false: 'true/false',
      fill_blank: 'fill in the blank',
    };
    const typesStr = questionTypes.map((t) => typeDesc[t] ?? t).join(', ');

    const chunks = splitIntoChunks(body.text, 2000).slice(0, 6); // max 6 chunks

    const base = aiConfig.endpoint.replace(/\/$/, '');
    const llmHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
    if (aiConfig.apiKey) llmHeaders['Authorization'] = `Bearer ${aiConfig.apiKey}`;

    const systemPrompt =
      'You are an expert educational content creator. ' +
      'Generate quiz questions based on the provided text. ' +
      'Respond ONLY with a valid JSON array. No markdown, no explanation outside JSON.';

    const allQuestions: RawQuestion[] = [];

    for (const chunk of chunks) {
      const userPrompt =
        `Generate ${questionsPerChunk} question(s) of type: ${typesStr}. Difficulty: ${difficulty}.\n\n` +
        `Use the SAME LANGUAGE as the content below.\n\n` +
        `CONTENT:\n${chunk}\n\n` +
        `Return a JSON array where each element has:\n` +
        `- "type": "mcq" | "true_false" | "fill_blank"\n` +
        `- "content": question text\n` +
        `- "difficulty": "${difficulty}"\n` +
        `- "options": [{"content":"...","isCorrect":bool}] — 4 for mcq, 2 for true_false (first=true,second=false), [] for fill_blank\n` +
        `- "correctAnswer": text of correct answer\n` +
        `- "explanation": short explanation\n` +
        `- "tags": topic keywords array`;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 90_000);

      try {
        const llmRes = await fetch(`${base}/chat/completions`, {
          method: 'POST',
          headers: llmHeaders,
          body: JSON.stringify({
            model: aiConfig.modelName,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
            temperature: 0.4,
            max_tokens: 3000,
          }),
          signal: controller.signal,
        });

        if (!llmRes.ok) {
          const errText = await llmRes.text().catch(() => '');
          console.error(`[wizard/questions] LLM ${llmRes.status}: ${errText.slice(0, 200)}`);
          continue;
        }

        const llmJson = await llmRes.json() as { choices?: { message?: { content?: string } }[] };
        const content = llmJson.choices?.[0]?.message?.content;
        if (!content) continue;

        const jsonStr = extractJsonArray(content);
        const parsed = JSON.parse(jsonStr) as RawQuestion[];
        if (Array.isArray(parsed)) allQuestions.push(...parsed.filter((q) => q.content && q.type));
      } catch (err) {
        console.error('[wizard/questions] chunk failed:', err);
      } finally {
        clearTimeout(timeout);
      }
    }

    return NextResponse.json({ success: true, data: { questions: allQuestions } });
  } catch (err) {
    return handleApiError(err);
  }
});
