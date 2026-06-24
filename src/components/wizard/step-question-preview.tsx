'use client';

import React, { useState } from 'react';
import type { CourseOutline, LessonScript } from './step-outline-editor';
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
  const [questions, setQuestions] = useState<GeneratedQuestion[]>([]);
  const [generating, setGenerating] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const generateQuestions = async () => {
    setGenerating(true);
    const allText = Object.values(scripts)
      .filter(Boolean)
      .flatMap((s) => s!.script.map((seg) => seg.content))
      .join('\n\n');

    const res = await fetch(`${process.env.NEXT_PUBLIC_AI_SERVICE_URL ?? 'http://localhost:8000'}/api/questions/generate-from-text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({
        text: allText,
        bank_id: bankId,
        question_types: ['mcq', 'true_false'],
        questions_per_chunk: 2,
        difficulty: 'medium',
      }),
    });

    const json = await res.json();
    if (json.success) {
      setQuestions(json.data.questions ?? []);
      setSelected(new Set(json.data.questions.map((_: unknown, i: number) => i)));
    }
    setGenerating(false);
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
