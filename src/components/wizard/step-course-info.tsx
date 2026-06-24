'use client';

import React, { useState } from 'react';

export interface CourseInfo {
  topic: string;
  targetAudience: string;
  objectives: string[];
  durationHours: number;
  documentText?: string;
}

interface Props {
  value: CourseInfo;
  onChange: (v: CourseInfo) => void;
  onNext: () => void;
}

export function StepCourseInfo({ value, onChange, onNext }: Props) {
  const [objectiveInput, setObjectiveInput] = useState('');

  const addObjective = () => {
    if (!objectiveInput.trim()) return;
    onChange({ ...value, objectives: [...value.objectives, objectiveInput.trim()] });
    setObjectiveInput('');
  };

  const removeObjective = (i: number) => {
    onChange({ ...value, objectives: value.objectives.filter((_, idx) => idx !== i) });
  };

  const canProceed = value.topic.trim() && value.targetAudience.trim() && value.durationHours > 0;

  return (
    <div className="space-y-5">
      <div>
        <label className="text-sm font-medium text-gray-700 block mb-1">Chủ đề / Tên khóa học *</label>
        <input type="text" value={value.topic}
          onChange={(e) => onChange({ ...value, topic: e.target.value })}
          className="w-full border rounded px-3 py-2 text-sm"
          placeholder="Ví dụ: An toàn lao động trong nhà máy" />
      </div>

      <div>
        <label className="text-sm font-medium text-gray-700 block mb-1">Đối tượng học *</label>
        <input type="text" value={value.targetAudience}
          onChange={(e) => onChange({ ...value, targetAudience: e.target.value })}
          className="w-full border rounded px-3 py-2 text-sm"
          placeholder="Ví dụ: Công nhân mới vào xưởng, cấp độ cơ bản" />
      </div>

      <div>
        <label className="text-sm font-medium text-gray-700 block mb-1">Mục tiêu học tập</label>
        <div className="flex gap-2">
          <input type="text" value={objectiveInput}
            onChange={(e) => setObjectiveInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addObjective()}
            className="flex-1 border rounded px-3 py-2 text-sm"
            placeholder="Nhập mục tiêu rồi nhấn Enter..." />
          <button onClick={addObjective} className="px-3 py-2 bg-gray-100 rounded text-sm hover:bg-gray-200">+</button>
        </div>
        <ul className="mt-2 space-y-1">
          {value.objectives.map((obj, i) => (
            <li key={i} className="flex items-center gap-2 text-sm">
              <span className="text-green-500">✓</span>
              <span className="flex-1">{obj}</span>
              <button onClick={() => removeObjective(i)} className="text-red-400 hover:text-red-600 text-xs">×</button>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <label className="text-sm font-medium text-gray-700 block mb-1">Thời lượng dự kiến (giờ) *</label>
        <input type="number" min={1} max={200} value={value.durationHours}
          onChange={(e) => onChange({ ...value, durationHours: parseFloat(e.target.value) || 1 })}
          className="w-full border rounded px-3 py-2 text-sm" />
      </div>

      <div>
        <label className="text-sm font-medium text-gray-700 block mb-1">
          Tài liệu tham khảo (tùy chọn — paste nội dung văn bản)
        </label>
        <textarea value={value.documentText ?? ''}
          onChange={(e) => onChange({ ...value, documentText: e.target.value })}
          rows={4} className="w-full border rounded px-3 py-2 text-sm resize-none"
          placeholder="Paste nội dung tài liệu để AI dựa vào khi tạo outline..." />
      </div>

      <button onClick={onNext} disabled={!canProceed}
        className="w-full py-2.5 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 disabled:opacity-50">
        Tiếp theo: Tạo outline →
      </button>
    </div>
  );
}
