'use client';

import { useAuth } from '@/components/providers/auth-provider';
import { useToast } from '@/components/ui/toast';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

interface OrgDetail {
  id: string;
  name: string;
  code: string;
  type: string;
  parentId: string | null;
  isActive: boolean;
  address?: string | null;
  phone?: string | null;
  description?: string | null;
  metadata?: Record<string, unknown> | null;
  children?: OrgDetail[];
}

interface UserInOrg {
  id: string;
  fullName: string;
  email: string;
  employeeCode?: string | null;
  isActive: boolean;
  roles: Array<{ id: string; role: string; organizationId: string }>;
}

const ROLE_LABEL: Record<string, string> = {
  group_admin: 'Quản trị tập đoàn',
  group_hrm: 'HRM tập đoàn',
  company_admin: 'Quản trị công ty',
  hr_manager: 'Quản lý HR',
  instructor: 'Giảng viên',
  learner: 'Học viên',
};

export default function OrgDetailPage() {
  const { accessToken, user } = useAuth();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [org, setOrg] = useState<OrgDetail | null>(null);
  const [users, setUsers] = useState<UserInOrg[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'info' | 'users' | 'orgchart'>('info');

  // Edit org
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', address: '', phone: '', description: '' });
  const [saving, setSaving] = useState(false);

  // Assign role
  const [showAssignRole, setShowAssignRole] = useState(false);
  const [assignForm, setAssignForm] = useState({ userId: '', role: 'company_admin' });
  const [allUsers, setAllUsers] = useState<UserInOrg[]>([]);
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  const { toast } = useToast();
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const getRole = (r: unknown): string =>
    typeof r === 'string' ? r : (r as { role: string }).role;
  const userRoles = user?.roles?.map(getRole) ?? [];
  const isGroupAdmin = userRoles.includes('group_admin');
  const isCompanyAdmin = userRoles.includes('company_admin');
  const canEdit = isGroupAdmin || isCompanyAdmin;

  const authHeader = { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' };

  const loadOrg = () => {
    if (!accessToken || !id) return;
    fetch(`/api/organizations/${id}`, { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((r) => r.json())
      .then((res) => {
        if (res.success) {
          setOrg(res.data);
          setEditForm({
            name: res.data.name ?? '',
            address: res.data.address ?? '',
            phone: res.data.phone ?? '',
            description: res.data.description ?? '',
          });
        } else {
          setError(res.error ?? 'Lỗi tải tổ chức');
        }
      })
      .catch(() => setError('Không thể kết nối server'))
      .finally(() => setIsLoading(false));
  };

  const loadUsers = () => {
    if (!accessToken) return;
    fetch(`/api/users?organizationId=${id}&limit=200`, { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((r) => r.json())
      .then((res) => {
        if (res.success) setUsers(res.data ?? []);
      })
      .catch(() => {});
  };

  const loadAllUsers = () => {
    if (!accessToken) return;
    fetch('/api/users?limit=500', { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((r) => r.json())
      .then((res) => {
        if (res.success) setAllUsers(res.data ?? []);
      })
      .catch(() => {});
  };

  useEffect(() => { loadOrg(); loadUsers(); }, [accessToken, id]); // eslint-disable-line

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/organizations/${id}`, {
        method: 'PATCH',
        headers: authHeader,
        body: JSON.stringify(editForm),
      }).then((r) => r.json());
      if (res.success) {
        setOrg({ ...org!, ...res.data });
        setEditing(false);
      } else {
        alert(res.error ?? 'Lỗi cập nhật');
      }
    } catch {
      alert('Lỗi kết nối');
    } finally {
      setSaving(false);
    }
  };

  const handleAssignRole = async (e: React.FormEvent) => {
    e.preventDefault();
    setAssignError(null);
    setAssigning(true);
    try {
      const res = await fetch(`/api/users/${assignForm.userId}/roles`, {
        method: 'POST',
        headers: authHeader,
        body: JSON.stringify({ role: assignForm.role, organizationId: id }),
      }).then((r) => r.json());
      if (res.success) {
        setShowAssignRole(false);
        setAssignForm({ userId: '', role: 'company_admin' });
        loadUsers();
        loadOrg();
      } else {
        setAssignError(res.error ?? 'Lỗi phân quyền');
      }
    } catch {
      setAssignError('Lỗi kết nối');
    } finally {
      setAssigning(false);
    }
  };

  const handleLogoUpload = async (file: File) => {
    setUploadingLogo(true);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await fetch(`/api/organizations/${id}/logo`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: fd,
      }).then((r) => r.json());
      if (res.success) {
        toast('success', 'Đã cập nhật logo tổ chức');
        loadOrg();
      } else {
        toast('error', res.error ?? 'Upload logo thất bại');
      }
    } catch {
      toast('error', 'Lỗi kết nối server');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleRemoveRole = async (userId: string, roleId: string) => {
    if (!confirm('Xóa phân quyền này?')) return;
    try {
      const res = await fetch(`/api/users/${userId}/roles/${roleId}`, {
        method: 'DELETE',
        headers: authHeader,
      }).then((r) => r.json());
      if (res.success) {
        loadUsers();
      } else {
        alert(res.error ?? 'Lỗi xóa phân quyền');
      }
    } catch {
      alert('Lỗi kết nối');
    }
  };

  if (isLoading) {
    return <div className="flex h-64 items-center justify-center text-gray-400">Đang tải...</div>;
  }

  if (error || !org) {
    return (
      <div className="p-6 text-center text-red-500">
        {error ?? 'Không tìm thấy tổ chức'}
        <br />
        <button onClick={() => router.back()} className="mt-3 text-sm text-blue-600 hover:underline">← Quay lại</button>
      </div>
    );
  }

  const typeLabel = { group: 'Tập đoàn', company: 'Công ty', dept: 'Phòng ban', team: 'Nhóm' }[org.type] ?? org.type;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <button onClick={() => router.push('/organizations')} className="hover:text-blue-600">Tổ chức</button>
        <span>/</span>
        <span className="text-gray-900 font-medium">{org.name}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          {/* Logo / upload area */}
          <div className="relative group shrink-0">
            {(org.metadata as Record<string, unknown>)?.logoUrl ? (
              <img
                src={(org.metadata as Record<string, string>).logoUrl}
                alt="Logo"
                className="w-14 h-14 rounded-xl object-contain border bg-white"
              />
            ) : (
              <div className="w-14 h-14 rounded-xl bg-blue-100 flex items-center justify-center">
                <span className="text-blue-700 font-bold text-xl">{org.code?.slice(0, 2) ?? org.name[0]}</span>
              </div>
            )}
            {canEdit && (
              <>
                <button
                  onClick={() => logoInputRef.current?.click()}
                  disabled={uploadingLogo}
                  className="absolute inset-0 rounded-xl flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity text-white text-xs font-medium disabled:opacity-30"
                >
                  {uploadingLogo ? '...' : 'Đổi logo'}
                </button>
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleLogoUpload(f); }}
                />
              </>
            )}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{org.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs bg-gray-100 text-gray-600 rounded-full px-2 py-0.5 font-medium">{typeLabel}</span>
              <span className="text-xs text-gray-400">Mã: {org.code}</span>
              <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${
                org.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
              }`}>
                {org.isActive ? 'Hoạt động' : 'Vô hiệu'}
              </span>
            </div>
          </div>
        </div>
        {canEdit && !editing && (
          <button
            onClick={() => setEditing(true)}
            className="rounded-lg border px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Chỉnh sửa
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b flex gap-1">
        {(['info', 'users', 'orgchart'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => {
              setActiveTab(tab);
              if (tab === 'users') loadUsers();
              if (tab === 'orgchart') {/* handled by iframe */}
            }}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab === 'info' && 'Thông tin'}
            {tab === 'users' && `Người dùng (${users.length})`}
            {tab === 'orgchart' && 'Sơ đồ tổ chức'}
          </button>
        ))}
      </div>

      {/* Tab: Info */}
      {activeTab === 'info' && (
        <div className="bg-white rounded-xl border p-6 space-y-5">
          {editing ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tên tổ chức</label>
                <input
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Địa chỉ</label>
                <input
                  value={editForm.address}
                  onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                  className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="123 Đường ABC, TP.HCM"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Điện thoại</label>
                <input
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="028 1234 5678"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mô tả</label>
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  rows={3}
                  className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setEditing(false)}
                  className="rounded-lg border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Hủy
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <InfoRow label="Tên tổ chức" value={org.name} />
              <InfoRow label="Mã" value={org.code} />
              <InfoRow label="Loại" value={typeLabel} />
              <InfoRow label="Địa chỉ" value={org.address} />
              <InfoRow label="Điện thoại" value={org.phone} />
              <InfoRow label="Mô tả" value={org.description} />
            </div>
          )}
        </div>
      )}

      {/* Tab: Users */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">{users.length} người dùng trong tổ chức này</p>
            {canEdit && (
              <button
                onClick={() => { setShowAssignRole(true); loadAllUsers(); }}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                + Phân quyền người dùng
              </button>
            )}
          </div>

          {users.length === 0 ? (
            <div className="text-center py-12 text-gray-400 bg-white rounded-xl border">
              <p>Chưa có người dùng nào trong tổ chức này</p>
              {canEdit && (
                <p className="text-sm mt-2">Nhấn &quot;Phân quyền người dùng&quot; để thêm người dùng</p>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-xl border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Họ tên</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Email</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Vai trò</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Trạng thái</th>
                    {canEdit && <th className="px-4 py-3" />}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {users.map((u) => {
                    const rolesHere = u.roles?.filter((r) => r.organizationId === id) ?? [];
                    return (
                      <tr key={u.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <button
                            onClick={() => router.push(`/users/${u.id}`)}
                            className="font-medium text-gray-900 hover:text-blue-600"
                          >
                            {u.fullName}
                          </button>
                          {u.employeeCode && <p className="text-xs text-gray-400">{u.employeeCode}</p>}
                        </td>
                        <td className="px-4 py-3 text-gray-500">{u.email}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {rolesHere.length > 0
                              ? rolesHere.map((r) => (
                                  <span key={r.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                                    {ROLE_LABEL[r.role] ?? r.role}
                                    {canEdit && (
                                      <button
                                        onClick={() => handleRemoveRole(u.id, r.id)}
                                        className="text-blue-400 hover:text-red-500 ml-0.5 leading-none"
                                        title="Xóa phân quyền"
                                      >
                                        ×
                                      </button>
                                    )}
                                  </span>
                                ))
                              : <span className="text-gray-400 text-xs">—</span>
                            }
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                            u.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                          }`}>
                            {u.isActive ? 'Hoạt động' : 'Vô hiệu'}
                          </span>
                        </td>
                        {canEdit && (
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => router.push(`/users/${u.id}`)}
                              className="text-xs text-blue-600 hover:underline"
                            >
                              Chi tiết
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab: Org chart */}
      {activeTab === 'orgchart' && (
        <div className="bg-white rounded-xl border overflow-hidden h-[600px]">
          <p className="text-xs text-gray-400 p-3 text-center">
            Sơ đồ tổ chức — dùng trang Import để tải sơ đồ theo cấu trúc phòng ban
          </p>
          <div className="flex flex-col gap-3 px-6 py-4">
            <OrgTree nodes={org.children ?? []} />
          </div>
        </div>
      )}

      {/* Assign role modal */}
      {showAssignRole && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl">
            <div className="px-6 py-5 border-b flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Phân quyền người dùng</h2>
              <button onClick={() => setShowAssignRole(false)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>
            <form onSubmit={handleAssignRole} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Người dùng <span className="text-red-500">*</span></label>
                <select
                  value={assignForm.userId}
                  onChange={(e) => setAssignForm({ ...assignForm, userId: e.target.value })}
                  required
                  className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">— Chọn người dùng —</option>
                  {allUsers.map((u) => (
                    <option key={u.id} value={u.id}>{u.fullName} ({u.email})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Vai trò <span className="text-red-500">*</span></label>
                <select
                  value={assignForm.role}
                  onChange={(e) => setAssignForm({ ...assignForm, role: e.target.value })}
                  className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {isGroupAdmin && <option value="group_admin">Quản trị tập đoàn</option>}
                  {isGroupAdmin && <option value="group_hrm">HRM tập đoàn</option>}
                  <option value="company_admin">Quản trị công ty</option>
                  <option value="hr_manager">Quản lý HR</option>
                  <option value="instructor">Giảng viên</option>
                  <option value="learner">Học viên</option>
                </select>
              </div>
              <div className="bg-blue-50 rounded-lg p-3 text-xs text-blue-700">
                <strong>Lưu ý:</strong> Vai trò sẽ được gán cho tổ chức <strong>{org.name}</strong>.
                Người dùng cần được tạo trước qua trang <a href="/users" className="underline">Người dùng</a>.
              </div>
              {assignError && (
                <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{assignError}</p>
              )}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAssignRole(false)}
                  className="flex-1 rounded-lg border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={assigning || !assignForm.userId}
                  className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {assigning ? 'Đang lưu...' : 'Phân quyền'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">{label}</p>
      <p className="mt-1 text-sm text-gray-900">{value || <span className="text-gray-400">—</span>}</p>
    </div>
  );
}

function OrgTree({ nodes }: { nodes: OrgDetail[] }) {
  if (!nodes || nodes.length === 0) return null;
  return (
    <ul className="space-y-2 pl-4 border-l-2 border-gray-100">
      {nodes.map((node) => (
        <li key={node.id}>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-300 shrink-0" />
            <span className="text-sm font-medium text-gray-800">{node.name}</span>
            <span className="text-xs text-gray-400">({node.code})</span>
            <span className="text-xs text-gray-400">— {node.type}</span>
          </div>
          {node.children && node.children.length > 0 && (
            <div className="mt-2 ml-4">
              <OrgTree nodes={node.children} />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
