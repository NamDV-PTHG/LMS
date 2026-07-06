'use client';

import { useAuth } from '@/components/providers/auth-provider';
import { useToast } from '@/components/ui/toast';
import { useEffect, useRef, useState } from 'react';
import { Upload, Palette, Mail, Check, X, HardDrive, Folder, FolderOpen, ChevronRight, Plus, Monitor as DriveIcon, ArrowLeft } from 'lucide-react';

interface Organization {
  id: string;
  name: string;
  code: string;
  type: string;
  isActive: boolean;
  metadata?: Record<string, string>;
}

interface BrandingForm {
  logoUrl: string;
  logoObjectName: string;
  faviconUrl: string;
  faviconObjectName: string;
  loginBgUrl: string;
  loginBgObjectName: string;
  companyName: string;
  themePreset: string;
  primaryColor: string;
  loginTitle: string;
  loginSubtitle: string;
  siteTitle: string;
  siteDescription: string;
}

const THEME_PRESETS = [
  { id: 'ocean',  name: 'Đại dương', primary: '#1a56db', from: '#1a56db', to: '#0e9f6e' },
  { id: 'sunset', name: 'Hoàng hôn', primary: '#d03801', from: '#d03801', to: '#e3a008' },
  { id: 'forest', name: 'Rừng xanh', primary: '#057a55', from: '#014737', to: '#057a55' },
  { id: 'purple', name: 'Tím hoàng', primary: '#7e3af2', from: '#6c2bd9', to: '#a855f7' },
  { id: 'slate',  name: 'Xám đá',    primary: '#374151', from: '#1f2937', to: '#4b5563' },
  { id: 'rose',   name: 'Hồng đào',  primary: '#e11d48', from: '#9f1239', to: '#e11d48' },
  { id: 'sky',    name: 'Bầu trời',  primary: '#0284c7', from: '#0369a1', to: '#38bdf8' },
  { id: 'amber',  name: 'Hổ phách',  primary: '#d97706', from: '#92400e', to: '#f59e0b' },
];

const DEFAULT_BRANDING: BrandingForm = {
  logoUrl: '', logoObjectName: '', faviconUrl: '', faviconObjectName: '',
  loginBgUrl: '', loginBgObjectName: '',
  companyName: '', themePreset: 'ocean', primaryColor: '#1a56db',
  loginTitle: 'LMS Tập đoàn', loginSubtitle: 'Đăng nhập để tiếp tục',
  siteTitle: '', siteDescription: '',
};

const inputClass =
  'w-full border border-default rounded-lg px-3 py-2 text-[12px] text-content placeholder:text-faint focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors';

