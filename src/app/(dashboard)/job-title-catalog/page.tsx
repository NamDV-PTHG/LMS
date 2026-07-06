'use client';

import React, { useState, useMemo } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import { useToast } from '@/components/ui/toast';
import { Settings, Plus, X } from 'lucide-react';
import useSWR from 'swr';

// ── Types ────────────────────────────────────────────────────────────────────

interface CatalogEntry {
  id: string;
  code: string;
  title: string;
  level?: string;
  category?: string;
  description?: string;
  isActive: boolean;
  displayOrder: number;
  _count: { positions: number };
}

interface JobCategory { id: string; name: string }
interface JobLevel    { id: string; code: string; label: string }
interface CatalogConfig { categories: JobCategory[]; levels: JobLevel[] }

// ── Defaults (if company hasn't configured yet) ───────────────────────────────

const DEFAULT_CATEGORIES = [
  'Kỹ thuật', 'Kinh doanh', 'Quản lý', 'Tài chính', 'Nhân sự', 'Vận hành', 'Hỗ trợ', 'Khác',
];
const DEFAULT_LEVELS: { code: string; label: string }[] = [
  { code: 'junior',    label: 'Junior' },
  { code: 'mid',       label: 'Mid' },
  { code: 'senior',    label: 'Senior' },
  { code: 'lead',      label: 'Lead' },
  { code: 'manager',   label: 'Manager' },
  { code: 'director',  label: 'Director' },
  { code: 'c_level',   label: 'C-Level' },
];

const LEVEL_BADGE_COLORS: Record<string, string> = {
  junior: 'bg-gray-100 text-gray-600',
  mid: 'bg-blue-100 text-blue-700',
  senior: 'bg-indigo-100 text-indigo-700',
  lead: 'bg-purple-100 text-purple-700',
  manager: 'bg-orange-100 text-orange-700',
  director: 'bg-red-100 text-red-700',
  c_level: 'bg-yellow-100 text-yellow-800',
};

// ── Helpers ──────────────────────────────────────────────────────────────────

const fetcher = (url: string, token: string) =>
  fetch(url, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json());

function suggestCode(category: string, levelCode: string): string {
  const catPart = category.replace(/[^a-zA-ZÀ-ỹ]/g, '').slice(0, 2).toUpperCase() ||
    category.slice(0, 2).toUpperCase();
  const lvlPart = levelCode.slice(0, 2).toUpperCase();
  if (!catPart && !lvlPart) return '';
  return `${catPart}${lvlPart ? '-' + lvlPart : ''}`;
}

const EMPTY_FORM = { code: '', title: '', level: '', category: '', description: '', displayOrder: 0 };

// ── Component ────────────────────────────────────────────────────────────────

