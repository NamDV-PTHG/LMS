import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { NotFoundError, ForbiddenError, ValidationError, ConflictError } from '@/lib/errors';
import { updateLessonProgress } from './enrollment.service';

// ── Types ─────────────────────────────────────────────────────

interface QuizQuestion {
  id: string;
  type: string;
  difficulty: string;
  questionText: string;
  options: { key: string; text: string }[];
  scorePoints: number;
  // correctAnswer is EXCLUDED from response to client
}

interface QuizAttemptSession {
  attemptId: string;
  lessonId: string;
  questions: QuizQuestion[];
  totalQuestions: number;
  timeLimitMins?: number;
  maxScore: number;
  startedAt: string;
  expiresAt?: string;
}

// ── Schema ────────────────────────────────────────────────────

export const submitAnswersSchema = z.object({
  answers: z.record(z.string(), z.string()), // { questionId: "A" } or multi: { questionId: "A;C" }
});

// ── Defaults (fallback when no QuizConfig exists) ─────────────

const DEFAULT_TOTAL = 10;
const DEFAULT_EASY_PCT = 0.3;
const DEFAULT_MEDIUM_PCT = 0.5;
const DEFAULT_HARD_PCT = 0.2;
const DEFAULT_PASSING_SCORE = 70;
const DEFAULT_TIME_LIMIT_MINS = 30;
const DEFAULT_MAX_ATTEMPTS = 3;

// ── Category-based competency level mapping ───────────────────

/** Map weighted-correct-percent to a competency level 1–5 (Bloom-style) */
function mapPercentToLevel(pct: number): number {
  if (pct >= 80) return 5;
  if (pct >= 60) return 4;
  if (pct >= 40) return 3;
  if (pct >= 20) return 2;
  return 1;
}

const DIFFICULTY_WEIGHT: Record<string, number> = {
  easy: 1,
  medium: 2,
  hard: 3,
};

/**
 * After any quiz submission (pass or fail), update UserCompetencyProfile
 * for each QuestionCategory that has a linked competency.
 *
 * Scoring: weighted-correct% = Σ(weight × isCorrect) / Σ(weight)
 * Level mapping: <20%→L1, 20–40%→L2, 40–60%→L3, 60–80%→L4, ≥80%→L5
 * Rule: never downgrade an existing level.
 */
export async function updateCompetencyFromCategories(
  userId: string,
  questionIds: string[],
  gradedAnswers: Record<string, { isCorrect: boolean }>,
): Promise<void> {
  if (questionIds.length === 0) return;

  // Fetch questions with categoryId and difficulty
  const questions = await prisma.question.findMany({
    where: { id: { in: questionIds } },
    select: { id: true, categoryId: true, difficulty: true },
  });

  // Group by categoryId
  const categoryGroups = new Map<string, { totalWeight: number; correctWeight: number }>();
  for (const q of questions) {
    if (!q.categoryId) continue;
    const graded = gradedAnswers[q.id];
    if (!graded) continue;
    const w = DIFFICULTY_WEIGHT[q.difficulty] ?? 1;
    const entry = categoryGroups.get(q.categoryId) ?? { totalWeight: 0, correctWeight: 0 };
    entry.totalWeight += w;
    if (graded.isCorrect) entry.correctWeight += w;
    categoryGroups.set(q.categoryId, entry);
  }

  if (categoryGroups.size === 0) return;

  // Fetch categories that have a competency link
  const categories = await prisma.questionCategory.findMany({
    where: {
      id: { in: Array.from(categoryGroups.keys()) },
      competencyId: { not: null },
    },
    select: { id: true, competencyId: true },
  });

  for (const cat of categories) {
    if (!cat.competencyId) continue;
    const grp = categoryGroups.get(cat.id);
    if (!grp || grp.totalWeight === 0) continue;

    const pct = (grp.correctWeight / grp.totalWeight) * 100;
    const achievedLevel = mapPercentToLevel(pct);

    const existing = await prisma.userCompetencyProfile.findUnique({
      where: { userId_competencyId: { userId, competencyId: cat.competencyId } },
    });

    // Never downgrade
    if (!existing || existing.currentLevel < achievedLevel) {
      await prisma.userCompetencyProfile.upsert({
        where: { userId_competencyId: { userId, competencyId: cat.competencyId } },
        create: {
          userId,
          competencyId: cat.competencyId,
          currentLevel: achievedLevel,
          source: 'QUIZ',
          assessedAt: new Date(),
        },
        update: {
          currentLevel: achievedLevel,
          source: 'QUIZ',
          assessedAt: new Date(),
        },
      });
    }
  }
}

