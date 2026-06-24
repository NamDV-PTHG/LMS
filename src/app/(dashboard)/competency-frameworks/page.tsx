'use client';

import React, { useState } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import useSWR from 'swr';

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
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Khung năng lực</h1>
          <p className="text-sm text-muted-foreground mt-1">Quản lý các khung năng lực theo vị trí công việc</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm">
          + Tạo khung mới
        </button>
      </div>

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

      {/* Framework list */}
      <div className="grid gap-4">
        {frameworks.map((fw) => (
          <div key={fw.id} className="border rounded-xl p-5 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">{fw.name}</h3>
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">v{fw.version}</span>
                  {fw.publishedAt ? (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Đã xuất bản</span>
                  ) : (
                    <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">Nháp</span>
                  )}
                  {!fw.isActive && (
                    <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">Không hoạt động</span>
                  )}
                </div>
                {fw.description && <p className="text-sm text-muted-foreground mt-1">{fw.description}</p>}
                <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                  <span>{fw._count.domains} lĩnh vực</span>
                  <span>{fw._count.positions} vị trí sử dụng</span>
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                {!fw.publishedAt && (
                  <button onClick={() => handlePublish(fw)}
                    className="text-xs px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700">
                    Xuất bản
                  </button>
                )}
                <button onClick={() => handleToggleActive(fw)}
                  className="text-xs px-3 py-1.5 border rounded hover:bg-gray-50">
                  {fw.isActive ? 'Ẩn' : 'Kích hoạt'}
                </button>
                <a href={`/competency-frameworks/${fw.id}`}
                  className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700">
                  Chỉnh sửa →
                </a>
              </div>
            </div>
          </div>
        ))}
        {frameworks.length === 0 && !data && (
          <div className="text-center py-12 text-muted-foreground">Đang tải...</div>
        )}
        {frameworks.length === 0 && data && (
          <div className="text-center py-12 text-muted-foreground">Chưa có khung năng lực nào. Tạo mới để bắt đầu.</div>
        )}
      </div>
    </div>
  );
}
