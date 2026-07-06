'use client';

import { useAuth } from '@/components/providers/auth-provider';
import { useEffect, useRef, useState } from 'react';
import { CheckCircle, Download } from 'lucide-react';
import { useToast } from '@/components/ui/toast';

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

const STEPS: ImportStep[] = ['upload', 'validate', 'execute', 'done'];
const STEP_LABELS: Record<ImportStep, string> = { upload: 'Tải file', validate: 'Xác thực', execute: 'Nhập dữ liệu', done: 'Hoàn thành' };

export default function ImportPage() {
  const { accessToken } = useAuth();
  const { toast } = useToast();
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

  const [fullTplLoading, setFullTplLoading] = useState(false);

  const downloadFullTemplate = async () => {
    setFullTplLoading(true);
    try {
      const res = await fetch('/api/import/templates?type=full', { headers: authHeader });
      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.error ?? `Lỗi tải template (HTTP ${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'template_nhansu_day_du.xlsx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      toast('error', err instanceof Error ? err.message : 'Không thể tải template. Vui lòng thử lại.');
    } finally {
      setFullTplLoading(false);
    }
  };

  const currentStepIdx = STEPS.indexOf(step);

  return (
    <div className="max-w-3xl mx-auto space-y-4">

      {/* Full template banner */}
      <div className="flex items-center justify-between p-3 bg-success-tint border border-success/20 rounded-xl">
        <div>
          <p className="text-[12px] font-medium text-success flex items-center gap-1.5">
            <Download size={13} /> Template đầy đủ (OrgChart + Vị trí + Nhân viên)
          </p>
          <p className="text-[11px] text-success/70 mt-0.5">Có dropdown dropdown chọn phòng ban, chức danh, framework, lộ trình — lấy từ dữ liệu công ty bạn</p>
        </div>
        <button
          onClick={downloadFullTemplate}
          disabled={fullTplLoading}
          className="px-3 py-1.5 bg-success hover:bg-success/90 text-white text-[11px] font-medium rounded-lg transition-colors flex-shrink-0 disabled:opacity-60"
        >
          {fullTplLoading ? 'Đang tải...' : '↓ Tải template đầy đủ'}
        </button>
      </div>

      {/* Type tabs */}
      <div className="flex gap-1 border-b border-default">
        {(['users', 'organizations', 'job_positions'] as ImportType[]).map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); reset(); }}
            className={`px-4 py-2.5 text-[12px] font-medium border-b-2 -mb-px transition-colors ${
              tab === t
                ? 'border-primary text-primary'
                : 'border-transparent text-subtle hover:text-content'
            }`}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => {
          const isDone = currentStepIdx > i;
          const isCurrent = step === s;
          return (
            <div key={s} className="flex items-center gap-2">
              {i > 0 && <div className="h-px w-8 bg-default" />}
              <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium transition-colors ${
                isCurrent
                  ? 'bg-primary-tint text-primary'
                  : isDone
                  ? 'bg-success-tint text-success'
                  : 'text-faint'
              }`}>
                {STEP_LABELS[s]}
              </span>
            </div>
          );
        })}
      </div>

      {/* Upload step */}
      {step === 'upload' && (
        <div className="bg-surface border border-default rounded-xl shadow-card p-4 space-y-4">
          {/* Template download */}
          <div className="flex items-center justify-between p-3 bg-primary-tint border border-primary/15 rounded-lg">
            <div>
              <p className="text-[12px] font-medium text-primary">Tải file mẫu</p>
              <p className="text-[11px] text-primary/70 mt-0.5">Dùng file mẫu để đảm bảo định dạng đúng</p>
            </div>
            <a
              href={`/api/import/templates?type=${TEMPLATE_TYPES[tab]}`}
              download
              className="px-3 py-1.5 bg-primary hover:bg-primary-dark text-white text-[11px] font-medium rounded-lg transition-colors flex-shrink-0"
            >
              ↓ Tải file mẫu (.xlsx)
            </a>
          </div>
          <div className="space-y-1.5">
            <label className="block text-[12px] font-medium text-content">
              Chọn file Excel (.xlsx, .xls)
            </label>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-[12px] text-subtle file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-[11px] file:font-medium file:bg-primary-tint file:text-primary hover:file:bg-primary/15 transition-colors"
            />
          </div>
          {file && (
            <p className="text-[12px] text-subtle">File đã chọn: <strong className="text-content">{file.name}</strong></p>
          )}
          {error && (
            <div className="bg-danger-tint border border-danger/20 rounded-lg px-3 py-2 text-[12px] text-danger">{error}</div>
          )}
          <button
            onClick={handleValidate}
            disabled={!file || isLoading}
            className="px-4 py-2 text-[12px] bg-primary hover:bg-primary-dark text-white rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            {isLoading ? 'Đang xác thực...' : 'Xác thực file'}
          </button>
        </div>
      )}

      {/* Validate step */}
      {step === 'validate' && validationResult && (
        <div className="bg-surface border border-default rounded-xl shadow-card p-4 space-y-4">
          <div className="flex items-center gap-6">
            <div className="text-center">
              <div className="text-[20px] font-medium text-content">{validationResult.totalRows}</div>
              <div className="text-[11px] text-faint">Tổng dòng</div>
            </div>
            <div className="text-center">
              <div className="text-[20px] font-medium text-success">{validationResult.validRows}</div>
              <div className="text-[11px] text-faint">Hợp lệ</div>
            </div>
            <div className="text-center">
              <div className="text-[20px] font-medium text-danger">{validationResult.errors.length}</div>
              <div className="text-[11px] text-faint">Lỗi</div>
            </div>
          </div>

          {validationResult.errors.length > 0 && (
            <div className="border border-default rounded-lg overflow-hidden">
              <div className="bg-danger-tint px-4 py-2 text-[10px] font-medium text-danger uppercase tracking-wide">Danh sách lỗi</div>
              <div className="max-h-48 overflow-y-auto">
                {validationResult.errors.map((e, i) => (
                  <div key={i} className="px-4 py-2 text-[11px] text-subtle border-b border-default last:border-0">
                    <span className="font-medium text-content">Dòng {e.row}</span> · {e.field}: {e.message}
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="bg-danger-tint border border-danger/20 rounded-lg px-3 py-2 text-[12px] text-danger">{error}</div>
          )}

          <div className="flex gap-2">
            <button
              onClick={reset}
              className="px-4 py-2 text-[12px] border border-default rounded-lg text-subtle hover:bg-muted transition-colors"
            >
              Chọn lại
            </button>
            {validationResult.validRows > 0 && (
              <button
                onClick={handleExecute}
                disabled={isLoading}
                className="px-4 py-2 text-[12px] bg-success hover:bg-success/90 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                {isLoading ? 'Đang import...' : `Import ${validationResult.validRows} dòng hợp lệ`}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Execute step */}
      {step === 'execute' && (
        <div className="bg-surface border border-default rounded-xl shadow-card p-8 text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-[12px] text-subtle">Đang nhập dữ liệu, vui lòng chờ...</p>
        </div>
      )}

      {/* Done step */}
      {step === 'done' && (
        <div className="bg-surface border border-default rounded-xl shadow-card p-8 text-center space-y-3">
          <div className="w-12 h-12 bg-success-tint rounded-full flex items-center justify-center mx-auto">
            <CheckCircle size={24} className="text-success" />
          </div>
          <p className="text-[13px] font-medium text-content">Import hoàn thành!</p>
          <button
            onClick={reset}
            className="px-4 py-2 text-[12px] bg-primary hover:bg-primary-dark text-white rounded-lg font-medium transition-colors"
          >
            Import tiếp
          </button>
        </div>
      )}

      {/* History */}
      <div className="space-y-3">
        <p className="text-[13px] font-medium text-content">Lịch sử import</p>
        {historyLoading ? (
          <div className="text-[12px] text-faint">Đang tải...</div>
        ) : history.length === 0 ? (
          <div className="text-[12px] text-faint">Chưa có lịch sử import</div>
        ) : (
          <div className="bg-surface border border-default rounded-xl shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-default">
                    <th className="text-left text-[10px] text-faint font-medium px-4 py-2.5">Loại</th>
                    <th className="text-left text-[10px] text-faint font-medium px-4 py-2.5">Trạng thái</th>
                    <th className="text-right text-[10px] text-faint font-medium px-4 py-2.5">Tổng</th>
                    <th className="text-right text-[10px] text-faint font-medium px-4 py-2.5">Thành công</th>
                    <th className="text-right text-[10px] text-faint font-medium px-4 py-2.5">Lỗi</th>
                    <th className="text-left text-[10px] text-faint font-medium px-4 py-2.5">Thời gian</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h) => (
                    <tr key={h.id} className="border-b border-default last:border-0 hover:bg-muted transition-colors">
                      <td className="px-4 py-2.5 text-[12px] text-subtle">{h.importType}</td>
                      <td className="px-4 py-2.5">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                          h.status === 'completed'
                            ? 'bg-success-tint text-success'
                            : h.status === 'failed'
                            ? 'bg-danger-tint text-danger'
                            : 'bg-muted text-faint'
                        }`}>
                          {h.status}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right text-[12px] text-subtle">{h.totalRows}</td>
                      <td className="px-4 py-2.5 text-right text-[12px] text-success">{h.successRows}</td>
                      <td className="px-4 py-2.5 text-right text-[12px] text-danger">{h.errorRows}</td>
                      <td className="px-4 py-2.5 text-[11px] text-faint">
                        {new Date(h.createdAt).toLocaleString('vi-VN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
