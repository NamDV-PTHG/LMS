import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { minioClient, BUCKET_PRIVATE } from '@/lib/minio';
import { NotFoundError, ForbiddenError, ValidationError } from '@/lib/errors';
import { Readable } from 'stream';

// ── Schemas ───────────────────────────────────────────────────

export const createBankSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
});

export const createQuestionSchema = z.object({
  type: z.enum(['single_choice', 'multi_choice', 'true_false', 'fill_blank']),
  difficulty: z.enum(['easy', 'medium', 'hard']).default('medium'),
  questionText: z.string().min(5),
  options: z.array(z.object({ key: z.string(), text: z.string() })).min(2),
  correctAnswer: z.string().min(1),
  explanation: z.string().optional(),
  scorePoints: z.number().int().min(1).default(1),
  tags: z.array(z.string()).default([]),
});

export const updateQuestionSchema = createQuestionSchema.partial().extend({
  status: z.enum(['draft', 'review', 'approved', 'rejected']).optional(),
  reviewComment: z.string().optional(),
});

// ── Bank CRUD ─────────────────────────────────────────────────

export async function getQuestionBanks(companyId: string) {
  return prisma.questionBank.findMany({
    where: { ownerCompanyId: companyId },
    include: {
      _count: { select: { questions: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getQuestionBank(bankId: string, companyId: string) {
  const bank = await prisma.questionBank.findUnique({ where: { id: bankId } });
  if (!bank) throw new NotFoundError('Ngân hàng câu hỏi');
  if (bank.ownerCompanyId !== companyId) throw new ForbiddenError('Không có quyền truy cập');
  return bank;
}

export async function createQuestionBank(companyId: string, data: z.infer<typeof createBankSchema>) {
  return prisma.questionBank.create({
    data: { ownerCompanyId: companyId, name: data.name, description: data.description },
  });
}

export async function updateQuestionBank(bankId: string, companyId: string, data: z.infer<typeof createBankSchema>) {
  await getQuestionBank(bankId, companyId);
  return prisma.questionBank.update({ where: { id: bankId }, data });
}

export async function deleteQuestionBank(bankId: string, companyId: string) {
  await getQuestionBank(bankId, companyId);
  await prisma.questionBank.delete({ where: { id: bankId } });
}

// ── Question CRUD ─────────────────────────────────────────────

export interface QuestionFilter {
  type?: string;
  difficulty?: string;
  status?: string;
  tag?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export async function getQuestions(bankId: string, companyId: string, filter: QuestionFilter = {}) {
  await getQuestionBank(bankId, companyId);

  const page = filter.page ?? 1;
  const limit = Math.min(filter.limit ?? 20, 100);
  const skip = (page - 1) * limit;

  const where: Parameters<typeof prisma.question.findMany>[0]['where'] = {
    bankId,
    ...(filter.type && { type: filter.type as 'single_choice' | 'multi_choice' | 'true_false' | 'fill_blank' }),
    ...(filter.difficulty && { difficulty: filter.difficulty as 'easy' | 'medium' | 'hard' }),
    ...(filter.status && { status: filter.status }),
    ...(filter.tag && { tags: { has: filter.tag } }),
    ...(filter.search && { questionText: { contains: filter.search, mode: 'insensitive' as const } }),
  };

  const [questions, total] = await Promise.all([
    prisma.question.findMany({
      where,
      skip,
      take: limit,
      select: {
        id: true, type: true, difficulty: true, questionText: true,
        options: true, correctAnswer: true, explanation: true,
        scorePoints: true, tags: true, status: true, reviewComment: true,
        createdAt: true, sourceDocId: true,
        createdBy: { select: { fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.question.count({ where }),
  ]);

  return { questions, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function createQuestion(
  bankId: string,
  companyId: string,
  userId: string,
  data: z.infer<typeof createQuestionSchema>,
) {
  await getQuestionBank(bankId, companyId);

  return prisma.question.create({
    data: {
      bankId,
      createdById: userId,
      type: data.type,
      difficulty: data.difficulty,
      questionText: data.questionText,
      options: data.options as object[],
      correctAnswer: data.correctAnswer,
      explanation: data.explanation,
      scorePoints: data.scorePoints,
      tags: data.tags,
      status: 'draft',
    },
  });
}

export async function updateQuestion(
  questionId: string,
  companyId: string,
  data: z.infer<typeof updateQuestionSchema>,
) {
  const q = await prisma.question.findUnique({
    where: { id: questionId },
    include: { bank: true },
  });
  if (!q) throw new NotFoundError('Câu hỏi');
  if (q.bank.ownerCompanyId !== companyId) throw new ForbiddenError('Không có quyền');

  return prisma.question.update({
    where: { id: questionId },
    data: {
      ...(data.type && { type: data.type }),
      ...(data.difficulty && { difficulty: data.difficulty }),
      ...(data.questionText && { questionText: data.questionText }),
      ...(data.options && { options: data.options as object[] }),
      ...(data.correctAnswer && { correctAnswer: data.correctAnswer }),
      ...(data.explanation !== undefined && { explanation: data.explanation }),
      ...(data.scorePoints && { scorePoints: data.scorePoints }),
      ...(data.tags && { tags: data.tags }),
      ...(data.status && { status: data.status }),
      ...(data.reviewComment !== undefined && { reviewComment: data.reviewComment }),
    },
  });
}

export async function deleteQuestion(questionId: string, companyId: string) {
  const q = await prisma.question.findUnique({
    where: { id: questionId },
    include: { bank: true },
  });
  if (!q) throw new NotFoundError('Câu hỏi');
  if (q.bank.ownerCompanyId !== companyId) throw new ForbiddenError('Không có quyền');
  await prisma.question.delete({ where: { id: questionId } });
}

// ── Submit for review / Approve / Reject ─────────────────────

export async function submitForReview(questionId: string, companyId: string) {
  const q = await prisma.question.findUnique({ where: { id: questionId }, include: { bank: true } });
  if (!q) throw new NotFoundError('Câu hỏi');
  if (q.bank.ownerCompanyId !== companyId) throw new ForbiddenError('Không có quyền');
  if (q.status !== 'draft') throw new ValidationError('Chỉ câu hỏi ở trạng thái draft mới được gửi duyệt');
  return prisma.question.update({ where: { id: questionId }, data: { status: 'review' } });
}

export async function approveQuestion(questionId: string, companyId: string) {
  return updateQuestion(questionId, companyId, { status: 'approved' });
}

export async function rejectQuestion(questionId: string, companyId: string, comment: string) {
  return updateQuestion(questionId, companyId, { status: 'draft', reviewComment: comment });
}

// ── Document Import (AI generation) ──────────────────────────

export async function createImportJob(
  bankId: string,
  companyId: string,
  userId: string,
  filename: string,
  mimeType: string,
  fileBuffer: Buffer,
): Promise<string> {
  await getQuestionBank(bankId, companyId);

  const storagePath = `source-docs/${bankId}/${Date.now()}-${filename}`;

  // Upload to MinIO
  await new Promise<void>((resolve, reject) => {
    const readable = Readable.from(fileBuffer);
    minioClient.putObject(BUCKET_PRIVATE, storagePath, readable, fileBuffer.length,
      { 'Content-Type': mimeType }, (err) => err ? reject(err) : resolve());
  });

  const doc = await prisma.sourceDocument.create({
    data: {
      bankId,
      ownerCompanyId: companyId,
      filename,
      mimeType,
      storagePath,
      status: 'pending',
      uploadedById: userId,
    },
  });

  return doc.id;
}

export async function getImportJob(jobId: string, companyId: string) {
  const doc = await prisma.sourceDocument.findUnique({ where: { id: jobId } });
  if (!doc || doc.ownerCompanyId !== companyId) throw new NotFoundError('Import job');
  return doc;
}

/**
 * Called by FastAPI webhook to save generated questions and update job status.
 */
export async function saveGeneratedQuestions(
  bankId: string,
  sourceDocId: string,
  questions: Array<{
    type: string;
    content: string;
    difficulty: string;
    options: { content: string; isCorrect: boolean }[];
    correctAnswer: string;
    explanation: string;
    tags: string[];
  }>,
  error?: string,
) {
  const doc = await prisma.sourceDocument.findUnique({ where: { id: sourceDocId } });
  if (!doc) throw new NotFoundError('SourceDocument');

  if (error) {
    await prisma.sourceDocument.update({
      where: { id: sourceDocId },
      data: { status: 'failed', errorMessage: error, processedAt: new Date() },
    });
    return { saved: 0 };
  }

  // Map AI output format → Prisma format
  const typeMap: Record<string, 'single_choice' | 'multi_choice' | 'true_false' | 'fill_blank'> = {
    mcq: 'single_choice',
    single_choice: 'single_choice',
    multi_choice: 'multi_choice',
    true_false: 'true_false',
    fill_blank: 'fill_blank',
  };

  let saved = 0;
  for (const q of questions) {
    const prismaType = typeMap[q.type] ?? 'single_choice';
    const options = q.options.map((o, i) => ({
      key: String.fromCharCode(65 + i), // A, B, C...
      text: o.content,
    }));
    const correctKey = (() => {
      const idx = q.options.findIndex((o) => o.isCorrect);
      return idx >= 0 ? String.fromCharCode(65 + idx) : 'A';
    })();

    await prisma.question.create({
      data: {
        bankId,
        createdById: doc.uploadedById,
        sourceDocId,
        type: prismaType,
        difficulty: (q.difficulty as 'easy' | 'medium' | 'hard') ?? 'medium',
        questionText: q.content,
        options: options as object[],
        correctAnswer: correctKey,
        explanation: q.explanation,
        tags: q.tags ?? [],
        scorePoints: 1,
        status: 'review', // AI-generated → needs review before approve
      },
    });
    saved++;
  }

  await prisma.sourceDocument.update({
    where: { id: sourceDocId },
    data: {
      status: 'completed',
      questionsGenerated: saved,
      processedAt: new Date(),
    },
  });

  return { saved };
}
