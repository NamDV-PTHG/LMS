'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import { ConfigCard } from '@/components/ai-config/config-card';
import { Bot, Plus, X, Info } from 'lucide-react';

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

const inputClass =
  'w-full border border-default rounded-lg px-3 py-2 text-[12px] text-content placeholder:text-faint focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors';

export default function AiConfigPage() {
  const { accessToken, user } = useAuth();
  const [configs,      setConfigs]      = useState<AiConfig[]>([]);
  const [companies,    setCompanies]    = useState<Company[]>([]);
  const [isLoading,    setIsLoading]    = useState(true);
  const [showCreate,   setShowCreate]   = useState(false);
  const [form,         setForm]         = useState(EMPTY_FORM);
  const [creating,     setCreating]     = useState(false);
  const [createError,  setCreateError]  = useState('');

  const userRoles: string[] = (user?.roles ?? []).map((r: { role: string } | string) =>
    typeof r === 'string' ? r : r.role,
  );
  const isGroupAdmin = userRoles.includes('group_admin');

  const fetchConfigs = async () => {
    const res = await fetch('/api/ai-config', { headers: { Authorization: `Bearer ${accessToken}` } });
    const json = await res.json();
    if (json.success) setConfigs(json.data);
    setIsLoading(false);
  };

  const fetchCompanies = async () => {
    const res = await fetch('/api/organizations', { headers: { Authorization: `Bearer ${accessToken}` } });
    const json = await res.json();
    if (json.success) {
      setCompanies((json.data as Company[]).filter((o) => o.type === 'company'));
    }
  };

  useEffect(() => {
    fetchConfigs();
    fetchCompanies();
  }, []); // eslint-disable-line

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
      name: form.name, endpoint: form.endpoint,
      modelName: form.modelName, allowedCompanyIds: form.allowedCompanyIds,
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">

      {/* Action bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[12px] text-subtle">
          {/* Status legend */}
          <span className="flex items-center gap-1 mr-2"><span className="w-2 h-2 rounded-full bg-success" /> Thành công</span>
          <span className="flex items-center gap-1 mr-2"><span className="w-2 h-2 rounded-full bg-danger" /> Thất bại</span>
          <span className="flex items-center gap-1 mr-2"><span className="w-2 h-2 rounded-full bg-warning" /> Chưa test</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-faint" /> Tắt</span>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 bg-primary hover:bg-primary-dark text-white text-[12px] font-medium rounded-lg px-3 py-2 transition-colors active:scale-[0.98]"
        >
          <Plus size={14} /> Thêm cấu hình
        </button>
      </div>

      {/* Config cards */}
      {configs.length === 0 ? (
        <div className="bg-surface rounded-xl border border-default shadow-card flex flex-col items-center justify-center py-16 px-4 text-center">
          <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mb-4">
            <Bot size={20} className="text-faint" />
          </div>
          <p className="text-[13px] font-medium text-content">Chưa có cấu hình AI nào</p>
          <p className="text-[12px] text-subtle mt-1">Thêm kết nối để sử dụng tính năng AI</p>
        </div>
      ) : (
        <div className="space-y-3">
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
      <div className="bg-primary-tint rounded-xl p-4 space-y-2">
        <div className="flex items-center gap-1.5">
          <Info size={13} className="text-primary" />
          <p className="text-[12px] font-medium text-primary">Lưu ý cấu hình</p>
        </div>
        <ul className="space-y-1">
          {[
            'Endpoint Ollama local: http://192.168.1.100:11434 (không cần API key)',
            'Endpoint AI đối tác (OpenAI-compatible): điền API key để xác thực',
            'Nhấn "Test kết nối" để xác minh và xem danh sách models thực tế',
            'Để trống "Công ty được phép" = tất cả công ty đều được dùng',
          ].map((note, i) => (
            <li key={i} className="flex items-start gap-1.5 text-[11px] text-primary/80">
              <span className="mt-0.5 flex-shrink-0">•</span>
              {note}
            </li>
          ))}
        </ul>
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-surface rounded-xl shadow-card border border-default p-5 w-full max-w-lg space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-[14px] font-medium text-content">Thêm cấu hình AI</h2>
              <button onClick={() => { setShowCreate(false); setCreateError(''); setForm(EMPTY_FORM); }}
                className="text-faint hover:text-content transition-colors">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="block text-[12px] font-medium text-content">Tên <span className="text-danger">*</span></label>
                <input type="text" value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className={inputClass} placeholder="Ví dụ: Question Generator" />
              </div>
              <div className="space-y-1.5">
                <label className="block text-[12px] font-medium text-content">Endpoint URL <span className="text-danger">*</span></label>
                <input type="url" value={form.endpoint}
                  onChange={(e) => setForm({ ...form, endpoint: e.target.value })}
                  className={`${inputClass} font-mono`} placeholder="http://192.168.1.100:11434" />
              </div>
              <div className="space-y-1.5">
                <label className="block text-[12px] font-medium text-content">Model name <span className="text-danger">*</span></label>
                <input type="text" value={form.modelName}
                  onChange={(e) => setForm({ ...form, modelName: e.target.value })}
                  className={`${inputClass} font-mono`} placeholder="qwen2.5:14b" />
              </div>
              <div className="space-y-1.5">
                <label className="block text-[12px] font-medium text-content">
                  API Key
                  <span className="text-[11px] text-faint font-normal ml-1">(tùy chọn — bỏ trống nếu là Ollama local)</span>
                </label>
                <input type="password" value={form.apiKey}
                  onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
                  className={`${inputClass} font-mono`} placeholder="sk-..." autoComplete="new-password" />
              </div>

              {isGroupAdmin && companies.length > 0 && (
                <div className="space-y-1.5">
                  <label className="block text-[12px] font-medium text-content">
                    Công ty được phép sử dụng
                    <span className="text-[11px] text-faint font-normal ml-1">(bỏ chọn tất cả = mọi công ty)</span>
                  </label>
                  <div className="border border-default rounded-lg p-2 max-h-36 overflow-y-auto space-y-0.5">
                    {companies.map((c) => (
                      <label key={c.id} className="flex items-center gap-2 cursor-pointer hover:bg-muted px-2 py-1 rounded-lg">
                        <input type="checkbox" checked={(form.allowedCompanyIds ?? []).includes(c.id)}
                          onChange={() => toggleCompany(c.id)} className="rounded accent-primary w-3.5 h-3.5" />
                        <span className="text-[12px] text-content">{c.name}</span>
                      </label>
                    ))}
                  </div>
                  {form.allowedCompanyIds === null && (
                    <p className="text-[11px] text-primary">Tất cả công ty đều được phép dùng cấu hình này</p>
                  )}
                </div>
              )}

              {createError && (
                <div className="rounded-lg bg-danger-tint px-3 py-2 text-[12px] text-danger">{createError}</div>
              )}
            </div>

            <div className="flex gap-2 justify-end pt-1">
              <button onClick={() => { setShowCreate(false); setCreateError(''); setForm(EMPTY_FORM); }}
                className="px-4 py-2 text-[12px] border border-default rounded-lg text-subtle hover:bg-muted transition-colors">
                Hủy
              </button>
              <button onClick={handleCreate}
                disabled={creating || !form.name || !form.endpoint || !form.modelName}
                className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary-dark text-white text-[12px] font-medium rounded-lg transition-colors disabled:opacity-50">
                {creating ? 'Đang tạo...' : 'Tạo cấu hình'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
