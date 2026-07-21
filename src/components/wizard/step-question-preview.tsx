'use client';

import React, { useState } from 'react';
import type { CourseOutline } from './step-outline-editor';
import type { LessonScript as LessonScriptType } from './step-script-review';

interface GeneratedQuestion {
  type: string;
  content: string;
  difficulty: string;
  options: { content: string; isCorrect: boolean }[];
  correctAnswer: string;
  explanation: string;
  tags: string[];
}

interface Props {
  outline: CourseOutline;
  scripts: Record<string, LessonScriptType | null>;
  accessToken: string;
  bankId: string;
  onNext: (questions: GeneratedQuestion[]) => void;
  onBack: () => void;
}

export function StepQuestionPreview({ outline, scripts, accessToken, bankId, onNext, onBack }: Props) {
  void outline; void bankId; // used by parent, not needed here
  const [questions, setQuestions] = useState<GeneratedQuestion[]>([]);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const generateQuestions = async () => {
    setGenerating(true);
    setGenerateError(null);

    // Collect all script content from step 3
    const allText = Object.values(scripts)
      .filter(Boolean)
      .flatMap((s) => s!.script.map((seg) => seg.content))
      .join('\n\n');

    try {
      const res = await fetch('/api/wizard/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          text: allText,
          questionTypes: ['mcq', 'true_false'],
          questionsPerChunk: 2,
          difficulty: 'medium',
        }),
      });

      const json = await res.json() as { success: boolean; data?: { questions: GeneratedQuestion[] }; error?: string };
      if (json.success && json.data) {
        const qs = json.data.questions ?? [];
        setQuestions(qs);
        setSelected(new Set(qs.map((_, i) => i)));
        if (qs.length === 0) {
          setGenerateError('AI không tạo được câu hỏi nào. Hãy thử lại hoặc bỏ qua bước này.');
        }
      } else {
        setGenerateError(json.error ?? 'Không thể tạo câu hỏi. Vui lòng thử lại.');
      }
    } catch {
      setGenerateError('Lỗi kết nối. Vui lòng thử lại.');
    } finally {
      setGenerating(false);
    }
  };

  const toggleSelect = (i: number) => {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  };

  const handleNext = () => {
    onNext(questions.filter((_, i) => selected.has(i)));
  };

  return (
    <div className="space-y-5">
      {questions.length === 0 ? (
        <div className="text-center py-10 space-y-3">
          {generating ? (
            <>
              <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-muted-foreground">AI đang tạo câu hỏi từ nội dung...</p>
            </>
          ) : (
            <>
              <p className="text-muted-foreground text-sm">AI sẽ sinh câu hỏi từ script bài học</p>
              <button onClick={generateQuestions}
                className="px-6 py-2.5 bg-purple-600 text-white rounded hover:bg-purple-700">
                🤖 Sinh câu hỏi
              </button>
              {generateError && (
                <p className="text-xs text-red-500 max-w-xs mx-auto">{generateError}</p>
              )}
              <p className="text-xs text-muted-foreground">Hoặc bỏ qua bước này</p>
              <button onClick={() => onNext([])} className="text-sm text-blue-500 hover:underline">Bỏ qua →</button>
            </>
          )}
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">{selected.size}/{questions.length} câu hỏi được chọn</p>
            <div className="flex gap-2">
              <button onClick={() => setSelected(new Set(questions.map((_, i) => i)))}
                className="text-xs text-blue-500 hover:underline">Chọn tất cả</button>
              <button onClick={() => setSelected(new Set())}
                className="text-xs text-gray-400 hover:underline">Bỏ chọn</button>
            </div>
          </div>

          <div className="divide-y border rounded-lg overflow-hidden">
            {questions.map((q, i) => (
              <label key={i} className="flex items-start gap-3 p-4 cursor-pointer hover:bg-gray-50">
                <input type="checkbox" checked={selected.has(i)} onChange={() => toggleSelect(i)}
                  className="mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm">{q.content}</p>
                  <div className="flex gap-2 mt-1">
                    <span className="text-xs text-muted-foreground">{q.type}</span>
                    <span className="text-xs text-muted-foreground">·</span>
                    <span className="text-xs text-muted-foreground">{q.difficulty}</span>
                  </div>
                  <p className="text-xs text-green-700 mt-0.5">✓ {q.correctAnswer}</p>
                </div>
              </label>
            ))}
          </div>
        </>
      )}

      <div className="flex gap-2">
        <button onClick={onBack} className="flex-1 py-2 border rounded text-sm hover:bg-gray-50">← Quay lại</button>
        <button onClick={handleNext}
          className="flex-1 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">
          Hoàn thành →
        </button>
      </div>
    </div>
  );
}
