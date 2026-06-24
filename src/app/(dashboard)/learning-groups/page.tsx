'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import { useToast } from '@/components/ui/toast';
import Link from 'next/link';

interface Group {
  id: string;
  name: string;
  description: string | null;
  type: 'manual' | 'rule_based' | 'external';
  isActive: boolean;
  createdAt: string;
  _count: { members: number; courses: number };
}

const TYPE_LABELS: Record<Group['type'], string> = {
  manual: 'Thủ công',
  rule_based: 'Rule-based',
  external: 'Ngoài hệ thống',
};

const TYPE_COLORS: Record<Group['type'], string> = {
  manual: 'bg-blue-100 text-blue-700',
  rule_based: 'bg-purple-100 text-purple-700',
  external: 'bg-orange-100 text-orange-700',
};

export default function LearningGroupsPage() {
  const { accessToken } = useAuth();
  const { toast } = useToast();
  const [groups, setGroups] = useState<Group[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', type: 'manual' as 'manual' | 'rule_based' | 'external' });
  const [creating, setCreating] = useState(false);

  const fetchGroups = async (token: string) => {
    try {
      const res = await fetch('/api/learning-groups', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.success) setGroups(json.data);
      else toast('error', 'Không thể tải danh sách nhóm', json.error);
    } catch {
      toast('error', 'Lỗi kết nối server');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (accessToken) fetchGroups(accessToken);
  }, [accessToken]); // eslint-disable-line

  const handleCreate = async () => {
    if (!form.name.trim() || !accessToken) return;
    setCreating(true);
    try {
      const res = await fetch('/api/learning-groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (json.success) {
        setShowCreate(false);
        setForm({ name: '', description: '', type: 'manual' as 'manual' | 'rule_based' | 'external' });
        toast('success', 'Tạo nhóm thành công', json.data?.name);
        fetchGroups(accessToken);
      } else {
        toast('error', 'Tạo nhóm thất bại', json.error ?? 'Vui lòng thử lại');
      }
    } catch {
      toast('error', 'Lỗi kết nối server');
    } finally {
      setCreating(false);
    }
  };

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Đang tải...</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Learning Groups</h1>
          <p className="text-sm text-muted-foreground mt-1">Nhóm học xuyên công ty</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
        >
          + Tạo nhóm
        </button>
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md space-y-4">
            <h2 className="text-lg font-semibold">Tạo Learning Group</h2>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Tên nhóm *"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full border rounded px-3 py-2 text-sm"
                autoFocus
              />
              <textarea
                placeholder="Mô tả (tùy chọn)"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
                className="w-full border rounded px-3 py-2 text-sm resize-none"
              />
              <div>
                <label className="text-sm text-gray-600 block mb-1">Loại nhóm</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value as 'manual' | 'rule_based' | 'external' })}
                  className="w-full border rounded px-3 py-2 text-sm"
                >
                  <option value="manual">Thủ công</option>
                  <option value="rule_based">Theo quy tắc</option>
                  <option value="external">Ngoài hệ thống</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm border rounded hover:bg-gray-50">
                Hủy
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || !form.name.trim()}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {creating ? 'Đang tạo...' : 'Tạo nhóm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {groups.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">Chưa có nhóm học nào</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {groups.map((g) => (
            <Link
              key={g.id}
              href={`/learning-groups/${g.id}`}
              className="block border rounded-xl p-5 hover:shadow-md transition-shadow bg-white"
            >
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-semibold text-gray-900">{g.name}</h3>
                <span className={`text-xs px-2 py-0.5 rounded-full ${TYPE_COLORS[g.type]}`}>
                  {TYPE_LABELS[g.type]}
                </span>
              </div>
              {g.description && (
                <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{g.description}</p>
              )}
              <div className="flex gap-4 text-xs text-gray-500">
                <span>{g._count.members} thành viên</span>
                <span>{g._count.courses} khóa học</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