// ── Helpers ───────────────────────────────────────────────────

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function selectQuestions(
  questions: { id: string; difficulty: string; type: string; questionText: string; options: unknown; scorePoints: number }[],
  total: number,
  easyCount: number,
  mediumCount: number,
  hardCount: number,
): typeof questions {
  const easy = shuffleArray(questions.filter((q) => q.difficulty === 'easy')).slice(0, easyCount);
  const medium = shuffleArray(questions.filter((q) => q.difficulty === 'medium')).slice(0, mediumCount);
  const hard = shuffleArray(questions.filter((q) => q.difficulty === 'hard')).slice(0, hardCount);

  const selected = shuffleArray([...easy, ...medium, ...hard]);

  // If not enough by difficulty split, fill from remaining
  if (selected.length < total) {
    const used = new Set(selected.map((q) => q.id));
    const remaining = shuffleArray(questions.filter((q) => !used.has(q.id)));
    selected.push(...remaining.slice(0, total - selected.length));
  }

  return selected.slice(0, total);
}

// ── Service functions ─────────────────────────────────────────

/**
 * Start a quiz attempt for a lesson.
 * Returns question list WITHOUT correct answers.
 */
export async function startQuiz(
  lessonId: string,
  userId: string,
  enrollmentId: string,
): Promise<QuizAttemptSession> {
  // Verify enrollment
  const enrollment = await prisma.enrollment.findUnique({ where: { id: enrollmentId } });
  if (!enrollment || enrollment.userId !== userId) throw new ForbiddenError('Không có quyền làm bài này');

  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: { quizConfig: true },
  });
  if (!lesson || lesson.contentType !== 'quiz') throw new NotFoundError('Bài quiz');

  const cfg = lesson.quizConfig;

  // Check max attempts
  const maxAttempts = cfg?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const existingAttempts = await prisma.quizAttempt.count({
    where: { enrollmentId, lessonId },
  });

  if (existingAttempts >= maxAttempts) {
    throw new ConflictError(`Đã hết ${maxAttempts} lượt làm bài. Liên hệ giảng viên để mở thêm.`);
  }

  // Fetch questions — use configured bankIds or fall back to first bank owned by same company
  let allQuestions: { id: string; difficulty: string; type: string; questionText: string; options: unknown; scorePoints: number }[] = [];

  if (cfg && cfg.bankIds.length > 0) {
    const categoryFilter = cfg.filterCategoryIds && cfg.filterCategoryIds.length > 0
      ? { categoryId: { in: cfg.filterCategoryIds } }
      : {};
    allQuestions = await prisma.question.findMany({
      where: { bankId: { in: cfg.bankIds }, status: 'approved', ...categoryFilter },
      select: {
        id: true, type: true, difficulty: true,
        questionText: true, options: true, scorePoints: true,
      },
    });
  } else {
    // Fallback: find bank owned by same company as the course
    const section = await prisma.courseSection.findUnique({
      where: { id: lesson.sectionId },
      include: { course: { select: { ownerCompanyId: true } } },
    });
    if (section) {
      const bank = await prisma.questionBank.findFirst({
        where: { ownerCompanyId: section.course.ownerCompanyId },
      });
      if (bank) {
        allQuestions = await prisma.question.findMany({
          where: { bankId: bank.id, status: 'approved' },
          select: {
            id: true, type: true, difficulty: true,
            questionText: true, options: true, scorePoints: true,
          },
        });
      }
    }
  }

  const total = Math.min(cfg?.totalQuestions ?? DEFAULT_TOTAL, allQuestions.length);
  const easyCount = cfg?.easyCount ?? Math.ceil(total * DEFAULT_EASY_PCT);
  const mediumCount = cfg?.mediumCount ?? Math.ceil(total * DEFAULT_MEDIUM_PCT);
  const hardCount = cfg?.hardCount ?? Math.ceil(total * DEFAULT_HARD_PCT);

  const selected = selectQuestions(allQuestions, total, easyCount, mediumCount, hardCount);
  const maxScore = selected.reduce((sum, q) => sum + q.scorePoints, 0);
  const timeLimitMins = cfg?.timeLimitMins ?? DEFAULT_TIME_LIMIT_MINS;

  // Create attempt record
  const attempt = await prisma.quizAttempt.create({
    data: {
      enrollmentId,
      lessonId,
      score: null,
      maxScore,
      startedAt: new Date(),
      answers: { questionIds: selected.map((q) => q.id) },
    },
  });

  const expiresAt = new Date(Date.now() + timeLimitMins * 60 * 1000).toISOString();

  const shuffleOpts = cfg?.shuffleOptions ?? true;

  return {
    attemptId: attempt.id,
    lessonId,
    questions: selected.map((q) => ({
      id: q.id,
      type: q.type,
      difficulty: q.difficulty,
      questionText: q.questionText,
      options: shuffleOpts
        ? shuffleArray(q.options as { key: string; text: string }[])
        : (q.options as { key: string; text: string }[]),
      scorePoints: q.scorePoints,
    })),
    totalQuestions: selected.length,
    timeLimitMins,
    maxScore,
    startedAt: attempt.startedAt.toISOString(),
    expiresAt,
  };
}

