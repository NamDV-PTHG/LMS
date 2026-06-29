/**
 * ai-document-processor.ts
 *
 * Parses documents (PDF/DOCX/PPTX) to text, then calls the configured
 * OpenAI-compatible LLM to generate quiz questions.
 *
 * Runs entirely within Next.js — no FastAPI service required.
 */

import { prisma } from '@/lib/prisma';
import { markImportJobFailed } from './question-bank.service';

// ── Document parsing ────────────────────────────────────────────

async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require('pdf-parse') as (buf: Buffer) => Promise<{ text: string }>;
  const result = await pdfParse(buffer);
  return result.text;
}

async function extractTextFromDocx(buffer: Buffer): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mammoth = require('mammoth') as { extractRawText: (opts: { buffer: Buffer }) => Promise<{ value: string }> };
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

async function extractTextFromPptx(buffer: Buffer): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const JSZip = require('jszip') as { loadAsync: (buf: Buffer) => Promise<{ files: Record<string, { async: (t: 'text') => Promise<string> }> }> };
  const zip = await JSZip.loadAsync(buffer);
  const texts: string[] = [];

  for (const [path, file] of Object.entries(zip.files)) {
    if (/ppt\/slides\/slide\d+\.xml/.test(path)) {
      const xml = await file.async('text');
      // Extract text nodes <a:t>...</a:t>
      const matches = Array.from(xml.matchAll(/<a:t[^>]*>([^<]*)<\/a:t>/g));
      const slideText = matches.map((m) => m[1]).join(' ').trim();
      if (slideText.length > 10) texts.push(slideText);
    }
  }

  return texts.join('\n\n');
}

export async function extractText(buffer: Buffer, mimeType: string): Promise<string> {
  if (mimeType === 'application/pdf') return extractTextFromPdf(buffer);
  if (mimeType.includes('wordprocessingml')) return extractTextFromDocx(buffer);
  if (mimeType.includes('presentationml')) return extractTextFromPptx(buffer);
  throw new Error(`Định dạng không hỗ trợ: ${mimeType}`);
}

// ── Text chunking ───────────────────────────────────────────────

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

  // If no paragraphs, slice raw text
  if (chunks.length === 0) {
    for (let i = 0; i < text.length; i += maxChars) {
      const slice = text.slice(i, i + maxChars).trim();
      if (slice.length > 30) chunks.push(slice);
    }
  }

  return chunks;
}

// ── LLM call ───────────────────────────────────────────────────

interface RawQuestion {
  type: string;
  content: string;
  difficulty: string;
  options?: { content: string; isCorrect: boolean }[];
  correctAnswer?: string;
  explanation?: string;
  tags?: string[];
}

function buildSystemPrompt(): string {
  return (
    'You are an expert educational content creator. ' +
    'Generate quiz questions based on the provided text. ' +
    'Respond ONLY with a valid JSON array. No markdown, no explanation outside JSON.'
  );
}

function buildUserPrompt(
  chunk: string,
  questionTypes: string[],
  count: number,
  difficulty: string,
): string {
  const typeDesc: Record<string, string> = {
    mcq: 'multiple choice with 4 options (exactly 1 correct)',
    true_false: 'true/false',
    fill_blank: 'fill in the blank',
  };
  const types = questionTypes.map((t) => typeDesc[t] ?? t).join(', ');

  return (
    `Generate ${count} question(s) of type: ${types}. Difficulty: ${difficulty}.\n\n` +
    `Use the SAME LANGUAGE as the content below.\n\n` +
    `CONTENT:\n${chunk}\n\n` +
    `Return a JSON array where each element has:\n` +
    `- "type": "mcq" | "true_false" | "fill_blank"\n` +
    `- "content": question text\n` +
    `- "difficulty": "${difficulty}"\n` +
    `- "options": [{\"content\":\"...\",\"isCorrect\":bool}] — 4 for mcq, 2 for true_false (first=true,second=false), [] for fill_blank\n` +
    `- "correctAnswer": text of correct answer\n` +
    `- "explanation": short explanation\n` +
    `- "tags": topic keywords array`
  );
}

function parseJsonResponse(text: string): RawQuestion[] {
  let s = text.trim().replace(/^```(?:json)?/i, '').replace(/```\s*$/, '').trim();
  const start = s.indexOf('[');
  const end = s.lastIndexOf(']');
  if (start === -1 || end === -1) throw new Error('Phản hồi AI không chứa JSON array hợp lệ');
  s = s.slice(start, end + 1);
  const parsed = JSON.parse(s) as unknown;
  if (!Array.isArray(parsed)) throw new Error('Phản hồi AI không phải array');
  return parsed as RawQuestion[];
}

