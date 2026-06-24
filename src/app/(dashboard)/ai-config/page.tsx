'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import { ConfigCard } from '@/components/ai-config/config-card';

interface AiConfig {
  id: string;
  name: string;
  endpoint: string;
  modelName: string;
  apiKey: string | null;
  allowedCompanyIds: string[] | null;
  isActive: boolean;
  updatedAt: string;
  companyId: string | null;
}

interface Company {
  id: string;
  name: string;
  type: string;
}

const EMPTY_FORM = {
  name: '',
  endpoint: '',
  modelName: 'qwen2.5:14b',
  apiKey: '',
  allowedCompanyIds: null as string[] | null,
};

export default function AiConfigPage() {
  const { accessToken, user } = useAuth();
  const [configs, setConfigs] = useState<AiConfig[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const userRoles: string[] = (user?.roles ?? []).map((r: { role: string } | string) =>
    typeof r === 'string' ? r : r.role,
  );
  const isGroupAdmin = userRoles.includes('group_admin');

  const fetchConfigs = async () => {
    const res = await fetch('/api/ai-config', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const json = await res.json();
    if (json.success) setConfigs(json.data);
    setIsLoading(false);
  };

  const fetchCompanies = async () => {
    const res = await fetch('/api/organizations', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const json = await res.json();
    if (json.success) {
      setCompanies((json.data as Company[]).filter((o) => o.type === 'company'));
    }
  };

  useEffect(() => {
    fetchConfigs();
    fetchCompanies();
  }, []);

  const toggleCompany = (id: string) => {
    setForm((prev) => {
      const current = prev.allowedCompanyIds ?? [];
      const next = current.includes(id) ? current.filter((c) => c !== id) : [...current, id];
      return { ...prev, allowedCompanyIds: next.length === 0 ? null : next };
    });
  };

  const handleCreate = async () => {
    if (!form.name || !form.endpoint || !form.modelName) return;
    setCreating(true);
    setCreateError('');
    const payload: Record<string, unknown> = {
      name: form.name,
      endpoint: form.endpoint,
      modelName: form.modelName,
      allowedCompanyIds: form.allowedCompanyIds,
    };
    if (form.apiKey.trim()) payload.apiKey = form.apiKey.trim();

    const res = await fetch('/api/ai-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (json.success) {
      setShowCreate(false);
      setForm(EMPTY_FORM);
      fetchConfigs();
    } else {
      setCreateError(json.error ?? 'Lỗi tạo cấu hình');
    }
    setCreating(false);
  };

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Đang tải...</div>;

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">AI Service Configuration</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Kết nối AI server — cấu hình được đọc động từ DB
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
        >
          + Thêm cấu hình
        </button>
      </div>

      {/* Legend */}
      <div className="flex gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /> Đã test — thành công</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> Đã test — thất bại</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-400" /> Chưa test</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-300" /> Không kích hoạt</span>
      </div>

      {/* Config cards */}
      {configs.length === 0 ? (
        <div className="text-center py-16 border rounded-xl text-muted-foreground">
          <p className="text-4xl mb-3">🤖</p>
          <p className="font-medium">Chưa có cấu hình AI nào</p>
          <p className="text-sm mt-1">Thêm kết nối để sử dụng tính năng AI</p>
        </div>
      ) : (
        <div className="space-y-4">
          {configs.map((cfg) => (
            <ConfigCard
              key={cfg.id}
              config={cfg}
              companies={companies}
              isGroupAdmin={isGroupAdmin}
              accessToken={accessToken!}
              onUpdated={fetchConfigs}
            />
          ))}
        </div>
      )}

      {/* Info box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800 space-y-1">
        <p className="font-medium">Lưu ý cấu hình</p>
        <ul className="list-disc list-inside text-xs space-y-0.5 text-blue-700">
          <li>Endpoint Ollama local: http://192.168.1.100:11434 (không cần API key)</li>
          <li>Endpoint AI đối tác (OpenAI-compatible): điền API key để xác thực</li>
          <li>Nhấn "Test kết nối" để xác minh và xem danh sách models thực tế</li>
          <li>Để trống "Công ty được phép" = tất cả công ty đều được dùng</li>
        </ul>
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold">Thêm cấu hình AI</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-600 block mb-1">Tên *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full border rounded px-3 py-2 text-sm"
                  placeholder="Ví dụ: Question Generator"
                />
              </div>
              <div>
                <label className="text-xs text-gray-600 block mb-1">Endpoint URL *</label>
                <input
                  type="url"
                  value={form.endpoint}
                  onChange={(e) => setForm({ ...form, endpoint: e.target.value })}
                  className="w-full border rounded px-3 py-2 text-sm font-mono"
                  placeholder="http://192.168.1.100:11434"
                />
              </div>
              <div>
                <label className="text-xs text-gray-600 block mb-1">Model name *</label>
                <input
                  type="text"
                  value={form.modelName}
                  onChange={(e) => setForm({ ...form, modelName: e.target.value })}
                  className="w-full border rounded px-3 py-2 text-sm font-mono"
                  placeholder="qwen2.5:14b"
                />
              </div>
              <div>
                <label className="text-xs text-gray-600 block mb-1">
                  API Key <span className="text-gray-400">(tùy chọn — bỏ trống nếu là Ollama local)</span>
                </label>
                <input
                  type="password"
                  value={form.apiKey}
                  onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
                  className="w-full border rounded px-3 py-2 text-sm font-mono"
                  placeholder="sk-..."
                  autoComplete="new-password"
                />
              </div>

              {/* Company access list — only shown to group_admin */}
              {isGroupAdmin && companies.length > 0 && (
                <div>
                  <label className="text-xs text-gray-600 block mb-1">
                    Công ty được phép sử dụng
                    <span className="text-gray-400 ml-1">(bỏ chọn tất cả = mọi công ty)</span>
                  </label>
                  <div className="border rounded p-2 max-h-40 overflow-y-auto space-y-1">
                    {companies.map((c) => (
                      <label key={c.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 px-1 py-0.5 rounded">
                        <input
                          type="checkbox"
                          checked={(form.allowedCompanyIds ?? []).includes(c.id)}
                          onChange={() => toggleCompany(c.id)}
                          className="rounded"
                        />
                        <span className="text-sm">{c.name}</span>
                      </label>
                    ))}
                  </div>
                  {form.allowedCompanyIds === null && (
                    <p className="text-xs text-blue-600 mt-1">Tất cả công ty đều được phép dùng cấu hình này</p>
                  )}
                </div>
              )}

              {createError && <p className="text-sm text-red-600">{createError}</p>}
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setShowCreate(false); setCreateError(''); setForm(EMPTY_FORM); }}
                className="px-4 py-2 text-sm border rounded hover:bg-gray-50"
              >
                Hủy
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || !form.name || !form.endpoint || !form.modelName}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {creating ? 'Đang tạo...' : 'Tạo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
