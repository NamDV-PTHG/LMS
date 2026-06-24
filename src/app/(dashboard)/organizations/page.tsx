'use client';

import { useAuth } from '@/components/providers/auth-provider';
import { useToast } from '@/components/ui/toast';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

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

export default function OrganizationsPage() {
  const { accessToken, user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create modal
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

  // Step 2: create company admin (shown after company is created)
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
        // After creating a company, offer to create admin user
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
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tổ chức</h1>
          <p className="text-sm text-gray-500 mt-0.5">Danh sách công ty và đơn vị trong tập đoàn</p>
        </div>
        {isGroupAdmin && (
          <button
            onClick={() => { setForm((f) => ({ ...f, type: 'company' })); setShowCreate(true); }}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            + Tạo công ty
          </button>
        )}
        {isCompanyAdmin && (
          <button
            onClick={() => { setForm((f) => ({ ...f, type: 'dept' })); setShowCreate(true); }}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            + Tạo phòng ban
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="text-center py-16 text-gray-400">Đang tải...</div>
      ) : error ? (
        <div className="text-center py-16 text-red-500">{error}</div>
      ) : orgs.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg font-medium">Chưa có tổ chức nào</p>
          {isGroupAdmin && (
            <p className="text-sm mt-2">Bắt đầu bằng cách tạo một công ty con</p>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Companies */}
          {companies.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Công ty ({companies.length})</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {companies.map((org) => (
                  <div
                    key={org.id}
                    onClick={() => router.push(`/organizations/${org.id}`)}
                    className="bg-white rounded-xl border p-4 cursor-pointer hover:border-blue-400 hover:shadow-sm transition-all"
                  >
                    <div className="flex items-start justify-between">
                      <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                        <span className="text-blue-700 font-bold text-sm">{org.code?.slice(0, 2) ?? org.name[0]}</span>
                      </div>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        org.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {org.isActive ? 'Hoạt động' : 'Vô hiệu'}
                      </span>
                    </div>
                    <div className="mt-3">
                      <p className="font-semibold text-gray-900">{org.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">Mã: {org.code ?? '—'}</p>
                      {org.address && <p className="text-xs text-gray-400 mt-0.5 truncate">{org.address}</p>}
                    </div>
                    <div className="mt-3 pt-3 border-t text-xs text-blue-600 font-medium hover:underline">
                      Quản lý →
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Other org types */}
          {others.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Đơn vị khác ({others.length})</h2>
              <div className="bg-white rounded-xl border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Tên</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Mã</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Loại</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {others.map((org) => (
                      <tr
                        key={org.id}
                        onClick={() => router.push(`/organizations/${org.id}`)}
                        className="hover:bg-blue-50 cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-3 font-medium text-gray-900">{org.name}</td>
                        <td className="px-4 py-3 text-gray-500">{org.code ?? '—'}</td>
                        <td className="px-4 py-3 text-gray-500">{ORG_TYPE_LABEL[org.type ?? ''] ?? org.type ?? '—'}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            org.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                          }`}>
                            {org.isActive ? 'Hoạt động' : 'Vô hiệu'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl">
            <div className="px-6 py-5 border-b flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">
                {isCompanyAdmin ? 'Tạo phòng ban / nhóm' : 'Tạo tổ chức mới'}
              </h2>
              <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tên tổ chức <span className="text-red-500">*</span></label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Công ty TNHH XYZ"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mã tổ chức <span className="text-red-500">*</span></label>
                <input
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                  required
                  maxLength={20}
                  className="w-full rounded-lg border px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="CTYXYZ"
                />
                <p className="text-xs text-gray-400 mt-1">Mã duy nhất, viết hoa, không dấu</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Loại tổ chức</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value as typeof form.type })}
                  className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {isGroupAdmin && <option value="company">Công ty</option>}
                  <option value="dept">Phòng ban</option>
                  <option value="team">Nhóm</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tổ chức cha</label>
                <select
                  value={form.parentId}
                  onChange={(e) => setForm({ ...form, parentId: e.target.value })}
                  className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">— Không có (trực thuộc tập đoàn) —</option>
                  {orgs.map((o) => (
                    <option key={o.id} value={o.id}>{o.name} ({o.code})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Địa chỉ</label>
                <input
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="123 Đường ABC, TP.HCM"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Điện thoại</label>
                <input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="028 1234 5678"
                />
              </div>
              {saveError && (
                <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{saveError}</p>
              )}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="flex-1 rounded-lg border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
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
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl">
            <div className="px-6 py-5 border-b">
              <h2 className="font-semibold text-gray-900">Tạo tài khoản quản trị</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Công ty <strong>{createdOrgName}</strong> đã được tạo. Tạo tài khoản admin để quản lý công ty này.
              </p>
            </div>
            <form onSubmit={handleCreateAdmin} className="p-6 space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-sm text-blue-800">
                Hệ thống sẽ tự động gửi email thông tin đăng nhập đến địa chỉ email bên dưới.
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Họ và tên <span className="text-red-500">*</span></label>
                <input
                  value={adminForm.fullName}
                  onChange={(e) => setAdminForm({ ...adminForm, fullName: e.target.value })}
                  required
                  className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Nguyễn Văn A"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email <span className="text-red-500">*</span></label>
                <input
                  type="email"
                  value={adminForm.email}
                  onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })}
                  required
                  className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="admin@congty.vn"
                />
              </div>
              {adminError && (
                <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{adminError}</p>
              )}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowAdminStep(false); setCreatedOrgId(null); toast('success', 'Đã tạo công ty. Bạn có thể tạo admin sau từ trang tổ chức.'); }}
                  className="flex-1 rounded-lg border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Bỏ qua
                </button>
                <button
                  type="submit"
                  disabled={savingAdmin}
                  className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
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
