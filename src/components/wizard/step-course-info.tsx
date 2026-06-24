'use client';

import React, { useCallback, useRef, useState } from 'react';
import { useAuth } from '@/components/providers/auth-provider';

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

const ACCEPTED_EXTS = ['txt', 'pdf', 'docx'];
const ACCEPTED_MIME = 'text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export function StepCourseInfo({ value, onChange, onNext }: Props) {
  const { accessToken } = useAuth();
  const [objectiveInput, setObjectiveInput] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [extractedFile, setExtractedFile] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addObjective = () => {
    if (!objectiveInput.trim()) return;
    onChange({ ...value, objectives: [...value.objectives, objectiveInput.trim()] });
    setObjectiveInput('');
  };

  const removeObjective = (i: number) => {
    onChange({ ...value, objectives: value.objectives.filter((_, idx) => idx !== i) });
  };

  const processFile = useCallback(async (file: File) => {
    const ext = (file.name.split('.').pop() ?? '').toLowerCase();
    setExtractError(null);
    setExtractedFile(null);

    if (!ACCEPTED_EXTS.includes(ext)) {
      setExtractError(`Không hỗ trợ định dạng .${ext}. Vui lòng dùng TXT, PDF hoặc DOCX.`);
      return;
    }

    if (ext === 'txt') {
      // Read TXT directly in browser — no server round-trip needed
      const text = await file.text();
      onChange({ ...value, documentText: text });
      setExtractedFile(file.name);
      return;
    }

    // PDF / DOCX → server-side extraction
    setExtracting(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/wizard/extract-text', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: fd,
      });
      const json = await res.json();
      if (json.success) {
        onChange({ ...value, documentText: json.data.text });
        setExtractedFile(file.name);
      } else {
        setExtractError(json.error ?? 'Không thể trích xuất nội dung file');
      }
    } catch {
      setExtractError('Lỗi kết nối khi xử lý file');
    } finally {
      setExtracting(false);
    }
  }, [value, onChange, accessToken]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    // Reset input so the same file can be re-selected
    e.target.value = '';
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

      {/* Reference document section */}
      <div>
        <label className="text-sm font-medium text-gray-700 block mb-1">
          Tài liệu tham khảo <span className="text-gray-400 font-normal">(tùy chọn — AI sẽ dựa vào nội dung này)</span>
        </label>

        {/* Drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-lg px-4 py-5 text-center transition-colors mb-2 ${
            dragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          {extracting ? (
            <p className="text-sm text-blue-600">Đang trích xuất nội dung...</p>
          ) : (
            <>
              <p className="text-sm text-gray-500 mb-2">
                Kéo thả file vào đây hoặc{' '}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-blue-600 hover:underline font-medium"
                >
                  chọn từ máy tính
                </button>
              </p>
              <p className="text-xs text-gray-400">Hỗ trợ: TXT, PDF, DOCX — tối đa 10MB</p>
            </>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_MIME}
          className="hidden"
          onChange={handleFileChange}
        />

        {/* Extracted file badge */}
        {extractedFile && !extracting && (
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1.5 bg-green-50 border border-green-200 text-green-700 text-xs px-2.5 py-1 rounded-full">
              <span>📄</span>
              <span>{extractedFile}</span>
              <button
                onClick={() => { setExtractedFile(null); onChange({ ...value, documentText: '' }); }}
                className="text-green-400 hover:text-red-500 ml-0.5"
                title="Xóa file"
              >
                ×
              </button>
            </span>
            <span className="text-xs text-gray-400">Nội dung đã được trích xuất</span>
          </div>
        )}

        {/* Error */}
        {extractError && (
          <p className="text-xs text-red-500 mb-2">{extractError}</p>
        )}

        {/* Textarea — editable regardless of source */}
        <textarea
          value={value.documentText ?? ''}
          onChange={(e) => { onChange({ ...value, documentText: e.target.value }); setExtractedFile(null); }}
          rows={5}
          className="w-full border rounded px-3 py-2 text-sm resize-none"
          placeholder="Nội dung tài liệu sẽ xuất hiện ở đây sau khi upload, hoặc paste trực tiếp..."
        />
      </div>

      <button onClick={onNext} disabled={!canProceed}
        className="w-full py-2.5 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 disabled:opacity-50">
        Tiếp theo: Tạo outline →
      </button>
    </div>
  );
}
