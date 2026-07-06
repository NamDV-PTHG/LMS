'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import { useToast } from '@/components/ui/toast';
import { MemberSearch } from '@/components/learning-group/member-search';
import { ExternalMemberSearch } from '@/components/learning-group/external-member-search';
import { RuleBuilder } from '@/components/learning-group/rule-builder';

interface Member {
  id: string;
  userId: string;
  isActive: boolean;
  removedAt: string | null;
  user: {
    id: string;
    fullName: string;
    email: string;
    employeeCode: string | null;
    jobTitle: string | null;
    isExternal: boolean;
  };
}

interface GroupCourse {
  id: string;
  courseId: string;
  deadline: string | null;
  course: { id: string; title: string; estimatedHours: number | null };
}

interface GroupDetail {
  id: string;
  name: string;
  description: string | null;
  type: 'manual' | 'rule_based' | 'external';
  ruleJson: unknown;
  members: Member[];
  courses: GroupCourse[];
}

const TYPE_LABELS: Record<GroupDetail['type'], string> = {
  manual: 'Thủ công',
  rule_based: 'Rule-based',
  external: 'Ngoài hệ thống',
};

const TYPE_COLORS: Record<GroupDetail['type'], string> = {
  manual: 'bg-primary-tint text-primary',
  rule_based: 'bg-muted text-subtle',
  external: 'bg-warning-tint text-warning',
};

