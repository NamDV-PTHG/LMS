import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/middleware/require-role';
import { prisma } from '@/lib/prisma';
import { handleApiError } from '@/app/api/error-handler';
import { NotFoundError, ValidationError, ForbiddenError } from '@/lib/errors';
import { randomUUID } from 'crypto';

// ── CSV template ───────────────────────────────────────────────

const CSV_HEADER = 'question,type,option_a,option_b,option_c,option_d,correct_answer,difficulty,explanation,points';

const CSV_EXAMPLE = `"Trái đất quay quanh mặt trời mất bao nhiêu ngày?",single_choice,"365 ngày","24 giờ","30 ngày","12 tháng",A,easy,"Trái đất mất 365 ngày để hoàn thành một vòng quay quanh Mặt Trời.",1
"HTML là viết tắt của?",single_choice,"HyperText Markup Language","High Tech Modern Language","HyperText Modern Links","High Text Markup Language",A,medium,,1
"JavaScript là ngôn ngữ lập trình phía máy chủ.",true_false,"Đúng","Sai","","",B,easy,"JavaScript chủ yếu chạy ở phía client (trình duyệt), dù Node.js cho phép chạy phía server.",1
"React được phát triển bởi công ty nào?",single_choice,"Google","Microsoft","Meta (Facebook)","Amazon",C,medium,,1
"CSS là gì?",single_choice,"Cascading Style Sheets","Computer Style Syntax","Creative Style System","Cascading Syntax Styling",A,easy,,1`;

const TEMPLATE_CSV = `${CSV_HEADER}\n${CSV_EXAMPLE}`;

// ── Simple CSV parser ─────────────────────────────────────────

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');

  for (const line of lines) {
    if (!line.trim()) continue;
    const cells: string[] = [];
    let inQuotes = false;
    let current = '';

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        cells.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    cells.push(current.trim());
    rows.push(cells);
  }

  return rows;
}

// ── Route handlers ────────────────────────────────────────────

/**
 * GET /api/lessons/[lessonId]/quiz-import
 * Returns a CSV template file for instructors to fill in quiz questions.
 */
export const GET = withRole(
  ['group_admin', 'company_admin', 'hr_manager', 'instructor'],
  async (_req: NextRequest, { params }) => {
    return new NextResponse(TEMPLATE_CSV, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="quiz_import_template.csv"',
      },
    });
  },
);

/**
 * POST /api/lessons/[lessonId]/quiz-import
 * Accepts a CSV file, creates questions in a question bank, and links
 * that bank to the lesson's QuizConfig.
 *
 * CSV columns (row 1 = header, ignored):
 *   question, type, option_a, option_b, option_c, option_d,
 *   correct_answer, difficulty, explanation, points
 *
 * type: single_choice | true_false | fill_blank
 * correct_answer: A/B/C/D (single_choice), true/false (true_false), text (fill_blank)
 * difficulty: easy | medium | hard
 */
