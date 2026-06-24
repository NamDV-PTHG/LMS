'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/components/providers/auth-provider';
import useSWR from 'swr';

const fetcher = (url: string, token: string) =>
  fetch(url, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json());

interface LevelDesc { [k: string]: string }
interface Competency {
  id: string;
  name: string;
  description?: string;
  requiredLevel: number;
  levelDescriptions: LevelDesc;
  displayOrder: number;
  courseLinks: { courseId: string; courseTitle: string; targetLevel: number }[];
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

const LEVELS = [1, 2, 3, 4, 5];

export default function FrameworkDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { accessToken } = useAuth();

  const { data, mutate } = useSWR(
    accessToken ? [`/api/frameworks/${id}`, accessToken] : null,
    ([url, token]) => fetcher(url, token),
  );

  const [expandedDomain, setExpandedDomain] = useState<string | null>(null);
  const [addDomainForm, setAddDomainForm] = useState({ name: '', description: '', weight: '' });
  const [showAddDomain, setShowAddDomain] = useState(false);
  const [addCompForm, setAddCompForm] = useState<Record<string, { name: string; requiredLevel: number; description: string }>>({});
  const [savingDomain, setSavingDomain] = useState(false);

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
    if (!confirm('Xóa lĩnh vực này? Tất cả năng lực trong lĩnh vực sẽ bị xóa.')) return;
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
    if (!confirm('Xóa năng lực này?')) return;
    await fetch(`/api/competencies/${compId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    mutate();
  };

  if (!fw) return <div className="p-6 text-muted-foreground">Đang tải...</div>;

  return (
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
              <button onClick={(e) => { e.stopPropagation(); handleDeleteDomain(domain.id); }}
                className="text-red-400 hover:text-red-600 text-xs px-1">×</button>
              <span className="text-gray-400">{expandedDomain === domain.id ? '▲' : '▼'}</span>
            </button>

            {expandedDomain === domain.id && (
              <div className="divide-y">
                {domain.competencies.map((comp) => (
                  <div key={comp.id} className="px-4 py-3 flex items-start gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{comp.name}</span>
                        <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                          Yêu cầu: Cấp {comp.requiredLevel}
                        </span>
                      </div>
                      {comp.description && (
                        <p className="text-xs text-muted-foreground mt-0.5">{comp.description}</p>
                      )}
                    </div>
                    <button onClick={() => handleDeleteCompetency(comp.id)}
                      className="text-red-400 hover:text-red-600 text-xs">×</button>
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
  );
}
