'use client';

import { useAuth } from '@/components/providers/auth-provider';
import { useToast } from '@/components/ui/toast';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Plus, X, Building2, AlertTriangle, GitBranch, ChevronDown } from 'lucide-react';

interface Organization {
  id: string;
  name: string;
  code: string | null;
  type: string | null;
  parentId: string | null;
  isActive: boolean;
  address?: string | null;
  phone?: string | null;
  description?: string | null;
}

type AutoAssignStatus =
  | 'assign' | 'reassign' | 'no_change'
  | 'keep_current' | 'already_assigned' | 'unresolvable';

interface AutoAssignItem {
  id: string;
  name: string;
  code: string;
  currentParentId: string | null;
  currentParentName: string | null;
  proposedParentId: string | null;
  proposedParentName: string | null;
  proposedParentCode: string | null;
  status: AutoAssignStatus;
}

interface AutoAssignResult {
  preview: AutoAssignItem[];
  summary: { willAssign: number; noChange: number; unresolvable: number; keepCurrent: number };
}

const ORG_TYPE_LABEL: Record<string, string> = {
  group: 'Tập đoàn',
  company: 'Công ty',
  dept: 'Phòng ban',
  team: 'Nhóm',
};

const inputClass =
  'w-full border border-default rounded-lg px-3 py-2 text-[12px] text-content placeholder:text-faint focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors';