async function callLlm(
  endpoint: string,
  apiKey: string | null,
  modelName: string,
  systemPrompt: string,
  userPrompt: string,
): Promise<RawQuestion[]> {
  const base = endpoint.replace(/\/$/, '');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90_000); // 90s per chunk

  try {
    const res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: modelName,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.4,
        max_tokens: 3000,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`LLM API lỗi ${res.status}: ${errText.slice(0, 300)}`);
    }

    const json = await res.json() as { choices?: { message?: { content?: string } }[] };
    const content = json.choices?.[0]?.message?.content;
    if (!content) throw new Error('LLM trả về phản hồi trống');

    return parseJsonResponse(content);
  } finally {
    clearTimeout(timeout);
  }
}

// ── Main entry point ────────────────────────────────────────────

export async function processDocumentWithAI(
  sourceDocId: string,
  bankId: string,
  uploadedById: string,
  buffer: Buffer,
  mimeType: string,
  questionTypes: string[],
  questionsPerChunk: number,
  difficulty: string,
): Promise<void> {
  try {
    await prisma.sourceDocument.update({
      where: { id: sourceDocId },
      data: { status: 'processing' },
    });

    // ── 1. Parse document ──────────────────────────────────────
    let rawText: string;
    try {
      rawText = await extractText(buffer, mimeType);
    } catch (parseErr: unknown) {
      throw new Error(
        `Không đọc được nội dung file: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`,
      );
    }

    if (rawText.trim().length < 50) {
      throw new Error(
        'File không trích xuất được văn bản. File có thể chỉ chứa hình ảnh hoặc bị mã hoá.',
      );
    }

    // ── 2. Get active AI config ────────────────────────────────
    const aiConfig = await prisma.aiServiceConfig.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
    });

    if (!aiConfig) {
      throw new Error(
        'Chưa có cấu hình AI nào đang hoạt động. Vào trang "Cấu hình AI" để thêm và kích hoạt.',
      );
    }

    // ── 3. Split text into chunks and generate questions ────────
    const chunks = splitIntoChunks(rawText, 2000);
    const processLimit = Math.min(chunks.length, 8); // max 8 chunks to avoid rate limits

    const systemPrompt = buildSystemPrompt();
    let totalSaved = 0;

    const typeMap: Record<string, 'single_choice' | 'multi_choice' | 'true_false' | 'fill_blank'> = {
      mcq: 'single_choice',
      single_choice: 'single_choice',
      multi_choice: 'multi_choice',
      true_false: 'true_false',
      fill_blank: 'fill_blank',
    };

    for (let i = 0; i < processLimit; i++) {
      try {
        const userPrompt = buildUserPrompt(chunks[i], questionTypes, questionsPerChunk, difficulty);
        const questions = await callLlm(
          aiConfig.endpoint,
          aiConfig.apiKey ?? null,
          aiConfig.modelName,
          systemPrompt,
          userPrompt,
        );

        for (const q of questions) {
          if (!q.content || !q.type) continue;

          const prismaType = typeMap[q.type] ?? 'single_choice';
          const opts = (q.options ?? []).map((o, idx) => ({
            key: String.fromCharCode(65 + idx),
            text: o.content,
          }));

          // Resolve correct answer key
          const correctKey = (() => {
            if (prismaType === 'fill_blank') return q.correctAnswer ?? '';
            const idx = (q.options ?? []).findIndex((o) => o.isCorrect);
            if (idx >= 0) return String.fromCharCode(65 + idx);
            // Fallback: try to match correctAnswer text
            const matchIdx = (q.options ?? []).findIndex(
              (o) => o.content === q.correctAnswer,
            );
            return matchIdx >= 0 ? String.fromCharCode(65 + matchIdx) : 'A';
          })();

          await prisma.question.create({
            data: {
              bankId,
              createdById: uploadedById,
              sourceDocId,
              type: prismaType,
              difficulty: (['easy', 'medium', 'hard'].includes(q.difficulty ?? '')
                ? q.difficulty
                : difficulty) as 'easy' | 'medium' | 'hard',
              questionText: q.content,
              options: opts as object[],
              correctAnswer: correctKey,
              explanation: q.explanation ?? null,
              tags: q.tags ?? [],
              scorePoints: 1,
              status: 'review',
            },
          });
          totalSaved++;
        }

        // Update progress after each chunk
        await prisma.sourceDocument.update({
          where: { id: sourceDocId },
          data: { processedChunks: i + 1, questionsGenerated: totalSaved },
        });
      } catch (chunkErr: unknown) {
        // Log but continue with remaining chunks
        const msg = chunkErr instanceof Error ? chunkErr.message : String(chunkErr);
        console.error(`[AI Processor] Chunk ${i + 1}/${processLimit} failed: ${msg}`);
      }
    }

    if (totalSaved === 0) {
      throw new Error(
        'AI không tạo được câu hỏi nào từ tài liệu này. Vui lòng kiểm tra model và thử lại.',
      );
    }

    await prisma.sourceDocument.update({
      where: { id: sourceDocId },
      data: { status: 'completed', questionsGenerated: totalSaved, processedAt: new Date() },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[AI Processor] Document processing failed:', msg);
    await markImportJobFailed(sourceDocId, msg);
  }
}