export default function SettingsPage() {
  const { user, accessToken } = useAuth();
  const { toast } = useToast();
  const logoFileRef    = useRef<HTMLInputElement>(null);
  const bgFileRef      = useRef<HTMLInputElement>(null);
  const faviconFileRef = useRef<HTMLInputElement>(null);

  const [activeTab,       setActiveTab]       = useState<'branding' | 'mail' | 'backup'>('branding');
  const [organizations,   setOrganizations]   = useState<Organization[]>([]);
  const [selectedOrgId,   setSelectedOrgId]   = useState('');
  const [loadingOrgs,     setLoadingOrgs]     = useState(true);
  const [branding,        setBranding]        = useState<BrandingForm>(DEFAULT_BRANDING);
  const [loadingBranding, setLoadingBranding] = useState(false);
  const [saving,          setSaving]          = useState(false);
  const [uploadingLogo,    setUploadingLogo]    = useState(false);
  const [uploadingBg,      setUploadingBg]      = useState(false);
  const [uploadingFavicon, setUploadingFavicon] = useState(false);

  const [mailForm, setMailForm] = useState({
    host: '', port: 587, secure: false, user: '', pass: '',
    fromName: 'LMS Tập đoàn', fromEmail: '',
  });
  const [loadingMail, setLoadingMail] = useState(false);
  const [savingMail,  setSavingMail]  = useState(false);
  const [testingMail, setTestingMail] = useState(false);

  // Backup storage state
  const [backupForm, setBackupForm] = useState({
    destination: 'LOCAL' as 'LOCAL' | 'MINIO_REMOTE' | 'GCS' | 'GOOGLE_DRIVE',
    isActive: false,
    localPath: '',
    minioEndpoint: '', minioPort: '9000', minioUseSsl: false,
    minioAccessKey: '', minioSecretKey: '', minioBucket: 'lms-backups', minioRegion: '',
    gcsProjectId: '', gcsKeyJson: '', gcsBucket: '',
    gdriveFolderId: '', gdriveKeyJson: '', gdriveEmail: '',
    cronSchedule: '0 2 * * *', retentionDays: '30',
  });
  const [loadingBackup, setLoadingBackup] = useState(false);
  const [savingBackup,  setSavingBackup]  = useState(false);
  const [testingBackup, setTestingBackup] = useState(false);

  // Folder browser modal
  const [browseOpen,      setBrowseOpen]      = useState(false);
  const [browsePath,      setBrowsePath]      = useState('');
  const [browseItems,     setBrowseItems]     = useState<{ name: string; path: string; writable?: boolean; type?: string }[]>([]);
  const [browseWritable,  setBrowseWritable]  = useState(false);
  const [browseParent,    setBrowseParent]    = useState<string | null>(null);
  const [browseLoading,   setBrowseLoading]   = useState(false);
  const [browseNewName,   setBrowseNewName]   = useState('');
  const [browseCreating,  setBrowseCreating]  = useState(false);
  const [showNewFolder,   setShowNewFolder]   = useState(false);

  const userRoles: string[] = (user?.roles ?? []).map((r: { role: string } | string) =>
    typeof r === 'string' ? r : r.role,
  );
  const isGroupAdmin   = userRoles.includes('group_admin');
  const isCompanyAdmin = userRoles.includes('company_admin') || userRoles.includes('hr_manager');

  // Load mail config
  useEffect(() => {
    if (activeTab === 'mail' && (isGroupAdmin || isCompanyAdmin) && accessToken) {
      const endpoint = isGroupAdmin ? '/api/settings/mail' : '/api/settings/company-mail';
      setLoadingMail(true);
      fetch(endpoint, { headers: { Authorization: `Bearer ${accessToken}` } })
        .then((r) => r.json())
        .then((res) => {
          if (res.success && res.data) {
            setMailForm({
              host: res.data.host ?? '', port: res.data.port ?? 587,
              secure: res.data.secure ?? false, user: res.data.user ?? '',
              pass: '', fromName: res.data.fromName ?? 'LMS Tập đoàn',
              fromEmail: res.data.fromEmail ?? '',
            });
          }
        })
        .catch(() => {})
        .finally(() => setLoadingMail(false));
    }
  }, [activeTab, isGroupAdmin, isCompanyAdmin, accessToken]);

  // Load backup config
  useEffect(() => {
    if (activeTab === 'backup' && isGroupAdmin && accessToken) {
      setLoadingBackup(true);
      fetch('/api/admin/backup-config', { headers: { Authorization: `Bearer ${accessToken}` } })
        .then((r) => r.json())
        .then((res) => {
          if (res.success && res.data) {
            const d = res.data;
            setBackupForm({
              destination: d.destination ?? 'LOCAL',
              isActive: d.isActive ?? false,
              localPath: d.localPath ?? '',
              minioEndpoint: d.minioEndpoint ?? '', minioPort: String(d.minioPort ?? 9000),
              minioUseSsl: d.minioUseSsl ?? false,
              minioAccessKey: d.minioAccessKey ?? '', minioSecretKey: d.minioSecretKey ?? '',
              minioBucket: d.minioBucket ?? 'lms-backups', minioRegion: d.minioRegion ?? '',
              gcsProjectId: d.gcsProjectId ?? '', gcsKeyJson: d.gcsKeyJson ?? '', gcsBucket: d.gcsBucket ?? '',
              gdriveFolderId: d.gdriveFolderId ?? '', gdriveKeyJson: d.gdriveKeyJson ?? '', gdriveEmail: d.gdriveEmail ?? '',
              cronSchedule: d.cronSchedule ?? '0 2 * * *', retentionDays: String(d.retentionDays ?? 30),
            });
          }
        })
        .catch(() => {})
        .finally(() => setLoadingBackup(false));
    }
  }, [activeTab, isGroupAdmin, accessToken]);

  const saveBackup = async (testFirst = false) => {
    if (testFirst) setTestingBackup(true); else setSavingBackup(true);
    try {
      if (testFirst) {
        const res = await fetch('/api/admin/backup-config/test', {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}` },
        }).then((r) => r.json());
        toast(res.success ? 'success' : 'error', res.success ? 'Kết nối thành công!' : (res.error ?? 'Kết nối thất bại'));
      } else {
        const res = await fetch('/api/admin/backup-config', {
          method: 'PUT',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...backupForm, minioPort: Number(backupForm.minioPort) || null, retentionDays: Number(backupForm.retentionDays) }),
        }).then((r) => r.json());
        toast(res.success ? 'success' : 'error', res.success ? 'Đã lưu cài đặt backup' : (res.error ?? 'Lưu thất bại'));
      }
    } catch {
      toast('error', 'Lỗi kết nối');
    } finally {
      setTestingBackup(false);
      setSavingBackup(false);
    }
  };

  // ── Folder browser helpers ───────────────────────────────────
  const browseTo = async (dir: string) => {
    setBrowseLoading(true);
    try {
      const qs = dir ? `?path=${encodeURIComponent(dir)}` : '';
      const res = await fetch(`/api/admin/backup/browse${qs}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      }).then((r) => r.json());
      if (res.success) {
        setBrowsePath(res.data.path ?? '');
        setBrowseParent(res.data.parent ?? null);
        setBrowseWritable(res.data.writable ?? false);
        setBrowseItems(res.data.items ?? []);
        setShowNewFolder(false);
        setBrowseNewName('');
      } else {
        toast('error', res.error ?? 'Không thể mở thư mục');
      }
    } catch {
      toast('error', 'Lỗi kết nối');
    } finally {
      setBrowseLoading(false);
    }
  };

  const openBrowser = () => {
    setBrowseOpen(true);
    browseTo(backupForm.localPath || '');
  };

  const createFolder = async () => {
    if (!browseNewName.trim()) return;
    const newPath = browsePath
      ? `${browsePath}${process.platform === 'win32' || browsePath.includes('\\') ? '\\' : '/'}${browseNewName.trim()}`
      : browseNewName.trim();
    setBrowseCreating(true);
    try {
      const res = await fetch('/api/admin/backup/browse', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: newPath }),
      }).then((r) => r.json());
      if (res.success) {
        toast('success', 'Đã tạo thư mục');
        await browseTo(browsePath);
      } else {
        toast('error', res.error ?? 'Không thể tạo thư mục');
      }
    } catch {
      toast('error', 'Lỗi kết nối');
    } finally {
      setBrowseCreating(false);
    }
  };

  const selectBrowsedPath = () => {
    setBackupForm((f) => ({ ...f, localPath: browsePath }));
    setBrowseOpen(false);
  };

  const saveMail = async (testFirst = false) => {
    if (testFirst) setTestingMail(true); else setSavingMail(true);
    const mailEndpoint = isGroupAdmin ? '/api/settings/mail' : '/api/settings/company-mail';
    try {
      const res = await fetch(mailEndpoint, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...mailForm, testConnection: testFirst }),
      }).then((r) => r.json());
      if (res.success) {
        toast('success', testFirst ? 'Kết nối SMTP thành công!' : 'Đã lưu cài đặt mail');
        if (!testFirst) setMailForm((f) => ({ ...f, pass: '' }));
      } else {
        toast('error', res.error ?? 'Lưu thất bại');
      }
    } catch {
      toast('error', 'Lỗi kết nối');
    } finally {
      setTestingMail(false);
      setSavingMail(false);
    }
  };

  // Load organizations
  useEffect(() => {
    if (!accessToken) return;
    setLoadingOrgs(true);
    fetch('/api/organizations', { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((r) => r.json())
      .then((res) => {
        if (res.success) {
          let orgs: Organization[] = res.data ?? [];
          orgs = isGroupAdmin
            ? orgs.filter((o) => o.type === 'group' || o.type === 'company')
            : orgs.filter((o) => o.type === 'company');
          setOrganizations(orgs);
          if (orgs.length > 0) setSelectedOrgId(orgs[0].id);
        } else {
          toast('error', 'Không thể tải danh sách tổ chức', res.error);
        }
      })
      .catch(() => toast('error', 'Lỗi kết nối server'))
      .finally(() => setLoadingOrgs(false));
  }, [accessToken]); // eslint-disable-line

  // Load branding for selected org
  useEffect(() => {
    if (!selectedOrgId || !accessToken) return;
    setLoadingBranding(true);
    fetch(`/api/organizations/${selectedOrgId}`, { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((r) => r.json())
      .then((res) => {
        if (res.success) {
          const m = (res.data?.metadata ?? {}) as Record<string, string>;
          setBranding({
            logoUrl: m.logoUrl ?? '', logoObjectName: m.logoObjectName ?? '',
            faviconUrl: m.faviconUrl ?? '', faviconObjectName: m.faviconObjectName ?? '',
            loginBgUrl: m.loginBgUrl ?? '', loginBgObjectName: m.loginBgObjectName ?? '',
            companyName: m.companyName ?? '', themePreset: m.themePreset ?? 'ocean',
            primaryColor: m.primaryColor ?? '#1a56db',
            loginTitle: m.loginTitle ?? 'LMS Tập đoàn',
            loginSubtitle: m.loginSubtitle ?? 'Đăng nhập để tiếp tục',
            siteTitle: m.siteTitle ?? '',
            siteDescription: m.siteDescription ?? '',
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoadingBranding(false));
  }, [selectedOrgId, accessToken]);

  const uploadFile = async (file: File, field: 'logoUrl' | 'loginBgUrl' | 'faviconUrl', setLoading: (v: boolean) => void) => {
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/upload/logo', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: fd,
      }).then((r) => r.json());
      if (res.success) {
        if (field === 'logoUrl') {
          setBranding((b) => ({ ...b, logoUrl: res.data.url, logoObjectName: res.data.objectName ?? '' }));
          toast('success', 'Upload logo thành công');
        } else if (field === 'faviconUrl') {
          setBranding((b) => ({ ...b, faviconUrl: res.data.url, faviconObjectName: res.data.objectName ?? '' }));
          toast('success', 'Upload favicon thành công');
        } else {
          setBranding((b) => ({ ...b, loginBgUrl: res.data.url, loginBgObjectName: res.data.objectName ?? '' }));
          toast('success', 'Upload ảnh nền thành công');
        }
      } else {
        toast('error', 'Upload thất bại', res.error);
      }
    } catch {
      toast('error', 'Lỗi kết nối khi upload');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!selectedOrgId) return;
    setSaving(true);
    try {
      const activePreset = THEME_PRESETS.find((p) => p.id === branding.themePreset) ?? THEME_PRESETS[0];
      const res = await fetch(`/api/organizations/${selectedOrgId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ metadata: { ...branding, primaryColor: activePreset.primary } }),
      }).then((r) => r.json());
      if (res.success) {
        toast('success', 'Đã lưu cài đặt thành công');
      } else {
        toast('error', 'Lưu thất bại', res.error);
      }
    } catch {
      toast('error', 'Lỗi kết nối server');
    } finally {
      setSaving(false);
    }
  };

  const selectedOrg  = organizations.find((o) => o.id === selectedOrgId);
  const activePreset = THEME_PRESETS.find((p) => p.id === branding.themePreset) ?? THEME_PRESETS[0];

  const tabs = [
    { id: 'branding', label: 'Thương hiệu & Giao diện', icon: Palette },
    ...((isGroupAdmin || isCompanyAdmin) ? [{ id: 'mail', label: 'Mail Server', icon: Mail }] : []),
    ...(isGroupAdmin ? [{ id: 'backup', label: 'Backup Storage', icon: HardDrive }] : []),
  ] as { id: 'branding' | 'mail' | 'backup'; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }[];

  return (
    <div className="max-w-3xl mx-auto space-y-4">

      {/* Tab nav */}
      <div className="flex gap-0.5 bg-surface rounded-xl border border-default shadow-card p-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 flex-1 justify-center px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-primary text-white'
                  : 'text-subtle hover:text-content hover:bg-muted'
              }`}
            >
              <Icon size={13} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── MAIL TAB ── */}
      {activeTab === 'mail' && (isGroupAdmin || isCompanyAdmin) && (
        <div className="space-y-4">
          {loadingMail ? (
            <div className="bg-surface rounded-xl border border-default shadow-card p-8 text-center text-[12px] text-faint">
              Đang tải...
            </div>
          ) : (
            <>
              <div className="bg-primary-tint rounded-lg px-3 py-2.5 text-[12px] text-primary">
                Cấu hình máy chủ email để hệ thống gửi thông báo, mật khẩu mới và đặt lại mật khẩu.
              </div>

              <div className="bg-surface rounded-xl border border-default shadow-card p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="block text-[12px] font-medium text-content">SMTP Host <span className="text-danger">*</span></label>
                    <input type="text" value={mailForm.host}
                      onChange={(e) => setMailForm((f) => ({ ...f, host: e.target.value }))}
                      placeholder="smtp.gmail.com" className={inputClass} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-[12px] font-medium text-content">Port</label>
                    <input type="number" value={mailForm.port}
                      onChange={(e) => setMailForm((f) => ({ ...f, port: parseInt(e.target.value) || 587 }))}
                      className={inputClass} />
                  </div>
                </div>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" id="smtpSecure" checked={mailForm.secure}
                    onChange={(e) => setMailForm((f) => ({ ...f, secure: e.target.checked }))}
                    className="w-3.5 h-3.5 rounded accent-primary" />
                  <span className="text-[12px] text-subtle">
                    Dùng SSL/TLS (port 465) — bỏ chọn nếu dùng STARTTLS (port 587)
                  </span>
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="block text-[12px] font-medium text-content">Tài khoản email <span className="text-danger">*</span></label>
                    <input type="text" value={mailForm.user}
                      onChange={(e) => setMailForm((f) => ({ ...f, user: e.target.value }))}
                      placeholder="noreply@company.vn" className={inputClass} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-[12px] font-medium text-content">Mật khẩu / App Password <span className="text-danger">*</span></label>
                    <input type="password" value={mailForm.pass}
                      onChange={(e) => setMailForm((f) => ({ ...f, pass: e.target.value }))}
                      placeholder="Để trống nếu không thay đổi" className={inputClass} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="block text-[12px] font-medium text-content">Tên người gửi</label>
                    <input type="text" value={mailForm.fromName}
                      onChange={(e) => setMailForm((f) => ({ ...f, fromName: e.target.value }))}
                      placeholder="LMS Tập đoàn" className={inputClass} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-[12px] font-medium text-content">Email người gửi <span className="text-danger">*</span></label>
                    <input type="email" value={mailForm.fromEmail}
                      onChange={(e) => setMailForm((f) => ({ ...f, fromEmail: e.target.value }))}
                      placeholder="noreply@company.vn" className={inputClass} />
                  </div>
                </div>
              </div>

              <div className="flex gap-2 justify-end">
                <button onClick={() => saveMail(true)} disabled={testingMail || savingMail}
                  className="flex items-center gap-1.5 px-3 py-2 border border-default rounded-lg text-[12px] text-subtle hover:bg-muted transition-colors disabled:opacity-50">
                  {testingMail ? 'Đang kiểm tra...' : 'Kiểm tra kết nối'}
                </button>
                <button onClick={() => saveMail(false)} disabled={savingMail || testingMail}
                  className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary-dark text-white text-[12px] font-medium rounded-lg transition-colors disabled:opacity-50">
                  {savingMail ? 'Đang lưu...' : 'Lưu cấu hình'}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── BRANDING TAB ── */}
      {activeTab === 'branding' && (
        <>
          {/* Org selector */}
          <div className="bg-surface rounded-xl border border-default shadow-card p-4">
            <label className="block text-[12px] font-medium text-content mb-2">Chọn tổ chức</label>
            {loadingOrgs ? (
              <div className="text-[12px] text-faint">Đang tải...</div>
            ) : organizations.length === 0 ? (
              <div className="text-[12px] text-danger">Không có tổ chức nào. Liên hệ quản trị viên cấp cao.</div>
            ) : (
              <select
                value={selectedOrgId}
                onChange={(e) => setSelectedOrgId(e.target.value)}
                className="border border-default rounded-lg px-3 py-2 text-[12px] text-content focus:outline-none focus:border-primary min-w-[240px]"
              >
                {organizations.map((o) => (
                  <option key={o.id} value={o.id}>{o.name} ({o.type})</option>
                ))}
              </select>
            )}
          </div>

          {loadingBranding && selectedOrgId && (
            <div className="bg-surface rounded-xl border border-default shadow-card p-8 text-center text-[12px] text-faint">
              Đang tải cài đặt...
            </div>
          )}

          {selectedOrgId && !loadingBranding && (
            <>
              {/* Logo */}
              <div className="bg-surface rounded-xl border border-default shadow-card p-4 space-y-3">
                <h2 className="text-[13px] font-medium text-content">Logo công ty</h2>
                <div className="flex items-start gap-3">
                  <div className="w-16 h-16 border border-default rounded-xl flex items-center justify-center bg-muted flex-shrink-0 overflow-hidden">
                    {branding.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={branding.logoUrl} alt="Logo" className="w-full h-full object-contain p-2" />
                    ) : (
                      <span className="text-[20px] text-faint font-medium">
                        {(branding.companyName || selectedOrg?.name || 'C')[0]?.toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 space-y-2">
                    <input ref={logoFileRef} type="file" accept="image/jpeg,image/png,image/svg+xml,image/webp"
                      className="hidden"
                      onChange={(e) => { if (e.target.files?.[0]) uploadFile(e.target.files[0], 'logoUrl', setUploadingLogo); }} />
                    <button onClick={() => logoFileRef.current?.click()} disabled={uploadingLogo}
                      className="flex items-center gap-1.5 px-3 py-1.5 border border-default rounded-lg text-[12px] text-subtle hover:bg-muted transition-colors disabled:opacity-50 w-full">
                      <Upload size={13} />
                      {uploadingLogo ? 'Đang upload...' : 'Chọn ảnh từ máy tính'}
                    </button>
                    <p className="text-[11px] text-faint">JPG, PNG, SVG, WebP — tối đa 2MB</p>
                    <div className="space-y-1">
                      <label className="text-[11px] text-faint">Hoặc nhập URL:</label>
                      <input type="text" value={branding.logoUrl}
                        onChange={(e) => setBranding((b) => ({ ...b, logoUrl: e.target.value }))}
                        placeholder="https://..." className={inputClass} />
                    </div>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-[12px] font-medium text-content">Tên hiển thị</label>
                  <input type="text" value={branding.companyName}
                    onChange={(e) => setBranding((b) => ({ ...b, companyName: e.target.value }))}
                    placeholder={selectedOrg?.name ?? 'Tên công ty'} className={inputClass} />
                </div>
              </div>

              {/* Browser tab / SEO */}
              <div className="bg-surface rounded-xl border border-default shadow-card p-4 space-y-3">
                <h2 className="text-[13px] font-medium text-content">Tab trình duyệt</h2>
                <div className="space-y-1.5">
                  <label className="block text-[12px] font-medium text-content">Tiêu đề tab (title)</label>
                  <input
                    type="text"
                    value={branding.siteTitle}
                    onChange={(e) => setBranding((b) => ({ ...b, siteTitle: e.target.value }))}
                    placeholder={branding.companyName || selectedOrg?.name || 'LMS Tập đoàn'}
                    className={inputClass}
                  />
                  <p className="text-[11px] text-faint">Hiển thị trên tab trình duyệt. Nếu để trống sẽ dùng Tên hiển thị.</p>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-[12px] font-medium text-content">Mô tả website (description)</label>
                  <textarea
                    value={branding.siteDescription}
                    onChange={(e) => setBranding((b) => ({ ...b, siteDescription: e.target.value }))}
                    placeholder="Hệ thống đào tạo trực tuyến..."
                    rows={2}
                    className={`${inputClass} resize-none`}
                  />
                  <p className="text-[11px] text-faint">Dùng cho meta description — hỗ trợ SEO và chia sẻ mạng xã hội.</p>
                </div>
                {/* Favicon */}
                <div className="space-y-2 pt-1 border-t border-default">
                  <label className="block text-[12px] font-medium text-content">Icon tab trình duyệt (Favicon)</label>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 border border-default rounded-lg flex items-center justify-center bg-muted flex-shrink-0 overflow-hidden">
                      {branding.faviconUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={branding.faviconUrl} alt="Favicon" className="w-full h-full object-contain p-1"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      ) : (
                        <span className="text-[16px]">🌐</span>
                      )}
                    </div>
                    <div className="flex gap-2 flex-1">
                      <input ref={faviconFileRef} type="file" accept="image/png,image/x-icon,image/svg+xml,image/jpeg,image/webp"
                        className="hidden"
                        onChange={(e) => { if (e.target.files?.[0]) uploadFile(e.target.files[0], 'faviconUrl', setUploadingFavicon); }} />
                      <button onClick={() => faviconFileRef.current?.click()} disabled={uploadingFavicon}
                        className="flex items-center gap-1.5 px-3 py-1.5 border border-default rounded-lg text-[12px] text-subtle hover:bg-muted transition-colors disabled:opacity-50 flex-shrink-0">
                        <Upload size={13} />
                        {uploadingFavicon ? 'Đang upload...' : 'Tải lên icon'}
                      </button>
                      {branding.faviconUrl && (
                        <button onClick={() => setBranding((b) => ({ ...b, faviconUrl: '', faviconObjectName: '' }))}
                          className="flex items-center gap-1 px-2 py-1.5 border border-default rounded-lg text-[12px] text-danger hover:bg-muted transition-colors flex-shrink-0">
                          <X size={12} /> Xóa
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="text-[11px] text-faint">Ảnh vuông 32×32px hoặc 64×64px — PNG, ICO, SVG, WebP</p>
                </div>
              </div>

              {/* Theme presets */}
              <div className="bg-surface rounded-xl border border-default shadow-card p-4 space-y-3">
                <h2 className="text-[13px] font-medium text-content">Giao diện màu sắc</h2>
                <div className="grid grid-cols-4 gap-2.5">
                  {THEME_PRESETS.map((preset) => (
                    <button key={preset.id}
                      onClick={() => setBranding((b) => ({ ...b, themePreset: preset.id, primaryColor: preset.primary }))}
                      className={`relative rounded-xl overflow-hidden h-14 border-2 transition-all ${
                        branding.themePreset === preset.id
                          ? 'border-content scale-105 shadow-card'
                          : 'border-default hover:border-subtle'
                      }`}
                    >
                      {/* Dynamic gradient — keep inline style */}
                      <div className="w-full h-full flex items-end pb-1.5 px-2"
                        style={{ background: `linear-gradient(135deg, ${preset.from}, ${preset.to})` }}>
                        <span className="text-[10px] font-medium text-white drop-shadow-sm">{preset.name}</span>
                      </div>
                      {branding.themePreset === preset.id && (
                        <div className="absolute top-1 right-1 w-4 h-4 bg-surface rounded-full flex items-center justify-center">
                          <Check size={10} className="text-success" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Login page config */}
              <div className="bg-surface rounded-xl border border-default shadow-card p-4 space-y-3">
                <h2 className="text-[13px] font-medium text-content">Trang đăng nhập</h2>
                <div className="space-y-1.5">
                  <label className="block text-[12px] font-medium text-content">Tiêu đề</label>
                  <input type="text" value={branding.loginTitle}
                    onChange={(e) => setBranding((b) => ({ ...b, loginTitle: e.target.value }))}
                    placeholder="LMS Tập đoàn" className={inputClass} />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-[12px] font-medium text-content">Mô tả phụ</label>
                  <input type="text" value={branding.loginSubtitle}
                    onChange={(e) => setBranding((b) => ({ ...b, loginSubtitle: e.target.value }))}
                    placeholder="Đăng nhập để tiếp tục" className={inputClass} />
                </div>
                <div className="space-y-2">
                  <label className="block text-[12px] font-medium text-content">Ảnh nền</label>
                  <input ref={bgFileRef} type="file" accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => { if (e.target.files?.[0]) uploadFile(e.target.files[0], 'loginBgUrl', setUploadingBg); }} />
                  <div className="flex gap-2">
                    <button onClick={() => bgFileRef.current?.click()} disabled={uploadingBg}
                      className="flex items-center gap-1.5 px-3 py-1.5 border border-default rounded-lg text-[12px] text-subtle hover:bg-muted transition-colors disabled:opacity-50 flex-shrink-0">
                      <Upload size={13} />
                      {uploadingBg ? 'Đang upload...' : 'Chọn file'}
                    </button>
                    <input type="text" value={branding.loginBgUrl}
                      onChange={(e) => setBranding((b) => ({ ...b, loginBgUrl: e.target.value }))}
                      placeholder="Hoặc nhập URL ảnh nền..." className={inputClass} />
                  </div>
                  <p className="text-[11px] text-faint">Nếu không có ảnh, sẽ dùng gradient từ theme đã chọn</p>
                  {branding.loginBgUrl && (
                    <div className="relative rounded-lg overflow-hidden border border-default">
                      {/* Dynamic bg image — keep inline style */}
                      <div className="h-20 bg-center bg-cover"
                        style={{ backgroundImage: `url(${branding.loginBgUrl})` }} />
                      <button onClick={() => setBranding((b) => ({ ...b, loginBgUrl: '' }))}
                        className="absolute top-1.5 right-1.5 w-5 h-5 bg-black/60 text-white rounded-full flex items-center justify-center hover:bg-black/80 transition-colors">
                        <X size={10} />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Login preview */}
              <div className="bg-surface rounded-xl border border-default shadow-card p-4 space-y-3">
                <h2 className="text-[13px] font-medium text-content">Xem trước trang đăng nhập</h2>
                {/* Dynamic background — keep inline style */}
                <div className="rounded-xl min-h-[200px] flex items-center justify-center relative overflow-hidden"
                  style={
                    branding.loginBgUrl
                      ? { backgroundImage: `url(${branding.loginBgUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
                      : { background: `linear-gradient(135deg, ${activePreset.from}, ${activePreset.to})` }
                  }
                >
                  <div className="bg-surface rounded-xl shadow-card p-4 w-56 text-center space-y-2.5 z-10">
                    {branding.logoUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={branding.logoUrl} alt="Logo" className="h-8 object-contain mx-auto"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    )}
                    <h3 className="text-[13px] font-medium text-content">{branding.loginTitle || 'LMS Tập đoàn'}</h3>
                    <p className="text-[10px] text-subtle">{branding.loginSubtitle || 'Đăng nhập để tiếp tục'}</p>
                    <div className="space-y-1.5 text-left">
                      <div className="h-6 bg-muted rounded border border-default" />
                      <div className="h-6 bg-muted rounded border border-default" />
                      {/* Dynamic preview button color — keep inline style */}
                      <div className="h-7 rounded text-[10px] text-white flex items-center justify-center font-medium"
                        style={{ background: activePreset.primary }}>
                        Đăng nhập
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <button onClick={handleSave} disabled={saving}
                  className="flex items-center gap-1.5 px-5 py-2 bg-primary hover:bg-primary-dark text-white text-[12px] font-medium rounded-lg transition-colors disabled:opacity-50">
                  {saving ? 'Đang lưu...' : 'Lưu cài đặt'}
                </button>
              </div>
            </>
          )}
        </>
      )}

      {/* ── BACKUP TAB ── */}
      {activeTab === 'backup' && isGroupAdmin && (
        <div className="space-y-4">
          {loadingBackup ? (
            <div className="bg-surface rounded-xl border border-default shadow-card p-8 text-center text-[12px] text-faint">Đang tải...</div>
          ) : (
            <>
              {/* Destination selector */}
              <div className="bg-surface rounded-xl border border-default shadow-card p-4 space-y-3">
                <h2 className="text-[13px] font-medium text-content">Đích lưu trữ</h2>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'LOCAL',        label: 'Local Server', sub: 'Thư mục trên server' },
                    { id: 'MINIO_REMOTE', label: 'MinIO / NAS',  sub: 'S3-compatible server' },
                    { id: 'GCS',          label: 'Google Cloud', sub: 'Cloud Storage (GCS)' },
                    { id: 'GOOGLE_DRIVE', label: 'Google Drive', sub: 'Service Account' },
                  ].map((d) => (
                    <button key={d.id} type="button"
                      onClick={() => setBackupForm((f) => ({ ...f, destination: d.id as typeof f.destination }))}
                      className={`p-3 rounded-xl border text-left transition-colors ${
                        backupForm.destination === d.id
                          ? 'border-primary bg-primary-tint'
                          : 'border-default hover:bg-muted'
                      }`}>
                      <p className={`text-[12px] font-medium ${backupForm.destination === d.id ? 'text-primary' : 'text-content'}`}>{d.label}</p>
                      <p className="text-[10px] text-faint mt-0.5">{d.sub}</p>
                    </button>
                  ))}
                </div>

                <label className="flex items-center gap-2 cursor-pointer mt-2">
                  <input type="checkbox" checked={backupForm.isActive}
                    onChange={(e) => setBackupForm((f) => ({ ...f, isActive: e.target.checked }))}
                    className="w-4 h-4 rounded border-default accent-primary" />
                  <span className="text-[12px] text-content">Kích hoạt backup tự động</span>
                </label>
              </div>

              {/* Local Server path */}
              {backupForm.destination === 'LOCAL' && (
                <div className="bg-surface rounded-xl border border-default shadow-card p-4 space-y-3">
                  <h2 className="text-[13px] font-medium text-content">Thư mục lưu trữ trên server</h2>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium text-subtle">Đường dẫn tuyệt đối</label>
                    <div className="flex gap-2">
                      <input
                        value={backupForm.localPath}
                        onChange={(e) => setBackupForm((f) => ({ ...f, localPath: e.target.value }))}
                        placeholder="D:\backups\lms  hoặc  /var/backups/lms"
                        className={`${inputClass} flex-1`}
                      />
                      <button
                        type="button"
                        onClick={openBrowser}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-default bg-surface hover:bg-muted text-[12px] text-content whitespace-nowrap transition-colors"
                      >
                        <FolderOpen size={13} />
                        Browse…
                      </button>
                    </div>
                    <p className="text-[11px] text-faint">
                      Để trống để dùng thư mục mặc định: <code className="bg-muted px-1 rounded">{'{project}/backups'}</code>
                      &nbsp;· Dùng Browse để chọn hoặc tạo thư mục trực tiếp trên server
                    </p>
                  </div>
                  <div className="bg-warning-tint rounded-lg px-3 py-2 text-[11px] text-warning">
                    ⚠️ Local backup không bảo vệ khỏi hỏng ổ cứng server. Nên kết hợp với đích lưu trữ remote (MinIO/GCS) để an toàn hơn.
                  </div>
                </div>
              )}

              {/* ── Folder Browser Modal ── */}
              {browseOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                  <div className="bg-surface rounded-2xl shadow-xl w-[560px] max-h-[80vh] flex flex-col border border-default">
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-default shrink-0">
                      <div className="flex items-center gap-2">
                        <FolderOpen size={16} className="text-primary" />
                        <span className="text-[13px] font-semibold text-content">Chọn thư mục lưu trữ</span>
                      </div>
                      <button onClick={() => setBrowseOpen(false)} className="p-1 rounded hover:bg-muted">
                        <X size={14} className="text-subtle" />
                      </button>
                    </div>

                    {/* Breadcrumb / current path */}
                    <div className="px-4 py-2 border-b border-default bg-muted/40 shrink-0 flex items-center gap-1 min-h-[36px]">
                      {browsePath ? (
                        <>
                          <button
                            onClick={() => browseTo('')}
                            className="text-[11px] text-primary hover:underline shrink-0"
                          >
                            {process.platform === 'win32' ? 'Ổ đĩa' : '/'}
                          </button>
                          {browsePath.replace(/\\/g, '/').split('/').filter(Boolean).map((seg, i, arr) => {
                            const partPath = arr.slice(0, i + 1).join('/');
                            const fullPart = process.platform === 'win32'
                              ? (i === 0 ? `${seg}\\` : arr.slice(0, i + 1).join('\\'))
                              : `/${partPath}`;
                            return (
                              <span key={i} className="flex items-center gap-1 shrink-0">
                                <ChevronRight size={10} className="text-faint" />
                                {i === arr.length - 1 ? (
                                  <span className="text-[11px] font-medium text-content">{seg}</span>
                                ) : (
                                  <button onClick={() => browseTo(fullPart)} className="text-[11px] text-primary hover:underline">
                                    {seg}
                                  </button>
                                )}
                              </span>
                            );
                          })}
                        </>
                      ) : (
                        <span className="text-[11px] text-faint">Chọn ổ đĩa hoặc thư mục gốc</span>
                      )}
                    </div>

                    {/* Directory list */}
                    <div className="flex-1 overflow-y-auto px-2 py-2 min-h-0">
                      {browseLoading ? (
                        <div className="flex items-center justify-center h-24 text-[12px] text-faint">Đang tải…</div>
                      ) : (
                        <div className="space-y-0.5">
                          {/* Up button */}
                          {browseParent !== null && (
                            <button
                              onClick={() => browseTo(browseParent ?? '')}
                              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-muted text-left transition-colors"
                            >
                              <ArrowLeft size={13} className="text-subtle shrink-0" />
                              <span className="text-[12px] text-subtle">..</span>
                            </button>
                          )}
                          {browseItems.length === 0 && (
                            <p className="text-center text-[11px] text-faint py-6">Thư mục trống</p>
                          )}
                          {browseItems.map((item) => (
                            <button
                              key={item.path}
                              onDoubleClick={() => browseTo(item.path)}
                              onClick={() => setBrowsePath(item.path)}
                              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-muted text-left transition-colors group ${
                                browsePath === item.path ? 'bg-primary-tint' : ''
                              }`}
                            >
                              {item.type === 'drive'
                                ? <DriveIcon size={13} className="text-primary shrink-0" />
                                : <Folder size={13} className="text-warning shrink-0" />
                              }
                              <span className="text-[12px] text-content flex-1 truncate">{item.name}</span>
                              {item.type !== 'drive' && (
                                <ChevronRight
                                  size={12}
                                  className="text-faint opacity-0 group-hover:opacity-100 shrink-0"
                                  onClick={(e) => { e.stopPropagation(); browseTo(item.path); }}
                                />
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* New folder row */}
                    {showNewFolder && (
                      <div className="px-4 py-2 border-t border-default shrink-0 flex items-center gap-2">
                        <Folder size={13} className="text-warning shrink-0" />
                        <input
                          autoFocus
                          value={browseNewName}
                          onChange={(e) => setBrowseNewName(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') createFolder(); if (e.key === 'Escape') setShowNewFolder(false); }}
                          placeholder="Tên thư mục mới…"
                          className="flex-1 border border-default rounded-md px-2 py-1 text-[12px] focus:outline-none focus:border-primary"
                        />
                        <button
                          onClick={createFolder}
                          disabled={browseCreating || !browseNewName.trim()}
                          className="px-3 py-1.5 rounded-md bg-primary text-white text-[11px] disabled:opacity-50"
                        >
                          {browseCreating ? 'Đang tạo…' : 'Tạo'}
                        </button>
                        <button onClick={() => setShowNewFolder(false)} className="p-1 rounded hover:bg-muted">
                          <X size={13} className="text-subtle" />
                        </button>
                      </div>
                    )}

                    {/* Footer */}
                    <div className="flex items-center justify-between px-4 py-3 border-t border-default shrink-0 bg-muted/30">
                      <button
                        onClick={() => setShowNewFolder(true)}
                        disabled={!browsePath || showNewFolder}
                        className="flex items-center gap-1.5 text-[12px] text-primary hover:underline disabled:opacity-40 disabled:no-underline"
                      >
                        <Plus size={13} />
                        Tạo thư mục mới
                      </button>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-faint">
                          {browsePath
                            ? browseWritable ? '✓ Có quyền ghi' : '✗ Không có quyền ghi'
                            : ''}
                        </span>
                        <button onClick={() => setBrowseOpen(false)} className="px-3 py-1.5 rounded-lg border border-default text-[12px] text-content hover:bg-muted">
                          Huỷ
                        </button>
                        <button
                          onClick={selectBrowsedPath}
                          disabled={!browsePath || !browseWritable}
                          className="px-3 py-1.5 rounded-lg bg-primary text-white text-[12px] disabled:opacity-40"
                        >
                          Chọn thư mục này
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* MinIO / NAS credentials */}
              {backupForm.destination === 'MINIO_REMOTE' && (
                <div className="bg-surface rounded-xl border border-default shadow-card p-4 space-y-3">
                  <h2 className="text-[13px] font-medium text-content">Cài đặt MinIO / NAS</h2>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-subtle">Host / Endpoint</label>
                      <input value={backupForm.minioEndpoint} onChange={(e) => setBackupForm((f) => ({ ...f, minioEndpoint: e.target.value }))}
                        placeholder="192.168.1.200" className={inputClass} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-subtle">Port</label>
                      <input value={backupForm.minioPort} onChange={(e) => setBackupForm((f) => ({ ...f, minioPort: e.target.value }))}
                        placeholder="9000" type="number" className={inputClass} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-subtle">Access Key</label>
                      <input value={backupForm.minioAccessKey} onChange={(e) => setBackupForm((f) => ({ ...f, minioAccessKey: e.target.value }))}
                        className={inputClass} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-subtle">Secret Key</label>
                      <input type="password" value={backupForm.minioSecretKey} onChange={(e) => setBackupForm((f) => ({ ...f, minioSecretKey: e.target.value }))}
                        placeholder="••••••••" className={inputClass} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-subtle">Bucket</label>
                      <input value={backupForm.minioBucket} onChange={(e) => setBackupForm((f) => ({ ...f, minioBucket: e.target.value }))}
                        placeholder="lms-backups" className={inputClass} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-subtle">Region (tuỳ chọn)</label>
                      <input value={backupForm.minioRegion} onChange={(e) => setBackupForm((f) => ({ ...f, minioRegion: e.target.value }))}
                        placeholder="us-east-1" className={inputClass} />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={backupForm.minioUseSsl}
                      onChange={(e) => setBackupForm((f) => ({ ...f, minioUseSsl: e.target.checked }))}
                      className="w-4 h-4 rounded border-default accent-primary" />
                    <span className="text-[12px] text-content">Dùng SSL / HTTPS</span>
                  </label>
                </div>
              )}

              {/* GCS credentials */}
              {backupForm.destination === 'GCS' && (
                <div className="bg-surface rounded-xl border border-default shadow-card p-4 space-y-3">
                  <h2 className="text-[13px] font-medium text-content">Google Cloud Storage</h2>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-subtle">Project ID</label>
                      <input value={backupForm.gcsProjectId} onChange={(e) => setBackupForm((f) => ({ ...f, gcsProjectId: e.target.value }))}
                        placeholder="my-gcp-project" className={inputClass} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-subtle">Bucket</label>
                      <input value={backupForm.gcsBucket} onChange={(e) => setBackupForm((f) => ({ ...f, gcsBucket: e.target.value }))}
                        placeholder="lms-backups-bucket" className={inputClass} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-subtle">Service Account Key (JSON)</label>
                    <textarea value={backupForm.gcsKeyJson === '••••••••' ? '' : backupForm.gcsKeyJson}
                      onChange={(e) => setBackupForm((f) => ({ ...f, gcsKeyJson: e.target.value }))}
                      placeholder={'{\n  "type": "service_account",\n  "project_id": "...",\n  ...\n}'}
                      rows={5} className={`${inputClass} font-mono text-[11px]`} />
                    {backupForm.gcsKeyJson === '••••••••' && (
                      <p className="text-[11px] text-faint">Key đã được lưu — nhập mới để cập nhật</p>
                    )}
                  </div>
                </div>
              )}

              {/* Google Drive credentials */}
              {backupForm.destination === 'GOOGLE_DRIVE' && (
                <div className="bg-surface rounded-xl border border-default shadow-card p-4 space-y-3">
                  <h2 className="text-[13px] font-medium text-content">Google Drive</h2>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-subtle">Folder ID</label>
                      <input value={backupForm.gdriveFolderId} onChange={(e) => setBackupForm((f) => ({ ...f, gdriveFolderId: e.target.value }))}
                        placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs" className={inputClass} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-subtle">Service Account Email</label>
                      <input value={backupForm.gdriveEmail} onChange={(e) => setBackupForm((f) => ({ ...f, gdriveEmail: e.target.value }))}
                        placeholder="backup@project.iam.gserviceaccount.com" className={inputClass} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-subtle">Service Account Key (JSON)</label>
                    <textarea value={backupForm.gdriveKeyJson === '••••••••' ? '' : backupForm.gdriveKeyJson}
                      onChange={(e) => setBackupForm((f) => ({ ...f, gdriveKeyJson: e.target.value }))}
                      placeholder={'{\n  "type": "service_account",\n  ...\n}'}
                      rows={5} className={`${inputClass} font-mono text-[11px]`} />
                    {backupForm.gdriveKeyJson === '••••••••' && (
                      <p className="text-[11px] text-faint">Key đã được lưu — nhập mới để cập nhật</p>
                    )}
                  </div>
                </div>
              )}

              {/* Schedule & Retention */}
              <div className="bg-surface rounded-xl border border-default shadow-card p-4 space-y-3">
                <h2 className="text-[13px] font-medium text-content">Lịch & Lưu trữ</h2>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-subtle">Cron Schedule</label>
                    <input value={backupForm.cronSchedule} onChange={(e) => setBackupForm((f) => ({ ...f, cronSchedule: e.target.value }))}
                      placeholder="0 2 * * *" className={inputClass} />
                    <p className="text-[10px] text-faint">Mặc định: 02:00 AM hàng ngày</p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-subtle">Giữ backup (ngày)</label>
                    <input value={backupForm.retentionDays} onChange={(e) => setBackupForm((f) => ({ ...f, retentionDays: e.target.value }))}
                      type="number" min="1" max="365" className={inputClass} />
                    <p className="text-[10px] text-faint">Tự xóa backup cũ hơn N ngày</p>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2">
                <button onClick={() => saveBackup(true)} disabled={testingBackup || savingBackup}
                  className="flex items-center gap-1.5 px-4 py-2 border border-default rounded-lg text-[12px] text-subtle hover:bg-muted transition-colors disabled:opacity-50">
                  {testingBackup ? 'Đang kiểm tra...' : 'Test kết nối'}
                </button>
                <button onClick={() => saveBackup(false)} disabled={savingBackup || testingBackup}
                  className="flex items-center gap-1.5 px-5 py-2 bg-primary hover:bg-primary-dark text-white text-[12px] font-medium rounded-lg transition-colors disabled:opacity-50">
                  {savingBackup ? 'Đang lưu...' : 'Lưu cài đặt'}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