export const POST = withRole(
  ['group_admin', 'company_admin', 'hr_manager', 'instructor'],
  async (req: NextRequest, { params, user, companyId }) => {
    try {
      const lessonId = params!.lessonId;

      // Verify the lesson exists and is a quiz type
      const lesson = await prisma.lesson.findUnique({
        where: { id: lessonId },
        include: { section: { include: { course: { select: { ownerCompanyId: true, title: true } } } } },
      });
      if (!lesson) throw new NotFoundError('Bài học');
      if (lesson.contentType !== 'quiz') throw new ValidationError('Bài học này không phải dạng Quiz');

      const course = lesson.section.course;
      if (course.ownerCompanyId !== companyId && !user.roles.includes('group_admin')) {
        throw new ForbiddenError('Không có quyền chỉnh sửa bài học này');
      }

      // Parse CSV from multipart form
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      if (!file) throw new ValidationError('Thiếu file CSV');
      const bankId = formData.get('bankId') as string | null;
      if (!bankId) throw new ValidationError('Vui lòng chọn ngân hàng câu hỏi');
      const categoryId = (formData.get('categoryId') as string | null) || null;

      const text = await file.text();
      const rows = parseCSV(text);

      if (rows.length < 2) throw new ValidationError('File CSV không có dữ liệu (cần ít nhất 1 dòng câu hỏi sau dòng header)');

      // Skip header row
      const dataRows = rows.slice(1);

      const VALID_TYPES = ['single_choice', 'true_false', 'fill_blank'];
      const VALID_DIFF = ['easy', 'medium', 'hard'];

      // Parse and validate rows
      const questions: Array<{
        questionText: string;
        type: string;
        options: Array<{ id: string; label: string; content: string }>;
        correctAnswer: string;
        difficulty: string;
        explanation: string;
        scorePoints: number;
      }> = [];

      const errors: string[] = [];

      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        const rowNum = i + 2; // 1-based, account for header

        const [qText, type, optA, optB, optC, optD, correctRaw, diff, explanation, pointsRaw] = row;

        if (!qText) { errors.push(`Dòng ${rowNum}: thiếu nội dung câu hỏi`); continue; }
        if (!VALID_TYPES.includes(type)) {
          errors.push(`Dòng ${rowNum}: type "${type}" không hợp lệ (dùng single_choice, true_false, fill_blank)`);
          continue;
        }

        const difficulty = (diff ?? 'medium').toLowerCase();
        if (!VALID_DIFF.includes(difficulty)) {
          errors.push(`Dòng ${rowNum}: difficulty "${diff}" không hợp lệ (dùng easy, medium, hard)`);
          continue;
        }

        const scorePoints = parseInt(pointsRaw ?? '1', 10) || 1;

        // Build options and correctAnswer
        let options: Array<{ id: string; label: string; content: string }> = [];
        let correctAnswer = '';

        if (type === 'single_choice') {
          const labels = ['A', 'B', 'C', 'D'];
          const contents = [optA, optB, optC, optD];
          const answerLabel = (correctRaw ?? '').toUpperCase().trim();

          options = labels.map((label, idx) => ({
            id: randomUUID(),
            label,
            content: contents[idx] ?? '',
          })).filter((o) => o.content);

          if (options.length < 2) {
            errors.push(`Dòng ${rowNum}: cần ít nhất 2 đáp án cho single_choice`);
            continue;
          }

          const correctOpt = options.find((o) => o.label === answerLabel);
          if (!correctOpt) {
            errors.push(`Dòng ${rowNum}: correct_answer "${correctRaw}" không khớp với nhãn đáp án (A-D)`);
            continue;
          }
          correctAnswer = correctOpt.id;

        } else if (type === 'true_false') {
          const trueOpt = { id: randomUUID(), label: 'A', content: 'Đúng' };
          const falseOpt = { id: randomUUID(), label: 'B', content: 'Sai' };
          options = [trueOpt, falseOpt];
          const raw = (correctRaw ?? '').toLowerCase().trim();
          if (raw === 'a' || raw === 'true' || raw === 'đúng') {
            correctAnswer = trueOpt.id;
          } else if (raw === 'b' || raw === 'false' || raw === 'sai') {
            correctAnswer = falseOpt.id;
          } else {
            errors.push(`Dòng ${rowNum}: correct_answer cho true_false phải là "true/A" hoặc "false/B"`);
            continue;
          }

        } else if (type === 'fill_blank') {
          options = [];
          correctAnswer = (correctRaw ?? '').trim();
          if (!correctAnswer) {
            errors.push(`Dòng ${rowNum}: correct_answer cho fill_blank không được trống`);
            continue;
          }
        }

        questions.push({
          questionText: qText,
          type,
          options,
          correctAnswer,
          difficulty,
          explanation: explanation ?? '',
          scorePoints,
        });
      }

      if (errors.length > 0) {
        return NextResponse.json(
          { success: false, error: `Tìm thấy ${errors.length} lỗi trong file CSV`, details: errors },
          { status: 400 },
        );
      }

      if (questions.length === 0) {
        throw new ValidationError('Không có câu hỏi hợp lệ nào trong file');
      }

      // Verify the selected bank belongs to this company
      const bank = await prisma.questionBank.findFirst({
        where: { id: bankId, ownerCompanyId: companyId },
      });
      if (!bank) throw new NotFoundError('Ngân hàng câu hỏi');

      // Bulk-create questions into the selected bank
      await prisma.question.createMany({
        data: questions.map((q) => ({
          bankId: bank.id,
          createdById: user.id,
          type: q.type as never,
          difficulty: q.difficulty as never,
          questionText: q.questionText,
          options: q.options as never,
          correctAnswer: q.correctAnswer,
          explanation: q.explanation || null,
          scorePoints: q.scorePoints,
          tags: [],
          status: 'approved',
          categoryId: categoryId || null,
        })),
      });

      // Count by difficulty for quiz config
      const counts = { easy: 0, medium: 0, hard: 0 };
      for (const q of questions) counts[q.difficulty as keyof typeof counts]++;
      const total = questions.length;

      // Upsert QuizConfig linking this bank
      const existingConfig = await prisma.quizConfig.findUnique({ where: { lessonId } });
      const newBankIds = existingConfig
        ? [...new Set([...existingConfig.bankIds, bank.id])]
        : [bank.id];

      await prisma.quizConfig.upsert({
        where: { lessonId },
        update: {
          bankIds: newBankIds,
          totalQuestions: total,
          easyCount: counts.easy,
          mediumCount: counts.medium,
          hardCount: counts.hard,
        },
        create: {
          lessonId,
          bankIds: [bank.id],
          totalQuestions: total,
          easyCount: counts.easy,
          mediumCount: counts.medium,
          hardCount: counts.hard,
          passingScore: 70,
          maxAttempts: 3,
          shuffleQuestions: true,
          shuffleOptions: true,
        },
      });

      return NextResponse.json({
        success: true,
        data: {
          imported: questions.length,
          bankId: bank.id,
          bankName: bank.name,
          counts,
        },
      });
    } catch (err) {
      return handleApiError(err);
    }
  },
);
