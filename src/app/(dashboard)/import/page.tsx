'use client';

import { useAuth } from '@/components/providers/auth-provider';
import { useEffect, useRef, useState } from 'react';

type ImportType = 'organizations' | 'users' | 'job_positions';
type ImportStep = 'upload' | 'validate' | 'execute' | 'done';

const TEMPLATE_TYPES: Record<ImportType, string> = { organizations: 'org_chart', users: 'users', job_positions: 'job_positions' };

interface ValidationResult {
  valid: boolean;
  totalRows: number;
  validRows: number;
  errors: { row: number; field: string; message: string }[];
}

interface HistoryItem {
  id: string;
  importType: string;
  status: string;
  totalRows: number;
  successRows: number;
  errorRows: number;
  createdAt: string;
}

export default function ImportPage() {
  const { accessToken } = useAuth();
  const [tab, setTab] = useState<ImportType>('users');
  const [step, setStep] = useState<ImportStep>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);

  const authHeader = { Authorization: `Bearer ${accessToken}` };

  const loadHistory = () => {
    setHistoryLoading(true);
    fetch('/api/import/history', { headers: authHeader })
      .then((r) => r.json())
      .then((res) => { if (res.success) setHistory(res.data ?? []); })
      .catch(() => {})
      .finally(() => setHistoryLoading(false));
  };

  useEffect(() => { if (accessToken) loadHistory(); }, [accessToken]); // eslint-disable-line

  const reset = () => {
    setStep('upload');
    setFile(null);
    setValidationResult(null);
    setError(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleValidate = async () => {
    if (!file) return;
    setIsLoading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('importType', TEMPLATE_TYPES[tab]);
      const res = await fetch('/api/import/validate', {
        method: 'POST',
        headers: authHeader,
        body: fd,
      }).then((r) => r.json());

      if (res.success) {
        setValidationResult(res.data);
        setStep('validate');
      } else {
        setError(res.error ?? 'Xác thực thất bại');
      }
    } catch {
      setError('Lỗi kết nối');
    } finally {
      setIsLoading(false);
    }
  };

  const handleExecute = async () => {
    if (!file) return;
    setIsLoading(true);
    setError(null);
    setStep('execute');
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('importType', TEMPLATE_TYPES[tab]);
      const res = await fetch('/api/import/execute', {
        method: 'POST',
        headers: authHeader,
        body: fd,
      }).then((r) => r.json());

      if (res.success) {
        setStep('done');
        loadHistory();
      } else {
        setError(res.error ?? 'Import thất bại');
        setStep('validate');
      }
    } catch {
      setError('Lỗi kết nối');
      setStep('validate');
    } finally {
      setIsLoading(false);
    }
  };

  const TAB_LABELS: Record<ImportType, string> = { organizations: 'Tổ chức', users: 'Người dùng', job_positions: 'Vị trí công việc' };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Nhập liệu</h1>
        <p className="text-sm text-gray-500 mt-0.5">Import dữ liệu tổ chức và người dùng từ file Excel</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b">
        {(['users', 'organizations', 'job_positions'] as ImportType[]).map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); reset(); }}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 text-xs text-gray-400">
        {(['upload', 'validate', 'execute', 'done'] as ImportStep[]).map((s, i) => {
          const labels: Record<ImportStep, string> = { upload: 'Tải file', validate: 'Xác thực', execute: 'Nhập dữ liệu', done: 'Hoàn thành' };
          const isDone = ['upload', 'validate', 'execute', 'done'].indexOf(step) > i;
          const isCurrent = step === s;
          return (
            <div key={s} className="flex items-center gap-2">
              {i > 0 && <div className="h-px w-8 bg-gray-200" />}
              <span className={`px-2 py-0.5 rounded-full ${
                isCurrent ? 'bg-blue-100 text-blue-700 font-medium' :
                isDone ? 'bg-green-100 text-green-700' : ''
              }`}>
                {labels[s]}
              </span>
            </div>
          );
        })}
      </div>

      {/* Upload step */}
      {step === 'upload' && (
        <div className="bg-white rounded-xl border p-6 space-y-4">
          {/* Template download */}
          <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-100">
            <div>
              <p className="text-sm font-medium text-blue-800">Tải file mẫu</p>
              <p className="text-xs text-blue-600 mt-0.5">Dùng file mẫu để đảm bảo định dạng đúng</p>
            </div>
            <a
              href={`/api/import/templates?type=${TEMPLATE_TYPES[tab]}`}
              download
              className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 shrink-0"
            >
              ↓ Tải file mẫu (.xlsx)
            </a>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Chọn file Excel (.xlsx, .xls)
            </label>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>
          {file && (
            <p className="text-sm text-gray-500">File đã chọn: <strong>{file.name}</strong></p>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            onClick={handleValidate}
            disabled={!file || isLoading}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {isLoading ? 'Đang xác thực...' : 'Xác thực file'}
          </button>
        </div>
      )}

      {/* Validate step */}
      {step === 'validate' && validationResult && (
        <div className="bg-white rounded-xl border p-6 space-y-4">
          <div className="flex items-center gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{validationResult.totalRows}</div>
              <div className="text-xs text-gray-500">Tổng dòng</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{validationResult.validRows}</div>
              <div className="text-xs text-gray-500">Hợp lệ</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-500">{validationResult.errors.length}</div>
              <div className="text-xs text-gray-500">Lỗi</div>
            </div>
          </div>

          {validationResult.errors.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-red-50 px-4 py-2 text-xs font-medium text-red-700">Danh sách lỗi</div>
              <div className="max-h-48 overflow-y-auto divide-y">
                {validationResult.errors.map((e, i) => (
                  <div key={i} className="px-4 py-2 text-xs text-gray-600">
                    <span className="font-medium">Dòng {e.row}</span> · {e.field}: {e.message}
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-3">
            <button onClick={reset} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">
              Chọn lại
            </button>
            {validationResult.validRows > 0 && (
              <button
                onClick={handleExecute}
                disabled={isLoading}
                className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {isLoading ? 'Đang import...' : `Import ${validationResult.validRows} dòng hợp lệ`}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Execute step */}
      {step === 'execute' && (
        <div className="bg-white rounded-xl border p-6 text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">Đang nhập dữ liệu, vui lòng chờ...</p>
        </div>
      )}

      {/* Done step */}
      {step === 'done' && (
        <div className="bg-white rounded-xl border p-6 text-center space-y-3">
          <div className="text-4xl">✓</div>
          <p className="text-base font-medium text-green-700">Import hoàn thành!</p>
          <button onClick={reset} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
            Import tiếp
          </button>
        </div>
      )}

      {/* History */}
      <div className="space-y-3">
        <h2 className="text-base font-semibold text-gray-800">Lịch sử import</h2>
        {historyLoading ? (
          <div className="text-sm text-gray-400">Đang tải...</div>
        ) : history.length === 0 ? (
          <div className="text-sm text-gray-400">Chưa có lịch sử import</div>
        ) : (
          <div className="bg-white rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left px-4 py-2.5 font-medium text-gray-600">Loại</th>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-600">Trạng thái</th>
                  <th className="text-right px-4 py-2.5 font-medium text-gray-600">Tổng</th>
                  <th className="text-right px-4 py-2.5 font-medium text-gray-600">Thành công</th>
                  <th className="text-right px-4 py-2.5 font-medium text-gray-600">Lỗi</th>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-600">Thời gian</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {history.map((h) => (
                  <tr key={h.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 text-gray-700">{h.importType}</td>
                    <td className="px-4 py-2.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        h.status === 'completed' ? 'bg-green-100 text-green-700' :
                        h.status === 'failed' ? 'bg-red-100 text-red-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {h.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right text-gray-500">{h.totalRows}</td>
                    <td className="px-4 py-2.5 text-right text-green-600">{h.successRows}</td>
                    <td className="px-4 py-2.5 text-right text-red-500">{h.errorRows}</td>
                    <td className="px-4 py-2.5 text-gray-400 text-xs">
                      {new Date(h.createdAt).toLocaleString('vi-VN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