/**
 * Submit answers and grade the quiz.
 */
export async function submitQuiz(
  attemptId: string,
  userId: string,
  companyId: string,
  submittedAnswers: Record<string, string>,
) {
  const attempt = await prisma.quizAttempt.findUnique({
    where: { id: attemptId },
    include: {
      enrollment: true,
      lesson: { include: { quizConfig: true } },
    },
  });

  if (!attempt) throw new NotFoundError('Lượt làm bài');
  if (attempt.enrollment.userId !== userId) throw new ForbiddenError('Không có quyền');
  if (attempt.submittedAt) throw new ConflictError('Bài đã được nộp rồi');

  // Check time limit from QuizConfig or default
  const timeLimitMins = attempt.lesson.quizConfig?.timeLimitMins ?? DEFAULT_TIME_LIMIT_MINS;
  const timeLimitMs = timeLimitMins * 60 * 1000;
  const elapsed = Date.now() - attempt.startedAt.getTime();
  if (elapsed > timeLimitMs + 30_000) { // 30s grace
    throw new ValidationError('Đã hết thời gian làm bài');
  }

  const passingScore = attempt.lesson.quizConfig?.passingScore ?? DEFAULT_PASSING_SCORE;

  // Get stored question IDs
  const storedAnswers = attempt.answers as { questionIds: string[] };
  const questionIds = storedAnswers.questionIds ?? [];

  // Fetch correct answers fresh from DB (never sent to client)
  const questions = await prisma.question.findMany({
    where: { id: { in: questionIds } },
    select: { id: true, correctAnswer: true, scorePoints: true },
  });

  // Grade
  let score = 0;
  const gradedAnswers: Record<string, { submitted: string; correct: string; isCorrect: boolean; points: number }> = {};

  questions.forEach((q) => {
    const submitted = (submittedAnswers[q.id] ?? '').trim().toUpperCase();
    const correct = q.correctAnswer.trim().toUpperCase();
    const isCorrect = submitted === correct;
    if (isCorrect) score += q.scorePoints;
    gradedAnswers[q.id] = { submitted, correct, isCorrect, points: isCorrect ? q.scorePoints : 0 };
  });

  const maxScore = attempt.maxScore ?? questions.reduce((s, q) => s + q.scorePoints, 0);
  const scorePct = maxScore > 0 ? (score / maxScore) * 100 : 0;
  const isPassed = scorePct >= passingScore;

  const updated = await prisma.quizAttempt.update({
    where: { id: attemptId },
    data: {
      score,
      maxScore,
      submittedAt: new Date(),
      passedAt: isPassed ? new Date() : null,
      answers: { ...storedAnswers, gradedAnswers, submitted: submittedAnswers },
    },
  });

  // Category-based competency update — always runs (pass or fail)
  // Measures per-category weighted score → updates UserCompetencyProfile level
  await updateCompetencyFromCategories(
    userId,
    questionIds,
    gradedAnswers,
  ).catch(() => {});

  // Update lesson progress if passed
  if (isPassed) {
    await updateLessonProgress(
      attempt.enrollment.courseId,
      attempt.lessonId,
      userId,
      companyId,
      { progressPct: 100, status: 'completed' },
    ).catch(() => {}); // Don't fail if progress update fails

    // Course-level competency update (via CompetencyCourseLink)
    await updateCompetencyFromQuiz(
      attempt.enrollment.courseId,
      userId,
      scorePct,
      passingScore,
    ).catch(() => {});
  }

  return {
    attemptId,
    score,
    maxScore,
    scorePct: Math.round(scorePct * 10) / 10,
    isPassed,
    passingScore,
    gradedAnswers,
    submittedAt: updated.submittedAt,
  };
}

