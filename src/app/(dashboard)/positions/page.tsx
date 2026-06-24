'use client';

import React, { useState } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import useSWR from 'swr';

const fetcher = (url: string, token: string) =>
  fetch(url, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json());

interface Position {
  id: string;
  title: string;
  code?: string;
  level?: string;
  description?: string;
  isActive: boolean;
  organization?: { id: string; name: string };
  competencyFramework?: { id: string; name: string; version: string };
  learningPath?: { id: string; name: string };
  _count: { users: number };
}
interface Framework { id: string; name: string; version: string }
interface LearningPath { id: string; name: string }

export default function PositionsPage() {
  const { accessToken } = useAuth();

  const { data: posData, mutate } = useSWR(
    accessToken ? ['/api/positions', accessToken] : null,
    ([url, token]) => fetcher(url, token),
  );
  const { data: fwData } = useSWR(
    accessToken ? ['/api/frameworks', accessToken] : null,
    ([url, token]) => fetcher(url, token),
  );
  const { data: lpData } = useSWR(
    accessToken ? ['/api/learning-paths?isActive=true', accessToken] : null,
    ([url, token]) => fetcher(url, token),
  );

  const positions: Position[] = posData?.data ?? [];
  const frameworks: Framework[] = fwData?.data ?? [];
  const learningPaths: LearningPath[] = lpData?.data ?? [];

  const [showCreate, setShowCreate] = useState(false);
  const [editPos, setEditPos] = useState<Position | null>(null);
  const [form, setForm] = useState({
    title: '', code: '', level: '', description: '',
    competencyFrameworkId: '', learningPathId: '',
  });
  const [saving, setSaving] = useState(false);

  const openCreate = () => {
    setForm({ title: '', code: '', level: '', description: '', competencyFrameworkId: '', learningPathId: '' });
    setEditPos(null);
    setShowCreate(true);
  };

  const openEdit = (pos: Position) => {
    setForm({
      title: pos.title,
      code: pos.code ?? '',
      level: pos.level ?? '',
      description: pos.description ?? '',
      competencyFrameworkId: pos.competencyFramework?.id ?? '',
      learningPathId: pos.learningPath?.id ?? '',
    });
    setEditPos(pos);
    setShowCreate(true);
  };

  const handleSave = async () => {
    setSaving(true);
    const body = {
      title: form.title,
      code: form.code || undefined,
      level: form.level || undefined,
      description: form.description || undefined,
      competencyFrameworkId: form.competencyFrameworkId || null,
      learningPathId: form.learningPathId || null,
    };

    if (editPos) {
      await fetch(`/api/positions/${editPos.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(body),
      });
    } else {
      await fetch('/api/positions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(body),
      });
    }
    await mutate();
    setShowCreate(false);
    setSaving(false);
  };

  const handleToggleActive = async (pos: Position) => {
    await fetch(`/api/positions/${pos.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ isActive: !pos.isActive }),
    });
    mutate();
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Vị trí công việc</h1>
          <p className="text-sm text-muted-foreground mt-1">Quản lý các vị trí và gắn khung năng lực / lộ trình học tập</p>
        </div>
        <button onClick={openCreate}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm">
          + Tạo vị trí mới
        </button>
      </div>

      {/* Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg shadow-xl space-y-4">
            <h2 className="font-semibold text-lg">{editPos ? 'Chỉnh sửa vị trí' : 'Tạo vị trí mới'}</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-sm font-medium block mb-1">Tên vị trí *</label>
                <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  className="w-full border rounded px-3 py-2 text-sm" placeholder="Ví dụ: Kỹ sư phần mềm" />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Mã vị trí</label>
                <input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                  className="w-full border rounded px-3 py-2 text-sm" placeholder="Ví dụ: SE-01" />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Cấp bậc</label>
                <input value={form.level} onChange={(e) => setForm((f) => ({ ...f, level: e.target.value }))}
                  className="w-full border rounded px-3 py-2 text-sm" placeholder="Ví dụ: Senior" />
              </div>
              <div className="col-span-2">
                <label className="text-sm font-medium block mb-1">Mô tả</label>
                <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  rows={2} className="w-full border rounded px-3 py-2 text-sm resize-none" />
              </div>
              <div className="col-span-2">
                <label className="text-sm font-medium block mb-1">Khung năng lực</label>
                <select value={form.competencyFrameworkId} onChange={(e) => setForm((f) => ({ ...f, competencyFrameworkId: e.target.value }))}
                  className="w-full border rounded px-3 py-2 text-sm">
                  <option value="">-- Không gắn --</option>
                  {frameworks.map((fw) => (
                    <option key={fw.id} value={fw.id}>{fw.name} v{fw.version}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <label className="text-sm font-medium block mb-1">Lộ trình học tập mặc định</label>
                <select value={form.learningPathId} onChange={(e) => setForm((f) => ({ ...f, learningPathId: e.target.value }))}
                  className="w-full border rounded px-3 py-2 text-sm">
                  <option value="">-- Không gắn --</option>
                  {learningPaths.map((lp) => (
                    <option key={lp.id} value={lp.id}>{lp.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setShowCreate(false)} className="flex-1 py-2 border rounded text-sm">Hủy</button>
              <button onClick={handleSave} disabled={!form.title.trim() || saving}
                className="flex-1 py-2 bg-blue-600 text-white rounded text-sm disabled:opacity-50">
                {saving ? 'Đang lưu...' : editPos ? 'Cập nhật' : 'Tạo'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Vị trí</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Cấp bậc</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Khung NL</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Lộ trình</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Nhân viên</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Trạng thái</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {positions.map((pos) => (
              <tr key={pos.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="font-medium">{pos.title}</div>
                  {pos.code && <div className="text-xs text-muted-foreground">{pos.code}</div>}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{pos.level ?? '—'}</td>
                <td className="px-4 py-3">
                  {pos.competencyFramework ? (
                    <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                      {pos.competencyFramework.name}
                    </span>
                  ) : <span className="text-muted-foreground text-xs">—</span>}
                </td>
                <td className="px-4 py-3">
                  {pos.learningPath ? (
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                      {pos.learningPath.name}
                    </span>
                  ) : <span className="text-muted-foreground text-xs">—</span>}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{pos._count.users}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${pos.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {pos.isActive ? 'Hoạt động' : 'Ẩn'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button onClick={() => openEdit(pos)} className="text-xs text-blue-500 hover:underline">Sửa</button>
                    <button onClick={() => handleToggleActive(pos)} className="text-xs text-gray-500 hover:underline">
                      {pos.isActive ? 'Ẩn' : 'Hiện'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {positions.length === 0 && (
              <tr><td colSpan={7} className="text-center py-10 text-muted-foreground">Chưa có vị trí nào</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
