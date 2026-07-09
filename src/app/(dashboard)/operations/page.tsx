'use client';

import { useAuth } from '@/components/providers/auth-provider';
import { useToast } from '@/components/ui/toast';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useEffect, useState, useCallback, useRef } from 'react';
import { RefreshCw, Database, Archive, RotateCcw, Play, ChevronDown, AlertTriangle, ClipboardList, ChevronLeft, ChevronRight } from 'lucide-react';

interface SystemInfo {
  platform: string;
  nodeVersion: string;
  uptimeSeconds: number;
  memory: {
    totalMB: number; usedMB: number; freeMB: number; usedPct: number;
    processMB: number; heapUsedMB: number; heapTotalMB: number;
  };
}

interface CompanyStat {
  id: string; name: string; code: string;
  users: number; onlineNow: number; enrollments: number; completed: number;
}

interface OperationsData {
  system: SystemInfo;
  online: { total: number; windowMinutes: number };
  stats: {
    totalUsers: number; activeUsers: number; totalCourses: number;
    totalEnrollments: number; completedEnrollments: number;
  };
  companies: CompanyStat[];
  generatedAt: string;
}

const REFRESH_INTERVAL = 30;

function fmtUptime(sec: number) {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function MemBar({ pct, variant = 'primary' }: { pct: number; variant?: 'primary' | 'success' | 'warning' | 'danger' }) {
  const autoColor = pct > 85 ? 'bg-danger' : pct > 65 ? 'bg-warning' : `bg-${variant}`;
  return (
    <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
      <div className={`h-full rounded-full transition-all duration-500 ${autoColor}`} style={{ width: `${Math.min(pct, 100)}%` }} />
    </div>
  );
}

function StatCard({ label, value, sub, color = 'text-content' }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="bg-surface border border-default rounded-xl shadow-card p-4 space-y-1">
      <p className="text-[9px] font-medium text-faint uppercase tracking-widest">{label}</p>
      <p className={`text-[20px] font-medium leading-none ${color}`}>{typeof value === 'number' ? value.toLocaleString() : value}</p>
      {sub && <p className="text-[11px] text-faint">{sub}</p>}
    </div>
  );
}

interface BackupJobRecord {
  id: string; type: string; status: string; destination: string;
  objectPrefix: string | null; dbDumpPath: string | null;
  sizeBytes: string | null; fileCount: number | null;
  error: string | null; restoreNote: string | null; restoredAt: string | null;
  startedAt: string; completedAt: string | null;
  triggeredBy: { fullName: string; email: string };
}

interface CompanyOption { id: string; name: string; code: string; }

