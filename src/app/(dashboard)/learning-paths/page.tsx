'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/providers/auth-provider';
import useSWR from 'swr';
import { AdminDataTable, ActionBtn } from '@/components/admin/AdminDataTable';
import { StatusBadge } from '@/components/admin/StatusBadge';

const fetcher = (url: string, token: string) =>
  fetch(url, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json());

interface LearningPath {
  id: string;
  name: string;
  description?: string;
  totalDeadlineDays?: number;
  isActive: boolean;
  _count: { steps: number; enrollments: number };
  positions: { id: string; title: string; code?: string }[];
}

export default function LearningPathsPage() {
  const { accessToken } = useAuth();
  const { data, mutate } = useSWR(
    accessToken ? ['/api/learning-paths', accessToken] : null,
    ([url, token]) => fetcher(url, token),
  );

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', totalDeadlineDays: '' });
  const [saving, setSaving] = useState(false);

  const paths: LearningPath[] = data?.data ?? [];

  const handleCreate = async () => {
    setSaving(true);
    await fetch('/api/learning-paths', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({
        name: form.name,
        description: form.description || undefined,
        totalDeadlineDays: form.totalDeadlineDays ? parseInt(form.totalDeadlineDays) : undefined,
      }),
    });
    await mutate();
    setShowCreate(false);
    setForm({ name: '', description: '', totalDeadlineDays: '' });
    setSaving(false);
  };

  const handleToggleActive = async (lp: LearningPath) => {
    await fetch(`/api/learning-paths/${lp.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ isActive: !lp.isActive }),
    });
    mutate();
  };

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl space-y-4">
            <h2 className="font-medium text-lg">Tạo lộ trình mới</h2>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium block mb-1">Tên lộ trình *</label>
                <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full border rounded px-3 py-2 text-sm" placeholder="Ví dụ: Onboarding Kỹ thuật" />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Mô tả</label>
                <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  rows={3} className="w-full border rounded px-3 py-2 text-sm resize-none" />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Hạn hoàn thành tổng (ngày)</label>
                <input type="number" min={1} value={form.totalDeadlineDays}
                  onChange={(e) => setForm((f) => ({ ...f, totalDeadlineDays: e.target.value }))}
                  className="w-full border rounded px-3 py-2 text-sm" placeholder="Ví dụ: 90" />
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setShowCreate(false)} className="flex-1 py-2 border rounded text-sm">Hủy</button>
              <button onClick={handleCreate} disabled={!form.name.trim() || saving}
                className="flex-1 py-2 bg-blue-600 text-white rounded text-sm disabled:opacity-50">
                {saving ? 'Đang tạo...' : 'Tạo'}
              </button>
            </div>
          </div>
        </div>
      )}

      <AdminDataTable
        title="Lộ trình học tập"
        description="Xây dựng lộ trình học cho từng vị trí công việc"
        primaryAction={{ label: '+ Tạo lộ trình mới', onClick: () => setShowCreate(true) }}
        rows={paths}
        rowKey={(lp) => lp.id}
        emptyState="Chưa có lộ trình nào. Tạo mới để bắt đầu."
        columns={[
          {
            key: 'name',
            header: 'Tên lộ trình',
            render: (lp) => (
              <div>
                <span className="font-medium">{lp.name}</span>
                {lp.totalDeadlineDays && (
                  <span className="ml-1.5 text-faint text-[11px]">(Hạn {lp.totalDeadlineDays}d)</span>
                )}
                {lp.description && (
                  <div className="text-subtle text-[12px] mt-0.5">{lp.description}</div>
                )}
              </div>
            ),
          },
          {
            key: 'status',
            header: 'Trạng thái',
            render: (lp) =>
              lp._count.enrollments > 0
                ? <StatusBadge label="Đang mở" variant="success" />
                : <StatusBadge label="Chưa có học viên" variant="warning" />,
          },
          {
            key: 'steps',
            header: 'Bước học',
            align: 'right',
            render: (lp) => lp._count.steps,
          },
          {
            key: 'enrollments',
            header: 'Học viên',
            align: 'right',
            render: (lp) => lp._count.enrollments,
          },
          {
            key: 'deadline',
            header: 'Hạn',
            align: 'center',
            render: (lp) =>
              lp.totalDeadlineDays
                ? <span className="text-[12px] text-warning font-medium">{lp.totalDeadlineDays} ngày</span>
                : <span className="text-faint">—</span>,
          },
          {
            key: 'toggle',
            header: 'Hiển thị',
            align: 'center',
            render: (lp) =>
              lp.isActive
                ? <ActionBtn label="Ẩn" onClick={() => handleToggleActive(lp)} variant="gray" />
                : <ActionBtn label="Kích hoạt" onClick={() => handleToggleActive(lp)} variant="blue" />,
          },
          {
            key: 'actions',
            header: 'Thao tác',
            align: 'right',
            render: (lp) => (
              <Link href={`/learning-paths/${lp.id}`}>
                <ActionBtn label="Xây dựng" onClick={() => {}} variant="blue" />
              </Link>
            ),
          },
        ]}
      />
    </div>
  );
}
