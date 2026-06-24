'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
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
  manual: 'bg-blue-100 text-blue-700',
  rule_based: 'bg-purple-100 text-purple-700',
  external: 'bg-orange-100 text-orange-700',
};

export default function LearningGroupDetailPage({ params }: { params: { id: string } }) {
  const { accessToken } = useAuth();
  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [activeTab, setActiveTab] = useState<'members' | 'courses' | 'rule'>('members');
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [togglingMember, setTogglingMember] = useState<string | null>(null);

  const fetchGroup = async () => {
    const res = await fetch(`/api/learning-groups/${params.id}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const json = await res.json();
    if (json.success) setGroup(json.data);
  };

  useEffect(() => { fetchGroup(); }, [params.id]);

  const handleRemoveMember = async (userId: string) => {
    await fetch(`/api/learning-groups/${params.id}/members/${userId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    fetchGroup();
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
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    const res = await fetch(`/api/learning-groups/${params.id}/sync`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const json = await res.json();
    if (json.success) {
      setSyncResult(`Đã đồng bộ: +${json.data.added} thêm, -${json.data.removed} xóa`);
      fetchGroup();
    } else {
      setSyncResult(`Lỗi: ${json.error}`);
    }
    setSyncing(false);
  };

  if (!group) return <div className="p-8 text-center text-muted-foreground">Đang tải...</div>;

  const activeMembers = group.members.filter((m) => m.removedAt === null);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{group.name}</h1>
          {group.description && <p className="text-sm text-muted-foreground mt-1">{group.description}</p>}
          <span className={`mt-2 inline-block text-xs px-2 py-0.5 rounded-full ${TYPE_COLORS[group.type]}`}>
            {TYPE_LABELS[group.type]}
          </span>
        </div>
        {group.type === 'rule_based' && (
          <div className="text-right">
            <button
              onClick={handleSync}
              disabled={syncing}
              className="px-3 py-2 text-sm bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
            >
              {syncing ? 'Đang đồng bộ...' : '↻ Đồng bộ thành viên'}
            </button>
            {syncResult && <p className="text-xs mt-1 text-muted-foreground">{syncResult}</p>}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b gap-1">
        {(['members', 'courses', 'rule'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${activeTab === tab ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            {tab === 'members'
              ? `Thành viên (${activeMembers.length})`
              : tab === 'courses'
                ? `Khóa học (${group.courses.length})`
                : 'Quy tắc'}
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

          <div className="divide-y border rounded-lg overflow-hidden">
            {activeMembers.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground text-sm">Chưa có thành viên</div>
            ) : (
              activeMembers.map((m) => (
                <div
                  key={m.id}
                  className={`flex items-center justify-between px-4 py-3 ${!m.isActive ? 'opacity-60 bg-gray-50' : ''}`}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{m.user.fullName}</p>
                      {m.user.isExternal && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-600 font-medium">
                          Ngoài CT
                        </span>
                      )}
                      {!m.isActive && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-200 text-gray-500 font-medium">
                          Tạm ngừng
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {m.user.email}
                      {m.user.employeeCode ? ` · ${m.user.employeeCode}` : ''}
                    </p>
                    {m.user.jobTitle && <p className="text-xs text-gray-400">{m.user.jobTitle}</p>}
                  </div>

                  <div className="flex items-center gap-3">
                    {group.type === 'external' && (
                      <button
                        onClick={() => handleToggleActive(m.userId, m.isActive)}
                        disabled={togglingMember === m.userId}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${m.isActive ? 'bg-blue-600' : 'bg-gray-300'}`}
                        title={m.isActive ? 'Nhấn để tạm ngừng' : 'Nhấn để kích hoạt'}
                      >
                        <span
                          className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${m.isActive ? 'translate-x-4' : 'translate-x-0.5'}`}
                        />
                      </button>
                    )}
                    <button
                      onClick={() => handleRemoveMember(m.userId)}
                      className="text-sm text-red-500 hover:text-red-700"
                    >
                      Xóa
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Courses tab */}
      {activeTab === 'courses' && (
        <div className="space-y-4">
          <AddCourseToGroup groupId={group.id} accessToken={accessToken!} onAdded={fetchGroup} />
          <div className="divide-y border rounded-lg overflow-hidden">
            {group.courses.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground text-sm">Chưa có khóa học nào. Thêm khóa học bên trên.</div>
            ) : (
              group.courses.map((gc) => (
                <div key={gc.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-sm font-medium">{gc.course.title}</p>
                    {gc.deadline && (
                      <p className="text-xs text-red-500">
                        Hạn: {new Date(gc.deadline).toLocaleDateString('vi-VN')}
                      </p>
                    )}
                    {gc.course.estimatedHours && (
                      <p className="text-xs text-muted-foreground">{gc.course.estimatedHours} giờ</p>
                    )}
                  </div>
                  <button
                    onClick={() => handleRemoveCourse(gc.courseId)}
                    className="text-sm text-red-500 hover:text-red-700"
                  >
                    Xóa
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Rule tab */}
      {activeTab === 'rule' && (
        <div className="space-y-4">
          {group.type !== 'rule_based' ? (
            <p className="text-sm text-muted-foreground">
              {group.type === 'external'
                ? 'Nhóm ngoài hệ thống quản lý thành viên thủ công bằng email.'
                : 'Nhóm thủ công không dùng quy tắc tự động.'}
            </p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Quy tắc xác định ai được tự động thêm/xóa khi đồng bộ.
              </p>
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
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [courseId, setCourseId] = useState('');
  const [deadline, setDeadline] = useState('');
  const [adding, setAdding] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    fetch('/api/courses?status=published&limit=200', { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((r) => r.json())
      .then((res) => { if (res.success) setCourses(res.data ?? []); })
      .catch(() => {});
  }, [accessToken]);

  const handleAdd = async () => {
    if (!courseId) { setMsg({ type: 'err', text: 'Chọn khóa học' }); return; }
    setAdding(true); setMsg(null);
    try {
      const res = await fetch(`/api/learning-groups/${groupId}/courses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ courseId, deadline: deadline || undefined }),
      }).then((r) => r.json());

      if (res.success) {
        setMsg({ type: 'ok', text: 'Đã thêm khóa học vào nhóm!' });
        setCourseId(''); setDeadline('');
        onAdded();
      } else {
        setMsg({ type: 'err', text: res.error ?? 'Lỗi thêm khóa học' });
      }
    } catch { setMsg({ type: 'err', text: 'Lỗi kết nối' }); }
    finally { setAdding(false); }
  };

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
      <p className="text-sm font-medium text-blue-800">+ Thêm khóa học vào nhóm</p>
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs text-blue-700 mb-1">Khóa học đã xuất bản</label>
          <select value={courseId} onChange={(e) => setCourseId(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
            <option value="">— Chọn khóa học —</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>{c.title}{c.estimatedHours ? ` (${c.estimatedHours}h)` : ''}</option>
            ))}
          </select>
          {courses.length === 0 && <p className="text-xs text-blue-500 mt-1">Chưa có khóa học nào được xuất bản.</p>}
        </div>
        <div>
          <label className="block text-xs text-blue-700 mb-1">Hạn hoàn thành (tuỳ chọn)</label>
          <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
        </div>
        <button onClick={handleAdd} disabled={adding || !courseId}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50">
          {adding ? 'Đang thêm...' : 'Thêm vào nhóm'}
        </button>
      </div>
      {msg && (
        <p className={`text-xs px-3 py-1.5 rounded-lg ${msg.type === 'ok' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          {msg.text}
        </p>
      )}
    </div>
  );
}
