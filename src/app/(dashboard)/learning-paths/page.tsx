'use client';

import React, { useState } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import useSWR from 'swr';

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
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Lộ trình học tập</h1>
          <p className="text-sm text-muted-foreground mt-1">Xây dựng lộ trình học cho từng vị trí công việc</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm">
          + Tạo lộ trình mới
        </button>
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl space-y-4">
            <h2 className="font-semibold text-lg">Tạo lộ trình mới</h2>
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

      {/* List */}
      <div className="grid gap-4">
        {paths.map((lp) => (
          <div key={lp.id} className="border rounded-xl p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold">{lp.name}</h3>
                  {!lp.isActive && (
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Ẩn</span>
                  )}
                  {lp.totalDeadlineDays && (
                    <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">
                      Hạn {lp.totalDeadlineDays} ngày
                    </span>
                  )}
                </div>
                {lp.description && <p className="text-sm text-muted-foreground mt-1">{lp.description}</p>}
                <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                  <span>{lp._count.steps} bước học</span>
                  <span>{lp._count.enrollments} học viên</span>
                  {lp.positions.length > 0 && (
                    <span>Gắn với: {lp.positions.map((p) => p.title).join(', ')}</span>
                  )}
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => handleToggleActive(lp)}
                  className="text-xs px-3 py-1.5 border rounded hover:bg-gray-50">
                  {lp.isActive ? 'Ẩn' : 'Kích hoạt'}
                </button>
                <a href={`/learning-paths/${lp.id}`}
                  className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700">
                  Xây dựng →
                </a>
              </div>
            </div>
          </div>
        ))}
        {paths.length === 0 && data && (
          <div className="text-center py-12 text-muted-foreground">Chưa có lộ trình nào. Tạo mới để bắt đầu.</div>
        )}
      </div>
    </div>
  );
}
