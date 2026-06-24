'use client';

import React, { useState } from 'react';

interface AiConfig {
  id: string;
  name: string;
  endpoint: string;
  modelName: string;
  apiKey: string | null;
  allowedCompanyIds: string[] | null;
  isActive: boolean;
  updatedAt: string;
}

interface Company {
  id: string;
  name: string;
}

interface TestResult {
  success: boolean;
  latencyMs: number;
  models?: string[];
  error?: string;
  testedAt: string;
}

interface ConfigCardProps {
  config: AiConfig;
  companies: Company[];
  isGroupAdmin: boolean;
  accessToken: string;
  onUpdated: () => void;
}

export function ConfigCard({ config, companies, isGroupAdmin, accessToken, onUpdated }: ConfigCardProps) {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: config.name,
    endpoint: config.endpoint,
    modelName: config.modelName,
    isActive: config.isActive,
    apiKey: '',                          // empty = keep existing; filled = update
    changeApiKey: false,                 // toggle to show the input
    allowedCompanyIds: config.allowedCompanyIds as string[] | null,
  });
  const [saving, setSaving] = useState(false);
  const [availableModels, setAvailableModels] = useState<string[]>([]);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    const res = await fetch(`/api/ai-config/${config.id}/test`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const json = await res.json();
    if (json.success) {
      setTestResult(json.data);
      if (json.data.models) setAvailableModels(json.data.models);
    }
    setTesting(false);
  };

  const fetchModels = async () => {
    const res = await fetch(`/api/ai-config/${config.id}/models`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const json = await res.json();
    if (json.success) setAvailableModels(json.data.models ?? []);
  };

  const toggleCompany = (id: string) => {
    setForm((prev) => {
      const current = prev.allowedCompanyIds ?? [];
      const next = current.includes(id) ? current.filter((c) => c !== id) : [...current, id];
      return { ...prev, allowedCompanyIds: next.length === 0 ? null : next };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    const payload: Record<string, unknown> = {
      name: form.name,
      endpoint: form.endpoint,
      modelName: form.modelName,
      isActive: form.isActive,
      allowedCompanyIds: form.allowedCompanyIds,
    };
    // Only send apiKey if user explicitly chose to change it
    if (form.changeApiKey) {
      payload.apiKey = form.apiKey.trim() || null; // empty string → null (clear the key)
    }

    const res = await fetch(`/api/ai-config/${config.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (json.success) {
      setEditing(false);
      onUpdated();
    }
    setSaving(false);
  };

  const allowedLabel = (() => {
    if (!config.allowedCompanyIds) return 'Tất cả công ty';
    const ids = config.allowedCompanyIds as string[];
    if (ids.length === 0) return 'Tất cả công ty';
    const names = ids
      .map((id) => companies.find((c) => c.id === id)?.name ?? id)
      .join(', ');
    return names;
  })();

  return (
    <div className={`border rounded-xl p-5 bg-white space-y-4 ${!config.isActive ? 'opacity-60' : ''}`}>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <span className={`w-2.5 h-2.5 rounded-full ${testResult ? (testResult.success ? 'bg-green-500' : 'bg-red-500') : config.isActive ? 'bg-yellow-400' : 'bg-gray-300'}`} />
          <div>
            <h3 className="font-semibold text-gray-900">{config.name}</h3>
            <p className="text-xs text-muted-foreground font-mono">{config.endpoint}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleTest}
            disabled={testing}
            className="px-3 py-1.5 text-xs border rounded hover:bg-gray-50 disabled:opacity-50"
          >
            {testing ? 'Testing...' : 'Test kết nối'}
          </button>
          <button
            onClick={() => { setEditing(true); fetchModels(); }}
            className="px-3 py-1.5 text-xs border rounded hover:bg-gray-50"
          >
            Chỉnh sửa
          </button>
        </div>
      </div>

      {/* Meta info row */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="text-xs text-muted-foreground">
          Model: <code className="bg-gray-100 px-1.5 py-0.5 rounded">{config.modelName}</code>
        </span>
        <span className="text-xs text-muted-foreground">
          API key: {config.apiKey
            ? <span className="text-green-700 font-medium">Đã cấu hình</span>
            : <span className="text-gray-400">Không dùng</span>}
        </span>
        <span className="text-xs text-muted-foreground">
          Phạm vi: <span className="text-gray-700">{allowedLabel}</span>
        </span>
      </div>

      {/* Test result */}
      {testResult && (
        <div className={`rounded-lg p-3 text-sm ${testResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
          {testResult.success ? (
            <>
              <p className="text-green-700 font-medium">✓ Kết nối thành công ({testResult.latencyMs}ms)</p>
              {testResult.models && testResult.models.length > 0 && (
                <p className="text-green-600 text-xs mt-1">
                  {testResult.models.length} models: {testResult.models.slice(0, 3).join(', ')}{testResult.models.length > 3 ? '...' : ''}
                </p>
              )}
            </>
          ) : (
            <p className="text-red-700">✗ {testResult.error}</p>
          )}
          <p className="text-xs text-muted-foreground mt-1">
            Kiểm tra lúc {new Date(testResult.testedAt).toLocaleTimeString('vi-VN')}
          </p>
        </div>
      )}

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="font-semibold">Chỉnh sửa: {config.name}</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-600 block mb-1">Tên</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full border rounded px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-600 block mb-1">Endpoint URL</label>
                <input
                  type="url"
                  value={form.endpoint}
                  onChange={(e) => setForm({ ...form, endpoint: e.target.value })}
                  className="w-full border rounded px-3 py-2 text-sm font-mono"
                  placeholder="http://192.168.1.100:11434"
                />
              </div>
              <div>
                <label className="text-xs text-gray-600 block mb-1">Model name</label>
                {availableModels.length > 0 ? (
                  <select
                    value={form.modelName}
                    onChange={(e) => setForm({ ...form, modelName: e.target.value })}
                    className="w-full border rounded px-3 py-2 text-sm"
                  >
                    {availableModels.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={form.modelName}
                    onChange={(e) => setForm({ ...form, modelName: e.target.value })}
                    className="w-full border rounded px-3 py-2 text-sm font-mono"
                    placeholder="qwen2.5:14b"
                  />
                )}
                {availableModels.length === 0 && (
                  <p className="text-xs text-muted-foreground mt-1">Test kết nối để xem danh sách models thực tế</p>
                )}
              </div>

              {/* API Key section */}
              <div className="border rounded p-3 space-y-2 bg-gray-50">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-600">
                    API Key hiện tại:{' '}
                    {config.apiKey
                      ? <span className="text-green-700 font-medium">Đã cấu hình</span>
                      : <span className="text-gray-400">Chưa có</span>}
                  </span>
                  <label className="flex items-center gap-1.5 cursor-pointer text-xs text-blue-600">
                    <input
                      type="checkbox"
                      checked={form.changeApiKey}
                      onChange={(e) => setForm({ ...form, changeApiKey: e.target.checked, apiKey: '' })}
                      className="rounded"
                    />
                    Thay đổi API key
                  </label>
                </div>
                {form.changeApiKey && (
                  <div>
                    <input
                      type="password"
                      value={form.apiKey}
                      onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
                      className="w-full border rounded px-3 py-2 text-sm font-mono bg-white"
                      placeholder="Nhập API key mới (để trống = xóa key hiện tại)"
                      autoComplete="new-password"
                    />
                    {form.apiKey === '' && (
                      <p className="text-xs text-amber-600 mt-1">Để trống sẽ xóa API key hiện tại</p>
                    )}
                  </div>
                )}
              </div>

              {/* Company access list */}
              {isGroupAdmin && companies.length > 0 && (
                <div>
                  <label className="text-xs text-gray-600 block mb-1">
                    Công ty được phép sử dụng
                    <span className="text-gray-400 ml-1">(bỏ chọn tất cả = mọi công ty)</span>
                  </label>
                  <div className="border rounded p-2 max-h-40 overflow-y-auto space-y-1 bg-white">
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

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  className="rounded"
                />
                <span className="text-sm">Kích hoạt</span>
              </label>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setEditing(false)} className="px-4 py-2 text-sm border rounded hover:bg-gray-50">
                Hủy
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Đang lưu...' : 'Lưu'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
