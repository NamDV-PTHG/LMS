'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/providers/auth-provider';
import useSWR from 'swr';
import { AdminDataTable, ActionBtn } from '@/components/admin/AdminDataTable';
import { StatusBadge } from '@/components/admin/StatusBadge';

const fetcher = (url: string, token: string) =>
  fetch(url, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json());

interface Framework {
  id: string;
  name: string;
  version: string;
  description?: string;
  isActive: boolean;
  publishedAt?: string;
  _count: { domains: number; positions: number };
}

export default function CompetencyFrameworksPage() {
  const { accessToken } = useAuth();
  const { data, mutate } = useSWR(
    accessToken ? ['/api/frameworks', accessToken] : null,
    ([url, token]) => fetcher(url, token),
  );

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', version: '1.0', description: '' });
  const [saving, setSaving] = useState(false);

  const frameworks: Framework[] = data?.data ?? [];

  const handleCreate = async () => {
    setSaving(true);
    await fetch('/api/frameworks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(form),
    });
    await mutate();
    setShowCreate(false);
    setForm({ name: '', version: '1.0', description: '' });
    setSaving(false);
  };

  const handleToggleActive = async (fw: Framework) => {
    await fetch(`/api/frameworks/${fw.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ isActive: !fw.isActive }),
    });
    mutate();
  };

  const handlePublish = async (fw: Framework) => {
    await fetch(`/api/frameworks/${fw.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ publishedAt: new Date().toISOString() }),
    });
    mutate();
  };

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl space-y-4">
            <h2 className="font-semibold text-lg">Tạo khung năng lực mới</h2>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium block mb-1">Tên khung *</label>
                <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full border rounded px-3 py-2 text-sm" placeholder="Ví dụ: Khung NL Kỹ thuật v2" />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Phiên bản</label>
                <input value={form.version} onChange={(e) => setForm((f) => ({ ...f, version: e.target.value }))}
                  className="w-full border rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Mô tả</label>
                <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  rows={3} className="w-full border rounded px-3 py-2 text-sm resize-none" />
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
        title="Khung năng lực"
        description="Quản lý các khung năng lực theo vị trí công việc"
        primaryAction={{ label: '+ Tạo khung mới', onClick: () => setShowCreate(true) }}
        rows={frameworks}
        rowKey={(fw) => fw.id}
        emptyState="Chưa có khung năng lực nào. Tạo mới để bắt đầu."
        columns={[
          {
            key: 'name',
            header: 'Tên khung',
            render: (fw) => (
              <div>
                <span className="font-medium">{fw.name}</span>
                {fw.description && (
                  <div className="text-subtle text-[12px] line-clamp-1 mt-0.5">{fw.description}</div>
                )}
              </div>
            ),
          },
          {
            key: 'version',
            header: 'Phiên bản',
            render: (fw) => <span className="text-subtle">v{fw.version}</span>,
          },
          {
            key: 'status',
            header: 'Trạng thái',
            render: (fw) =>
              fw.publishedAt
                ? <StatusBadge label="Đã xuất bản" variant="success" />
                : <StatusBadge label="Bản nháp" variant="warning" />,
          },
          {
            key: 'domains',
            header: 'Lĩnh vực',
            align: 'right',
            render: (fw) => fw._count.domains,
          },
          {
            key: 'positions',
            header: 'Vị trí sử dụng',
            align: 'right',
            render: (fw) => fw._count.positions,
          },
          {
            key: 'actions',
            header: 'Thao tác',
            align: 'right',
            render: (fw) => (
              <div className="flex gap-1.5 justify-end">
                {!fw.publishedAt && (
                  <ActionBtn label="Xuất bản" onClick={() => handlePublish(fw)} variant="blue" />
                )}
                <ActionBtn
                  label={fw.isActive ? 'Ẩn' : 'Kích hoạt'}
                  onClick={() => handleToggleActive(fw)}
                  variant="gray"
                />
                <Link href={`/competency-frameworks/${fw.id}`}>
                  <ActionBtn label="Chỉnh sửa" onClick={() => {}} variant="blue" />
                </Link>
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
