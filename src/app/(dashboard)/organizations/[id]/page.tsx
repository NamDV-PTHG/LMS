'use client';

import { useAuth } from '@/components/providers/auth-provider';
import { useToast } from '@/components/ui/toast';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, X } from 'lucide-react';
import { OrgChartViewer } from '@/components/org-chart/OrgChartViewer';

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
  dept_head: 'Trưởng bộ phận',
  instructor: 'Giảng viên',
  learner: 'Học viên',
};

const inputClass =
  'w-full border border-default rounded-lg px-3 py-2 text-[12px] text-content placeholder:text-faint focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors';

export default function OrgDetailPage() {
  const { accessToken, user } = useAuth();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [org, setOrg] = useState<OrgDetail | null>(null);
  const [users, setUsers] = useState<UserInOrg[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'info' | 'users' | 'orgchart'>('info');

  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', address: '', phone: '', description: '', parentId: '', type: '' });
  const [saving, setSaving] = useState(false);
  const [parentOptions, setParentOptions] = useState<{ id: string; name: string; code: string; type: string }[]>([]);
  const [parentOptionsLoading, setParentOptionsLoading] = useState(false);
  const [parentSearch, setParentSearch] = useState('');
  const [parentDropdownOpen, setParentDropdownOpen] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [showAssignRole, setShowAssignRole] = useState(false);
  const [assignForm, setAssignForm] = useState({ userId: '', role: 'company_admin' });
  const [allUsers, setAllUsers] = useState<UserInOrg[]>([]);
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  const [showCreateAdmin, setShowCreateAdmin] = useState(false);
  const [adminForm, setAdminForm] = useState({ email: '', fullName: '', password: '' });
  const [creatingAdmin, setCreatingAdmin] = useState(false);
  const [adminMsg, setAdminMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

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
            parentId: res.data.parentId ?? '',
            type: res.data.type ?? '',
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
    const param = org?.type === 'company'
      ? `filterCompanyId=${id}`
      : `deptId=${id}`;
    fetch(`/api/users?${param}&limit=200`, { headers: { Authorization: `Bearer ${accessToken}` } })
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

  const loadParentOptions = () => {
    if (!accessToken) return;
    setParentOptionsLoading(true);
    fetch(`/api/organizations/${id}/flat`, { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((r) => r.json())
      .then((res) => {
        if (res.success) {
          // Exclude self from parent candidates
          setParentOptions((res.data ?? []).filter((o: { id: string }) => o.id !== id));
        }
      })
      .catch(() => {})
      .finally(() => setParentOptionsLoading(false));
  };

  useEffect(() => { loadOrg(); loadUsers(); }, [accessToken, id]); // eslint-disable-line

  const handleSave = async () => {
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        name: editForm.name,
        address: editForm.address || undefined,
        phone: editForm.phone || undefined,
        description: editForm.description || undefined,
      };
      if (org?.type === 'dept' || org?.type === 'team') {
        body.parentId = editForm.parentId || null;
        if (editForm.type && editForm.type !== org.type) {
          body.type = editForm.type;
        }
      }
      const res = await fetch(`/api/organizations/${id}`, {
        method: 'PATCH',
        headers: authHeader,
        body: JSON.stringify(body),
      }).then((r) => r.json());
      if (res.success) {
        setOrg({ ...org!, ...res.data });
        setEditing(false);
        loadOrg(); // reload to sync parentId
        toast('success', 'Đã cập nhật thông tin tổ chức');
      } else {
        toast('error', res.error ?? 'Lỗi cập nhật');
      }
    } catch {
      toast('error', 'Lỗi kết nối server');
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async () => {
    setDeactivating(true);
    try {
      const res = await fetch(`/api/organizations/${id}/deactivate`, {
        method: 'POST',
        headers: authHeader,
        body: JSON.stringify({}),
      }).then((r) => r.json());
      if (res.success) {
        toast('success', 'Đã vô hiệu hóa phòng ban');
        router.push('/organizations');
      } else {
        toast('error', res.error ?? 'Lỗi vô hiệu hóa');
      }
    } catch {
      toast('error', 'Lỗi kết nối server');
    } finally {
      setDeactivating(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/organizations/${id}`, {
        method: 'DELETE',
        headers: authHeader,
      }).then((r) => r.json());
      if (!res.success && res.code === 'HAS_DEPENDENCIES') {
        toast('warning', res.error ?? 'Không thể xóa vì còn dữ liệu liên quan');
      } else if (res.success) {
        toast('success', 'Đã xóa phòng ban');
        router.push('/organizations');
      } else {
        toast('error', res.error ?? 'Lỗi xóa phòng ban');
      }
    } catch {
      toast('error', 'Lỗi kết nối server');
    } finally {
      setDeleting(false);
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

  const [removingRoleId, setRemovingRoleId] = useState<string | null>(null);
  const handleRemoveRole = async (userId: string, roleId: string) => {
    setRemovingRoleId(roleId);
    try {
      const res = await fetch(`/api/users/${userId}/roles/${roleId}`, {
        method: 'DELETE',
        headers: authHeader,
      }).then((r) => r.json());
      if (res.success) {
        loadUsers();
        toast('success', 'Đã xóa phân quyền');
      } else {
        toast('error', res.error ?? 'Lỗi xóa phân quyền');
      }
    } catch {
      toast('error', 'Lỗi kết nối');
    } finally {
      setRemovingRoleId(null);
    }
  };

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingAdmin(true);
    setAdminMsg(null);
    try {
      const res = await fetch(`/api/organizations/${id}/admin`, {
        method: 'POST',
        headers: authHeader,
        body: JSON.stringify({
          email: adminForm.email.trim(),
          fullName: adminForm.fullName.trim(),
          password: adminForm.password || undefined,
        }),
      }).then((r) => r.json());
      if (res.success) {
        const emailNote = res.data?.emailSent
          ? 'Thông tin đăng nhập đã gửi qua email.'
          : `⚠ Tài khoản đã tạo nhưng email chưa gửi được (${res.data?.emailError ?? 'SMTP chưa cấu hình'}). Hãy cung cấp mật khẩu cho người dùng thủ công.`;
        setAdminMsg({ type: res.data?.emailSent ? 'ok' : 'err', text: `Đã tạo tài khoản cho ${adminForm.email}. ${emailNote}` });
        setAdminForm({ email: '', fullName: '', password: '' });
        loadUsers();
      } else {
        setAdminMsg({ type: 'err', text: res.error ?? 'Tạo thất bại' });
      }
    } catch {
      setAdminMsg({ type: 'err', text: 'Lỗi kết nối server' });
    } finally {
      setCreatingAdmin(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !org) {
    return (
      <div className="max-w-5xl mx-auto space-y-3">
        <div className="bg-danger-tint border border-danger/20 rounded-xl p-4 text-[12px] text-danger">
          {error ?? 'Không tìm thấy tổ chức'}
        </div>
        <button onClick={() => router.back()} className="inline-flex items-center gap-1 text-[12px] text-primary hover:underline">
          <ChevronLeft size={14} /> Quay lại
        </button>
      </div>
    );
  }

  const typeLabel = { group: 'Tập đoàn', company: 'Công ty', dept: 'Phòng ban', team: 'Nhóm' }[org.type] ?? org.type;

  return (
    <div className="max-w-5xl mx-auto space-y-4">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-[12px] text-subtle">
        <button onClick={() => router.push('/organizations')} className="hover:text-primary transition-colors">Tổ chức</button>
        <span className="text-faint">/</span>
        <span className="text-content font-medium">{org.name}</span>
      </div>

      {/* Header */}
      <div className="bg-surface border border-default rounded-xl shadow-card p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            {/* Logo */}
            <div className="relative group shrink-0">
              {(org.metadata as Record<string, unknown>)?.logoUrl ? (
                <img
                  src={(org.metadata as Record<string, string>).logoUrl}
                  alt="Logo"
                  className="w-14 h-14 rounded-xl object-contain border border-default bg-surface"
                />
              ) : (
                <div className="w-14 h-14 rounded-xl bg-primary-tint flex items-center justify-center">
                  <span className="text-primary font-medium text-[17px]">{org.code?.slice(0, 2) ?? org.name[0]}</span>
                </div>
              )}
              {canEdit && (
                <>
                  <button
                    onClick={() => logoInputRef.current?.click()}
                    disabled={uploadingLogo}
                    className="absolute inset-0 rounded-xl flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity text-white text-[10px] font-medium disabled:opacity-30"
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
              <h1 className="text-[16px] font-medium text-content">{org.name}</h1>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="text-[10px] bg-muted text-subtle rounded-full px-2 py-0.5 font-medium">{typeLabel}</span>
                <span className="text-[11px] text-faint font-mono">Mã: {org.code}</span>
                <span className={`text-[10px] rounded-full px-2 py-0.5 font-medium ${
                  org.isActive ? 'bg-success-tint text-success' : 'bg-muted text-faint'
                }`}>
                  {org.isActive ? 'Hoạt động' : 'Vô hiệu'}
                </span>
              </div>
            </div>
          </div>
          {canEdit && !editing && (
            <button
              onClick={() => { setEditing(true); setActiveTab('info'); loadParentOptions(); }}
              className="px-3 py-1.5 text-[12px] font-medium border border-default rounded-lg text-subtle hover:bg-muted transition-colors"
            >
              Chỉnh sửa
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-default">
        {(['info', 'users', 'orgchart'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => {
              setActiveTab(tab);
              if (tab === 'users') loadUsers();
            }}
            className={`px-4 py-2.5 text-[12px] font-medium border-b-2 -mb-px transition-colors ${
              activeTab === tab
                ? 'border-primary text-primary'
                : 'border-transparent text-subtle hover:text-content'
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
        <div className="bg-surface border border-default rounded-xl shadow-card p-4 space-y-4">
          {editing ? (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="block text-[12px] font-medium text-content">Tên tổ chức</label>
                <input
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className={inputClass}
                />
              </div>

              {/* Loại phòng ban — chỉ cho dept/team */}
              {(org.type === 'dept' || org.type === 'team') && (
                <div className="space-y-1.5">
                  <label className="block text-[12px] font-medium text-content">Loại phòng ban</label>
                  <select
                    value={editForm.type}
                    onChange={(e) => setEditForm({ ...editForm, type: e.target.value })}
                    className={inputClass}
                  >
                    <option value="dept">Phòng ban</option>
                    <option value="team">Nhóm / Tổ</option>
                  </select>
                </div>
              )}

              {/* Bộ phận quản lý trực tiếp — chỉ cho dept/team */}
              {(org.type === 'dept' || org.type === 'team') && (
                <div className="space-y-1.5">
                  <label className="block text-[12px] font-medium text-content">Bộ phận quản lý trực tiếp</label>
                  {parentOptionsLoading ? (
                    <div className="w-full border border-default rounded-lg px-3 py-2 text-[12px] text-faint flex items-center gap-2">
                      <span className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin shrink-0" />
                      Đang tải danh sách...
                    </div>
                  ) : (
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => { setParentDropdownOpen((v) => !v); setParentSearch(''); }}
                        className="w-full border border-default rounded-lg px-3 py-2 text-[12px] text-left focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 bg-surface flex items-center justify-between gap-2"
                      >
                        <span className={editForm.parentId ? 'text-content' : 'text-faint'}>
                          {editForm.parentId
                            ? (() => { const o = parentOptions.find((x) => x.id === editForm.parentId); return o ? `${o.name} (${o.code})` : '—'; })()
                            : '— Không có (trực thuộc công ty) —'}
                        </span>
                        <svg className={`w-3.5 h-3.5 text-faint shrink-0 transition-transform ${parentDropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                      </button>

                      {parentDropdownOpen && (
                        <div className="absolute z-20 mt-1 w-full bg-surface border border-default rounded-lg shadow-card overflow-hidden">
                          <div className="p-2 border-b border-default">
                            <input
                              autoFocus
                              type="text"
                              value={parentSearch}
                              onChange={(e) => setParentSearch(e.target.value)}
                              placeholder="Tìm kiếm phòng ban..."
                              className="w-full border border-default rounded-md px-2.5 py-1.5 text-[12px] text-content placeholder:text-faint focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                            />
                          </div>
                          <ul className="max-h-52 overflow-y-auto py-1">
                            <li>
                              <button
                                type="button"
                                onClick={() => { setEditForm({ ...editForm, parentId: '' }); setParentDropdownOpen(false); }}
                                className={`w-full text-left px-3 py-2 text-[12px] hover:bg-muted transition-colors ${!editForm.parentId ? 'bg-primary-tint text-primary font-medium' : 'text-faint'}`}
                              >
                                — Không có (trực thuộc công ty) —
                              </button>
                            </li>
                            {(() => {
                              const q = parentSearch.trim().toLowerCase();
                              const filtered = q
                                ? parentOptions.filter((o) => o.name.toLowerCase().includes(q) || o.code.toLowerCase().includes(q))
                                : parentOptions;
                              if (filtered.length === 0) return (
                                <li className="px-3 py-2 text-[12px] text-faint text-center">Không tìm thấy phòng ban</li>
                              );
                              return filtered.map((o) => (
                                <li key={o.id}>
                                  <button
                                    type="button"
                                    onClick={() => { setEditForm({ ...editForm, parentId: o.id }); setParentDropdownOpen(false); setParentSearch(''); }}
                                    className={`w-full text-left px-3 py-2 text-[12px] hover:bg-muted transition-colors ${editForm.parentId === o.id ? 'bg-primary-tint text-primary font-medium' : 'text-content'}`}
                                  >
                                    <span className="font-medium">{o.name}</span>
                                    <span className="ml-1.5 text-faint text-[11px]">({o.code})</span>
                                  </button>
                                </li>
                              ));
                            })()}
                          </ul>
                        </div>
                      )}

                      {parentDropdownOpen && (
                        <div className="fixed inset-0 z-10" onClick={() => { setParentDropdownOpen(false); setParentSearch(''); }} />
                      )}
                    </div>
                  )}
                </div>
              )}
              <div className="space-y-1.5">
                <label className="block text-[12px] font-medium text-content">Mô tả</label>
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  rows={3}
                  className={inputClass}
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setEditing(false)}
                  className="px-4 py-2 text-[12px] border border-default rounded-lg text-subtle hover:bg-muted transition-colors"
                >
                  Hủy
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-2 text-[12px] bg-primary hover:bg-primary-dark text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
                </button>
              </div>

              {/* Danger zone — chỉ cho dept/team */}
              {(org.type === 'dept' || org.type === 'team') && (
                <div className="border border-danger/20 bg-danger-tint/30 rounded-xl p-4 space-y-3 mt-2">
                  <p className="text-[11px] font-semibold text-danger uppercase tracking-wide">Vùng nguy hiểm</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handleDeactivate}
                      disabled={deactivating || deleting}
                      className="px-3 py-1.5 text-[12px] border border-warning/50 text-warning rounded-lg hover:bg-warning/10 transition-colors disabled:opacity-50"
                    >
                      {deactivating ? 'Đang xử lý...' : '⏸ Ngưng hoạt động'}
                    </button>
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={deleting || deactivating}
                      className="px-3 py-1.5 text-[12px] border border-danger/50 text-danger rounded-lg hover:bg-danger/10 transition-colors disabled:opacity-50"
                    >
                      {deleting ? 'Đang xóa...' : '🗑 Xóa phòng ban'}
                    </button>
                  </div>
                  <p className="text-[11px] text-faint leading-relaxed">
                    <strong>Ngưng hoạt động:</strong> ẩn khỏi sơ đồ, giữ nguyên lịch sử học tập.<br />
                    <strong>Xóa:</strong> xóa vĩnh viễn, chỉ thực hiện được khi không còn nhân viên, vị trí hay khóa học liên quan.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
          {/* Create Admin section */}
          {isGroupAdmin && org.type === 'company' && (
            <div className="bg-warning-tint border border-warning/20 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[12px] font-medium text-warning">Quản trị viên công ty</p>
                  <p className="text-[11px] text-warning/80 mt-0.5">
                    Tạo nhanh tài khoản company_admin cho công ty <strong>{org.name}</strong>.
                    Thông tin đăng nhập sẽ gửi qua email.
                  </p>
                </div>
                <button
                  onClick={() => { setShowCreateAdmin((v) => !v); setAdminMsg(null); }}
                  className="px-3 py-1.5 text-[11px] bg-warning text-white rounded-lg hover:bg-warning/90 whitespace-nowrap transition-colors"
                >
                  {showCreateAdmin ? 'Đóng' : '+ Tạo quản trị viên'}
                </button>
              </div>

              {showCreateAdmin && (
                <form onSubmit={handleCreateAdmin} className="space-y-3 pt-1">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-medium text-content">Email <span className="text-danger">*</span></label>
                      <input
                        type="email"
                        value={adminForm.email}
                        onChange={(e) => setAdminForm((f) => ({ ...f, email: e.target.value }))}
                        placeholder="admin@company.com"
                        required
                        className={inputClass}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-medium text-content">Họ tên <span className="text-danger">*</span></label>
                      <input
                        type="text"
                        value={adminForm.fullName}
                        onChange={(e) => setAdminForm((f) => ({ ...f, fullName: e.target.value }))}
                        placeholder="Nguyễn Văn A"
                        required
                        className={inputClass}
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-medium text-content">Mật khẩu <span className="text-[10px] text-faint font-normal">(để trống = tự tạo ngẫu nhiên)</span></label>
                    <input
                      type="text"
                      value={adminForm.password}
                      onChange={(e) => setAdminForm((f) => ({ ...f, password: e.target.value }))}
                      placeholder="Để trống để tạo ngẫu nhiên"
                      className={`${inputClass} font-mono`}
                    />
                  </div>
                  {adminMsg && (
                    <div className={`text-[11px] px-3 py-2 rounded-lg ${adminMsg.type === 'ok' ? 'bg-success-tint text-success' : 'bg-danger-tint text-danger'}`}>
                      {adminMsg.text}
                    </div>
                  )}
                  <button
                    type="submit"
                    disabled={creatingAdmin || !adminForm.email || !adminForm.fullName}
                    className="px-4 py-2 text-[12px] bg-warning hover:bg-warning/90 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                  >
                    {creatingAdmin ? 'Đang tạo...' : 'Tạo tài khoản quản trị viên'}
                  </button>
                </form>
              )}
            </div>
          )}

          <div className="flex items-center justify-between">
            <p className="text-[12px] text-subtle">
              {users.length} người dùng {org.type === 'company' ? 'thuộc công ty' : 'trong tổ chức'} này
            </p>
            {canEdit && (
              <button
                onClick={() => { setShowAssignRole(true); loadAllUsers(); }}
                className="flex items-center gap-1.5 bg-primary hover:bg-primary-dark text-white text-[12px] font-medium rounded-lg px-3 py-2 transition-colors"
              >
                + Phân quyền người dùng
              </button>
            )}
          </div>

          {users.length === 0 ? (
            <div className="bg-surface border border-default rounded-xl shadow-card flex flex-col items-center justify-center py-12 px-4 text-center">
              <p className="text-[12px] text-faint">Chưa có người dùng nào trong tổ chức này</p>
              {canEdit && (
                <p className="text-[11px] text-faint mt-1">Nhấn &quot;Phân quyền người dùng&quot; để thêm người dùng</p>
              )}
            </div>
          ) : (
            <div className="bg-surface border border-default rounded-xl shadow-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-default">
                      <th className="text-left text-[10px] text-faint font-medium px-4 py-2.5">Họ tên</th>
                      <th className="text-left text-[10px] text-faint font-medium px-4 py-2.5">Email</th>
                      <th className="text-left text-[10px] text-faint font-medium px-4 py-2.5">Vai trò</th>
                      <th className="text-left text-[10px] text-faint font-medium px-4 py-2.5">Trạng thái</th>
                      {canEdit && <th className="px-4 py-2.5" />}
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => {
                      const rolesHere = u.roles?.filter((r) => r.organizationId === id) ?? [];
                      return (
                        <tr key={u.id} className="border-b border-default last:border-0 hover:bg-muted transition-colors">
                          <td className="px-4 py-3">
                            <button
                              onClick={() => router.push(`/users/${u.id}`)}
                              className="text-[12px] font-medium text-content hover:text-primary transition-colors"
                            >
                              {u.fullName}
                            </button>
                            {u.employeeCode && <p className="text-[10px] text-faint">{u.employeeCode}</p>}
                          </td>
                          <td className="px-4 py-3 text-[11px] text-subtle">{u.email}</td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1">
                              {rolesHere.length > 0
                                ? rolesHere.map((r) => (
                                    <span key={r.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-primary-tint text-primary">
                                      {ROLE_LABEL[r.role] ?? r.role}
                                      {canEdit && (
                                        <button
                                          onClick={() => handleRemoveRole(u.id, r.id)}
                                          disabled={removingRoleId === r.id}
                                          className="text-primary/40 hover:text-danger ml-0.5 leading-none disabled:opacity-40"
                                          title="Xóa phân quyền"
                                        >
                                          {removingRoleId === r.id ? '…' : '×'}
                                        </button>
                                      )}
                                    </span>
                                  ))
                                : <span className="text-faint text-[11px]">—</span>
                              }
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                              u.isActive ? 'bg-success-tint text-success' : 'bg-muted text-faint'
                            }`}>
                              {u.isActive && <span className="w-1.5 h-1.5 bg-success rounded-full" />}
                              {u.isActive ? 'Hoạt động' : 'Vô hiệu'}
                            </span>
                          </td>
                          {canEdit && (
                            <td className="px-4 py-3 text-right">
                              <button
                                onClick={() => router.push(`/users/${u.id}`)}
                                className="text-[11px] text-primary hover:underline"
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
            </div>
          )}
        </div>
      )}

      {/* Tab: Org chart */}
      {activeTab === 'orgchart' && accessToken && (
        <div className="border border-default rounded-xl shadow-card overflow-hidden" style={{ height: 640 }}>
          <OrgChartViewer
            companyId={org.companyId ?? org.id}
            accessToken={accessToken}
            canEdit={canEdit}
          />
        </div>
      )}

      {/* Assign role modal */}
      {showAssignRole && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-surface rounded-xl shadow-card border border-default w-full max-w-md">
            <div className="px-5 py-4 border-b border-default flex items-center justify-between">
              <h2 className="text-[14px] font-medium text-content">Phân quyền người dùng</h2>
              <button onClick={() => setShowAssignRole(false)} className="text-faint hover:text-content transition-colors">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleAssignRole} className="p-5 space-y-3">
              <div className="space-y-1.5">
                <label className="block text-[12px] font-medium text-content">Người dùng <span className="text-danger">*</span></label>
                <select
                  value={assignForm.userId}
                  onChange={(e) => setAssignForm({ ...assignForm, userId: e.target.value })}
                  required
                  className="w-full border border-default rounded-lg px-3 py-2 text-[12px] text-content focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 bg-surface"
                >
                  <option value="">— Chọn người dùng —</option>
                  {allUsers.map((u) => (
                    <option key={u.id} value={u.id}>{u.fullName} ({u.email})</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="block text-[12px] font-medium text-content">Vai trò <span className="text-danger">*</span></label>
                <select
                  value={assignForm.role}
                  onChange={(e) => setAssignForm({ ...assignForm, role: e.target.value })}
                  className="w-full border border-default rounded-lg px-3 py-2 text-[12px] text-content focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 bg-surface"
                >
                  {isGroupAdmin && <option value="group_admin">Quản trị tập đoàn</option>}
                  {isGroupAdmin && <option value="group_hrm">HRM tập đoàn</option>}
                  <option value="company_admin">Quản trị công ty</option>
                  <option value="hr_manager">Quản lý HR</option>
                  <option value="dept_head">Trưởng bộ phận</option>
                  <option value="instructor">Giảng viên</option>
                  <option value="learner">Học viên</option>
                </select>
              </div>
              <div className="bg-primary-tint border border-primary/15 rounded-lg p-3 text-[11px] text-primary">
                <strong>Lưu ý:</strong> Vai trò sẽ được gán cho tổ chức <strong>{org.name}</strong>.
                Người dùng cần được tạo trước qua trang <a href="/users" className="underline">Người dùng</a>.
              </div>
              {assignError && (
                <div className="bg-danger-tint border border-danger/20 rounded-lg px-3 py-2 text-[12px] text-danger">{assignError}</div>
              )}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowAssignRole(false)}
                  className="flex-1 rounded-lg border border-default px-4 py-2 text-[12px] font-medium text-subtle hover:bg-muted transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={assigning || !assignForm.userId}
                  className="flex-1 rounded-lg bg-primary hover:bg-primary-dark px-4 py-2 text-[12px] font-medium text-white transition-colors disabled:opacity-50"
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
      <p className="text-[9px] font-medium text-faint uppercase tracking-widest">{label}</p>
      <p className="mt-1 text-[12px] text-content">{value || <span className="text-faint">—</span>}</p>
    </div>
  );
}

function OrgTree({ nodes }: { nodes: OrgDetail[] }) {
  if (!nodes || nodes.length === 0) return null;
  return (
    <ul className="space-y-2 pl-4 border-l-2 border-default">
      {nodes.map((node) => (
        <li key={node.id}>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
            <span className="text-[12px] font-medium text-content">{node.name}</span>
            <span className="text-[10px] text-faint font-mono">({node.code})</span>
            <span className="text-[10px] text-faint">— {node.type}</span>
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