export default function LearningGroupDetailPage({ params }: { params: { id: string } }) {
  const { accessToken } = useAuth();
  const { toast } = useToast();
  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [activeTab, setActiveTab] = useState<'members' | 'courses' | 'rule'>('members');
  const [syncing, setSyncing] = useState(false);
  const [togglingMember, setTogglingMember] = useState<string | null>(null);
  const [pendingRemoveId, setPendingRemoveId] = useState<string | null>(null);

  const fetchGroup = async () => {
    const res = await fetch(`/api/learning-groups/${params.id}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const json = await res.json();
    if (json.success) setGroup(json.data);
  };

  useEffect(() => { fetchGroup(); }, [params.id]); // eslint-disable-line

  const handleRemoveMember = async (userId: string) => {
    await fetch(`/api/learning-groups/${params.id}/members/${userId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    setPendingRemoveId(null);
    fetchGroup();
    toast('success', 'Đã xóa thành viên');
  };

  const handleToggleActive = async (userId: string, currentIsActive: boolean) => {
    setTogglingMember(userId);
    await fetch(`/api/learning-groups/${params.id}/members`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ userId, isActive: !currentIsActive }),
    });
    await fetchGroup();
    setTogglingMember(null);
  };

  const handleRemoveCourse = async (courseId: string) => {
    await fetch(`/api/learning-groups/${params.id}/courses/${courseId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    fetchGroup();
    toast('success', 'Đã xóa khóa học khỏi nhóm');
  };

  const handleSync = async () => {
    setSyncing(true);
    const res = await fetch(`/api/learning-groups/${params.id}/sync`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const json = await res.json();
    if (json.success) {
      toast('success', `Đồng bộ xong: +${json.data.added} thêm, -${json.data.removed} xóa`);
      fetchGroup();
    } else {
      toast('error', json.error ?? 'Đồng bộ thất bại');
    }
    setSyncing(false);
  };

  if (!group) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const activeMembers = group.members.filter((m) => m.removedAt === null);

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Header */}
      <div>
        <a href="/learning-groups" className="text-[12px] text-subtle hover:text-content inline-flex items-center gap-1 transition-colors">
          ← Nhóm học tập
        </a>
        <div className="flex items-start justify-between gap-4 mt-1">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-[18px] font-medium text-content">{group.name}</h1>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${TYPE_COLORS[group.type]}`}>
                {TYPE_LABELS[group.type]}
              </span>
            </div>
            {group.description && (
              <p className="text-[12px] text-subtle mt-1">{group.description}</p>
            )}
          </div>
          {group.type === 'rule_based' && (
            <button
              onClick={handleSync}
              disabled={syncing}
              className="px-4 py-2 text-[12px] bg-primary hover:bg-primary-dark text-white font-medium rounded-lg shrink-0 transition-colors disabled:opacity-50"
            >
              {syncing ? 'Đang đồng bộ...' : '↻ Đồng bộ thành viên'}
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-default flex gap-1">
        {(['members', 'courses', 'rule'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-[12px] font-medium border-b-2 -mb-px transition-colors ${
              activeTab === tab
                ? 'border-primary text-primary'
                : 'border-transparent text-subtle hover:text-content'
            }`}
          >
            {tab === 'members'
              ? `Thành viên (${activeMembers.length})`
              : tab === 'courses'
                ? `Khóa học (${group.courses.length})`
                : 'Quy tắc tự động'}
          </button>
        ))}
      </div>

      {/* Members tab */}
      {activeTab === 'members' && (
        <div className="space-y-4">
          {group.type === 'manual' && (
            <MemberSearch groupId={group.id} accessToken={accessToken!} onAdded={fetchGroup} />
          )}
          {group.type === 'external' && (
            <ExternalMemberSearch groupId={group.id} accessToken={accessToken!} onAdded={fetchGroup} />
          )}
          {group.type === 'rule_based' && (
            <div className="bg-primary-tint border border-primary/15 rounded-xl px-4 py-3 text-[12px] text-primary">
              Nhóm rule-based — thành viên được quản lý tự động qua quy tắc. Nhấn "Đồng bộ thành viên" để cập nhật.
            </div>
          )}

          <div className="bg-surface border border-default rounded-xl shadow-card overflow-hidden">
            {activeMembers.length === 0 ? (
              <div className="py-10 text-center text-[12px] text-faint">Chưa có thành viên</div>
            ) : (
              <div className="divide-y divide-default">
                {activeMembers.map((m) => (
                  <div
                    key={m.id}
                    className={`flex items-center justify-between px-5 py-3 ${!m.isActive ? 'opacity-60' : ''}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-[12px] font-medium text-content">{m.user.fullName}</p>
                        {m.user.isExternal && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-warning-tint text-warning font-medium">
                            Ngoài CT
                          </span>
                        )}
                        {!m.isActive && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-faint font-medium">
                            Tạm ngừng
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-faint">
                        {m.user.email}
                        {m.user.employeeCode ? ` · ${m.user.employeeCode}` : ''}
                        {m.user.jobTitle ? ` · ${m.user.jobTitle}` : ''}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {group.type === 'external' && (
                        <button
                          onClick={() => handleToggleActive(m.userId, m.isActive)}
                          disabled={togglingMember === m.userId}
                          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${
                            m.isActive ? 'bg-primary' : 'bg-muted'
                          }`}
                          title={m.isActive ? 'Nhấn để tạm ngừng' : 'Nhấn để kích hoạt'}
                        >
                          <span
                            className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
                              m.isActive ? 'translate-x-4' : 'translate-x-0.5'
                            }`}
                          />
                        </button>
                      )}
                      {pendingRemoveId === m.userId ? (
                        <>
                          <span className="text-[11px] text-warning">Xóa?</span>
                          <button
                            onClick={() => setPendingRemoveId(null)}
                            className="text-[11px] text-subtle hover:text-content"
                          >
                            Hủy
                          </button>
                          <button
                            onClick={() => handleRemoveMember(m.userId)}
                            className="text-[11px] text-danger hover:underline"
                          >
                            Xác nhận
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => setPendingRemoveId(m.userId)}
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
        </div>
      )}

      {/* Courses tab */}
      {activeTab === 'courses' && (
        <div className="space-y-4">
          <AddCourseToGroup groupId={group.id} accessToken={accessToken!} onAdded={fetchGroup} />
          <div className="bg-surface border border-default rounded-xl shadow-card overflow-hidden">
            {group.courses.length === 0 ? (
              <div className="py-10 text-center text-[12px] text-faint">
                Chưa có khóa học nào trong nhóm này
              </div>
            ) : (
              <div className="divide-y divide-default">
                {group.courses.map((gc) => (
                  <div key={gc.id} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <p className="text-[12px] font-medium text-content">{gc.course.title}</p>
                      <div className="flex gap-3 mt-0.5 text-[11px] text-faint">
                        {gc.course.estimatedHours && <span>{gc.course.estimatedHours}h</span>}
                        {gc.deadline && (
                          <span className="text-danger">Hạn: {new Date(gc.deadline).toLocaleDateString('vi-VN')}</span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemoveCourse(gc.courseId)}
                      className="text-[11px] text-faint hover:text-danger transition-colors"
                    >
                      Xóa
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Rule tab */}
      {activeTab === 'rule' && (
        <div className="space-y-4">
          {group.type !== 'rule_based' ? (
            <div className="bg-muted border border-default rounded-xl p-4 text-[12px] text-subtle">
              {group.type === 'external'
                ? 'Nhóm ngoài hệ thống quản lý thành viên thủ công bằng email.'
                : 'Nhóm thủ công không dùng quy tắc tự động. Chuyển sang loại rule_based để cài đặt quy tắc.'}
            </div>
          ) : (
            <>
              <div className="bg-muted border border-default rounded-xl p-4 text-[12px] text-subtle">
                Quy tắc xác định ai được tự động thêm/xóa khi đồng bộ. Chọn phòng ban hoặc điều kiện khác, sau đó nhấn "Đồng bộ thành viên".
              </div>
              <RuleBuilder
                value={group.ruleJson as Parameters<typeof RuleBuilder>[0]['value']}
                onChange={async (rule) => {
                  await fetch(`/api/learning-groups/${group.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
                    body: JSON.stringify({ ruleJson: rule }),
                  });
                  fetchGroup();
                }}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Add course to group component ─────────────────────────────

interface CourseOption { id: string; title: string; estimatedHours?: number | null }

function AddCourseToGroup({ groupId, accessToken, onAdded }: { groupId: string; accessToken: string; onAdded: () => void }) {
  const { toast } = useToast();
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [courseId, setCourseId] = useState('');
  const [deadline, setDeadline] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    fetch('/api/courses?published=true&limit=200', { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((r) => r.json())
      .then((res) => { if (res.success) setCourses(res.data ?? []); })
      .catch(() => {});
  }, [accessToken]);

  const handleAdd = async () => {
    if (!courseId) { toast('error', 'Chọn khóa học'); return; }
    setAdding(true);
    try {
      const res = await fetch(`/api/learning-groups/${groupId}/courses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ courseId, deadline: deadline || undefined }),
      }).then((r) => r.json());
      if (res.success) {
        toast('success', 'Đã thêm khóa học vào nhóm');
        setCourseId(''); setDeadline('');
        onAdded();
      } else {
        toast('error', res.error ?? 'Lỗi thêm khóa học');
      }
    } catch {
      toast('error', 'Lỗi kết nối server');
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="bg-surface border border-default rounded-xl shadow-card p-4 space-y-3">
      <p className="text-[12px] font-medium text-content">Thêm khóa học vào nhóm</p>
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[200px] space-y-1">
          <label className="block text-[11px] text-faint">Khóa học đã xuất bản</label>
          <select
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
            className="w-full border border-default rounded-lg px-3 py-2 text-[12px] text-content bg-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors"
          >
            <option value="">— Chọn khóa học —</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>{c.title}{c.estimatedHours ? ` (${c.estimatedHours}h)` : ''}</option>
            ))}
          </select>
          {courses.length === 0 && <p className="text-[11px] text-faint">Chưa có khóa học nào được xuất bản.</p>}
        </div>
        <div className="space-y-1">
          <label className="block text-[11px] text-faint">Hạn hoàn thành (tuỳ chọn)</label>
          <input
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className="border border-default rounded-lg px-3 py-2 text-[12px] focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <button
          onClick={handleAdd}
          disabled={adding || !courseId}
          className="px-4 py-2 bg-primary hover:bg-primary-dark text-white text-[12px] font-medium rounded-lg transition-colors disabled:opacity-50"
        >
          {adding ? 'Đang thêm...' : '+ Thêm vào nhóm'}
        </button>
      </div>
    </div>
  );
}