/**
 * Update UserCompetencyProfile based on quiz score.
 * Called after a quiz is passed — never downgrades existing level.
 *
 * Level assignment by score:
 *   >= 90% of maxScore → targetLevel + 1 (capped at 5, "exceeds")
 *   >= 80%             → targetLevel ("meets")
 *   >= passingScore    → targetLevel - 1 (min 1, "approaching")
 */
export async function updateCompetencyFromQuiz(
  courseId: string,
  userId: string,
  scorePct: number,
  passingScore: number,
): Promise<void> {
  // Find competencies linked to this course
  const links = await prisma.competencyCourseLink.findMany({
    where: { courseId },
    select: { competencyId: true, targetLevel: true },
  });

  if (links.length === 0) return;

  for (const link of links) {
    let achievedLevel: number;
    if (scorePct >= 90) {
      achievedLevel = Math.min(link.targetLevel + 1, 5);
    } else if (scorePct >= 80) {
      achievedLevel = link.targetLevel;
    } else {
      achievedLevel = Math.max(link.targetLevel - 1, 1);
    }

    // Upsert — never downgrade existing level
    const existing = await prisma.userCompetencyProfile.findUnique({
      where: { userId_competencyId: { userId, competencyId: link.competencyId } },
    });

    if (!existing || existing.currentLevel < achievedLevel) {
      await prisma.userCompetencyProfile.upsert({
        where: { userId_competencyId: { userId, competencyId: link.competencyId } },
        create: {
          userId,
          competencyId: link.competencyId,
          currentLevel: achievedLevel,
          source: 'QUIZ',
          assessedAt: new Date(),
        },
        update: {
          currentLevel: achievedLevel,
          source: 'QUIZ',
          assessedAt: new Date(),
        },
      });
    }
  }
}

/**
 * Auto-submit expired quiz attempts (called by cron job).
 * Looks up QuizConfig per lesson for accurate time limit.
 */
export async function autoSubmitExpiredAttempts(): Promise<number> {
  // Use the most conservative cutoff (default 30 min) to find candidates
  const conservativeCutoff = new Date(Date.now() - DEFAULT_TIME_LIMIT_MINS * 60 * 1000 - 60_000);

  const expired = await prisma.quizAttempt.findMany({
    where: {
      submittedAt: null,
      startedAt: { lt: conservativeCutoff },
    },
    include: {
      enrollment: true,
      lesson: { include: { quizConfig: true } },
    },
  });

  let count = 0;
  for (const attempt of expired) {
    const timeLimitMins = attempt.lesson.quizConfig?.timeLimitMins ?? DEFAULT_TIME_LIMIT_MINS;
    const timeLimitMs = timeLimitMins * 60 * 1000;
    const elapsed = Date.now() - attempt.startedAt.getTime();

    if (elapsed > timeLimitMs + 60_000) {
      await prisma.quizAttempt.update({
        where: { id: attempt.id },
        data: {
          score: 0,
          submittedAt: new Date(),
          answers: { autoSubmitted: true, reason: 'time_expired' },
        },
      });
      count++;
    }
  }

  return count;
}
