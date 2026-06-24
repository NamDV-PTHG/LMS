'use client';

import { useAuth } from '@/components/providers/auth-provider';
import { useToast } from '@/components/ui/toast';
import { useEffect, useRef, useState } from 'react';

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
  companyName: string;
  themePreset: string;
  primaryColor: string;
  loginTitle: string;
  loginSubtitle: string;
  loginBgUrl: string;
}

const THEME_PRESETS = [
  { id: 'ocean',  name: 'Đại dương', primary: '#1a56db', from: '#1a56db', to: '#0e9f6e' },
  { id: 'sunset', name: 'Hoàng hôn', primary: '#d03801', from: '#d03801', to: '#e3a008' },
  { id: 'forest', name: 'Rừng xanh', primary: '#057a55', from: '#014737', to: '#057a55' },
  { id: 'purple', name: 'Tím hoàng', primary: '#7e3af2', from: '#6c2bd9', to: '#a855f7' },
  { id: 'slate',  name: 'Xám đá',    primary: '#374151', from: '#1f2937', to: '#4b5563' },
  { id: 'rose',   name: 'Hồng đào',  primary: '#e11d48', from: '#9f1239', to: '#e11d48' },
  { id: 'sky',    name: 'Bầu trời',  primary: '#0284c7', from: '#0369a1', to: '#38bdf8' },
  { id: 'amber',  name: 'Hổ phách', primary: '#d97706', from: '#92400e', to: '#f59e0b' },
];

const DEFAULT_BRANDING: BrandingForm = {
  logoUrl: '',
  companyName: '',
  themePreset: 'ocean',
  primaryColor: '#1a56db',
  loginTitle: 'LMS Tập đoàn',
  loginSubtitle: 'Đăng nhập để tiếp tục',
  loginBgUrl: '',
};

