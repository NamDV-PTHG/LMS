'use client';

import React, { useRef, useState } from 'react';

interface ExternalMemberSearchProps {
  groupId: string;
  accessToken: string;
  onAdded: () => void;
}

interface ImportResult {
  email: string;
  status: 'added' | 'created' | 'skipped' | 'error';
  message?: string;
}

export function ExternalMemberSearch({ groupId, accessToken, onAdded }: ExternalMemberSearchProps) {
  // ── Single email add ──────────────────────────────────────────
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'warning' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [wasCreated, setWasCreated] = useState(false);

  // ── Bulk import ───────────────────────────────────────────────
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importSummary, setImportSummary] = useState<{
    total: number; added: number; created: number; skipped: number; errors: number;
    results: ImportResult[];
  } | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  // ── Single add handler ────────────────────────────────────────
  const handleAdd = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
      setStatus('warning');
      setMessage('Định dạng email không hợp lệ. Vui lòng kiểm tra lại.');
      return;
    }

    setStatus('loading');
    setMessage('');
    setWasCreated(false);

    try {
      const res = await fetch(`/api/learning-groups/${groupId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ identifier: trimmed }),
      });
      const json = await res.json();

      if (!json.success) {
        setStatus('warning');
        setMessage(json.error ?? 'Không thể thêm thành viên này');
        return;
      }

      const created = json.data?.wasCreated ?? false;
      setWasCreated(created);
      setStatus('success');
      setMessage(
        created
          ? `Đã tạo tài khoản và gửi thông tin đăng nhập đến ${trimmed}`
          : `Đã thêm ${trimmed} vào nhóm`,
      );
      setEmail('');
      onAdded();
    } catch {
      setStatus('error');
      setMessage('Lỗi kết nối. Vui lòng thử lại.');
    }
  };

  // ── Download template ─────────────────────────────────────────
  const handleDownloadTemplate = () => {
    const link = document.createElement('a');
    link.href = `/api/learning-groups/${groupId}/members/import`;
    link.setAttribute('Authorization', `Bearer ${accessToken}`); // won't work in anchor
    // Use fetch to trigger download with auth header
    fetch(`/api/learning-groups/${groupId}/members/import`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((r) => r.blob())
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'external-members-template.csv';
        a.click();
        URL.revokeObjectURL(url);
      })
      .catch(() => {});
  };

  // ── File import handler ───────────────────────────────────────
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportSummary(null);
    setShowDetails(false);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`/api/learning-groups/${groupId}/members/import`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: formData,
      });
      const json = await res.json();

      if (json.success) {
        setImportSummary(json.data);
        onAdded();
      } else {
        setImportSummary(null);
        setStatus('error');
        setMessage(json.error ?? 'Lỗi import file');
      }
    } catch {
      setStatus('error');
      setMessage('Lỗi kết nối khi import file');
    } finally {
      setImporting(false);
      // Reset file input so same file can be re-selected
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  // ── Render ────────────────────────────────────────────────────
  const statusBg = {
    success: 'bg-green-50 text-green-700',
    warning: 'bg-amber-50 text-amber-700',
    error: 'bg-red-50 text-red-700',
  };
  const statusIcon = { success: wasCreated ? '✓ Tài khoản mới: ' : '✓ ', warning: '⚠ ', error: '✕ ' };

  return (
    <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 space-y-3">
      <div>
        <p className="text-sm font-medium text-orange-800">+ Thêm người dùng ngoài hệ thống</p>
        <p className="text-xs text-orange-600 mt-0.5">
          Nhập email — nếu chưa có tài khoản, hệ thống sẽ tự tạo và gửi thông tin đăng nhập.
        </p>
      </div>

      {/* Single email input */}
      <div className="flex gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setStatus('idle'); setMessage(''); }}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder="email@domain.com"
          className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
          disabled={status === 'loading'}
        />
        <button
          onClick={handleAdd}
          disabled={status === 'loading' || !email.trim()}
          className="px-4 py-2 bg-orange-500 text-white text-sm font-medium rounded-lg hover:bg-orange-600 disabled:opacity-50 whitespace-nowrap"
        >
          {status === 'loading' ? 'Đang xử lý...' : 'Thêm'}
        </button>
      </div>

      {/* Status message */}
      {message && status !== 'idle' && status !== 'loading' && (
        <p className={`text-xs px-3 py-1.5 rounded-lg ${statusBg[status as 'success' | 'warning' | 'error']}`}>
          {statusIcon[status as 'success' | 'warning' | 'error']}{message}
        </p>
      )}

      {/* Divider */}
      <div className="flex items-center gap-2 pt-1">
        <div className="flex-1 h-px bg-orange-200" />
        <span className="text-xs text-orange-400">hoặc nhập từ file</span>
        <div className="flex-1 h-px bg-orange-200" />
      </div>

      {/* Bulk import row */}
      <div className="flex flex-wrap gap-2 items-center">
        <button
          onClick={handleDownloadTemplate}
          className="px-3 py-1.5 text-xs border border-orange-300 text-orange-700 rounded-lg hover:bg-orange-100 whitespace-nowrap"
        >
          ↓ Tải file mẫu (CSV)
        </button>
        <label className={`px-3 py-1.5 text-xs rounded-lg whitespace-nowrap cursor-pointer transition-colors
          ${importing
            ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
            : 'bg-orange-500 text-white hover:bg-orange-600'}`}
        >
          {importing ? 'Đang import...' : '↑ Import từ file (CSV / Excel)'}
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            disabled={importing}
            onChange={handleFileChange}
          />
        </label>
        <span className="text-[11px] text-orange-500">Tối đa 200 email mỗi lần</span>
      </div>

      {/* Import results summary */}
      {importSummary && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2 text-xs">
            {importSummary.added > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                +{importSummary.added} thêm vào nhóm
              </span>
            )}
            {importSummary.created > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                +{importSummary.created} tạo tài khoản mới
              </span>
            )}
            {importSummary.skipped > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                {importSummary.skipped} bỏ qua (đã tồn tại)
              </span>
            )}
            {importSummary.errors > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                {importSummary.errors} lỗi
              </span>
            )}
          </div>

          {importSummary.errors > 0 && (
            <button
              onClick={() => setShowDetails((v) => !v)}
              className="text-xs text-orange-600 hover:underline"
            >
              {showDetails ? 'Ẩn chi tiết' : 'Xem chi tiết lỗi'}
            </button>
          )}

          {showDetails && (
            <div className="max-h-40 overflow-y-auto border rounded-lg divide-y text-xs bg-white">
              {importSummary.results
                .filter((r) => r.status === 'error')
                .map((r) => (
                  <div key={r.email} className="px-3 py-1.5 flex justify-between gap-2">
                    <span className="text-gray-700 font-mono truncate">{r.email}</span>
                    <span className="text-red-600 shrink-0">{r.message}</span>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
