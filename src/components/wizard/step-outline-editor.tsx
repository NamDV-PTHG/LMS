'use client';

import React, { useState } from 'react';

export interface LessonOutline {
  title: string;
  contentType: string;
  estimatedMinutes: number;
  objectives: string[];
  keyPoints: string[];
}

export interface SectionOutline {
  title: string;
  description: string;
  estimatedMinutes: number;
  lessons: LessonOutline[];
}

export interface CourseOutline {
  title: string;
  description: string;
  estimatedHours: number;
  sections: SectionOutline[];
}

interface Props {
  outline: CourseOutline | null;
  generating: boolean;
  onGenerate: () => void;
  onChange: (o: CourseOutline) => void;
  onNext: () => void;
  onBack: () => void;
}

export function StepOutlineEditor({ outline, generating, onGenerate, onChange, onNext, onBack }: Props) {
  const [expandedSection, setExpandedSection] = useState<number | null>(0);

  const updateSection = (si: number, patch: Partial<SectionOutline>) => {
    if (!outline) return;
    const sections = outline.sections.map((s, i) => i === si ? { ...s, ...patch } : s);
    onChange({ ...outline, sections });
  };

  const updateLesson = (si: number, li: number, patch: Partial<LessonOutline>) => {
    if (!outline) return;
    const sections = outline.sections.map((s, i) =>
      i === si ? { ...s, lessons: s.lessons.map((l, j) => j === li ? { ...l, ...patch } : l) } : s
    );
    onChange({ ...outline, sections });
  };

  const addLesson = (si: number) => {
    if (!outline) return;
    const newLesson: LessonOutline = { title: 'Bài học mới', contentType: 'video', estimatedMinutes: 15, objectives: [], keyPoints: [] };
    updateSection(si, { lessons: [...outline.sections[si].lessons, newLesson] });
  };

  const removeLesson = (si: number, li: number) => {
    if (!outline) return;
    updateSection(si, { lessons: outline.sections[si].lessons.filter((_, j) => j !== li) });
  };

  const addSection = () => {
    if (!outline) return;
    onChange({ ...outline, sections: [...outline.sections, { title: 'Chương mới', description: '', estimatedMinutes: 60, lessons: [] }] });
  };

  return (
    <div className="space-y-5">
      {!outline && (
        <div className="text-center py-10 space-y-3">
          {generating ? (
            <>
              <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-muted-foreground">AI đang tạo outline...</p>
            </>
          ) : (
            <>
              <p className="text-muted-foreground">Nhấn để AI đề xuất cấu trúc khóa học</p>
              <button onClick={onGenerate}
                className="px-6 py-2.5 bg-blue-600 text-white rounded hover:bg-blue-700">
                🤖 Tạo outline với AI
              </button>
            </>
          )}
        </div>
      )}

      {outline && (
        <>
          {/* Course header */}
          <div className="border rounded-lg p-4 space-y-3 bg-blue-50">
            <input type="text" value={outline.title}
              onChange={(e) => onChange({ ...outline, title: e.target.value })}
              className="w-full border rounded px-3 py-2 text-sm font-semibold bg-white" />
            <textarea value={outline.description}
              onChange={(e) => onChange({ ...outline, description: e.target.value })}
              rows={2} className="w-full border rounded px-3 py-2 text-sm resize-none bg-white"
              placeholder="Mô tả khóa học..." />
          </div>

          {/* Sections */}
          <div className="space-y-3">
            {outline.sections.map((section, si) => (
              <div key={si} className="border rounded-lg overflow-hidden">
                <button onClick={() => setExpandedSection(expandedSection === si ? null : si)}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 hover:bg-gray-100 text-left">
                  <span className="text-xs font-mono text-muted-foreground w-6">S{si + 1}</span>
                  <input type="text" value={section.title}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => updateSection(si, { title: e.target.value })}
                    className="flex-1 bg-transparent font-medium text-sm border-none focus:outline-none"
                    placeholder="Tên chương..." />
                  <span className="text-xs text-muted-foreground">{section.lessons.length} bài</span>
                  <span className="text-gray-400">{expandedSection === si ? '▲' : '▼'}</span>
                </button>

                {expandedSection === si && (
                  <div className="divide-y">
                    {section.lessons.map((lesson, li) => (
                      <div key={li} className="flex items-center gap-2 px-4 py-2.5">
                        <span className="text-xs font-mono text-muted-foreground w-8">L{li + 1}</span>
                        <input type="text" value={lesson.title}
                          onChange={(e) => updateLesson(si, li, { title: e.target.value })}
                          className="flex-1 text-sm border-b border-gray-200 focus:outline-none py-0.5" />
                        <select value={lesson.contentType}
                          onChange={(e) => updateLesson(si, li, { contentType: e.target.value })}
                          className="text-xs border rounded px-1 py-0.5">
                          <option value="video">Video</option>
                          <option value="document">Tài liệu</option>
                          <option value="quiz">Quiz</option>
                          <option value="interactive">Tương tác</option>
                        </select>
                        <input type="number" min={5} value={lesson.estimatedMinutes}
                          onChange={(e) => updateLesson(si, li, { estimatedMinutes: parseInt(e.target.value) || 15 })}
                          className="text-xs border rounded px-1 py-0.5 w-12 text-center" />
                        <span className="text-xs text-muted-foreground">phút</span>
                        <button onClick={() => removeLesson(si, li)} className="text-red-400 hover:text-red-600 text-xs">×</button>
                      </div>
                    ))}
                    <div className="px-4 py-2">
                      <button onClick={() => addLesson(si)} className="text-xs text-blue-500 hover:underline">+ Thêm bài học</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <button onClick={addSection} className="text-sm text-blue-500 hover:underline">+ Thêm chương</button>
            <button onClick={onGenerate} disabled={generating}
              className="text-sm text-gray-500 hover:underline ml-auto disabled:opacity-50">
              ↺ Tạo lại với AI
            </button>
          </div>

          <div className="flex gap-2">
            <button onClick={onBack} className="flex-1 py-2 border rounded text-sm hover:bg-gray-50">← Quay lại</button>
            <button onClick={onNext} disabled={outline.sections.length === 0}
              className="flex-1 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50">
              Tiếp theo: Sinh nội dung →
            </button>
          </div>
        </>
      )}

      {outline && (
        <div className="flex gap-2">
          <button onClick={onBack} className="flex-1 py-2 border rounded text-sm hover:bg-gray-50">← Quay lại</button>
        </div>
      )}
    </div>
  );
}
