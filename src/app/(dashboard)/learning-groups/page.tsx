'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/providers/auth-provider';
import { useToast } from '@/components/ui/toast';
import { AdminDataTable, ActionBtn } from '@/components/admin/AdminDataTable';
import { StatusBadge } from '@/components/admin/StatusBadge';

interface Group {
  id: string;
  name: string;
  description: string | null;
  type: 'manual' | 'rule_based' | 'external';
  isActive: boolean;
  createdAt: string;
  _count: { members: number; courses: number };
}

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
    <div className="max-w-5xl mx-auto space-y-4">
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

      <AdminDataTable
        title="Learning Groups"
        description="Nhóm học xuyên công ty"
        primaryAction={{ label: '+ Tạo nhóm', onClick: () => setShowCreate(true) }}
        rows={groups}
        rowKey={(g) => g.id}
        emptyState="Chưa có nhóm học nào"
        columns={[
          {
            key: 'name',
            header: 'Tên nhóm',
            render: (g) => (
              <div>
                <span className="font-medium">{g.name}</span>
                {g.description && (
                  <div className="text-subtle text-[12px] line-clamp-1 mt-0.5">{g.description}</div>
                )}
              </div>
            ),
          },
          {
            key: 'type',
            header: 'Loại',
            render: (g) => {
              if (g.type === 'rule_based') return <StatusBadge label="Rule-based" variant="info-purple" />;
              if (g.type === 'external') return <StatusBadge label="Ngoài hệ thống" variant="warning" />;
              return <StatusBadge label="Thủ công" variant="info-blue" />;
            },
          },
          {
            key: 'members',
            header: 'Thành viên',
            align: 'right',
            render: (g) => g._count.members,
          },
          {
            key: 'courses',
            header: 'Khóa học',
            align: 'right',
            render: (g) => g._count.courses,
          },
          {
            key: 'actions',
            header: 'Thao tác',
            align: 'right',
            render: (g) => (
              <Link href={`/learning-groups/${g.id}`}>
                <ActionBtn label="Quản lý" onClick={() => {}} variant="blue" />
              </Link>
            ),
          },
        ]}
      />
    </div>
  );
}