export default function SettingsPage() {
  const { user, accessToken } = useAuth();
  const { toast } = useToast();
  const logoFileRef = useRef<HTMLInputElement>(null);
  const bgFileRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<'branding' | 'mail'>('branding');

  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState('');
  const [loadingOrgs, setLoadingOrgs] = useState(true);
  const [branding, setBranding] = useState<BrandingForm>(DEFAULT_BRANDING);
  const [loadingBranding, setLoadingBranding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingBg, setUploadingBg] = useState(false);

  // Mail settings state
  const [mailForm, setMailForm] = useState({
    host: '', port: 587, secure: false, user: '', pass: '', fromName: 'LMS Tập đoàn', fromEmail: '',
  });
  const [loadingMail, setLoadingMail] = useState(false);
  const [savingMail, setSavingMail] = useState(false);
  const [testingMail, setTestingMail] = useState(false);

  // Derive roles BEFORE any useEffect that depends on them
  const userRoles: string[] = (user?.roles ?? []).map((r: { role: string } | string) =>
    typeof r === 'string' ? r : r.role,
  );
  const isGroupAdmin = userRoles.includes('group_admin');
  const isCompanyAdmin = userRoles.includes('company_admin') || userRoles.includes('hr_manager');

  useEffect(() => {
    if (activeTab === 'mail' && (isGroupAdmin || isCompanyAdmin) && accessToken) {
      const endpoint = isGroupAdmin ? '/api/settings/mail' : '/api/settings/company-mail';
      setLoadingMail(true);
      fetch(endpoint, { headers: { Authorization: `Bearer ${accessToken}` } })
        .then((r) => r.json())
        .then((res) => {
          if (res.success && res.data) {
            setMailForm({
              host: res.data.host ?? '',
              port: res.data.port ?? 587,
              secure: res.data.secure ?? false,
              user: res.data.user ?? '',
              pass: '',
              fromName: res.data.fromName ?? 'LMS Tập đoàn',
              fromEmail: res.data.fromEmail ?? '',
            });
          }
        })
        .catch(() => {})
        .finally(() => setLoadingMail(false));
    }
  }, [activeTab, isGroupAdmin, isCompanyAdmin, accessToken]);

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
          // group_admin sees company/group orgs; others see all returned (backend already filters by companyId)
          if (isGroupAdmin) {
            orgs = orgs.filter((o) => o.type === 'group' || o.type === 'company');
          } else {
            // company_admin: only show their own company org (no depts/teams)
            orgs = orgs.filter((o) => o.type === 'company');
          }
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
            logoUrl: m.logoUrl ?? '',
            companyName: m.companyName ?? '',
            themePreset: m.themePreset ?? 'ocean',
            primaryColor: m.primaryColor ?? '#1a56db',
            loginTitle: m.loginTitle ?? 'LMS Tập đoàn',
            loginSubtitle: m.loginSubtitle ?? 'Đăng nhập để tiếp tục',
            loginBgUrl: m.loginBgUrl ?? '',
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoadingBranding(false));
  }, [selectedOrgId, accessToken]);

  const uploadFile = async (file: File, field: 'logoUrl' | 'loginBgUrl', setLoading: (v: boolean) => void) => {
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
        setBranding((b) => ({ ...b, [field]: res.data.url }));
        toast('success', field === 'logoUrl' ? 'Upload logo thành công' : 'Upload ảnh nền thành công');
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
        body: JSON.stringify({
          metadata: {
            ...branding,
            primaryColor: activePreset.primary,
          },
        }),
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

  const selectedOrg = organizations.find((o) => o.id === selectedOrgId);
  const activePreset = THEME_PRESETS.find((p) => p.id === branding.themePreset) ?? THEME_PRESETS[0];

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Cài đặt</h1>
        <p className="text-sm text-gray-500 mt-0.5">Tuỳ chỉnh hệ thống</p>
      </div>

      {/* Tab nav */}
      <div className="flex gap-1 border-b">
        {[
          { id: 'branding', label: 'Thương hiệu & Giao diện' },
          ...(isGroupAdmin || isCompanyAdmin ? [{ id: 'mail', label: 'Mail Server' }] : []),
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as 'branding' | 'mail')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === tab.id
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Mail settings tab */}
      {activeTab === 'mail' && (isGroupAdmin || isCompanyAdmin) && (
        <div className="space-y-5">
          {loadingMail ? (
            <div className="text-center py-10 text-gray-400">Đang tải...</div>
          ) : (
            <>
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
                Cấu hình máy chủ email để hệ thống có thể gửi thông báo, mật khẩu mới và đặt lại mật khẩu cho người dùng.
              </div>
              <div className="bg-white rounded-xl border p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">SMTP Host <span className="text-red-500">*</span></label>
                    <input type="text" value={mailForm.host}
                      onChange={(e) => setMailForm((f) => ({ ...f, host: e.target.value }))}
                      placeholder="smtp.gmail.com"
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Port</label>
                    <input type="number" value={mailForm.port}
                      onChange={(e) => setMailForm((f) => ({ ...f, port: parseInt(e.target.value) || 587 }))}
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <input type="checkbox" id="smtpSecure" checked={mailForm.secure}
                    onChange={(e) => setMailForm((f) => ({ ...f, secure: e.target.checked }))}
                    className="w-4 h-4 text-blue-600 rounded" />
                  <label htmlFor="smtpSecure" className="text-sm text-gray-700">
                    Dùng SSL/TLS (port 465) — bỏ chọn nếu dùng STARTTLS (port 587)
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tài khoản email <span className="text-red-500">*</span></label>
                    <input type="text" value={mailForm.user}
                      onChange={(e) => setMailForm((f) => ({ ...f, user: e.target.value }))}
                      placeholder="noreply@company.vn"
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Mật khẩu / App Password <span className="text-red-500">*</span></label>
                    <input type="password" value={mailForm.pass}
                      onChange={(e) => setMailForm((f) => ({ ...f, pass: e.target.value }))}
                      placeholder="Để trống nếu không thay đổi"
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tên người gửi</label>
                    <input type="text" value={mailForm.fromName}
                      onChange={(e) => setMailForm((f) => ({ ...f, fromName: e.target.value }))}
                      placeholder="LMS Tập đoàn"
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email người gửi <span className="text-red-500">*</span></label>
                    <input type="email" value={mailForm.fromEmail}
                      onChange={(e) => setMailForm((f) => ({ ...f, fromEmail: e.target.value }))}
                      placeholder="noreply@company.vn"
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>
              </div>
              <div className="flex gap-3 justify-end">
                <button onClick={() => saveMail(true)} disabled={testingMail || savingMail}
                  className="px-4 py-2 border text-sm rounded-lg hover:bg-gray-50 disabled:opacity-50">
                  {testingMail ? 'Đang kiểm tra...' : 'Kiểm tra kết nối'}
                </button>
                <button onClick={() => saveMail(false)} disabled={savingMail || testingMail}
                  className="px-5 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium">
                  {savingMail ? 'Đang lưu...' : 'Lưu cấu hình'}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === 'branding' && (<>

      {/* Org selector */}
      <div className="bg-white rounded-xl border p-5 space-y-3">
        <label className="block text-sm font-semibold text-gray-700">Chọn tổ chức</label>
        {loadingOrgs ? (
          <div className="text-sm text-gray-400">Đang tải...</div>
        ) : organizations.length === 0 ? (
          <div className="text-sm text-red-500">Không có tổ chức nào. Liên hệ quản trị viên cấp cao.</div>
        ) : (
          <select
            value={selectedOrgId}
            onChange={(e) => setSelectedOrgId(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[240px]"
          >
            {organizations.map((o) => (
              <option key={o.id} value={o.id}>{o.name} ({o.type})</option>
            ))}
          </select>
        )}
      </div>

      {selectedOrgId && !loadingBranding && (
        <>
          {/* Logo section */}
          <div className="bg-white rounded-xl border p-5 space-y-4">
            <h2 className="text-base font-semibold">Logo công ty</h2>
            <div className="flex items-start gap-4">
              {/* Preview */}
              <div className="w-20 h-20 border-2 border-dashed rounded-xl flex items-center justify-center bg-gray-50 shrink-0 overflow-hidden">
                {branding.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={branding.logoUrl} alt="Logo" className="w-full h-full object-contain p-2" />
                ) : (
                  <span className="text-3xl text-gray-300">{(branding.companyName || selectedOrg?.name || 'C')[0]?.toUpperCase()}</span>
                )}
              </div>
              <div className="flex-1 space-y-2">
                <input
                  ref={logoFileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/svg+xml,image/webp"
                  className="hidden"
                  onChange={(e) => { if (e.target.files?.[0]) uploadFile(e.target.files[0], 'logoUrl', setUploadingLogo); }}
                />
                <button
                  onClick={() => logoFileRef.current?.click()}
                  disabled={uploadingLogo}
                  className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50 w-full text-left"
                >
                  {uploadingLogo ? '⏳ Đang upload...' : '↑ Chọn ảnh từ máy tính'}
                </button>
                <p className="text-xs text-gray-400">JPG, PNG, SVG, WebP — tối đa 2MB</p>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Hoặc nhập URL:</label>
                  <input
                    type="text"
                    value={branding.logoUrl}
                    onChange={(e) => setBranding((b) => ({ ...b, logoUrl: e.target.value }))}
                    placeholder="https://..."
                    className="w-full border rounded px-2 py-1.5 text-xs"
                  />
                </div>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Tên hiển thị</label>
              <input
                type="text"
                value={branding.companyName}
                onChange={(e) => setBranding((b) => ({ ...b, companyName: e.target.value }))}
                placeholder={selectedOrg?.name ?? 'Tên công ty'}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>

          {/* Theme presets */}
          <div className="bg-white rounded-xl border p-5 space-y-4">
            <h2 className="text-base font-semibold">Giao diện màu sắc</h2>
            <div className="grid grid-cols-4 gap-3">
              {THEME_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => setBranding((b) => ({ ...b, themePreset: preset.id, primaryColor: preset.primary }))}
                  className={`relative rounded-xl overflow-hidden h-16 border-2 transition-all ${branding.themePreset === preset.id ? 'border-gray-900 scale-105' : 'border-transparent hover:border-gray-300'}`}
                >
                  <div
                    className="w-full h-full flex items-end pb-1.5 px-2"
                    style={{ background: `linear-gradient(135deg, ${preset.from}, ${preset.to})` }}
                  >
                    <span className="text-xs font-medium text-white drop-shadow-sm">{preset.name}</span>
                  </div>
                  {branding.themePreset === preset.id && (
                    <div className="absolute top-1 right-1 w-4 h-4 bg-white rounded-full flex items-center justify-center">
                      <span className="text-[10px] text-green-600 font-bold">✓</span>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Login page config */}
          <div className="bg-white rounded-xl border p-5 space-y-4">
            <h2 className="text-base font-semibold">Trang đăng nhập</h2>
            <div>
              <label className="text-sm font-medium block mb-1">Tiêu đề</label>
              <input
                type="text"
                value={branding.loginTitle}
                onChange={(e) => setBranding((b) => ({ ...b, loginTitle: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm"
                placeholder="LMS Tập đoàn"
              />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Mô tả phụ</label>
              <input
                type="text"
                value={branding.loginSubtitle}
                onChange={(e) => setBranding((b) => ({ ...b, loginSubtitle: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm"
                placeholder="Đăng nhập để tiếp tục"
              />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Ảnh nền</label>
              <input
                ref={bgFileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => { if (e.target.files?.[0]) uploadFile(e.target.files[0], 'loginBgUrl', setUploadingBg); }}
              />
              <div className="flex gap-2 mb-2">
                <button
                  onClick={() => bgFileRef.current?.click()}
                  disabled={uploadingBg}
                  className="px-3 py-1.5 border rounded text-sm hover:bg-gray-50 disabled:opacity-50 shrink-0"
                >
                  {uploadingBg ? '⏳ Đang upload...' : '↑ Chọn từ máy tính'}
                </button>
                <input
                  type="text"
                  value={branding.loginBgUrl}
                  onChange={(e) => setBranding((b) => ({ ...b, loginBgUrl: e.target.value }))}
                  placeholder="Hoặc nhập URL ảnh nền..."
                  className="flex-1 border rounded px-3 py-1.5 text-sm"
                />
              </div>
              <p className="text-xs text-gray-400">Nếu không có ảnh, sẽ dùng màu gradient từ theme đã chọn</p>
              {branding.loginBgUrl && (
                <div className="relative mt-2 rounded-lg overflow-hidden border">
                  <div
                    className="h-24 bg-center bg-cover"
                    style={{ backgroundImage: `url(${branding.loginBgUrl})` }}
                  />
                  <button
                    onClick={() => setBranding((b) => ({ ...b, loginBgUrl: '' }))}
                    className="absolute top-1 right-1 w-6 h-6 bg-black/60 text-white rounded-full text-xs hover:bg-black/80"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Preview */}
          <div className="bg-white rounded-xl border p-5 space-y-3">
            <h2 className="text-base font-semibold">Xem trước trang đăng nhập</h2>
            <div
              className="rounded-xl min-h-[220px] flex items-center justify-center relative overflow-hidden"
              style={
                branding.loginBgUrl
                  ? { backgroundImage: `url(${branding.loginBgUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
                  : { background: `linear-gradient(135deg, ${activePreset.from}, ${activePreset.to})` }
              }
            >
              <div className="bg-white rounded-xl shadow-xl p-6 w-64 text-center space-y-3 z-10">
                {branding.logoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={branding.logoUrl} alt="Logo" className="h-10 object-contain mx-auto" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                )}
                <h3 className="text-base font-bold text-gray-900">{branding.loginTitle || 'LMS Tập đoàn'}</h3>
                <p className="text-xs text-gray-500">{branding.loginSubtitle || 'Đăng nhập để tiếp tục'}</p>
                <div className="space-y-2 text-left">
                  <div className="h-7 bg-gray-100 rounded border" />
                  <div className="h-7 bg-gray-100 rounded border" />
                  <div
                    className="h-8 rounded text-xs text-white flex items-center justify-center font-medium"
                    style={{ background: activePreset.primary }}
                  >
                    Đăng nhập
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
            >
              {saving ? 'Đang lưu...' : 'Lưu cài đặt'}
            </button>
          </div>
        </>
      )}

      {loadingBranding && selectedOrgId && (
        <div className="text-center py-8 text-muted-foreground">Đang tải cài đặt...</div>
      )}
      </>)}
    </div>
  );
}
