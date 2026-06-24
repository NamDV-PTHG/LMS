'use client';

import React, { useState } from 'react';

interface Option { key: string; text: string }

interface QuestionFormData {
  type: 'single_choice' | 'multi_choice' | 'true_false' | 'fill_blank';
  difficulty: 'easy' | 'medium' | 'hard';
  questionText: string;
  options: Option[];
  correctAnswer: string;
  explanation: string;
  tags: string;
  scorePoints: number;
}

interface QuestionFormProps {
  bankId: string;
  accessToken: string;
  onSaved: () => void;
  onCancel: () => void;
  initial?: Partial<QuestionFormData & { id: string }>;
}

const TYPE_LABELS = {
  single_choice: 'Một đáp án',
  multi_choice:  'Nhiều đáp án',
  true_false:    'Đúng / Sai',
  fill_blank:    'Điền vào chỗ trống',
};

const DEFAULT_OPTIONS: Record<string, Option[]> = {
  single_choice: [
    { key: 'A', text: '' }, { key: 'B', text: '' },
    { key: 'C', text: '' }, { key: 'D', text: '' },
  ],
  multi_choice: [
    { key: 'A', text: '' }, { key: 'B', text: '' },
    { key: 'C', text: '' }, { key: 'D', text: '' },
  ],
  true_false: [{ key: 'A', text: 'Đúng' }, { key: 'B', text: 'Sai' }],
  fill_blank: [{ key: 'A', text: '' }, { key: 'B', text: '' }],
};

export function QuestionForm({ bankId, accessToken, onSaved, onCancel, initial }: QuestionFormProps) {
  const [form, setForm] = useState<QuestionFormData>({
    type: initial?.type ?? 'single_choice',
    difficulty: initial?.difficulty ?? 'medium',
    questionText: initial?.questionText ?? '',
    options: initial?.options ?? DEFAULT_OPTIONS['single_choice'],
    correctAnswer: initial?.correctAnswer ?? 'A',
    explanation: initial?.explanation ?? '',
    tags: initial?.tags ?? '',
    scorePoints: initial?.scorePoints ?? 1,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const setType = (type: QuestionFormData['type']) => {
    setForm((f) => ({ ...f, type, options: DEFAULT_OPTIONS[type], correctAnswer: 'A' }));
  };

  const updateOption = (i: number, text: string) => {
    setForm((f) => {
      const options = [...f.options];
      options[i] = { ...options[i], text };
      return { ...f, options };
    });
  };

  const handleSave = async () => {
    if (!form.questionText.trim()) { setError('Nhập nội dung câu hỏi'); return; }
    setSaving(true);
    setError('');

    const url = initial?.id
      ? `/api/question-banks/${bankId}/questions/${initial.id}`
      : `/api/question-banks/${bankId}/questions`;

    const res = await fetch(url, {
      method: initial?.id ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({
        ...form,
        tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
      }),
    });
    const json = await res.json();
    if (json.success) {
      onSaved();
    } else {
      setError(json.error ?? 'Lỗi lưu câu hỏi');
    }
    setSaving(false);
  };

  return (
    <div className="space-y-4">
      {/* Type + Difficulty */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-600 block mb-1">Loại câu hỏi</label>
          <select value={form.type} onChange={(e) => setType(e.target.value as QuestionFormData['type'])}
            className="w-full border rounded px-3 py-2 text-sm">
            {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-600 block mb-1">Độ khó</label>
          <select value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value as 'easy' | 'medium' | 'hard' })}
            className="w-full border rounded px-3 py-2 text-sm">
            <option value="easy">Dễ</option>
            <option value="medium">Trung bình</option>
            <option value="hard">Khó</option>
          </select>
        </div>
      </div>

      {/* Question text */}
      <div>
        <label className="text-xs text-gray-600 block mb-1">Nội dung câu hỏi *</label>
        <textarea
          value={form.questionText}
          onChange={(e) => setForm({ ...form, questionText: e.target.value })}
          rows={3}
          className="w-full border rounded px-3 py-2 text-sm resize-none"
          placeholder={form.type === 'fill_blank' ? 'Điền ___ vào chỗ trống...' : 'Nhập câu hỏi...'}
        />
      </div>

      {/* Options */}
      <div>
        <label className="text-xs text-gray-600 block mb-1">Đáp án</label>
        <div className="space-y-2">
          {form.options.map((opt, i) => (
            <div key={opt.key} className="flex items-center gap-2">
              <input
                type="radio"
                name="correct"
                checked={form.correctAnswer === opt.key}
                onChange={() => setForm({ ...form, correctAnswer: opt.key })}
                className="flex-shrink-0"
              />
              <span className="font-mono text-sm w-5 text-gray-500">{opt.key}.</span>
              {form.type === 'true_false' ? (
                <span className="text-sm flex-1 py-1.5">{opt.text}</span>
              ) : (
                <input
                  type="text"
                  value={opt.text}
                  onChange={(e) => updateOption(i, e.target.value)}
                  className="flex-1 border rounded px-2 py-1.5 text-sm"
                  placeholder={`Đáp án ${opt.key}`}
                />
              )}
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-1">Chọn radio button để đánh dấu đáp án đúng</p>
      </div>

      {/* Explanation */}
      <div>
        <label className="text-xs text-gray-600 block mb-1">Giải thích (tùy chọn)</label>
        <input
          type="text"
          value={form.explanation}
          onChange={(e) => setForm({ ...form, explanation: e.target.value })}
          className="w-full border rounded px-3 py-2 text-sm"
          placeholder="Giải thích tại sao đáp án đúng..."
        />
      </div>

      {/* Tags + Score */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-600 block mb-1">Tags (cách nhau bởi dấu phẩy)</label>
          <input
            type="text"
            value={form.tags}
            onChange={(e) => setForm({ ...form, tags: e.target.value })}
            className="w-full border rounded px-3 py-2 text-sm"
            placeholder="tag1, tag2"
          />
        </div>
        <div>
          <label className="text-xs text-gray-600 block mb-1">Điểm</label>
          <input
            type="number"
            min={1}
            value={form.scorePoints}
            onChange={(e) => setForm({ ...form, scorePoints: parseInt(e.target.value) || 1 })}
            className="w-full border rounded px-3 py-2 text-sm"
          />
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2 justify-end pt-2">
        <button onClick={onCancel} className="px-4 py-2 text-sm border rounded hover:bg-gray-50">Hủy</button>
        <button onClick={handleSave} disabled={saving}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50">
          {saving ? 'Đang lưu...' : initial?.id ? 'Cập nhật' : 'Tạo câu hỏi'}
        </button>
      </div>
    </div>
  );
}
