'use client';

import React, { useState } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import { useRouter } from 'next/navigation';
import { StepCourseInfo, CourseInfo } from '@/components/wizard/step-course-info';
import { StepOutlineEditor, CourseOutline } from '@/components/wizard/step-outline-editor';
import { StepScriptReview, LessonScript } from '@/components/wizard/step-script-review';
import { StepQuestionPreview } from '@/components/wizard/step-question-preview';

const STEPS = ['Thông tin', 'Outline', 'Nội dung', 'Câu hỏi', 'Hoàn thành'];

export default function CourseWizardPage() {
  const { user, accessToken } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState(0);
  const [courseInfo, setCourseInfo] = useState<CourseInfo>({
    topic: '', targetAudience: '', objectives: [], durationHours: 4,
  });
  const [outline, setOutline] = useState<CourseOutline | null>(null);
  const [generatingOutline, setGeneratingOutline] = useState(false);
  const [scripts, setScripts] = useState<Record<string, LessonScript | null>>({});
  const [finalQuestions, setFinalQuestions] = useState<unknown[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [createdCourseId, setCreatedCourseId] = useState<string | null>(null);

  const generateOutline = async () => {
    setGeneratingOutline(true);
    const res = await fetch('/api/wizard/outline', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(courseInfo),
    });
    const json = await res.json();
    if (json.success) setOutline(json.data);
    setGeneratingOutline(false);
  };

  const handleScriptGenerated = (key: string, script: LessonScript) => {
    setScripts((s) => ({ ...s, [key]: script }));
  };

  const handleFinish = async (questions: unknown[]) => {
    if (!outline) return;
    setFinalQuestions(questions);
    setSubmitting(true);

    try {
      // Create course
      const courseRes = await fetch('/api/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          title: outline.title,
          description: outline.description,
          estimatedHours: outline.estimatedHours,
        }),
      });
      const courseJson = await courseRes.json();
      if (!courseJson.success) throw new Error(courseJson.error);
      const courseId = courseJson.data.id;

      // Create sections + lessons
      for (let si = 0; si < outline.sections.length; si++) {
        const section = outline.sections[si];
        const secRes = await fetch(`/api/courses/${courseId}/sections`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify({
            title: section.title,
            description: section.description,
            displayOrder: si + 1,
            estimatedMinutes: section.estimatedMinutes,
          }),
        });
        const secJson = await secRes.json();
        if (!secJson.success) continue;
        const sectionId = secJson.data.id;

        for (let li = 0; li < section.lessons.length; li++) {
          const lesson = section.lessons[li];
          await fetch(`/api/courses/${courseId}/sections/${sectionId}/lessons`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
            body: JSON.stringify({
              title: lesson.title,
              contentType: lesson.contentType,
              displayOrder: li + 1,
              estimatedMinutes: lesson.estimatedMinutes,
            }),
          });
        }
      }

      setCreatedCourseId(courseId);
      setStep(4);
    } catch (err) {
      console.error(err);
      alert('Lỗi tạo khóa học: ' + (err instanceof Error ? err.message : String(err)));
    }
    setSubmitting(false);
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">AI Course Wizard</h1>
        <p className="text-sm text-muted-foreground mt-1">Tạo khóa học với trợ giúp của AI</p>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-0">
        {STEPS.map((label, i) => (
          <React.Fragment key={i}>
            <div className="flex items-center gap-1.5">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${i < step ? 'bg-green-500 text-white' : i === step ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
                {i < step ? '✓' : i + 1}
              </div>
              <span className={`text-xs hidden sm:block ${i === step ? 'text-blue-600 font-medium' : 'text-gray-400'}`}>{label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 mx-1 ${i < step ? 'bg-green-400' : 'bg-gray-200'}`} />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Step content */}
      <div className="border rounded-xl p-6">
        {step === 0 && (
          <StepCourseInfo
            value={courseInfo}
            onChange={setCourseInfo}
            onNext={() => { setStep(1); generateOutline(); }}
          />
        )}

        {step === 1 && (
          <StepOutlineEditor
            outline={outline}
            generating={generatingOutline}
            onGenerate={generateOutline}
            onChange={setOutline}
            onNext={() => setStep(2)}
            onBack={() => setStep(0)}
          />
        )}

        {step === 2 && outline && (
          <StepScriptReview
            outline={outline}
            scripts={scripts}
            accessToken={accessToken!}
            onScriptGenerated={handleScriptGenerated}
            onNext={() => setStep(3)}
            onBack={() => setStep(1)}
          />
        )}

        {step === 3 && outline && (
          <StepQuestionPreview
            outline={outline}
            scripts={scripts}
            accessToken={accessToken!}
            bankId=""  // user selects bank; simplified for now
            onNext={handleFinish}
            onBack={() => setStep(2)}
          />
        )}

        {step === 4 && (
          <div className="text-center py-10 space-y-4">
            {submitting ? (
              <>
                <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-muted-foreground">Đang tạo khóa học...</p>
              </>
            ) : (
              <>
                <div className="text-6xl">🎉</div>
                <h2 className="text-xl font-bold text-green-700">Khóa học đã được tạo!</h2>
                <p className="text-sm text-muted-foreground">
                  Cấu trúc khóa học đã được tạo ở trạng thái Draft.
                  Tiếp theo: upload video/tài liệu cho từng bài học.
                </p>
                {finalQuestions.length > 0 && (
                  <p className="text-sm text-muted-foreground">
                    {finalQuestions.length} câu hỏi đã được thêm vào ngân hàng (trạng thái: Chờ duyệt)
                  </p>
                )}
                <div className="flex gap-3 justify-center">
                  {createdCourseId && (
                    <button onClick={() => router.push(`/courses/${createdCourseId}`)}
                      className="px-6 py-2.5 bg-blue-600 text-white rounded hover:bg-blue-700">
                      Vào Course Builder →
                    </button>
                  )}
                  <button onClick={() => { setStep(0); setOutline(null); setScripts({}); }}
                    className="px-6 py-2.5 border rounded hover:bg-gray-50">
                    Tạo khóa học mới
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
