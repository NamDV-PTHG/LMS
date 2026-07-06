'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/components/providers/auth-provider';
import { useToast } from '@/components/ui/toast';
import useSWR from 'swr';

const fetcher = (url: string, token: string) =>
  fetch(url, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json());

interface Course { id: string; title: string; estimatedHours?: number }
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
interface Organization { id: string; name: string; type: string }
interface UserItem { id: string; fullName: string; email: string }

const STEP_TYPE_LABELS: Record<string, string> = {
  REQUIRED: 'Bắt buộc',
  ELECTIVE: 'Tự chọn',
  ADVANCED: 'Nâng cao',
};
const STEP_TYPE_COLORS: Record<string, string> = {
  REQUIRED: 'bg-primary-tint text-primary',
  ELECTIVE: 'bg-success-tint text-success',
  ADVANCED: 'bg-muted text-subtle',
};

const inputClass =
  'w-full border border-default rounded-lg px-3 py-2 text-[12px] text-content placeholder:text-faint focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 bg-surface transition-colors';
const selectClass =
  'w-full border border-default rounded-lg px-3 py-2 text-[12px] text-content focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 bg-surface transition-colors';

export default function LearningPathBuilderPage() {
  const { id } = useParams<{ id: string }>();
  const { accessToken } = useAuth();
  const { toast } = useToast();

  const { data: lpData, mutate } = useSWR(
    accessToken ? [`/api/learning-paths/${id}`, accessToken] : null,
    ([url, token]) => fetcher(url, token),
  );
  const { data: courseData } = useSWR(
    accessToken ? ['/api/courses?published=true&limit=200', accessToken] : null,
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

  // Enroll modal state
  const [showEnroll, setShowEnroll] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [enrollTargetType, setEnrollTargetType] = useState<'user' | 'department' | 'company'>('user');
  const [enrollUserId, setEnrollUserId] = useState('');
  const [enrollOrgId, setEnrollOrgId] = useState('');
  const [users, setUsers] = useState<UserItem[]>([]);
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [userSearch, setUserSearch] = useState('');

  // Inline delete confirm
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadEnrollData = () => {
    if (!accessToken) return;
    fetch('/api/users?limit=200', { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((r) => r.json())
      .then((res) => setUsers(res.data ?? []))
      .catch(() => {});
    fetch('/api/organizations', { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((r) => r.json())
      .then((res) => {
        const list: Organization[] = res.data ?? [];
        setOrgs(list);
        if (list.length > 0 && !enrollOrgId) setEnrollOrgId(list[0].id);
      })
      .catch(() => {});
  };

  useEffect(() => {
    if (showEnroll) loadEnrollData();
  }, [showEnroll]); // eslint-disable-line

  const handleAddStep = async () => {
    if (!addForm.courseId) {
      toast('error', 'Vui lòng chọn khóa học');
      return;
    }
    setAdding(true);
    try {
      const res = await fetch(`/api/learning-paths/${id}/steps`, {
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
      }).then((r) => r.json());
      if (res.success) {
        toast('success', 'Đã thêm bước học');
        await mutate();
        setAddForm({ courseId: '', stepType: 'REQUIRED', deadlineOffsetDays: '', availableAfterDays: '', estimatedHours: '', prerequisiteStepId: '' });
      } else {
        toast('error', res.error ?? 'Thêm bước thất bại');
      }
    } catch {
      toast('error', 'Lỗi kết nối server');
    } finally {
      setAdding(false);
    }
  };

  const handleRemoveStep = async (stepId: string) => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/learning-paths/${id}/steps/${stepId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      }).then((r) => r.json());
      if (res.success) {
        toast('success', 'Đã xóa bước học');
        mutate();
      } else {
        toast('error', res.error ?? 'Xóa bước thất bại');
      }
    } catch {
      toast('error', 'Lỗi kết nối server');
    } finally {
      setDeleting(false);
      setPendingDeleteId(null);
    }
  };

  const handleEnroll = async () => {
    setEnrolling(true);
    try {
      const body: Record<string, string> = { targetType: enrollTargetType };
      if (enrollTargetType === 'user') {
        if (!enrollUserId) { toast('error', 'Vui lòng chọn học viên'); setEnrolling(false); return; }
        body.userId = enrollUserId;
      } else if (enrollTargetType === 'department') {
        if (!enrollOrgId) { toast('error', 'Vui lòng chọn phòng ban'); setEnrolling(false); return; }
        body.organizationId = enrollOrgId;
      }

      const res = await fetch(`/api/learning-paths/${id}/enroll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(body),
      }).then((r) => r.json());

      if (res.success) {
        if (enrollTargetType === 'user') {
          toast('success', 'Đăng ký học viên thành công');
        } else {
          const { enrolled, skipped } = res.data ?? {};
          toast('success', `Đã đăng ký ${enrolled} học viên${skipped > 0 ? `, bỏ qua ${skipped} (đã có)` : ''}`);
        }
        setShowEnroll(false);
        setEnrollUserId('');
        setEnrollOrgId(orgs[0]?.id ?? '');
        setUserSearch('');
      } else {
        toast('error', res.error ?? 'Đăng ký thất bại');
      }
    } catch {
      toast('error', 'Lỗi kết nối server');
    } finally {
      setEnrolling(false);
    }
  };

  const filteredUsers = users.filter((u) =>
    !userSearch ||
    u.fullName.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.email.toLowerCase().includes(userSearch.toLowerCase()),
  );

  if (!lp) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Header */}
      <div>
        <a href="/learning-paths" className="text-[12px] text-subtle hover:text-content inline-flex items-center gap-1 transition-colors">
          ← Lộ trình học tập
        </a>
        <div className="flex items-start justify-between gap-4 mt-1">
          <div>
            <h1 className="text-[18px] font-medium text-content">{lp.name}</h1>
            {lp.description && <p className="text-[12px] text-subtle mt-1">{lp.description}</p>}
            {lp.totalDeadlineDays && (
              <p className="text-[11px] text-faint mt-1">Hạn hoàn thành: {lp.totalDeadlineDays} ngày</p>
            )}
          </div>
          <button
            onClick={() => setShowEnroll(true)}
            className="px-4 py-2 bg-primary hover:bg-primary-dark text-white text-[12px] font-medium rounded-lg shrink-0 transition-colors"
          >
            + Đăng ký học viên
          </button>
        </div>
      </div>

      {/* Enroll modal */}
      {showEnroll && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-surface rounded-xl border border-default shadow-card w-full max-w-md space-y-4 p-6">
            <h2 className="text-[14px] font-medium text-content">Đăng ký học viên</h2>

            {/* Target type tabs */}
            <div className="flex border border-default rounded-lg overflow-hidden text-[12px]">
              {(['user', 'department', 'company'] as const).map((t) => {
                const labels = { user: 'Học viên', department: 'Phòng ban', company: 'Toàn công ty' };
                return (
                  <button
                    key={t}
                    onClick={() => setEnrollTargetType(t)}
                    className={`flex-1 py-2 transition-colors ${
                      enrollTargetType === t
                        ? 'bg-primary text-white font-medium'
                        : 'text-subtle hover:bg-muted'
                    }`}
                  >
                    {labels[t]}
                  </button>
                );
              })}
            </div>

            {/* User selection */}
            {enrollTargetType === 'user' && (
              <div className="space-y-2">
                <label className="block text-[12px] font-medium text-content">Tìm học viên</label>
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Tìm theo tên hoặc email..."
                  className={inputClass}
                />
                <div className="border border-default rounded-lg max-h-48 overflow-y-auto">
                  {filteredUsers.length === 0 ? (
                    <div className="py-4 text-center text-[12px] text-faint">Không tìm thấy</div>
                  ) : (
                    filteredUsers.slice(0, 50).map((u) => (
                      <div
                        key={u.id}
                        onClick={() => setEnrollUserId(u.id)}
                        className={`px-3 py-2 cursor-pointer transition-colors ${
                          enrollUserId === u.id
                            ? 'bg-primary-tint border-l-2 border-primary'
                            : 'hover:bg-muted'
                        }`}
                      >
                        <div className="text-[12px] font-medium text-content">{u.fullName}</div>
                        <div className="text-[11px] text-faint">{u.email}</div>
                      </div>
                    ))
                  )}
                </div>
                {enrollUserId && (
                  <p className="text-[11px] text-primary">
                    Đã chọn: {users.find((u) => u.id === enrollUserId)?.fullName}
                  </p>
                )}
              </div>
            )}

            {/* Department selection */}
            {enrollTargetType === 'department' && (
              <div className="space-y-2">
                <label className="block text-[12px] font-medium text-content">Chọn phòng ban</label>
                <select
                  value={enrollOrgId}
                  onChange={(e) => setEnrollOrgId(e.target.value)}
                  className={selectClass}
                >
                  <option value="">-- Chọn phòng ban --</option>
                  {orgs.map((o) => (
                    <option key={o.id} value={o.id}>{o.name}</option>
                  ))}
                </select>
                <p className="text-[11px] text-faint">Toàn bộ học viên trong phòng ban sẽ được đăng ký</p>
              </div>
            )}

            {/* Company-wide */}
            {enrollTargetType === 'company' && (
              <div className="bg-warning-tint border border-warning/20 rounded-lg p-3">
                <p className="text-[12px] text-warning font-medium">Đăng ký toàn công ty</p>
                <p className="text-[11px] text-warning/80 mt-1">
                  Tất cả học viên đang hoạt động trong công ty sẽ được đăng ký vào lộ trình này.
                  Học viên đã đăng ký sẽ bị bỏ qua.
                </p>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => { setShowEnroll(false); setEnrollUserId(''); setUserSearch(''); }}
                className="flex-1 py-2 text-[12px] border border-default rounded-lg text-subtle hover:bg-muted transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={handleEnroll}
                disabled={enrolling}
                className="flex-1 py-2 text-[12px] bg-primary hover:bg-primary-dark text-white rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                {enrolling ? 'Đang đăng ký...' : 'Đăng ký'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Steps list */}
      <div className="bg-surface border border-default rounded-xl shadow-card overflow-hidden">
        <div className="px-4 py-3 border-b border-default">
          <h2 className="text-[13px] font-medium text-content">Các bước học ({lp.steps.length})</h2>
        </div>

        {lp.steps.length === 0 ? (
          <div className="py-10 text-center text-[12px] text-faint">
            Chưa có bước nào. Thêm khóa học phía dưới để xây dựng lộ trình.
          </div>
        ) : (
          <div className="divide-y divide-default">
            {lp.steps.map((step, idx) => (
              <div key={step.id} className="p-4 flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-primary-tint text-primary flex items-center justify-center text-[12px] font-medium shrink-0">
                  {idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-[12px] text-content">{step.course.title}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STEP_TYPE_COLORS[step.stepType]}`}>
                      {STEP_TYPE_LABELS[step.stepType]}
                    </span>
                  </div>
                  <div className="flex gap-4 mt-1 text-[11px] text-faint flex-wrap">
                    {step.estimatedHours && <span>{step.estimatedHours}h</span>}
                    {step.deadlineOffsetDays && <span>Hạn: +{step.deadlineOffsetDays} ngày</span>}
                    {step.availableAfterDays != null && <span>Mở sau: {step.availableAfterDays} ngày</span>}
                    {step.prerequisiteStep && <span>Sau bước {step.prerequisiteStep.stepOrder}</span>}
                  </div>
                </div>
                <div className="shrink-0 flex items-center gap-2">
                  {pendingDeleteId === step.id ? (
                    <>
                      <span className="text-[11px] text-warning">Xóa bước này?</span>
                      <button
                        onClick={() => setPendingDeleteId(null)}
                        className="text-[11px] text-subtle hover:text-content"
                      >
                        Hủy
                      </button>
                      <button
                        onClick={() => handleRemoveStep(step.id)}
                        disabled={deleting}
                        className="text-[11px] text-danger hover:underline disabled:opacity-50"
                      >
                        {deleting ? '...' : 'Xác nhận'}
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setPendingDeleteId(step.id)}
                      className="text-[11px] text-faint hover:text-danger transition-colors"
                    >
                      Xóa
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add step form */}
      <div className="bg-surface border border-default rounded-xl shadow-card p-5 space-y-4">
        <h3 className="text-[13px] font-medium text-content">Thêm bước học</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1">
            <label className="block text-[11px] font-medium text-content">Khóa học *</label>
            <select
              value={addForm.courseId}
              onChange={(e) => setAddForm((f) => ({ ...f, courseId: e.target.value }))}
              className={selectClass}
            >
              <option value="">-- Chọn khóa học --</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>{c.title}{c.estimatedHours ? ` (${c.estimatedHours}h)` : ''}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="block text-[11px] font-medium text-content">Loại bước</label>
            <select
              value={addForm.stepType}
              onChange={(e) => setAddForm((f) => ({ ...f, stepType: e.target.value as 'REQUIRED' | 'ELECTIVE' | 'ADVANCED' }))}
              className={selectClass}
            >
              <option value="REQUIRED">Bắt buộc</option>
              <option value="ELECTIVE">Tự chọn</option>
              <option value="ADVANCED">Nâng cao</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="block text-[11px] font-medium text-content">Hạn hoàn thành (+ngày)</label>
            <input
              type="number"
              min={0}
              value={addForm.deadlineOffsetDays}
              onChange={(e) => setAddForm((f) => ({ ...f, deadlineOffsetDays: e.target.value }))}
              placeholder="Từ ngày bắt đầu"
              className={inputClass}
            />
          </div>
          <div className="space-y-1">
            <label className="block text-[11px] font-medium text-content">Mở sau (ngày)</label>
            <input
              type="number"
              min={0}
              value={addForm.availableAfterDays}
              onChange={(e) => setAddForm((f) => ({ ...f, availableAfterDays: e.target.value }))}
              placeholder="0 = mở ngay"
              className={inputClass}
            />
          </div>
          <div className="space-y-1">
            <label className="block text-[11px] font-medium text-content">Điều kiện tiên quyết (bước)</label>
            <select
              value={addForm.prerequisiteStepId}
              onChange={(e) => setAddForm((f) => ({ ...f, prerequisiteStepId: e.target.value }))}
              className={selectClass}
            >
              <option value="">-- Không có --</option>
              {lp.steps.map((s) => (
                <option key={s.id} value={s.id}>Bước {s.stepOrder}: {s.course.title}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="block text-[11px] font-medium text-content">Thời lượng ước tính (giờ)</label>
            <input
              type="number"
              min={0}
              step="0.5"
              value={addForm.estimatedHours}
              onChange={(e) => setAddForm((f) => ({ ...f, estimatedHours: e.target.value }))}
              className={inputClass}
            />
          </div>
        </div>
        <button
          onClick={handleAddStep}
          disabled={!addForm.courseId || adding}
          className="px-5 py-2 text-[12px] bg-primary hover:bg-primary-dark text-white rounded-lg font-medium transition-colors disabled:opacity-50"
        >
          {adding ? 'Đang thêm...' : '+ Thêm bước'}
        </button>
      </div>
    </div>
  );
}