export default function OrganizationsPage() {
  const { accessToken, user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    name: '',
    code: '',
    type: 'company' as 'company' | 'dept' | 'team',
    parentId: '',
    address: '',
    phone: '',
    description: '',
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [createdOrgId, setCreatedOrgId] = useState<string | null>(null);
  const [createdOrgName, setCreatedOrgName] = useState('');
  const [showAdminStep, setShowAdminStep] = useState(false);
  const [adminForm, setAdminForm] = useState({ email: '', fullName: '' });
  const [savingAdmin, setSavingAdmin] = useState(false);
  const [adminError, setAdminError] = useState<string | null>(null);

  // Auto-assign state
  const [autoAssignModal, setAutoAssignModal] = useState(false);
  const [autoAssignForce, setAutoAssignForce] = useState(false);
  const [autoAssignData, setAutoAssignData] = useState<AutoAssignResult | null>(null);
  const [autoAssignLoading, setAutoAssignLoading] = useState(false);
  const [autoAssignExecuting, setAutoAssignExecuting] = useState(false);
  const [autoAssignError, setAutoAssignError] = useState<string | null>(null);
  const [autoAssignShowAll, setAutoAssignShowAll] = useState(false);

  const getRole = (r: unknown): string =>
    typeof r === 'string' ? r : (r as { role: string }).role;
  const userRoles = user?.roles?.map(getRole) ?? [];
  const isGroupAdmin = userRoles.includes('group_admin');
  const isCompanyAdmin = !isGroupAdmin && (userRoles.includes('company_admin') || userRoles.includes('hr_manager'));

  const headers = { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' };

  const load = () => {
    if (!accessToken) return;
    setIsLoading(true);
    fetch('/api/organizations', { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((r) => r.json())
      .then((res) => {
        if (res.success) setOrgs(res.data ?? []);
        else setError(res.error ?? 'Lỗi tải dữ liệu');
      })
      .catch(() => setError('Không thể kết nối server'))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => { load(); }, [accessToken]); // eslint-disable-line

  const fetchAutoAssignPreview = async (force: boolean) => {
    setAutoAssignLoading(true);
    setAutoAssignError(null);
    setAutoAssignData(null);
    setAutoAssignShowAll(false);
    try {
      const res = await fetch('/api/organizations/auto-assign', {
        method: 'POST',
        headers,
        body: JSON.stringify({ preview: true, forceReassign: force }),
      }).then((r) => r.json());
      if (res.success) setAutoAssignData(res.data);
      else setAutoAssignError(res.error ?? 'Lỗi tải dữ liệu');
    } catch {
      setAutoAssignError('Lỗi kết nối server');
    } finally {
      setAutoAssignLoading(false);
    }
  };

  const handleOpenAutoAssign = () => {
    setAutoAssignModal(true);
    setAutoAssignForce(false);
    fetchAutoAssignPreview(false);
  };

  const handleForceToggle = (checked: boolean) => {
    setAutoAssignForce(checked);
    fetchAutoAssignPreview(checked);
  };

  const handleConfirmAutoAssign = async () => {
    setAutoAssignExecuting(true);
    setAutoAssignError(null);
    try {
      const res = await fetch('/api/organizations/auto-assign', {
        method: 'POST',
        headers,
        body: JSON.stringify({ preview: false, forceReassign: autoAssignForce }),
      }).then((r) => r.json());
      if (res.success) {
        setAutoAssignModal(false);
        setAutoAssignForce(false);
        setAutoAssignData(null);
        toast('success', `Đã gắn ${res.data.summary.willAssign} phòng ban vào sơ đồ`);
        load();
      } else {
        setAutoAssignError(res.error ?? 'Lỗi thực thi');
      }
    } catch {
      setAutoAssignError('Lỗi kết nối server');
    } finally {
      setAutoAssignExecuting(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        name: form.name,
        code: form.code.toUpperCase(),
        type: form.type,
      };
      if (form.parentId) body.parentId = form.parentId;
      if (form.address) body.address = form.address;
      if (form.phone) body.phone = form.phone;
      if (form.description) body.description = form.description;

      const res = await fetch('/api/organizations', {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      }).then((r) => r.json());

      if (res.success) {
        setShowCreate(false);
        setForm({ name: '', code: '', type: 'company', parentId: '', address: '', phone: '', description: '' });
        load();
        if (form.type === 'company' && isGroupAdmin && res.data?.id) {
          setCreatedOrgId(res.data.id);
          setCreatedOrgName(res.data.name ?? form.name);
          setAdminForm({ email: '', fullName: '' });
          setAdminError(null);
          setShowAdminStep(true);
        } else {
          toast('success', 'Tạo tổ chức thành công');
        }
      } else {
        setSaveError(res.error ?? 'Lỗi tạo tổ chức');
      }
    } catch {
      setSaveError('Lỗi kết nối');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createdOrgId) return;
    setAdminError(null);
    setSavingAdmin(true);
    try {
      const res = await fetch(`/api/organizations/${createdOrgId}/admin`, {
        method: 'POST',
        headers,
        body: JSON.stringify(adminForm),
      }).then((r) => r.json());
      if (res.success) {
        setShowAdminStep(false);
        setCreatedOrgId(null);
        toast('success', `Đã tạo tài khoản admin và gửi email đến ${adminForm.email}`);
      } else {
        setAdminError(res.error ?? 'Lỗi tạo tài khoản');
      }
    } catch {
      setAdminError('Lỗi kết nối');
    } finally {
      setSavingAdmin(false);
    }
  };

  const companies = orgs.filter((o) => o.type === 'company');
  const others = orgs.filter((o) => o.type !== 'company');

  return (
    <div className="max-w-5xl mx-auto space-y-4">

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <p className="text-[12px] text-subtle">
          {orgs.length > 0 ? `${orgs.length} tổ chức trong hệ thống` : 'Danh sách tổ chức'}
        </p>
        <div className="flex items-center gap-2">
          {(isGroupAdmin || isCompanyAdmin) && others.length > 0 && (
            <button
              onClick={handleOpenAutoAssign}
              className="flex items-center gap-1.5 border border-default text-subtle text-[12px] font-medium rounded-lg px-3 py-2 hover:bg-muted transition-colors active:scale-[0.98]"
            >
              <GitBranch size={14} /> Tự động gắn sơ đồ
            </button>
          )}
          {isGroupAdmin && (
            <button
              onClick={() => { setForm((f) => ({ ...f, type: 'company' })); setShowCreate(true); }}
              className="flex items-center gap-1.5 bg-primary hover:bg-primary-dark text-white text-[12px] font-medium rounded-lg px-3 py-2 transition-colors active:scale-[0.98]"
            >
              <Plus size={14} /> Tạo công ty
            </button>
          )}
          {isCompanyAdmin && (
            <button
              onClick={() => { setForm((f) => ({ ...f, type: 'dept' })); setShowCreate(true); }}
              className="flex items-center gap-1.5 bg-primary hover:bg-primary-dark text-white text-[12px] font-medium rounded-lg px-3 py-2 transition-colors active:scale-[0.98]"
            >
              <Plus size={14} /> Tạo phòng ban
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="bg-danger-tint border border-danger/20 rounded-xl p-4 text-[12px] text-danger">{error}</div>
      ) : orgs.length === 0 ? (
        <div className="bg-surface border border-default rounded-xl shadow-card flex flex-col items-center justify-center py-16 px-4 text-center">
          <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mb-4">
            <Building2 size={20} className="text-faint" />
          </div>
          <p className="text-[13px] font-medium text-content">Chưa có tổ chức nào</p>
          {isGroupAdmin && (
            <p className="text-[12px] text-subtle mt-1">Bắt đầu bằng cách tạo một công ty con</p>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Companies */}
          {companies.length > 0 && (
            <div className="space-y-3">
              <p className="text-[9px] font-medium text-faint uppercase tracking-widest">Công ty ({companies.length})</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {companies.map((org) => (
                  <div
                    key={org.id}
                    onClick={() => router.push(`/organizations/${org.id}`)}
                    className="bg-surface border border-default rounded-xl shadow-card p-4 cursor-pointer hover:border-primary/40 hover:shadow-md transition-all"
                  >
                    <div className="flex items-start justify-between">
                      <div className="w-10 h-10 rounded-lg bg-primary-tint flex items-center justify-center flex-shrink-0">
                        <span className="text-primary font-medium text-[13px]">{org.code?.slice(0, 2) ?? org.name[0]}</span>
                      </div>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                        org.isActive ? 'bg-success-tint text-success' : 'bg-muted text-faint'
                      }`}>
                        {org.isActive ? 'Hoạt động' : 'Vô hiệu'}
                      </span>
                    </div>
                    <div className="mt-3">
                      <p className="text-[13px] font-medium text-content">{org.name}</p>
                      <p className="text-[11px] text-faint mt-0.5 font-mono">Mã: {org.code ?? '—'}</p>
                      {org.address && <p className="text-[11px] text-subtle mt-0.5 truncate">{org.address}</p>}
                    </div>
                    <div className="mt-3 pt-3 border-t border-default text-[11px] text-primary font-medium">
                      Quản lý →
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Other org types */}
          {others.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[9px] font-medium text-faint uppercase tracking-widest">Đơn vị khác ({others.length})</p>
                {others.filter((o) => o.parentId === null).length > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-warning-tint text-warning border border-warning/20">
                    <AlertTriangle size={10} />
                    {others.filter((o) => o.parentId === null).length} chưa gán vào sơ đồ
                  </span>
                )}
              </div>
              <div className="bg-surface border border-default rounded-xl shadow-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-default">
                        <th className="text-left text-[10px] text-faint font-medium px-4 py-2.5">Tên</th>
                        <th className="text-left text-[10px] text-faint font-medium px-4 py-2.5">Mã</th>
                        <th className="text-left text-[10px] text-faint font-medium px-4 py-2.5">Loại</th>
                        <th className="text-left text-[10px] text-faint font-medium px-4 py-2.5">Trạng thái</th>
                        <th className="text-left text-[10px] text-faint font-medium px-4 py-2.5">Vị trí sơ đồ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {others.map((org) => (
                        <tr
                          key={org.id}
                          onClick={() => router.push(`/organizations/${org.id}`)}
                          className="border-b border-default last:border-0 hover:bg-muted cursor-pointer transition-colors"
                        >
                          <td className="px-4 py-3 text-[12px] font-medium text-content">{org.name}</td>
                          <td className="px-4 py-3 text-[11px] text-subtle font-mono">{org.code ?? '—'}</td>
                          <td className="px-4 py-3 text-[11px] text-subtle">{ORG_TYPE_LABEL[org.type ?? ''] ?? org.type ?? '—'}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                              org.isActive ? 'bg-success-tint text-success' : 'bg-muted text-faint'
                            }`}>
                              {org.isActive && <span className="w-1.5 h-1.5 bg-success rounded-full" />}
                              {org.isActive ? 'Hoạt động' : 'Vô hiệu'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {org.parentId !== null ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-success-tint text-success">
                                <span className="w-1.5 h-1.5 bg-success rounded-full" />
                                Đã gán
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-warning-tint text-warning">
                                <AlertTriangle size={10} />
                                Chưa gán
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-surface rounded-xl shadow-card border border-default w-full max-w-md">
            <div className="px-5 py-4 border-b border-default flex items-center justify-between">
              <h2 className="text-[14px] font-medium text-content">
                {isCompanyAdmin ? 'Tạo phòng ban / nhóm' : 'Tạo tổ chức mới'}
              </h2>
              <button onClick={() => setShowCreate(false)} className="text-faint hover:text-content transition-colors">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-5 space-y-3">
              <div className="space-y-1.5">
                <label className="block text-[12px] font-medium text-content">Tên tổ chức <span className="text-danger">*</span></label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  className={inputClass}
                  placeholder="Công ty TNHH XYZ"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-[12px] font-medium text-content">Mã tổ chức <span className="text-danger">*</span></label>
                <input
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                  required
                  maxLength={20}
                  className={`${inputClass} font-mono`}
                  placeholder="CTYXYZ"
                />
                <p className="text-[11px] text-faint">Mã duy nhất, viết hoa, không dấu</p>
              </div>
              <div className="space-y-1.5">
                <label className="block text-[12px] font-medium text-content">Loại tổ chức</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value as typeof form.type })}
                  className="w-full border border-default rounded-lg px-3 py-2 text-[12px] text-content focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 bg-surface"
                >
                  {isGroupAdmin && <option value="company">Công ty</option>}
                  <option value="dept">Phòng ban</option>
                  <option value="team">Nhóm</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="block text-[12px] font-medium text-content">Tổ chức cha</label>
                <select
                  value={form.parentId}
                  onChange={(e) => setForm({ ...form, parentId: e.target.value })}
                  className="w-full border border-default rounded-lg px-3 py-2 text-[12px] text-content focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 bg-surface"
                >
                  <option value="">— Không có (trực thuộc tập đoàn) —</option>
                  {orgs.map((o) => (
                    <option key={o.id} value={o.id}>{o.name} ({o.code})</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="block text-[12px] font-medium text-content">Địa chỉ</label>
                <input
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className={inputClass}
                  placeholder="123 Đường ABC, TP.HCM"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-[12px] font-medium text-content">Điện thoại</label>
                <input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className={inputClass}
                  placeholder="028 1234 5678"
                />
              </div>
              {saveError && (
                <div className="bg-danger-tint border border-danger/20 rounded-lg px-3 py-2 text-[12px] text-danger">{saveError}</div>
              )}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="flex-1 rounded-lg border border-default px-4 py-2 text-[12px] font-medium text-subtle hover:bg-muted transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 rounded-lg bg-primary hover:bg-primary-dark px-4 py-2 text-[12px] font-medium text-white transition-colors disabled:opacity-50"
                >
                  {saving ? 'Đang lưu...' : 'Tạo tổ chức'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Step 2: Create company admin */}
      {showAdminStep && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-surface rounded-xl shadow-card border border-default w-full max-w-md">
            <div className="px-5 py-4 border-b border-default">
              <h2 className="text-[14px] font-medium text-content">Tạo tài khoản quản trị</h2>
              <p className="text-[12px] text-subtle mt-0.5">
                Công ty <strong>{createdOrgName}</strong> đã được tạo. Tạo tài khoản admin để quản lý công ty này.
              </p>
            </div>
            <form onSubmit={handleCreateAdmin} className="p-5 space-y-3">
              <div className="bg-primary-tint border border-primary/15 rounded-lg px-3 py-2 text-[12px] text-primary">
                Hệ thống sẽ tự động gửi email thông tin đăng nhập đến địa chỉ email bên dưới.
              </div>
              <div className="space-y-1.5">
                <label className="block text-[12px] font-medium text-content">Họ và tên <span className="text-danger">*</span></label>
                <input
                  value={adminForm.fullName}
                  onChange={(e) => setAdminForm({ ...adminForm, fullName: e.target.value })}
                  required
                  className={inputClass}
                  placeholder="Nguyễn Văn A"
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-[12px] font-medium text-content">Email <span className="text-danger">*</span></label>
                <input
                  type="email"
                  value={adminForm.email}
                  onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })}
                  required
                  className={inputClass}
                  placeholder="admin@congty.vn"
                />
              </div>
              {adminError && (
                <div className="bg-danger-tint border border-danger/20 rounded-lg px-3 py-2 text-[12px] text-danger">{adminError}</div>
              )}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => { setShowAdminStep(false); setCreatedOrgId(null); toast('success', 'Đã tạo công ty. Bạn có thể tạo admin sau từ trang tổ chức.'); }}
                  className="flex-1 rounded-lg border border-default px-4 py-2 text-[12px] font-medium text-subtle hover:bg-muted transition-colors"
                >
                  Bỏ qua
                </button>
                <button
                  type="submit"
                  disabled={savingAdmin}
                  className="flex-1 rounded-lg bg-primary hover:bg-primary-dark px-4 py-2 text-[12px] font-medium text-white transition-colors disabled:opacity-50"
                >
                  {savingAdmin ? 'Đang tạo...' : 'Tạo & gửi email'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Auto-assign modal */}
      {autoAssignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-surface rounded-xl shadow-card border border-default w-full max-w-2xl max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="px-5 py-4 border-b border-default flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <GitBranch size={16} className="text-primary" />
                <h2 className="text-[14px] font-medium text-content">Tự động gắn sơ đồ tổ chức</h2>
              </div>
              <button
                onClick={() => { setAutoAssignModal(false); setAutoAssignForce(false); setAutoAssignData(null); }}
                className="text-faint hover:text-content transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              {/* Force toggle */}
              <label className="flex items-start gap-3 p-3 border border-default rounded-lg cursor-pointer hover:bg-muted transition-colors">
                <input
                  type="checkbox"
                  checked={autoAssignForce}
                  onChange={(e) => handleForceToggle(e.target.checked)}
                  disabled={autoAssignLoading || autoAssignExecuting}
                  className="mt-0.5 accent-primary"
                />
                <div>
                  <p className="text-[12px] font-medium text-content">Chạy lại toàn bộ (kể cả đã được gán)</p>
                  <p className="text-[11px] text-subtle mt-0.5">
                    Dùng khi vừa tạo thêm phòng ban cấp giữa còn thiếu.
                    Ví dụ: tạo <span className="font-mono bg-muted px-1 rounded">BGD-PC</span> → phòng ban{' '}
                    <span className="font-mono bg-muted px-1 rounded">BGD-PC-DES</span> sẽ tự chuyển sang <span className="font-mono bg-muted px-1 rounded">BGD-PC</span>.
                  </p>
                </div>
              </label>

              {/* Loading */}
              {autoAssignLoading && (
                <div className="flex items-center gap-2 text-[12px] text-subtle py-4 justify-center">
                  <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  Đang phân tích mã phòng ban...
                </div>
              )}

              {/* Error */}
              {autoAssignError && (
                <div className="bg-danger-tint border border-danger/20 rounded-lg px-3 py-2 text-[12px] text-danger">
                  {autoAssignError}
                </div>
              )}

              {/* Preview */}
              {autoAssignData && !autoAssignLoading && (() => {
                const { preview, summary } = autoAssignData;
                const activeRows = preview.filter((i) =>
                  i.status === 'assign' || i.status === 'reassign' || i.status === 'unresolvable'
                );
                const hiddenRows = preview.filter((i) =>
                  i.status === 'already_assigned' || i.status === 'no_change' || i.status === 'keep_current'
                );

                return (
                  <div className="space-y-3">
                    {/* Summary bar */}
                    <div className={`flex items-center gap-3 px-3 py-2 rounded-lg text-[12px] border ${
                      summary.willAssign > 0 ? 'bg-primary-tint border-primary/20 text-primary' : 'bg-muted border-default text-subtle'
                    }`}>
                      <span className="font-medium">{summary.willAssign} sẽ được gán</span>
                      {summary.unresolvable > 0 && (
                        <>
                          <span className="text-faint">·</span>
                          <span className="text-warning font-medium">{summary.unresolvable} không xác định được</span>
                        </>
                      )}
                      {summary.keepCurrent > 0 && (
                        <>
                          <span className="text-faint">·</span>
                          <span className="text-subtle">{summary.keepCurrent} giữ nguyên</span>
                        </>
                      )}
                    </div>

                    {/* Preview table */}
                    {activeRows.length > 0 && (
                      <div className="border border-default rounded-lg overflow-hidden">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-default bg-muted/40">
                              <th className="text-left text-[10px] text-faint font-medium px-3 py-2">Phòng ban</th>
                              <th className="text-left text-[10px] text-faint font-medium px-3 py-2">Mã</th>
                              <th className="text-left text-[10px] text-faint font-medium px-3 py-2">Đơn vị cha đề xuất</th>
                              <th className="text-left text-[10px] text-faint font-medium px-3 py-2">Trạng thái</th>
                            </tr>
                          </thead>
                          <tbody>
                            {activeRows.map((item) => (
                              <tr key={item.id} className="border-b border-default last:border-0">
                                <td className="px-3 py-2 text-[12px] font-medium text-content">{item.name}</td>
                                <td className="px-3 py-2 text-[11px] font-mono text-subtle">{item.code}</td>
                                <td className="px-3 py-2 text-[11px] text-content">
                                  {item.status === 'reassign' ? (
                                    <span className="flex items-center gap-1">
                                      <span className="text-faint line-through">{item.currentParentName}</span>
                                      <span className="text-faint">→</span>
                                      <span className="text-primary font-medium">{item.proposedParentName}</span>
                                    </span>
                                  ) : item.proposedParentName ? (
                                    <span className="text-primary font-medium">{item.proposedParentName}
                                      <span className="text-faint font-normal ml-1">({item.proposedParentCode})</span>
                                    </span>
                                  ) : (
                                    <span className="text-faint">—</span>
                                  )}
                                </td>
                                <td className="px-3 py-2">
                                  {(item.status === 'assign' || item.status === 'reassign') && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-success-tint text-success">
                                      <span className="w-1.5 h-1.5 bg-success rounded-full" />
                                      {item.status === 'reassign' ? 'Đổi cha' : 'Sẽ gán'}
                                    </span>
                                  )}
                                  {item.status === 'unresolvable' && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-warning-tint text-warning">
                                      <AlertTriangle size={10} />
                                      Không xác định được
                                    </span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Collapsed rows toggle */}
                    {hiddenRows.length > 0 && (
                      <button
                        onClick={() => setAutoAssignShowAll((v) => !v)}
                        className="flex items-center gap-1 text-[11px] text-subtle hover:text-content transition-colors"
                      >
                        <ChevronDown size={12} className={`transition-transform ${autoAssignShowAll ? 'rotate-180' : ''}`} />
                        {autoAssignShowAll ? 'Ẩn bớt' : `Xem thêm ${hiddenRows.length} phòng ban không thay đổi`}
                      </button>
                    )}

                    {autoAssignShowAll && hiddenRows.length > 0 && (
                      <div className="border border-default rounded-lg overflow-hidden opacity-60">
                        <table className="w-full">
                          <tbody>
                            {hiddenRows.map((item) => (
                              <tr key={item.id} className="border-b border-default last:border-0">
                                <td className="px-3 py-2 text-[11px] text-subtle">{item.name}</td>
                                <td className="px-3 py-2 text-[11px] font-mono text-faint">{item.code}</td>
                                <td className="px-3 py-2 text-[11px] text-faint">{item.currentParentName ?? '—'}</td>
                                <td className="px-3 py-2">
                                  <span className="text-[10px] text-faint">
                                    {item.status === 'already_assigned' && 'Đã gán (bỏ qua)'}
                                    {item.status === 'no_change' && 'Không thay đổi'}
                                    {item.status === 'keep_current' && 'Giữ nguyên'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {activeRows.length === 0 && hiddenRows.length > 0 && (
                      <p className="text-[12px] text-subtle text-center py-3">
                        Tất cả phòng ban đã được gán đúng vị trí.
                      </p>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-default flex items-center justify-between gap-3 shrink-0">
              <button
                onClick={() => { setAutoAssignModal(false); setAutoAssignForce(false); setAutoAssignData(null); }}
                disabled={autoAssignExecuting}
                className="px-4 py-2 text-[12px] border border-default rounded-lg text-subtle hover:bg-muted transition-colors disabled:opacity-50"
              >
                Hủy
              </button>
              <button
                onClick={handleConfirmAutoAssign}
                disabled={autoAssignExecuting || autoAssignLoading || !autoAssignData || autoAssignData.summary.willAssign === 0}
                className="flex items-center gap-2 px-4 py-2 text-[12px] bg-primary hover:bg-primary-dark text-white rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                {autoAssignExecuting && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                {autoAssignExecuting
                  ? 'Đang thực thi...'
                  : `Xác nhận gán ${autoAssignData?.summary.willAssign ?? 0} phòng ban`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