export default function JobTitleCatalogPage() {
  const { accessToken } = useAuth();
  const { toast } = useToast();

  const { data: catalogData, mutate } = useSWR(
    accessToken ? ['/api/job-title-catalog', accessToken] : null,
    ([url, token]) => fetcher(url, token),
  );
  const { data: configData, mutate: mutateConfig } = useSWR(
    accessToken ? ['/api/job-title-catalog/config', accessToken] : null,
    ([url, token]) => fetcher(url, token),
  );

  const entries: CatalogEntry[] = catalogData?.data ?? [];
  const config: CatalogConfig | null = configData?.data ?? null;

  // Use company-specific config or defaults
  const categoryNames: string[] = config?.categories.length
    ? config.categories.map((c) => c.name)
    : DEFAULT_CATEGORIES;
  const levelOptions: { code: string; label: string }[] = config?.levels.length
    ? config.levels.map((l) => ({ code: l.code, label: l.label }))
    : DEFAULT_LEVELS;
  const levelLabelMap = Object.fromEntries(levelOptions.map((l) => [l.code, l.label]));

  // ── Filters ──
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterLevel, setFilterLevel] = useState('');

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      const matchSearch = !search ||
        e.title.toLowerCase().includes(search.toLowerCase()) ||
        e.code.toLowerCase().includes(search.toLowerCase());
      const matchCat = !filterCategory || e.category === filterCategory;
      const matchLvl = !filterLevel || e.level === filterLevel;
      return matchSearch && matchCat && matchLvl;
    });
  }, [entries, search, filterCategory, filterLevel]);

  // ── Catalog entry modal ──
  const [showModal, setShowModal] = useState(false);
  const [editEntry, setEditEntry] = useState<CatalogEntry | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CatalogEntry | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ── Config modal ──
  const [showConfig, setShowConfig] = useState(false);
  const [configCategories, setConfigCategories] = useState<string[]>([]);
  const [configLevels, setConfigLevels] = useState<{ code: string; label: string }[]>([]);
  const [newCatName, setNewCatName] = useState('');
  const [newLvlCode, setNewLvlCode] = useState('');
  const [newLvlLabel, setNewLvlLabel] = useState('');
  const [savingConfig, setSavingConfig] = useState(false);

  const openConfig = () => {
    setConfigCategories(categoryNames.slice());
    setConfigLevels(levelOptions.slice());
    setNewCatName('');
    setNewLvlCode('');
    setNewLvlLabel('');
    setShowConfig(true);
  };

  const saveConfig = async () => {
    setSavingConfig(true);
    try {
      const res = await fetch('/api/job-title-catalog/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ categories: configCategories, levels: configLevels }),
      });
      const json = await res.json();
      if (!json.success) { toast('error', json.error ?? 'Lưu thất bại'); return; }
      toast('success', 'Đã lưu cấu hình nhóm & cấp bậc');
      setShowConfig(false);
      await mutateConfig();
    } catch {
      toast('error', 'Lỗi kết nối');
    } finally {
      setSavingConfig(false);
    }
  };

  // ── Catalog entry handlers ──

  const openCreate = () => { setForm(EMPTY_FORM); setEditEntry(null); setShowModal(true); };
  const openEdit = (e: CatalogEntry) => {
    setForm({ code: e.code, title: e.title, level: e.level ?? '', category: e.category ?? '', description: e.description ?? '', displayOrder: e.displayOrder });
    setEditEntry(e);
    setShowModal(true);
  };

  const handleFormChange = (field: keyof typeof EMPTY_FORM, value: string | number) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if ((field === 'category' || field === 'level') && !editEntry) {
        const suggested = suggestCode(
          field === 'category' ? (value as string) : prev.category,
          field === 'level' ? (value as string) : prev.level,
        );
        if (suggested) next.code = suggested;
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (!form.code.trim()) { toast('error', 'Mã chức danh là bắt buộc'); return; }
    if (!form.title.trim()) { toast('error', 'Tên chức danh là bắt buộc'); return; }
    setSaving(true);
    try {
      const url = editEntry ? `/api/job-title-catalog/${editEntry.id}` : '/api/job-title-catalog';
      const res = await fetch(url, {
        method: editEntry ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          code: form.code.trim(), title: form.title.trim(),
          level: form.level || undefined, category: form.category || undefined,
          description: form.description || undefined, displayOrder: form.displayOrder,
        }),
      });
      const json = await res.json();
      if (!json.success) { toast('error', json.error ?? 'Có lỗi xảy ra'); return; }
      toast('success', editEntry ? 'Đã cập nhật chức danh' : 'Đã thêm chức danh mới');
      setShowModal(false);
      await mutate();
    } catch { toast('error', 'Có lỗi xảy ra, vui lòng thử lại'); }
    finally { setSaving(false); }
  };

  const handleToggleActive = async (entry: CatalogEntry) => {
    try {
      const res = await fetch(`/api/job-title-catalog/${entry.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ isActive: !entry.isActive }),
      });
      const json = await res.json();
      if (!json.success) { toast('error', json.error ?? 'Không thể thay đổi trạng thái'); return; }
      toast('success', entry.isActive ? 'Đã ẩn chức danh' : 'Đã kích hoạt chức danh');
      mutate();
    } catch { toast('error', 'Có lỗi xảy ra'); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/job-title-catalog/${deleteTarget.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const json = await res.json();
      if (!json.success) { toast('error', json.error ?? 'Không thể xóa'); return; }
      toast('success', 'Đã xóa chức danh');
      setDeleteTarget(null);
      await mutate();
    } catch { toast('error', 'Có lỗi xảy ra'); }
    finally { setDeleting(false); }
  };

  const inputClass = 'w-full border border-default rounded-lg px-3 py-2 text-[12px] text-content placeholder:text-faint focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors bg-surface';

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[16px] font-semibold text-content">Danh mục Chức danh</h1>
          <p className="text-[12px] text-subtle mt-0.5">
            {entries.length} chức danh · Danh mục chuẩn hóa cho toàn công ty
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={openConfig}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-default rounded-lg text-[12px] text-subtle hover:bg-muted transition-colors"
          >
            <Settings size={13} /> Cấu hình nhóm & cấp bậc
          </button>
          <button
            onClick={openCreate}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary hover:bg-primary-dark text-white rounded-lg text-[12px] font-medium transition-colors"
          >
            <Plus size={13} /> Thêm chức danh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Tìm theo mã hoặc tên..."
          className="border border-default rounded-lg px-3 py-2 text-[12px] text-content bg-surface focus:outline-none focus:border-primary w-56"
        />
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="border border-default rounded-lg px-3 py-2 text-[12px] text-content bg-surface focus:outline-none focus:border-primary"
        >
          <option value="">Tất cả nhóm</option>
          {categoryNames.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select
          value={filterLevel}
          onChange={(e) => setFilterLevel(e.target.value)}
          className="border border-default rounded-lg px-3 py-2 text-[12px] text-content bg-surface focus:outline-none focus:border-primary"
        >
          <option value="">Tất cả cấp bậc</option>
          {levelOptions.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
        </select>
        {(search || filterCategory || filterLevel) && (
          <button
            onClick={() => { setSearch(''); setFilterCategory(''); setFilterLevel(''); }}
            className="text-[12px] text-subtle hover:text-content underline"
          >
            Xóa lọc
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-surface border border-default rounded-xl shadow-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-default bg-muted/40">
              <th className="text-left px-4 py-3 text-[10px] text-faint font-medium uppercase tracking-wide">Mã</th>
              <th className="text-left px-4 py-3 text-[10px] text-faint font-medium uppercase tracking-wide">Tên chức danh</th>
              <th className="text-left px-4 py-3 text-[10px] text-faint font-medium uppercase tracking-wide">Cấp bậc</th>
              <th className="text-left px-4 py-3 text-[10px] text-faint font-medium uppercase tracking-wide">Nhóm</th>
              <th className="text-left px-4 py-3 text-[10px] text-faint font-medium uppercase tracking-wide">Vị trí</th>
              <th className="text-left px-4 py-3 text-[10px] text-faint font-medium uppercase tracking-wide">Trạng thái</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map((entry) => (
              <tr key={entry.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3">
                  <span className="font-mono text-[11px] bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                    {entry.code}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="text-[12px] font-medium text-content">{entry.title}</div>
                  {entry.isActive && entry._count.positions === 0 && (
                    <div className="text-[10px] text-amber-600 font-medium mt-0.5">⚠ Chưa dùng</div>
                  )}
                </td>
                <td className="px-4 py-3">
                  {entry.level ? (
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${LEVEL_BADGE_COLORS[entry.level] ?? 'bg-gray-100 text-gray-600'}`}>
                      {levelLabelMap[entry.level] ?? entry.level}
                    </span>
                  ) : <span className="text-faint">—</span>}
                </td>
                <td className="px-4 py-3 text-[12px] text-subtle">{entry.category ?? '—'}</td>
                <td className="px-4 py-3 text-[12px] text-subtle">{entry._count.positions}</td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => handleToggleActive(entry)}
                    className={`text-[10px] px-2 py-0.5 rounded-full font-medium cursor-pointer transition-colors ${
                      entry.isActive ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    {entry.isActive ? 'Hoạt động' : 'Ẩn'}
                  </button>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button onClick={() => openEdit(entry)} className="text-[11px] text-primary hover:underline">Sửa</button>
                    <button onClick={() => setDeleteTarget(entry)} className="text-[11px] text-danger hover:underline">Xóa</button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-10 text-[12px] text-faint">
                  {entries.length === 0 ? 'Chưa có chức danh nào' : 'Không tìm thấy kết quả phù hợp'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Config Modal ── */}
      {showConfig && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-surface rounded-xl w-full max-w-2xl shadow-xl max-h-[85vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-default">
              <h2 className="text-[14px] font-semibold text-content">Cấu hình Nhóm & Cấp bậc</h2>
              <button onClick={() => setShowConfig(false)} className="text-faint hover:text-content"><X size={16} /></button>
            </div>
            <div className="overflow-y-auto flex-1 p-5 space-y-6">
              {/* Categories */}
              <div>
                <h3 className="text-[12px] font-semibold text-content mb-2">Nhóm chức danh</h3>
                <p className="text-[11px] text-subtle mb-3">Danh sách nhóm tùy chỉnh theo đặc thù công ty (VD: Kỹ thuật, Kinh doanh...)</p>
                <div className="space-y-1.5 mb-3">
                  {configCategories.map((cat, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        value={cat}
                        onChange={(e) => {
                          const next = [...configCategories];
                          next[i] = e.target.value;
                          setConfigCategories(next);
                        }}
                        className={inputClass}
                      />
                      <button
                        onClick={() => setConfigCategories(configCategories.filter((_, j) => j !== i))}
                        className="shrink-0 text-danger hover:text-danger/80"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newCatName.trim()) {
                        setConfigCategories([...configCategories, newCatName.trim()]);
                        setNewCatName('');
                      }
                    }}
                    placeholder="Tên nhóm mới..."
                    className={inputClass}
                  />
                  <button
                    onClick={() => {
                      if (newCatName.trim()) {
                        setConfigCategories([...configCategories, newCatName.trim()]);
                        setNewCatName('');
                      }
                    }}
                    className="shrink-0 px-3 py-2 bg-primary text-white rounded-lg text-[12px] hover:bg-primary-dark transition-colors"
                  >
                    <Plus size={13} />
                  </button>
                </div>
              </div>

              <hr className="border-default" />

              {/* Levels */}
              <div>
                <h3 className="text-[12px] font-semibold text-content mb-2">Cấp bậc / Chức cấp</h3>
                <p className="text-[11px] text-subtle mb-3">Định nghĩa các cấp bậc của công ty (mã ngắn + nhãn hiển thị)</p>
                <div className="space-y-1.5 mb-3">
                  {configLevels.map((lvl, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        value={lvl.code}
                        onChange={(e) => {
                          const next = [...configLevels];
                          next[i] = { ...lvl, code: e.target.value };
                          setConfigLevels(next);
                        }}
                        placeholder="Mã (VD: senior)"
                        className="w-28 border border-default rounded-lg px-2 py-2 text-[12px] text-content bg-surface focus:outline-none focus:border-primary"
                      />
                      <input
                        value={lvl.label}
                        onChange={(e) => {
                          const next = [...configLevels];
                          next[i] = { ...lvl, label: e.target.value };
                          setConfigLevels(next);
                        }}
                        placeholder="Nhãn hiển thị"
                        className={inputClass}
                      />
                      <button
                        onClick={() => setConfigLevels(configLevels.filter((_, j) => j !== i))}
                        className="shrink-0 text-danger hover:text-danger/80"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    value={newLvlCode}
                    onChange={(e) => setNewLvlCode(e.target.value)}
                    placeholder="Mã (VD: senior)"
                    className="w-28 border border-default rounded-lg px-2 py-2 text-[12px] text-content bg-surface focus:outline-none focus:border-primary"
                  />
                  <input
                    value={newLvlLabel}
                    onChange={(e) => setNewLvlLabel(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newLvlCode.trim() && newLvlLabel.trim()) {
                        setConfigLevels([...configLevels, { code: newLvlCode.trim(), label: newLvlLabel.trim() }]);
                        setNewLvlCode(''); setNewLvlLabel('');
                      }
                    }}
                    placeholder="Nhãn hiển thị"
                    className={inputClass}
                  />
                  <button
                    onClick={() => {
                      if (newLvlCode.trim() && newLvlLabel.trim()) {
                        setConfigLevels([...configLevels, { code: newLvlCode.trim(), label: newLvlLabel.trim() }]);
                        setNewLvlCode(''); setNewLvlLabel('');
                      }
                    }}
                    className="shrink-0 px-3 py-2 bg-primary text-white rounded-lg text-[12px] hover:bg-primary-dark transition-colors"
                  >
                    <Plus size={13} />
                  </button>
                </div>
              </div>
            </div>
            <div className="flex gap-2 px-5 py-4 border-t border-default">
              <button onClick={() => setShowConfig(false)} className="flex-1 py-2 border border-default rounded-lg text-[12px] text-subtle hover:bg-muted transition-colors">Hủy</button>
              <button
                onClick={saveConfig}
                disabled={savingConfig}
                className="flex-1 py-2 bg-primary hover:bg-primary-dark text-white rounded-lg text-[12px] font-medium transition-colors disabled:opacity-50"
              >
                {savingConfig ? 'Đang lưu...' : 'Lưu cấu hình'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Create / Edit Modal ── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-surface rounded-xl w-full max-w-lg shadow-xl space-y-4 p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-[14px] font-semibold text-content">
                {editEntry ? 'Chỉnh sửa chức danh' : 'Thêm chức danh mới'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-faint hover:text-content"><X size={16} /></button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[12px] font-medium text-content mb-1">Nhóm</label>
                <select value={form.category} onChange={(e) => handleFormChange('category', e.target.value)} className={inputClass}>
                  <option value="">-- Chọn nhóm --</option>
                  {categoryNames.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[12px] font-medium text-content mb-1">Cấp bậc</label>
                <select value={form.level} onChange={(e) => handleFormChange('level', e.target.value)} className={inputClass}>
                  <option value="">-- Chọn cấp bậc --</option>
                  {levelOptions.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[12px] font-medium text-content mb-1">Mã chức danh <span className="text-danger">*</span></label>
                <input value={form.code} onChange={(e) => handleFormChange('code', e.target.value)} className={inputClass} placeholder="VD: KT-SR" />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-content mb-1">Thứ tự hiển thị</label>
                <input type="number" value={form.displayOrder} onChange={(e) => handleFormChange('displayOrder', Number(e.target.value))} className={inputClass} min={0} />
              </div>
              <div className="col-span-2">
                <label className="block text-[12px] font-medium text-content mb-1">Tên chức danh <span className="text-danger">*</span></label>
                <input value={form.title} onChange={(e) => handleFormChange('title', e.target.value)} className={inputClass} placeholder="VD: Kỹ sư phần mềm cấp cao" />
              </div>
              <div className="col-span-2">
                <label className="block text-[12px] font-medium text-content mb-1">Mô tả</label>
                <textarea value={form.description} onChange={(e) => handleFormChange('description', e.target.value)} rows={3} className={`${inputClass} resize-none`} placeholder="Mô tả ngắn về chức danh..." />
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2 border border-default rounded-lg text-[12px] text-subtle hover:bg-muted transition-colors">Hủy</button>
              <button
                onClick={handleSave}
                disabled={!form.code.trim() || !form.title.trim() || saving}
                className="flex-1 py-2 bg-primary hover:bg-primary-dark text-white rounded-lg text-[12px] font-medium transition-colors disabled:opacity-50"
              >
                {saving ? 'Đang lưu...' : editEntry ? 'Cập nhật' : 'Thêm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation ── */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-surface rounded-xl w-full max-w-md shadow-xl p-5 space-y-4">
            <h2 className="text-[14px] font-semibold text-danger">Xóa chức danh?</h2>
            <p className="text-[12px] text-subtle">
              Bạn sắp xóa <strong className="text-content">{deleteTarget.title}</strong>{' '}
              <span className="font-mono text-[11px] bg-gray-100 px-1 rounded">{deleteTarget.code}</span>.
            </p>
            {deleteTarget._count.positions > 0 ? (
              <div className="bg-danger-tint border border-danger/20 rounded-lg p-3 text-[12px] text-danger">
                <strong>Không thể xóa.</strong> Chức danh đang được dùng bởi{' '}
                <strong>{deleteTarget._count.positions} vị trí</strong>. Hãy gỡ liên kết trước.
              </div>
            ) : (
              <p className="text-[12px] text-subtle">Thao tác này không thể hoàn tác.</p>
            )}
            <div className="flex gap-2">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 py-2 border border-default rounded-lg text-[12px] text-subtle hover:bg-muted transition-colors">Hủy</button>
              <button
                onClick={handleDelete}
                disabled={deleteTarget._count.positions > 0 || deleting}
                className="flex-1 py-2 bg-danger hover:bg-danger/90 text-white rounded-lg text-[12px] font-medium transition-colors disabled:opacity-50"
              >
                {deleting ? 'Đang xóa...' : 'Xóa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
