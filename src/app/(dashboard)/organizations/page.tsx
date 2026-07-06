'use client';

import { useAuth } from '@/components/providers/auth-provider';
import { useToast } from '@/components/ui/toast';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Plus, X, Building2 } from 'lucide-react';

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
              <p className="text-[9px] font-medium text-faint uppercase tracking-widest">Đơn vị khác ({others.length})</p>
              <div className="bg-surface border border-default rounded-xl shadow-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-default">
                        <th className="text-left text-[10px] text-faint font-medium px-4 py-2.5">Tên</th>
                        <th className="text-left text-[10px] text-faint font-medium px-4 py-2.5">Mã</th>
                        <th className="text-left text-[10px] text-faint font-medium px-4 py-2.5">Loại</th>
                        <th className="text-left text-[10px] text-faint font-medium px-4 py-2.5">Trạng thái</th>
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
    </div>
  );
}
