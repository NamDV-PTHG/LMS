'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/components/providers/auth-provider';
import useSWR from 'swr';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { BookOpen, Link2, X } from 'lucide-react';

const fetcher = (url: string, token: string) =>
  fetch(url, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json());

interface LevelDesc { [k: string]: string }
interface CourseLink { courseId: string; course: { id: string; title: string }; targetLevel: number }
interface Competency {
  id: string;
  name: string;
  description?: string;
  requiredLevel: number;
  levelDescriptions: LevelDesc;
  displayOrder: number;
  courseLinks: CourseLink[];
}
interface Domain {
  id: string;
  name: string;
  description?: string;
  weight?: number;
  competencies: Competency[];
}
interface Framework {
  id: string;
  name: string;
  version: string;
  description?: string;
  domains: Domain[];
}
interface CourseOption { id: string; title: string }

const LEVELS = [1, 2, 3, 4, 5];

export default function FrameworkDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { accessToken } = useAuth();

  const { data, mutate } = useSWR(
    accessToken ? [`/api/frameworks/${id}`, accessToken] : null,
    ([url, token]) => fetcher(url, token),
  );

  // Fetch course list for linking
  const { data: coursesData } = useSWR(
    accessToken ? [`/api/courses?limit=200&published=true`, accessToken] : null,
    ([url, token]) => fetcher(url, token),
  );
  const courseOptions: CourseOption[] = coursesData?.data ?? [];

  const [expandedDomain, setExpandedDomain] = useState<string | null>(null);
  const [expandedComp, setExpandedComp] = useState<string | null>(null);
  const [addDomainForm, setAddDomainForm] = useState({ name: '', description: '', weight: '' });
  const [showAddDomain, setShowAddDomain] = useState(false);
  const [addCompForm, setAddCompForm] = useState<Record<string, { name: string; requiredLevel: number; description: string }>>({});
  const [savingDomain, setSavingDomain] = useState(false);
  const [deleteDomainDialog, setDeleteDomainDialog] = useState<{ open: boolean; domainId: string }>({ open: false, domainId: '' });
  const [deleteCompDialog, setDeleteCompDialog] = useState<{ open: boolean; compId: string }>({ open: false, compId: '' });

  // Course-link state per competency
  const [linkForm, setLinkForm] = useState<Record<string, { courseId: string; targetLevel: number }>>({});
  const [savingLink, setSavingLink] = useState<string | null>(null);

  // Level descriptions edit state per competency
  const [editLevelDesc, setEditLevelDesc] = useState<string | null>(null); // compId being edited
  const [levelDescForm, setLevelDescForm] = useState<Record<string, Record<string, string>>>({}); // compId → {1..5}
  const [savingDesc, setSavingDesc] = useState<string | null>(null);

  const fw: Framework | undefined = data?.data;

  const handleAddDomain = async () => {
    setSavingDomain(true);
    await fetch(`/api/frameworks/${id}/domains`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({
        name: addDomainForm.name,
        description: addDomainForm.description || undefined,
        weight: addDomainForm.weight ? parseFloat(addDomainForm.weight) : undefined,
      }),
    });
    await mutate();
    setShowAddDomain(false);
    setAddDomainForm({ name: '', description: '', weight: '' });
    setSavingDomain(false);
  };

  const handleDeleteDomain = async (domainId: string) => {
    await fetch(`/api/frameworks/${id}/domains/${domainId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    mutate();
  };

  const handleAddCompetency = async (domainId: string) => {
    const form = addCompForm[domainId];
    if (!form?.name) return;
    const levelDescriptions: LevelDesc = {};
    LEVELS.forEach((l) => { levelDescriptions[String(l)] = `Cấp ${l}`; });
    await fetch(`/api/frameworks/${id}/domains/${domainId}/competencies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ ...form, levelDescriptions }),
    });
    await mutate();
    setAddCompForm((prev) => ({ ...prev, [domainId]: { name: '', requiredLevel: 3, description: '' } }));
  };

  const handleDeleteCompetency = async (compId: string) => {
    await fetch(`/api/competencies/${compId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    mutate();
  };

  const handleLinkCourse = async (compId: string) => {
    const form = linkForm[compId];
    if (!form?.courseId) return;
    setSavingLink(compId);
    await fetch(`/api/competencies/${compId}/courses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ courseId: form.courseId, targetLevel: form.targetLevel }),
    });
    await mutate();
    setLinkForm((prev) => ({ ...prev, [compId]: { courseId: '', targetLevel: 1 } }));
    setSavingLink(null);
  };

  const handleUnlinkCourse = async (compId: string, courseId: string) => {
    await fetch(`/api/competencies/${compId}/courses`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ courseId }),
    });
    mutate();
  };

  const handleSaveLevelDesc = async (compId: string) => {
    setSavingDesc(compId);
    await fetch(`/api/competencies/${compId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ levelDescriptions: levelDescForm[compId] }),
    });
    await mutate();
    setEditLevelDesc(null);
    setSavingDesc(null);
  };

  if (!fw) return <div className="p-6 text-muted-foreground">Đang tải...</div>;

  return (
    <>
    <ConfirmDialog
      open={deleteDomainDialog.open}
      title="Xóa lĩnh vực này?"
      message="Tất cả năng lực trong lĩnh vực sẽ bị xóa. Thao tác này không thể hoàn tác."
      confirmLabel="Xóa"
      onConfirm={() => { handleDeleteDomain(deleteDomainDialog.domainId); setDeleteDomainDialog({ open: false, domainId: '' }); }}
      onCancel={() => setDeleteDomainDialog({ open: false, domainId: '' })}
    />
    <ConfirmDialog
      open={deleteCompDialog.open}
      title="Xóa năng lực này?"
      message="Thao tác này không thể hoàn tác."
      confirmLabel="Xóa"
      onConfirm={() => { handleDeleteCompetency(deleteCompDialog.compId); setDeleteCompDialog({ open: false, compId: '' }); }}
      onCancel={() => setDeleteCompDialog({ open: false, compId: '' })}
    />
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <a href="/competency-frameworks" className="text-sm text-blue-500 hover:underline">← Khung năng lực</a>
        <h1 className="text-2xl font-bold mt-2">{fw.name} <span className="text-base font-normal text-muted-foreground">v{fw.version}</span></h1>
        {fw.description && <p className="text-sm text-muted-foreground mt-1">{fw.description}</p>}
      </div>

      {/* Domains */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-sm">Lĩnh vực năng lực ({fw.domains.length})</h2>
          <button onClick={() => setShowAddDomain(true)}
            className="text-sm text-blue-500 hover:underline">+ Thêm lĩnh vực</button>
        </div>

        {/* Add domain inline */}
        {showAddDomain && (
          <div className="border rounded-lg p-4 bg-blue-50 space-y-3">
            <h3 className="text-sm font-medium">Lĩnh vực mới</h3>
            <div className="grid grid-cols-2 gap-3">
              <input value={addDomainForm.name} onChange={(e) => setAddDomainForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Tên lĩnh vực *" className="border rounded px-3 py-2 text-sm col-span-2" />
              <input value={addDomainForm.description} onChange={(e) => setAddDomainForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Mô tả" className="border rounded px-3 py-2 text-sm" />
              <input type="number" value={addDomainForm.weight} onChange={(e) => setAddDomainForm((f) => ({ ...f, weight: e.target.value }))}
                placeholder="Trọng số (0–1)" step="0.1" min="0" max="1" className="border rounded px-3 py-2 text-sm" />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowAddDomain(false)} className="flex-1 py-1.5 border rounded text-sm">Hủy</button>
              <button onClick={handleAddDomain} disabled={!addDomainForm.name || savingDomain}
                className="flex-1 py-1.5 bg-blue-600 text-white rounded text-sm disabled:opacity-50">
                {savingDomain ? 'Đang lưu...' : 'Thêm'}
              </button>
            </div>
          </div>
        )}

        {fw.domains.map((domain) => (
          <div key={domain.id} className="border rounded-lg overflow-hidden">
            <button
              onClick={() => setExpandedDomain(expandedDomain === domain.id ? null : domain.id)}
              className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 hover:bg-gray-100 text-left">
              <span className="flex-1 font-medium text-sm">{domain.name}</span>
              {domain.weight != null && (
                <span className="text-xs text-muted-foreground">Trọng số {domain.weight}</span>
              )}
              <span className="text-xs text-muted-foreground">{domain.competencies.length} năng lực</span>
              <button onClick={(e) => { e.stopPropagation(); setDeleteDomainDialog({ open: true, domainId: domain.id }); }}
                className="text-red-400 hover:text-red-600 text-xs px-1">×</button>
              <span className="text-gray-400">{expandedDomain === domain.id ? '▲' : '▼'}</span>
            </button>

            {expandedDomain === domain.id && (
              <div className="divide-y">
                {domain.competencies.map((comp) => (
                  <div key={comp.id} className="border-b last:border-b-0">
                    {/* Competency header row */}
                    <div className="px-4 py-3 flex items-start gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium">{comp.name}</span>
                          <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                            Yêu cầu: Cấp {comp.requiredLevel}
                          </span>
                          {comp.courseLinks.length > 0 && (
                            <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                              <BookOpen size={10} /> {comp.courseLinks.length} khóa học
                            </span>
                          )}
                        </div>
                        {comp.description && (
                          <p className="text-xs text-muted-foreground mt-0.5">{comp.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setExpandedComp(expandedComp === comp.id ? null : comp.id)}
                          className="text-xs text-blue-500 hover:underline flex items-center gap-0.5"
                        >
                          <Link2 size={11} /> {expandedComp === comp.id ? 'Ẩn' : 'Khóa học'}
                        </button>
                        <button onClick={() => setDeleteCompDialog({ open: true, compId: comp.id })}
                          className="text-red-400 hover:text-red-600 text-xs">×</button>
                      </div>
                    </div>

                    {/* Course-link panel */}
                    {expandedComp === comp.id && (
                      <div className="mx-4 mb-3 border rounded-lg bg-gray-50 overflow-hidden">
                        {/* Existing links */}
                        {comp.courseLinks.length > 0 && (
                          <div className="divide-y divide-gray-100">
                            {comp.courseLinks.map((cl) => (
                              <div key={cl.courseId} className="flex items-center gap-2 px-3 py-2">
                                <BookOpen size={13} className="text-gray-400 shrink-0" />
                                <span className="text-xs flex-1 truncate">{cl.course.title}</span>
                                <span className="text-xs text-blue-600 font-medium shrink-0">→ Cấp {cl.targetLevel}</span>
                                <button
                                  onClick={() => handleUnlinkCourse(comp.id, cl.courseId)}
                                  className="text-red-400 hover:text-red-600 shrink-0"
                                  title="Gỡ liên kết"
                                >
                                  <X size={13} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                        {comp.courseLinks.length === 0 && (
                          <p className="text-xs text-muted-foreground px-3 py-2">Chưa có khóa học nào được liên kết</p>
                        )}
                        {/* Add link form */}
                        <div className="px-3 py-2 border-t border-gray-200 bg-white space-y-1.5">
                          <p className="text-[10px] text-amber-600 font-medium">
                            Vị trí yêu cầu cấp {comp.requiredLevel} — chọn mức khóa học này đạt được
                          </p>
                          <div className="flex items-center gap-2">
                            <select
                              value={linkForm[comp.id]?.courseId ?? ''}
                              onChange={(e) => setLinkForm((prev) => ({
                                ...prev,
                                [comp.id]: { courseId: e.target.value, targetLevel: prev[comp.id]?.targetLevel ?? comp.requiredLevel },
                              }))}
                              className="flex-1 border rounded px-2 py-1.5 text-xs min-w-0"
                            >
                              <option value="">-- Chọn khóa học --</option>
                              {courseOptions
                                .filter((c) => !comp.courseLinks.some((cl) => cl.courseId === c.id))
                                .map((c) => (
                                  <option key={c.id} value={c.id}>{c.title}</option>
                                ))}
                            </select>
                            <select
                              value={linkForm[comp.id]?.targetLevel ?? comp.requiredLevel}
                              onChange={(e) => setLinkForm((prev) => ({
                                ...prev,
                                [comp.id]: { courseId: prev[comp.id]?.courseId ?? '', targetLevel: parseInt(e.target.value) },
                              }))}
                              className="border rounded px-2 py-1.5 text-xs w-24 shrink-0"
                            >
                              {LEVELS.map((l) => <option key={l} value={l}>Đạt cấp {l}</option>)}
                            </select>
                            <button
                              onClick={() => handleLinkCourse(comp.id)}
                              disabled={!linkForm[comp.id]?.courseId || savingLink === comp.id}
                              className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs disabled:opacity-50 shrink-0"
                            >
                              {savingLink === comp.id ? '...' : 'Gắn'}
                            </button>
                          </div>
                          {(linkForm[comp.id]?.targetLevel ?? comp.requiredLevel) < comp.requiredLevel && linkForm[comp.id]?.courseId && (
                            <p className="text-[10px] text-orange-500">
                              ⚠ Khóa học này chỉ đạt cấp {linkForm[comp.id]?.targetLevel} — học viên cần thêm khóa khác để đạt yêu cầu vị trí (cấp {comp.requiredLevel})
                            </p>
                          )}
                        </div>

                        {/* Level descriptions editor */}
                        <div className="px-3 py-2 border-t border-gray-200 bg-gray-50">
                          {editLevelDesc === comp.id ? (
                            <div className="space-y-1.5">
                              <p className="text-[10px] font-medium text-gray-500 mb-1">Mô tả từng cấp độ</p>
                              {LEVELS.map((l) => (
                                <div key={l} className="flex items-center gap-2">
                                  <span className="text-[10px] text-gray-500 w-10 shrink-0">Cấp {l}:</span>
                                  <input
                                    value={levelDescForm[comp.id]?.[String(l)] ?? comp.levelDescriptions[String(l)] ?? ''}
                                    onChange={(e) => setLevelDescForm((prev) => ({
                                      ...prev,
                                      [comp.id]: { ...(prev[comp.id] ?? comp.levelDescriptions), [String(l)]: e.target.value },
                                    }))}
                                    placeholder={`Mô tả cấp ${l}...`}
                                    className="flex-1 border rounded px-2 py-1 text-[11px]"
                                  />
                                </div>
                              ))}
                              <div className="flex gap-2 pt-1">
                                <button onClick={() => setEditLevelDesc(null)} className="flex-1 py-1 border rounded text-[11px]">Hủy</button>
                                <button
                                  onClick={() => handleSaveLevelDesc(comp.id)}
                                  disabled={savingDesc === comp.id}
                                  className="flex-1 py-1 bg-blue-600 text-white rounded text-[11px] disabled:opacity-50"
                                >
                                  {savingDesc === comp.id ? 'Đang lưu...' : 'Lưu mô tả'}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                setLevelDescForm((prev) => ({ ...prev, [comp.id]: { ...comp.levelDescriptions } }));
                                setEditLevelDesc(comp.id);
                              }}
                              className="text-[10px] text-gray-400 hover:text-gray-600 underline"
                            >
                              Chỉnh sửa mô tả cấp 1–5
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {/* Add competency form */}
                <div className="px-4 py-3 bg-gray-50">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Thêm năng lực</p>
                  <div className="flex gap-2">
                    <input
                      value={addCompForm[domain.id]?.name ?? ''}
                      onChange={(e) => setAddCompForm((prev) => ({
                        ...prev,
                        [domain.id]: { ...(prev[domain.id] ?? { name: '', requiredLevel: 3, description: '' }), name: e.target.value },
                      }))}
                      placeholder="Tên năng lực"
                      className="flex-1 border rounded px-2 py-1.5 text-xs"
                    />
                    <select
                      value={addCompForm[domain.id]?.requiredLevel ?? 3}
                      onChange={(e) => setAddCompForm((prev) => ({
                        ...prev,
                        [domain.id]: { ...(prev[domain.id] ?? { name: '', requiredLevel: 3, description: '' }), requiredLevel: parseInt(e.target.value) },
                      }))}
                      className="border rounded px-2 py-1.5 text-xs w-28">
                      {LEVELS.map((l) => <option key={l} value={l}>Yêu cầu cấp {l}</option>)}
                    </select>
                    <button
                      onClick={() => handleAddCompetency(domain.id)}
                      disabled={!addCompForm[domain.id]?.name}
                      className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs disabled:opacity-50">
                      +
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}

        {fw.domains.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">
            Chưa có lĩnh vực nào. Thêm lĩnh vực để bắt đầu định nghĩa năng lực.
          </p>
        )}
      </div>
    </div>
    </>
  );
}
