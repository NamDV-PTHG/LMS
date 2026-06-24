'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/components/providers/auth-provider';
import useSWR from 'swr';

const fetcher = (url: string, token: string) =>
  fetch(url, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json());

interface Course { id: string; title: string; estimatedHours?: number; thumbnailUrl?: string }
interface Step {
  id: string;
  stepOrder: number;
  stepType: 'REQUIRED' | 'ELECTIVE' | 'ADVANCED';
  deadlineOffsetDays?: number;
  availableAfterDays?: number;
  estimatedHours?: number;
  prerequisiteStepId?: string;
  course: Course;
  prerequisiteStep?: { id: string; stepOrder: number };
}
interface LearningPath {
  id: string;
  name: string;
  description?: string;
  totalDeadlineDays?: number;
  steps: Step[];
}

const STEP_TYPE_LABELS: Record<string, string> = {
  REQUIRED: 'Bắt buộc',
  ELECTIVE: 'Tự chọn',
  ADVANCED: 'Nâng cao',
};
const STEP_TYPE_COLORS: Record<string, string> = {
  REQUIRED: 'bg-blue-100 text-blue-700',
  ELECTIVE: 'bg-green-100 text-green-700',
  ADVANCED: 'bg-purple-100 text-purple-700',
};

export default function LearningPathBuilderPage() {
  const { id } = useParams<{ id: string }>();
  const { accessToken } = useAuth();

  const { data: lpData, mutate } = useSWR(
    accessToken ? [`/api/learning-paths/${id}`, accessToken] : null,
    ([url, token]) => fetcher(url, token),
  );
  const { data: courseData } = useSWR(
    accessToken ? ['/api/courses?status=published&limit=200', accessToken] : null,
    ([url, token]) => fetcher(url, token),
  );

  const lp: LearningPath | undefined = lpData?.data;
  const courses: Course[] = courseData?.data ?? [];

  const [addForm, setAddForm] = useState<{
    courseId: string;
    stepType: 'REQUIRED' | 'ELECTIVE' | 'ADVANCED';
    deadlineOffsetDays: string;
    availableAfterDays: string;
    estimatedHours: string;
    prerequisiteStepId: string;
  }>({
    courseId: '',
    stepType: 'REQUIRED',
    deadlineOffsetDays: '',
    availableAfterDays: '',
    estimatedHours: '',
    prerequisiteStepId: '',
  });
  const [adding, setAdding] = useState(false);
  const [enrollForm, setEnrollForm] = useState({ userId: '' });
  const [showEnroll, setShowEnroll] = useState(false);
  const [enrolling, setEnrolling] = useState(false);

  const handleAddStep = async () => {
    setAdding(true);
    await fetch(`/api/learning-paths/${id}/steps`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({
        courseId: addForm.courseId,
        stepType: addForm.stepType,
        deadlineOffsetDays: addForm.deadlineOffsetDays ? parseInt(addForm.deadlineOffsetDays) : undefined,
        availableAfterDays: addForm.availableAfterDays ? parseInt(addForm.availableAfterDays) : undefined,
        estimatedHours: addForm.estimatedHours ? parseFloat(addForm.estimatedHours) : undefined,
        prerequisiteStepId: addForm.prerequisiteStepId || undefined,
      }),
    });
    await mutate();
    setAddForm({ courseId: '', stepType: 'REQUIRED', deadlineOffsetDays: '', availableAfterDays: '', estimatedHours: '', prerequisiteStepId: '' });
    setAdding(false);
  };

  const handleRemoveStep = async (stepId: string) => {
    if (!confirm('Xóa bước này?')) return;
    await fetch(`/api/learning-paths/${id}/steps/${stepId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    mutate();
  };

  const handleEnroll = async () => {
    setEnrolling(true);
    const res = await fetch(`/api/learning-paths/${id}/enroll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ userId: enrollForm.userId }),
    });
    const json = await res.json();
    if (json.success) {
      alert('Đăng ký thành công!');
      setShowEnroll(false);
      setEnrollForm({ userId: '' });
    } else {
      alert('Lỗi: ' + json.error);
    }
    setEnrolling(false);
  };

  if (!lp) return <div className="p-6 text-muted-foreground">Đang tải...</div>;

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <a href="/learning-paths" className="text-sm text-blue-500 hover:underline">← Lộ trình học tập</a>
          <h1 className="text-2xl font-bold mt-2">{lp.name}</h1>
          {lp.description && <p className="text-sm text-muted-foreground mt-1">{lp.description}</p>}
          {lp.totalDeadlineDays && (
            <p className="text-xs text-muted-foreground mt-1">Hạn hoàn thành: {lp.totalDeadlineDays} ngày</p>
          )}
        </div>
        <button onClick={() => setShowEnroll(true)}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm shrink-0">
          + Đăng ký học viên
        </button>
      </div>

      {/* Enroll modal */}
      {showEnroll && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-xl space-y-4">
            <h2 className="font-semibold">Đăng ký học viên</h2>
            <div>
              <label className="text-sm font-medium block mb-1">User ID *</label>
              <input value={enrollForm.userId} onChange={(e) => setEnrollForm({ userId: e.target.value })}
                className="w-full border rounded px-3 py-2 text-sm" placeholder="UUID của học viên" />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowEnroll(false)} className="flex-1 py-2 border rounded text-sm">Hủy</button>
              <button onClick={handleEnroll} disabled={!enrollForm.userId || enrolling}
                className="flex-1 py-2 bg-green-600 text-white rounded text-sm disabled:opacity-50">
                {enrolling ? 'Đang đăng ký...' : 'Đăng ký'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Steps */}
      <div className="space-y-3">
        <h2 className="font-semibold">Các bước học ({lp.steps.length})</h2>

        {lp.steps.map((step, idx) => (
          <div key={step.id} className="border rounded-lg p-4 flex items-start gap-4">
            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-bold shrink-0">
              {idx + 1}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm">{step.course.title}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${STEP_TYPE_COLORS[step.stepType]}`}>
                  {STEP_TYPE_LABELS[step.stepType]}
                </span>
              </div>
              <div className="flex gap-4 mt-1 text-xs text-muted-foreground flex-wrap">
                {step.estimatedHours && <span>{step.estimatedHours}h</span>}
                {step.deadlineOffsetDays && <span>Hạn: +{step.deadlineOffsetDays} ngày</span>}
                {step.availableAfterDays != null && <span>Mở sau: {step.availableAfterDays} ngày</span>}
                {step.prerequisiteStep && <span>Sau bước {step.prerequisiteStep.stepOrder}</span>}
              </div>
            </div>
            <button onClick={() => handleRemoveStep(step.id)}
              className="text-red-400 hover:text-red-600 text-xs shrink-0">Xóa</button>
          </div>
        ))}

        {lp.steps.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8 border rounded-lg">
            Chưa có bước nào. Thêm khóa học để xây dựng lộ trình.
          </p>
        )}
      </div>

      {/* Add step form */}
      <div className="border rounded-xl p-5 space-y-4 bg-gray-50">
        <h3 className="font-medium text-sm">Thêm bước học</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="text-xs font-medium block mb-1">Khóa học *</label>
            <select value={addForm.courseId} onChange={(e) => setAddForm((f) => ({ ...f, courseId: e.target.value }))}
              className="w-full border rounded px-3 py-2 text-sm bg-white">
              <option value="">-- Chọn khóa học --</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>{c.title}{c.estimatedHours ? ` (${c.estimatedHours}h)` : ''}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium block mb-1">Loại bước</label>
            <select value={addForm.stepType} onChange={(e) => setAddForm((f) => ({ ...f, stepType: e.target.value as 'REQUIRED' | 'ELECTIVE' | 'ADVANCED' }))}
              className="w-full border rounded px-3 py-2 text-sm bg-white">
              <option value="REQUIRED">Bắt buộc</option>
              <option value="ELECTIVE">Tự chọn</option>
              <option value="ADVANCED">Nâng cao</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium block mb-1">Hạn hoàn thành (+ngày)</label>
            <input type="number" min={0} value={addForm.deadlineOffsetDays}
              onChange={(e) => setAddForm((f) => ({ ...f, deadlineOffsetDays: e.target.value }))}
              className="w-full border rounded px-3 py-2 text-sm" placeholder="Từ ngày bắt đầu" />
          </div>
          <div>
            <label className="text-xs font-medium block mb-1">Mở sau (ngày)</label>
            <input type="number" min={0} value={addForm.availableAfterDays}
              onChange={(e) => setAddForm((f) => ({ ...f, availableAfterDays: e.target.value }))}
              className="w-full border rounded px-3 py-2 text-sm" placeholder="0 = mở ngay" />
          </div>
          <div>
            <label className="text-xs font-medium block mb-1">Điều kiện tiên quyết (bước)</label>
            <select value={addForm.prerequisiteStepId}
              onChange={(e) => setAddForm((f) => ({ ...f, prerequisiteStepId: e.target.value }))}
              className="w-full border rounded px-3 py-2 text-sm bg-white">
              <option value="">-- Không có --</option>
              {lp.steps.map((s) => (
                <option key={s.id} value={s.id}>Bước {s.stepOrder}: {s.course.title}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium block mb-1">Thời lượng ước tính (giờ)</label>
            <input type="number" min={0} step="0.5" value={addForm.estimatedHours}
              onChange={(e) => setAddForm((f) => ({ ...f, estimatedHours: e.target.value }))}
              className="w-full border rounded px-3 py-2 text-sm" />
          </div>
        </div>
        <button onClick={handleAddStep} disabled={!addForm.courseId || adding}
          className="px-6 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50">
          {adding ? 'Đang thêm...' : '+ Thêm bước'}
        </button>
      </div>
    </div>
  );
}