function fmtBytes(bytes: string | null): string {
  if (!bytes) return '—';
  const n = Number(bytes);
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)} GB`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)} MB`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)} KB`;
  return `${n} B`;
}

const STATUS_STYLE: Record<string, string> = {
  PENDING:   'bg-muted text-faint',
  RUNNING:   'bg-primary-tint text-primary animate-pulse',
  COMPLETED: 'bg-success-tint text-success',
  FAILED:    'bg-danger-tint text-danger',
  RESTORING: 'bg-warning-tint text-warning animate-pulse',
  RESTORED:  'bg-purple-50 text-purple-600',
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Chờ', RUNNING: 'Đang chạy', COMPLETED: 'Hoàn thành',
  FAILED: 'Thất bại', RESTORING: 'Đang phục hồi', RESTORED: 'Đã phục hồi',
};

export default function OperationsPage() {
  const { accessToken, user } = useAuth();
  const { toast } = useToast();
  const [data,        setData]        = useState<OperationsData | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState('');
  const [countdown,   setCountdown]   = useState(REFRESH_INTERVAL);
  const [lastRefresh, setLastRefresh] = useState('');
  const [activeTab,   setActiveTab]   = useState<'system' | 'backup' | 'activity'>('system');

  // Backup state
  const [backupJobs,     setBackupJobs]     = useState<BackupJobRecord[]>([]);
  const [backupLoading,  setBackupLoading]  = useState(false);
  const [triggerOpen,    setTriggerOpen]    = useState(false);
  const [restoreDialog,  setRestoreDialog]  = useState<{
    jobId: string; type: 'db' | 'assets' | 'full';
    job: BackupJobRecord; scopeCompanyId: string;
  } | null>(null);
  const [companyOpts,    setCompanyOpts]    = useState<CompanyOption[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Activity log state
  interface ActivityLogItem {
    id: string; companyId: string; userId: string; userFullName: string;
    action: 'CREATE' | 'UPDATE' | 'DELETE'; resource: string;
    resourceId: string; resourceTitle: string; ipAddress: string | null;
    createdAt: string;
  }
  const [activityLogs,    setActivityLogs]    = useState<ActivityLogItem[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityPage,    setActivityPage]    = useState(1);
  const [activityTotal,   setActivityTotal]   = useState(0);
  const [activityFilter,  setActivityFilter]  = useState({ resource: '', action: '' });
  const ACTIVITY_LIMIT = 20;

  const userRoles: string[] = ((user?.roles ?? []) as Array<{ role: string } | string>).map((r) =>
    typeof r === 'string' ? r : r.role,
  );
  const isGroupAdmin    = userRoles.includes('group_admin');
  const isCompanyAdmin  = userRoles.includes('company_admin');
  // company_admin chỉ thấy tab Nhật ký — mặc định vào đó ngay
  const canSeeSystem    = isGroupAdmin;

  const fetchBackupJobs = useCallback(async () => {
    if (!accessToken || !isGroupAdmin) return;
    setBackupLoading(true);
    try {
      const res = await fetch('/api/admin/backup', { headers: { Authorization: `Bearer ${accessToken}` } }).then((r) => r.json());
      if (res.success) setBackupJobs(res.data ?? []);
    } catch { /* ignore */ }
    finally { setBackupLoading(false); }
  }, [accessToken, isGroupAdmin]);

  const fetchActivityLogs = useCallback(async (page = 1, filter = activityFilter) => {
    if (!accessToken) return;
    setActivityLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(ACTIVITY_LIMIT) });
      if (filter.resource) params.set('resource', filter.resource);
      if (filter.action) params.set('action', filter.action);
      const res = await fetch(`/api/activity-logs?${params}`, { headers: { Authorization: `Bearer ${accessToken}` } }).then((r) => r.json());
      if (res.success) {
        setActivityLogs(res.data ?? []);
        setActivityTotal(res.meta?.total ?? 0);
        setActivityPage(page);
      }
    } catch { /* ignore */ }
    finally { setActivityLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  useEffect(() => {
    if (activeTab === 'backup') {
      fetchBackupJobs();
      // Load companies for restore scope selector
      if (companyOpts.length === 0 && accessToken) {
        fetch('/api/organizations?type=company&limit=100', { headers: { Authorization: `Bearer ${accessToken}` } })
          .then((r) => r.json())
          .then((res) => { if (res.success) setCompanyOpts(res.data ?? []); })
          .catch(() => {});
      }
    }
    if (activeTab === 'activity') {
      fetchActivityLogs(1, activityFilter);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // Auto-poll when any job is RUNNING / RESTORING / PENDING
  useEffect(() => {
    const hasActive = backupJobs.some((j) => ['RUNNING', 'RESTORING', 'PENDING'].includes(j.status));
    if (hasActive && !pollRef.current) {
      pollRef.current = setInterval(fetchBackupJobs, 3000);
    } else if (!hasActive && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    };
  }, [backupJobs, fetchBackupJobs]);

  const triggerBackup = async (type: 'FULL' | 'DB_ONLY' | 'ASSETS_ONLY') => {
    setTriggerOpen(false);
    try {
      const res = await fetch('/api/admin/backup', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      }).then((r) => r.json());
      if (res.success) {
        toast('success', 'Backup job đã được thêm vào hàng đợi');
        setTimeout(fetchBackupJobs, 1500);
      } else {
        toast('error', res.error ?? 'Không thể tạo backup');
      }
    } catch { toast('error', 'Lỗi kết nối'); }
  };

  const triggerRestore = async (reason: string) => {
    if (!restoreDialog) return;
    const { jobId, type, scopeCompanyId } = restoreDialog;
    setRestoreDialog(null);
    try {
      const res = await fetch(`/api/admin/backup/${jobId}/restore`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restoreDb: type === 'db' || type === 'full',
          restoreAssets: type === 'assets' || type === 'full',
          scopeCompanyId: scopeCompanyId || null,
          reason,
        }),
      }).then((r) => r.json());
      if (res.success) {
        toast('info', 'Quá trình khôi phục đã bắt đầu — tự động cập nhật trạng thái');
        fetchBackupJobs();
      } else {
        toast('error', res.error ?? 'Khôi phục thất bại');
      }
    } catch { toast('error', 'Lỗi kết nối'); }
  };

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/operations', { headers: { Authorization: `Bearer ${accessToken}` } });
      const json = await res.json();
      if (json.success) {
        setData(json.data);
        setLastRefresh(new Date().toLocaleTimeString('vi-VN'));
        setError('');
      } else {
        setError(json.error ?? 'Lỗi tải dữ liệu');
      }
    } catch {
      setError('Không thể kết nối API');
    } finally {
      setLoading(false);
      setCountdown(REFRESH_INTERVAL);
    }
  }, [accessToken]);

  // company_admin không có tab System → chuyển sang Nhật ký ngay khi mount
  useEffect(() => {
    if (!canSeeSystem) setActiveTab('activity');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canSeeSystem]);

  useEffect(() => { if (canSeeSystem) fetchData(); }, [fetchData, canSeeSystem]);
  useEffect(() => {
    if (!canSeeSystem) return;
    const interval = setInterval(() => fetchData(), REFRESH_INTERVAL * 1000);
    return () => clearInterval(interval);
  }, [fetchData, canSeeSystem]);
  useEffect(() => {
    const tick = setInterval(() => setCountdown((c) => (c > 0 ? c - 1 : REFRESH_INTERVAL)), 1000);
    return () => clearInterval(tick);
  }, []);

  if (canSeeSystem && loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (canSeeSystem && error) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="bg-danger-tint border border-danger/20 rounded-xl p-4 text-[12px] text-danger">
          <p className="font-medium">Lỗi tải dữ liệu</p>
          <p className="mt-1">{error}</p>
        </div>
      </div>
    );
  }

  const system        = data?.system;
  const online        = data?.online;
  const stats         = data?.stats;
  const companies     = data?.companies ?? [];
  const maxUsers      = Math.max(...companies.map((c) => c.users), 1);
  const completionPct = (stats?.totalEnrollments ?? 0) > 0
    ? Math.round(((stats?.completedEnrollments ?? 0) / (stats?.totalEnrollments ?? 1)) * 100)
    : 0;

  return (
    <div className="max-w-6xl mx-auto space-y-4">

      {/* ConfirmDialog for restore */}
      {restoreDialog && (
        <ConfirmDialog
          open
          title={`Xác nhận khôi phục — ${restoreDialog.type === 'db' ? 'Database' : restoreDialog.type === 'assets' ? 'Assets' : 'Toàn bộ'}`}
          message={
            <div className="space-y-3">
              <div className="bg-muted rounded-lg px-3 py-2 text-[11px] space-y-1">
                <p><span className="text-faint">Backup:</span> <span className="font-medium">{new Date(restoreDialog.job.startedAt).toLocaleString('vi-VN')}</span></p>
                <p><span className="text-faint">Kích thước:</span> <span className="font-medium">{fmtBytes(restoreDialog.job.sizeBytes)}</span> · {restoreDialog.job.fileCount?.toLocaleString() ?? 0} files</p>
                <p><span className="text-faint">Đích:</span> <span className="font-medium">{restoreDialog.job.destination}</span></p>
              </div>
              {(restoreDialog.type === 'assets' || restoreDialog.type === 'full') && companyOpts.length > 0 && (
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-subtle">Phạm vi assets (để trống = toàn bộ)</label>
                  <select
                    value={restoreDialog.scopeCompanyId}
                    onChange={(e) => setRestoreDialog((d) => d ? { ...d, scopeCompanyId: e.target.value } : d)}
                    className="w-full border border-default rounded-lg px-3 py-2 text-[12px] focus:outline-none focus:border-primary bg-surface"
                  >
                    <option value="">Tất cả công ty</option>
                    {companyOpts.map((c) => (
                      <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="flex items-start gap-2 bg-danger-tint rounded-lg px-3 py-2">
                <AlertTriangle size={13} className="text-danger mt-0.5 shrink-0" />
                <p className="text-[11px] text-danger">
                  {restoreDialog.type === 'db' || restoreDialog.type === 'full'
                    ? 'Toàn bộ database sẽ bị ghi đè. App sẽ ngắt kết nối trong vài giây.'
                    : `Assets ${restoreDialog.scopeCompanyId ? 'của công ty đã chọn' : 'tất cả công ty'} sẽ bị ghi đè.`}
                  {' '}Hành động này không thể hoàn tác.
                </p>
              </div>
            </div>
          }
          confirmLabel="Bắt đầu khôi phục"
          variant="danger"
          inputLabel="Nhập lý do khôi phục (bắt buộc)"
          inputRequired
          onConfirm={triggerRestore}
          onCancel={() => setRestoreDialog(null)}
        />
      )}

      {/* Tab switcher */}
      <div className="flex gap-0.5 bg-surface rounded-xl border border-default shadow-card p-1 max-w-sm">
        {[
          ...(canSeeSystem   ? [{ id: 'system',   label: 'Hệ thống', icon: Database }] : []),
          { id: 'activity',    label: 'Nhật ký',   icon: ClipboardList },
          ...(isGroupAdmin   ? [{ id: 'backup',   label: 'Sao lưu',  icon: Archive }]  : []),
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button key={tab.id}
              onClick={() => setActiveTab(tab.id as 'system' | 'backup' | 'activity')}
              className={`flex items-center gap-1.5 flex-1 justify-center px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors ${
                activeTab === tab.id ? 'bg-primary text-white' : 'text-subtle hover:text-content hover:bg-muted'
              }`}>
              <Icon size={13} />{tab.label}
            </button>
          );
        })}
      </div>

      {/* ── BACKUP TAB ── */}
      {activeTab === 'backup' && isGroupAdmin && (
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button onClick={fetchBackupJobs} disabled={backupLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-default rounded-lg text-[12px] text-subtle hover:bg-muted transition-colors disabled:opacity-50">
                <RefreshCw size={13} className={backupLoading ? 'animate-spin' : ''} /> Làm mới
              </button>
            </div>
            {/* Trigger dropdown */}
            <div className="relative">
              <button onClick={() => setTriggerOpen((v) => !v)}
                className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary-dark text-white text-[12px] font-medium rounded-lg transition-colors">
                <Play size={12} /> Tạo backup <ChevronDown size={12} />
              </button>
              {triggerOpen && (
                <div className="absolute right-0 top-full mt-1 w-44 bg-surface border border-default rounded-xl shadow-lg overflow-hidden z-10">
                  {[
                    { type: 'FULL' as const, label: 'Đầy đủ (DB + Assets)' },
                    { type: 'DB_ONLY' as const, label: 'Chỉ Database' },
                    { type: 'ASSETS_ONLY' as const, label: 'Chỉ Assets' },
                  ].map((opt) => (
                    <button key={opt.type} onClick={() => triggerBackup(opt.type)}
                      className="w-full text-left px-4 py-2.5 text-[12px] text-content hover:bg-muted transition-colors border-b border-default last:border-0">
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Job list */}
          {backupLoading && backupJobs.length === 0 ? (
            <div className="bg-surface border border-default rounded-xl shadow-card p-8 text-center text-[12px] text-faint">Đang tải...</div>
          ) : backupJobs.length === 0 ? (
            <div className="bg-surface border border-default rounded-xl shadow-card p-8 text-center text-[12px] text-faint">
              Chưa có backup nào. Cấu hình đích lưu trữ trong <strong>Cài đặt → Backup Storage</strong> rồi tạo backup đầu tiên.
            </div>
          ) : (
            <div className="space-y-3">
              {backupJobs.map((job) => (
                <div key={job.id} className="bg-surface border border-default rounded-xl shadow-card overflow-hidden">
                  <div className="px-4 py-3 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 ${STATUS_STYLE[job.status] ?? 'bg-muted text-faint'}`}>
                        {STATUS_LABEL[job.status] ?? job.status}
                      </span>
                      <div className="min-w-0">
                        <p className="text-[12px] font-medium text-content">
                          {job.type === 'FULL' ? 'Full Backup' : job.type === 'DB_ONLY' ? 'Database Only' : 'Assets Only'}
                          <span className="ml-2 text-[10px] font-normal text-faint">{job.destination}</span>
                        </p>
                        <p className="text-[11px] text-faint">
                          {new Date(job.startedAt).toLocaleString('vi-VN')}
                          {job.completedAt && ` → ${new Date(job.completedAt).toLocaleTimeString('vi-VN')}`}
                          {' · '}{job.triggeredBy.fullName}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[13px] font-medium text-content">{fmtBytes(job.sizeBytes)}</p>
                      {job.fileCount != null && <p className="text-[11px] text-faint">{job.fileCount.toLocaleString()} files</p>}
                    </div>
                  </div>
                  {job.status === 'RESTORING' && (
                    <div className="px-4 pb-3">
                      <div className="flex items-center gap-2 bg-warning-tint rounded-lg px-3 py-2">
                        <div className="w-3 h-3 border-2 border-warning border-t-transparent rounded-full animate-spin shrink-0" />
                        <p className="text-[11px] text-warning">Đang khôi phục… Tự động cập nhật mỗi 3 giây</p>
                      </div>
                    </div>
                  )}
                  {job.restoreNote && (job.status === 'RESTORED' || job.status === 'FAILED') && (
                    <div className="px-4 pb-2">
                      <p className="text-[11px] text-faint">
                        <span className="font-medium">Lý do khôi phục:</span> {job.restoreNote}
                        {job.restoredAt && <span className="ml-2">· {new Date(job.restoredAt).toLocaleString('vi-VN')}</span>}
                      </p>
                    </div>
                  )}
                  {job.error && (
                    <div className="px-4 pb-3">
                      <p className="text-[11px] text-danger bg-danger-tint rounded-lg px-3 py-2">{job.error}</p>
                    </div>
                  )}
                  {job.status === 'COMPLETED' && (
                    <div className="px-4 pb-3 flex gap-2 flex-wrap border-t border-default pt-3">
                      {job.dbDumpPath && (
                        <button onClick={() => setRestoreDialog({ jobId: job.id, type: 'db', job, scopeCompanyId: '' })}
                          className="flex items-center gap-1.5 px-3 py-1.5 border border-danger/30 text-danger bg-danger-tint rounded-lg text-[11px] font-medium hover:bg-danger hover:text-white transition-colors">
                          <RotateCcw size={11} /> Khôi phục DB
                        </button>
                      )}
                      {job.type !== 'DB_ONLY' && (
                        <button onClick={() => setRestoreDialog({ jobId: job.id, type: 'assets', job, scopeCompanyId: '' })}
                          className="flex items-center gap-1.5 px-3 py-1.5 border border-warning/30 text-warning bg-warning-tint rounded-lg text-[11px] font-medium hover:bg-warning hover:text-white transition-colors">
                          <RotateCcw size={11} /> Khôi phục Assets
                        </button>
                      )}
                      {job.type === 'FULL' && (
                        <button onClick={() => setRestoreDialog({ jobId: job.id, type: 'full', job, scopeCompanyId: '' })}
                          className="flex items-center gap-1.5 px-3 py-1.5 border border-default text-subtle rounded-lg text-[11px] font-medium hover:bg-muted transition-colors">
                          <RotateCcw size={11} /> Khôi phục toàn bộ
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── ACTIVITY LOG TAB ── */}
      {activeTab === 'activity' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={activityFilter.resource}
              onChange={(e) => {
                const f = { ...activityFilter, resource: e.target.value };
                setActivityFilter(f);
                fetchActivityLogs(1, f);
              }}
              className="border border-default rounded-lg px-3 py-1.5 text-[12px] focus:outline-none focus:border-primary bg-surface text-content"
            >
              <option value="">Tất cả loại</option>
              {['user', 'course', 'question_bank', 'learning_path'].map((r) => (
                <option key={r} value={r}>{
                  r === 'user' ? 'Người dùng'
                  : r === 'course' ? 'Khóa học'
                  : r === 'question_bank' ? 'Ngân hàng câu hỏi'
                  : 'Lộ trình học'
                }</option>
              ))}
            </select>
            <select
              value={activityFilter.action}
              onChange={(e) => {
                const f = { ...activityFilter, action: e.target.value };
                setActivityFilter(f);
                fetchActivityLogs(1, f);
              }}
              className="border border-default rounded-lg px-3 py-1.5 text-[12px] focus:outline-none focus:border-primary bg-surface text-content"
            >
              <option value="">Tất cả thao tác</option>
              <option value="CREATE">Tạo mới</option>
              <option value="UPDATE">Cập nhật</option>
              <option value="DELETE">Xóa</option>
            </select>
            <button onClick={() => fetchActivityLogs(activityPage, activityFilter)} disabled={activityLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-default rounded-lg text-[12px] text-subtle hover:bg-muted transition-colors disabled:opacity-50">
              <RefreshCw size={13} className={activityLoading ? 'animate-spin' : ''} /> Làm mới
            </button>
            <p className="text-[11px] text-faint ml-auto">Tổng: {activityTotal.toLocaleString()} · tự xóa sau 30 ngày</p>
          </div>

          {/* Log table */}
          <div className="bg-surface border border-default rounded-xl shadow-card overflow-hidden">
            {activityLoading && activityLogs.length === 0 ? (
              <div className="p-8 text-center text-[12px] text-faint">Đang tải...</div>
            ) : activityLogs.length === 0 ? (
              <div className="p-8 text-center text-[12px] text-faint">Chưa có nhật ký nào</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-default bg-muted/40">
                      <th className="text-left text-[10px] text-faint font-medium px-4 py-2.5">Thời gian</th>
                      <th className="text-left text-[10px] text-faint font-medium px-4 py-2.5">Thao tác</th>
                      <th className="text-left text-[10px] text-faint font-medium px-4 py-2.5">Loại</th>
                      <th className="text-left text-[10px] text-faint font-medium px-4 py-2.5">Đối tượng</th>
                      <th className="text-left text-[10px] text-faint font-medium px-4 py-2.5">Người thực hiện</th>
                      <th className="text-left text-[10px] text-faint font-medium px-4 py-2.5">IP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activityLogs.map((log) => {
                      const actionStyle = log.action === 'CREATE'
                        ? 'bg-success-tint text-success'
                        : log.action === 'DELETE'
                        ? 'bg-danger-tint text-danger'
                        : 'bg-primary-tint text-primary';
                      const actionLabel = log.action === 'CREATE' ? 'Tạo' : log.action === 'UPDATE' ? 'Sửa' : 'Xóa';
                      const resourceLabel = log.resource === 'user' ? 'Người dùng'
                        : log.resource === 'course' ? 'Khóa học'
                        : log.resource === 'question_bank' ? 'Ngân hàng câu hỏi'
                        : log.resource === 'learning_path' ? 'Lộ trình học'
                        : log.resource;
                      return (
                        <tr key={log.id} className="border-b border-default last:border-0 hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-2.5 text-[11px] text-subtle whitespace-nowrap">
                            {new Date(log.createdAt).toLocaleString('vi-VN')}
                          </td>
                          <td className="px-4 py-2.5">
                            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${actionStyle}`}>{actionLabel}</span>
                          </td>
                          <td className="px-4 py-2.5 text-[11px] text-subtle">{resourceLabel}</td>
                          <td className="px-4 py-2.5 text-[11px] text-content max-w-[200px] truncate" title={log.resourceTitle}>
                            {log.resourceTitle}
                          </td>
                          <td className="px-4 py-2.5 text-[11px] text-content">{log.userFullName}</td>
                          <td className="px-4 py-2.5 text-[10px] text-faint font-mono">{log.ipAddress ?? '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Pagination */}
          {activityTotal > ACTIVITY_LIMIT && (
            <div className="flex items-center justify-center gap-2">
              <button
                disabled={activityPage <= 1 || activityLoading}
                onClick={() => fetchActivityLogs(activityPage - 1, activityFilter)}
                className="flex items-center gap-1 px-3 py-1.5 border border-default rounded-lg text-[12px] text-subtle hover:bg-muted transition-colors disabled:opacity-40"
              >
                <ChevronLeft size={13} /> Trước
              </button>
              <span className="text-[12px] text-subtle">
                Trang {activityPage} / {Math.ceil(activityTotal / ACTIVITY_LIMIT)}
              </span>
              <button
                disabled={activityPage >= Math.ceil(activityTotal / ACTIVITY_LIMIT) || activityLoading}
                onClick={() => fetchActivityLogs(activityPage + 1, activityFilter)}
                className="flex items-center gap-1 px-3 py-1.5 border border-default rounded-lg text-[12px] text-subtle hover:bg-muted transition-colors disabled:opacity-40"
              >
                Sau <ChevronRight size={13} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── SYSTEM TAB ── */}
      {activeTab === 'system' && canSeeSystem && <>

      {/* Meta bar */}
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-faint">
          Cập nhật lúc <span className="font-medium text-subtle">{lastRefresh}</span> · tự làm mới sau {countdown}s
        </p>
        <button onClick={fetchData}
          className="flex items-center gap-1.5 px-3 py-1.5 border border-default rounded-lg text-[12px] text-subtle hover:bg-muted transition-colors">
          <RefreshCw size={13} /> Làm mới
        </button>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard label="Đang online"   value={online!.total}         sub={`Trong ${online!.windowMinutes} phút qua`} color="text-success" />
        <StatCard label="Người dùng"    value={stats!.activeUsers}    sub={`/ ${stats!.totalUsers.toLocaleString()} tổng`} />
        <StatCard label="Khóa học"      value={stats!.totalCourses} />
        <StatCard label="Ghi danh"      value={stats!.totalEnrollments} />
        <StatCard label="Hoàn thành"    value={`${completionPct}%`}  sub={`${stats!.completedEnrollments.toLocaleString()} khóa`} />
      </div>

      {/* System resources */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Memory */}
        <div className="bg-surface border border-default rounded-xl shadow-card p-4 space-y-3">
          <h2 className="text-[13px] font-medium text-content">Bộ nhớ hệ thống</h2>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-[12px] mb-1.5">
                <span className="text-subtle">RAM hệ thống</span>
                <span className="font-medium text-content">
                  {system!.memory.usedMB.toLocaleString()} / {system!.memory.totalMB.toLocaleString()} MB
                  <span className="text-faint ml-1">({system!.memory.usedPct}%)</span>
                </span>
              </div>
              <MemBar pct={system!.memory.usedPct} />
            </div>
            <div>
              <div className="flex justify-between text-[12px] mb-1.5">
                <span className="text-subtle">Process Node.js (RSS)</span>
                <span className="font-medium text-content">{system!.memory.processMB} MB</span>
              </div>
              <MemBar pct={Math.round((system!.memory.processMB / system!.memory.totalMB) * 100)} variant="primary" />
            </div>
            <div>
              <div className="flex justify-between text-[12px] mb-1.5">
                <span className="text-subtle">Heap V8</span>
                <span className="font-medium text-content">
                  {system!.memory.heapUsedMB} / {system!.memory.heapTotalMB} MB
                </span>
              </div>
              <MemBar pct={Math.round((system!.memory.heapUsedMB / Math.max(system!.memory.heapTotalMB, 1)) * 100)} variant="primary" />
            </div>
          </div>
        </div>

        {/* Server info */}
        <div className="bg-surface border border-default rounded-xl shadow-card p-4 space-y-3">
          <h2 className="text-[13px] font-medium text-content">Thông tin server</h2>
          <dl className="space-y-2">
            {[
              ['Uptime',    fmtUptime(system!.uptimeSeconds)],
              ['Node.js',   system!.nodeVersion],
              ['Platform',  system!.platform],
              ['RAM trống', `${system!.memory.freeMB.toLocaleString()} MB`],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between border-b border-default pb-2 last:border-0">
                <span className="text-[12px] text-subtle">{k}</span>
                <span className="text-[12px] font-medium text-content font-mono">{v}</span>
              </div>
            ))}
          </dl>
          <div>
            {(() => {
              const pct = system!.memory.usedPct;
              const cls = pct < 70
                ? 'bg-success-tint text-success'
                : pct < 85
                ? 'bg-warning-tint text-warning'
                : 'bg-danger-tint text-danger';
              const dot = pct < 70 ? 'bg-success' : pct < 85 ? 'bg-warning' : 'bg-danger';
              const msg = pct < 70 ? 'Hệ thống ổn định' : pct < 85 ? 'RAM đang cao' : 'RAM nguy hiểm — cần xử lý';
              return (
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium ${cls}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
                  {msg}
                </span>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Company breakdown */}
      <div className="bg-surface border border-default rounded-xl shadow-card">
        <div className="px-4 py-3 border-b border-default">
          <h2 className="text-[13px] font-medium text-content">Theo công ty</h2>
        </div>
        {companies.length === 0 ? (
          <p className="text-[12px] text-faint text-center py-8">Không có dữ liệu công ty</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-default">
                  <th className="text-left text-[10px] text-faint font-medium px-4 py-2.5">Công ty</th>
                  <th className="text-right text-[10px] text-faint font-medium px-4 py-2.5">Người dùng</th>
                  <th className="text-center text-[10px] text-faint font-medium px-4 py-2.5">Online</th>
                  <th className="text-right text-[10px] text-faint font-medium px-4 py-2.5">Ghi danh</th>
                  <th className="text-right text-[10px] text-faint font-medium px-4 py-2.5">Hoàn thành</th>
                  <th className="text-[10px] text-faint font-medium px-4 py-2.5 w-32">Tỷ lệ HT</th>
                </tr>
              </thead>
              <tbody>
                {companies.map((c) => {
                  const pct      = c.enrollments > 0 ? Math.round((c.completed / c.enrollments) * 100) : 0;
                  const barWidth = Math.round((c.users / maxUsers) * 100);
                  const rateColor = pct >= 70 ? 'bg-success' : pct >= 40 ? 'bg-primary' : 'bg-danger';
                  return (
                    <tr key={c.id} className="border-b border-default last:border-0 hover:bg-muted transition-colors">
                      <td className="px-4 py-3">
                        <p className="text-[12px] font-medium text-content">{c.name}</p>
                        <p className="text-[10px] text-faint font-mono">{c.code}</p>
                        <div className="mt-1.5 h-1 bg-muted rounded-full overflow-hidden w-20">
                          <div className="h-full bg-primary rounded-full" style={{ width: `${barWidth}%` }} />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[12px] text-content text-right font-medium">{c.users.toLocaleString()}</td>
                      <td className="px-4 py-3 text-center">
                        {c.onlineNow > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-success-tint text-success rounded-full text-[10px] font-medium">
                            <span className="w-1.5 h-1.5 bg-success rounded-full" />
                            {c.onlineNow}
                          </span>
                        ) : (
                          <span className="text-faint text-[11px]">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[11px] text-subtle text-right">{c.enrollments.toLocaleString()}</td>
                      <td className="px-4 py-3 text-[11px] text-subtle text-right">{c.completed.toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-muted rounded-full h-1.5 overflow-hidden">
                            <div className={`h-full rounded-full ${rateColor}`} style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-[11px] text-subtle w-8 text-right">{pct}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-[11px] text-faint text-center">
        Online users = người dùng có request trong 15 phút qua · dữ liệu DB theo thời gian thực
      </p>

      </>}
    </div>
  );
}
