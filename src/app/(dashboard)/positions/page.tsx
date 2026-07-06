'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import { useToast } from '@/components/ui/toast';
import useSWR from 'swr';

const fetcher = (url: string, token: string) =>
  fetch(url, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json());

interface PositionFramework {
  id: string;
  frameworkId: string;
  learningPathId: string | null;
  weight: number;
  isPrimary: boolean;
  displayOrder: number;
  framework: { id: string; name: string; version: string };
  learningPath: { id: string; name: string } | null;
}

interface Position {
  id: string;
  title: string;
  code?: string;
  level?: string;
  description?: string;
  isActive: boolean;
  catalogId?: string;
  organization?: { id: string; name: string };
  competencyFramework?: { id: string; name: string; version: string };
  learningPath?: { id: string; name: string };
  catalog?: { id: string; code: string; title: string };
  _count: { users: number };
}

interface Framework { id: string; name: string; version: string }
interface LearningPath { id: string; name: string }
interface CatalogEntry { id: string; code: string; title: string; level?: string }

export default function PositionsPage() {
  const { accessToken } = useAuth();
  const { toast } = useToast();

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
  const { data: catalogData } = useSWR(
    accessToken ? ['/api/job-title-catalog?isActive=true', accessToken] : null,
    ([url, token]) => fetcher(url, token),
  );

  const positions: Position[] = posData?.data ?? [];
  const frameworks: Framework[] = fwData?.data ?? [];
  const learningPaths: LearningPath[] = lpData?.data ?? [];
  const catalogEntries: CatalogEntry[] = catalogData?.data ?? [];

  // Basic position modal
  const [showCreate, setShowCreate] = useState(false);
  const [editPos, setEditPos] = useState<Position | null>(null);
  const [form, setForm] = useState({
    title: '', code: '', level: '', description: '', catalogId: '',
  });
  const [saving, setSaving] = useState(false);

  // Framework management modal
  const [fwModal, setFwModal] = useState<{ open: boolean; position: Position | null }>({ open: false, position: null });
  const [posFrameworks, setPosFrameworks] = useState<PositionFramework[]>([]);
  const [fwLoading, setFwLoading] = useState(false);
  const [addFwForm, setAddFwForm] = useState({ frameworkId: '', learningPathId: '', weight: 1.0, isPrimary: false });
  const [addingFw, setAddingFw] = useState(false);

  const openCreate = () => {
    setForm({ title: '', code: '', level: '', description: '', catalogId: '' });
    setEditPos(null);
    setShowCreate(true);
  };

  const openEdit = (pos: Position) => {
    setForm({ title: pos.title, code: pos.code ?? '', level: pos.level ?? '', description: pos.description ?? '', catalogId: pos.catalogId ?? '' });
    setEditPos(pos);
    setShowCreate(true);
  };

  const handleCatalogSelect = (catalogId: string) => {
    if (!catalogId) { setForm((f) => ({ ...f, catalogId: '' })); return; }
    const entry = catalogEntries.find((c) => c.id === catalogId);
    if (entry) setForm((f) => ({ ...f, catalogId: entry.id, title: entry.title, level: entry.level ?? f.level, code: entry.code }));
  };

  const handleSave = async () => {
    if (!form.title.trim()) { toast('error', 'Tên vị trí là bắt buộc'); return; }
    setSaving(true);
    const body = {
      title: form.title, code: form.code || undefined, level: form.level || undefined,
      description: form.description || undefined, catalogId: form.catalogId || null,
    };
    try {
      if (editPos) {
        const res = await fetch(`/api/positions/${editPos.id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` }, body: JSON.stringify(body),
        });
        const json = await res.json();
        if (!json.success) { toast('error', json.error ?? 'Có lỗi xảy ra'); return; }
        toast('success', 'Đã cập nhật vị trí');
      } else {
        const res = await fetch('/api/positions', {
          method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` }, body: JSON.stringify(body),
        });
        const json = await res.json();
        if (!json.success) { toast('error', json.error ?? 'Có lỗi xảy ra'); return; }
        toast('success', 'Đã tạo vị trí mới');
      }
      await mutate();
      setShowCreate(false);
    } catch {
      toast('error', 'Có lỗi xảy ra, vui lòng thử lại');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (pos: Position) => {
    const res = await fetch(`/api/positions/${pos.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` }, body: JSON.stringify({ isActive: !pos.isActive }),
    });
    const json = await res.json();
    if (!json.success) { toast('error', json.error ?? 'Không thể thay đổi trạng thái'); return; }
    mutate();
  };

  // Framework management
  const openFwModal = async (pos: Position) => {
    setFwModal({ open: true, position: pos });
    setAddFwForm({ frameworkId: '', learningPathId: '', weight: 1.0, isPrimary: false });
    await loadFrameworks(pos.id);
  };

  const loadFrameworks = async (posId: string) => {
    setFwLoading(true);
    try {
      const res = await fetch(`/api/positions/${posId}/frameworks`, { headers: { Authorization: `Bearer ${accessToken}` } });
      const json = await res.json();
      if (json.success) setPosFrameworks(json.data);
    } finally {
      setFwLoading(false);
    }
  };

  const handleAddFramework = async () => {
    if (!addFwForm.frameworkId) { toast('error', 'Chọn khung năng lực'); return; }
    if (!fwModal.position) return;
    setAddingFw(true);
    try {
      const res = await fetch(`/api/positions/${fwModal.position.id}/frameworks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(addFwForm),
      }).then((r) => r.json());
      if (res.success) {
        toast('success', 'Đã thêm khung năng lực');
        setAddFwForm({ frameworkId: '', learningPathId: '', weight: 1.0, isPrimary: false });
        await loadFrameworks(fwModal.position.id);
        mutate();
      } else {
        toast('error', res.error ?? 'Lỗi thêm khung');
      }
    } catch { toast('error', 'Lỗi kết nối'); } finally { setAddingFw(false); }
  };

  const handleUpdateFw = async (pfId: string, data: Partial<PositionFramework>) => {
    if (!fwModal.position) return;
    const res = await fetch(`/api/positions/${fwModal.position.id}/frameworks/${pfId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(data),
    }).then((r) => r.json());
    if (res.success) {
      await loadFrameworks(fwModal.position.id);
      mutate();
    } else {
      toast('error', res.error ?? 'Lỗi cập nhật');
    }
  };

  const handleDeleteFw = async (pfId: string) => {
    if (!fwModal.position) return;
    const res = await fetch(`/api/positions/${fwModal.position.id}/frameworks/${pfId}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` },
    }).then((r) => r.json());
    if (res.success) {
      toast('success', 'Đã xóa khung năng lực');
      await loadFrameworks(fwModal.position.id);
      mutate();
    } else {
      toast('error', res.error ?? 'Lỗi xóa');
    }
  };

  // Total weight for normalization display
  const totalWeight = posFrameworks.reduce((s, pf) => s + pf.weight, 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Vị trí công việc</h1>
          <p className="text-sm text-muted-foreground mt-1">Quản lý vị trí — gắn nhiều khung năng lực với trọng số và lộ trình học riêng</p>
        </div>
        <button onClick={openCreate} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm">
          + Tạo vị trí mới
        </button>
      </div>

      {/* Basic position modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg shadow-xl space-y-4">
            <h2 className="font-semibold text-lg">{editPos ? 'Chỉnh sửa vị trí' : 'Tạo vị trí mới'}</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-sm font-medium block mb-1">Chức danh từ danh mục</label>
                <select value={form.catalogId} onChange={(e) => handleCatalogSelect(e.target.value)}
                  className="w-full border rounded px-3 py-2 text-sm">
                  <option value="">-- Không chọn từ danh mục --</option>
                  {catalogEntries.map((c) => (
                    <option key={c.id} value={c.id}>[{c.code}] {c.title}{c.level ? ` · ${c.level}` : ''}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <label className="text-sm font-medium block mb-1">Tên vị trí *</label>
                <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  className="w-full border rounded px-3 py-2 text-sm" placeholder="Kỹ sư phần mềm" />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Mã vị trí</label>
                <input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                  className="w-full border rounded px-3 py-2 text-sm" placeholder="SE-01" />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Cấp bậc</label>
                <input value={form.level} onChange={(e) => setForm((f) => ({ ...f, level: e.target.value }))}
                  className="w-full border rounded px-3 py-2 text-sm" placeholder="Senior" />
              </div>
              <div className="col-span-2">
                <label className="text-sm font-medium block mb-1">Mô tả</label>
                <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  rows={2} className="w-full border rounded px-3 py-2 text-sm resize-none" />
              </div>
            </div>
            <p className="text-xs text-gray-500 bg-blue-50 rounded p-2">
              💡 Sau khi tạo vị trí, dùng nút <strong>Khung NL</strong> trong bảng để gắn nhiều khung năng lực với trọng số và lộ trình học riêng.
            </p>
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

      {/* Framework management modal */}
      {fwModal.open && fwModal.position && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl shadow-xl flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-lg">Khung năng lực & Lộ trình</h2>
                <p className="text-xs text-gray-500">Vị trí: {fwModal.position.title}</p>
              </div>
              <button onClick={() => setFwModal({ open: false, position: null })} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Existing frameworks */}
              {fwLoading ? (
                <p className="text-sm text-gray-400">Đang tải...</p>
              ) : posFrameworks.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">Chưa gắn khung năng lực nào</p>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-gray-500 uppercase">Khung đã gắn</p>
                    <span className={`text-xs font-medium ${Math.abs(totalWeight - 1) < 0.01 ? 'text-green-600' : 'text-amber-600'}`}>
                      Tổng trọng số: {totalWeight.toFixed(2)} {Math.abs(totalWeight - 1) < 0.01 ? '✓' : '⚠️'}
                    </span>
                  </div>
                  {posFrameworks.map((pf) => (
                    <div key={pf.id} className="border rounded-lg p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          {pf.isPrimary && <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded flex-shrink-0">⭐ Chính</span>}
                          <span className="font-medium text-sm">{pf.framework.name}</span>
                          <span className="text-xs text-gray-400">v{pf.framework.version}</span>
                        </div>
                        <button onClick={() => handleDeleteFw(pf.id)} className="text-xs text-red-400 hover:text-red-600 flex-shrink-0">Xóa</button>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <label className="text-gray-500 block mb-0.5">Trọng số</label>
                          <input
                            type="number" min={0.01} max={10} step={0.05}
                            defaultValue={pf.weight}
                            onBlur={(e) => handleUpdateFw(pf.id, { weight: parseFloat(e.target.value) || 1 })}
                            className="w-full border rounded px-2 py-1"
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="text-gray-500 block mb-0.5">Lộ trình học</label>
                          <select
                            defaultValue={pf.learningPathId ?? ''}
                            onChange={(e) => handleUpdateFw(pf.id, { learningPathId: e.target.value || null } as never)}
                            className="w-full border rounded px-2 py-1"
                          >
                            <option value="">-- Không có --</option>
                            {learningPaths.map((lp) => <option key={lp.id} value={lp.id}>{lp.name}</option>)}
                          </select>
                        </div>
                      </div>
                      {!pf.isPrimary && (
                        <button onClick={() => handleUpdateFw(pf.id, { isPrimary: true })}
                          className="text-xs text-blue-500 hover:underline">Đặt làm khung chính</button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Add new framework */}
              <div className="border-t pt-4 space-y-3">
                <p className="text-xs font-medium text-gray-500 uppercase">Thêm khung năng lực</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="col-span-2">
                    <label className="text-xs text-gray-500 block mb-1">Khung năng lực *</label>
                    <select value={addFwForm.frameworkId} onChange={(e) => setAddFwForm((f) => ({ ...f, frameworkId: e.target.value }))}
                      className="w-full border rounded px-2 py-1.5 text-sm">
                      <option value="">-- Chọn khung --</option>
                      {frameworks
                        .filter((fw) => !posFrameworks.some((pf) => pf.frameworkId === fw.id))
                        .map((fw) => <option key={fw.id} value={fw.id}>{fw.name} v{fw.version}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Trọng số</label>
                    <input type="number" min={0.01} max={10} step={0.05} value={addFwForm.weight}
                      onChange={(e) => setAddFwForm((f) => ({ ...f, weight: parseFloat(e.target.value) || 1 }))}
                      className="w-full border rounded px-2 py-1.5 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Lộ trình học</label>
                    <select value={addFwForm.learningPathId} onChange={(e) => setAddFwForm((f) => ({ ...f, learningPathId: e.target.value }))}
                      className="w-full border rounded px-2 py-1.5 text-sm">
                      <option value="">-- Không có --</option>
                      {learningPaths.map((lp) => <option key={lp.id} value={lp.id}>{lp.name}</option>)}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="checkbox" checked={addFwForm.isPrimary}
                        onChange={(e) => setAddFwForm((f) => ({ ...f, isPrimary: e.target.checked }))} />
                      Đặt làm khung năng lực chính
                    </label>
                  </div>
                </div>
                <button onClick={handleAddFramework} disabled={addingFw || !addFwForm.frameworkId}
                  className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50">
                  {addingFw ? 'Đang thêm...' : '+ Thêm khung'}
                </button>
              </div>
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
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Nhân viên</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Trạng thái</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {positions.map((pos) => (
              <tr key={pos.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{pos.title}</span>
                    {pos.catalogId ? (
                      <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-medium">✓ DM</span>
                    ) : (
                      <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">Tùy chỉnh</span>
                    )}
                  </div>
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
                <td className="px-4 py-3 text-muted-foreground">{pos._count.users}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${pos.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {pos.isActive ? 'Hoạt động' : 'Ẩn'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button onClick={() => openEdit(pos)} className="text-xs text-blue-500 hover:underline">Sửa</button>
                    <button onClick={() => openFwModal(pos)} className="text-xs text-purple-500 hover:underline">Khung NL</button>
                    <button onClick={() => handleToggleActive(pos)} className="text-xs text-gray-500 hover:underline">
                      {pos.isActive ? 'Ẩn' : 'Hiện'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {positions.length === 0 && (
              <tr><td colSpan={6} className="text-center py-10 text-muted-foreground">Chưa có vị trí nào</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
