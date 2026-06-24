'use client';

import React, { useState } from 'react';
import type { CourseOutline } from './step-outline-editor';

interface ScriptSegment {
  segment: string;
  durationMins: number;
  content: string;
  speakerNotes?: string;
}

export interface LessonScript {
  lessonTitle: string;
  summary: string;
  script: ScriptSegment[];
  keyTakeaways: string[];
  discussionQuestions: string[];
}

interface Props {
  outline: CourseOutline;
  scripts: Record<string, LessonScript | null>;
  accessToken: string;
  onScriptGenerated: (key: string, script: LessonScript) => void;
  onNext: () => void;
  onBack: () => void;
}

function lessonKey(si: number, li: number) { return `${si}-${li}`; }

export function StepScriptReview({ outline, scripts, accessToken, onScriptGenerated, onNext, onBack }: Props) {
  const [generating, setGenerating] = useState<string | null>(null);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const generateScript = async (si: number, li: number) => {
    const key = lessonKey(si, li);
    const lesson = outline.sections[si].lessons[li];
    const section = outline.sections[si];
    setGenerating(key);

    const res = await fetch('/api/wizard/script', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({
        lessonTitle: lesson.title,
        sectionContext: section.title,
        courseObjectives: lesson.objectives,
        durationMins: lesson.estimatedMinutes,
      }),
    });
    const json = await res.json();
    if (json.success) onScriptGenerated(key, json.data);
    setGenerating(null);
  };

  const generateAll = async () => {
    for (let si = 0; si < outline.sections.length; si++) {
      for (let li = 0; li < outline.sections[si].lessons.length; li++) {
        const key = lessonKey(si, li);
        if (!scripts[key]) await generateScript(si, li);
      }
    }
  };

  const allGenerated = outline.sections.every((s, si) => s.lessons.every((_, li) => !!scripts[lessonKey(si, li)]));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {Object.values(scripts).filter(Boolean).length} / {outline.sections.reduce((s, sec) => s + sec.lessons.length, 0)} bài đã sinh script
        </p>
        <button onClick={generateAll} disabled={!!generating}
          className="text-sm px-3 py-1.5 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50">
          🤖 Sinh tất cả
        </button>
      </div>

      <div className="space-y-3">
        {outline.sections.map((section, si) => (
          <div key={si} className="border rounded-lg overflow-hidden">
            <div className="px-4 py-2 bg-gray-50 text-sm font-medium">{section.title}</div>
            <div className="divide-y">
              {section.lessons.map((lesson, li) => {
                const key = lessonKey(si, li);
                const script = scripts[key];
                const isGenerating = generating === key;
                const isExpanded = expandedKey === key;

                return (
                  <div key={li} className="p-3">
                    <div className="flex items-center gap-3">
                      <span className={`w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-xs ${script ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                        {script ? '✓' : li + 1}
                      </span>
                      <span className="flex-1 text-sm">{lesson.title}</span>
                      <span className="text-xs text-muted-foreground">{lesson.contentType} · {lesson.estimatedMinutes}p</span>

                      {lesson.contentType !== 'quiz' && (
                        <button onClick={() => script ? setExpandedKey(isExpanded ? null : key) : generateScript(si, li)}
                          disabled={isGenerating}
                          className={`text-xs px-2 py-1 rounded ${script ? 'border hover:bg-gray-50' : 'bg-purple-600 text-white hover:bg-purple-700'} disabled:opacity-50`}>
                          {isGenerating ? '...' : script ? (isExpanded ? 'Thu gọn' : 'Xem script') : 'Sinh script'}
                        </button>
                      )}
                      {lesson.contentType === 'quiz' && (
                        <span className="text-xs text-blue-500">Quiz (cấu hình sau)</span>
                      )}
                    </div>

                    {isExpanded && script && (
                      <div className="mt-3 pl-8 space-y-3">
                        <p className="text-sm text-muted-foreground italic">{script.summary}</p>
                        <div className="space-y-2">
                          {script.script.map((seg, k) => (
                            <div key={k} className="border-l-2 border-blue-200 pl-3">
                              <div className="flex justify-between text-xs text-muted-foreground">
                                <span className="font-medium">{seg.segment}</span>
                                <span>{seg.durationMins} phút</span>
                              </div>
                              <p className="text-sm mt-0.5">{seg.content}</p>
                              {seg.speakerNotes && (
                                <p className="text-xs text-orange-600 mt-0.5">📝 {seg.speakerNotes}</p>
                              )}
                            </div>
                          ))}
                        </div>
                        {script.keyTakeaways.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-gray-600">Điểm chính:</p>
                            <ul className="mt-1 space-y-0.5">
                              {script.keyTakeaways.map((t, k) => (
                                <li key={k} className="text-xs text-gray-600 flex gap-1"><span>•</span>{t}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <button onClick={onBack} className="flex-1 py-2 border rounded text-sm hover:bg-gray-50">← Quay lại</button>
        <button onClick={onNext}
          className="flex-1 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">
          Tiếp theo →
        </button>
      </div>
    </div>
  );
}
