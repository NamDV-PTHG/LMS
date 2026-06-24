'use client';

import { useAuth } from '@/components/providers/auth-provider';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

const ROLE_TYPES = [
  'group_admin',
  'group_hrm',
  'company_admin',
  'hr_manager',
  'instructor',
  'learner',
];

interface UserRole {
  id: string;
  role: string;
  organizationId: string;
  organization: { id: string; name: string; type: string };
}

interface UserDetail {
  id: string;
  email: string;
  fullName: string;
  employeeCode: string | null;
  jobTitle: string | null;
  isActive: boolean;
  roles: UserRole[];
}

interface Organization {
  id: string;
  name: string;
  code: string;
  type: string;
  isActive: boolean;
}

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { accessToken } = useAuth();
  const router = useRouter();

  const [user, setUser] = useState<UserDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit form state
  const [editForm, setEditForm] = useState({ email: '', fullName: '', employeeCode: '', jobTitle: '' });
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  // Toggle active state
  const [toggling, setToggling] = useState(false);

  // Roles management
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [newRole, setNewRole] = useState('learner');
  const [newOrgId, setNewOrgId] = useState('');
  const [addingRole, setAddingRole] = useState(false);
  const [roleMsg, setRoleMsg] = useState<string | null>(null);
  const [removingRoleId, setRemovingRoleId] = useState<string | null>(null);

  // Password reset
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPw, setChangingPw] = useState(false);
  const [pwMsg, setPwMsg] = useState<string | null>(null);

  const authHeader = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };

  const loadUser = () => {
    setIsLoading(true);
    fetch(`/api/users/${id}`, { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((r) => r.json())
      .then((res) => {
        if (res.success) {
          setUser(res.data);
          setEditForm({
            email: res.data.email ?? '',
            fullName: res.data.fullName ?? '',
            employeeCode: res.data.employeeCode ?? '',
            jobTitle: res.data.jobTitle ?? '',
          });
        } else {
          setError(res.error ?? 'Không tìm thấy người dùng');
        }
      })
      .catch(() => setError('Không thể kết nối server'))
      .finally(() => setIsLoading(false));
  };

  const loadOrgs = () => {
    fetch('/api/organizations', { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((r) => r.json())
      .then((res) => {
        if (res.success) {
          const orgs: Organization[] = res.data ?? [];
          setOrganizations(orgs);
          if (orgs.length > 0) setNewOrgId(orgs[0].id);
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    if (accessToken) {
      loadUser();
      loadOrgs();
    }
  }, [accessToken]); // eslint-disable-line

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: 'PATCH',
        headers: authHeader,
        body: JSON.stringify({
          email: editForm.email || undefined,
          fullName: editForm.fullName,
          employeeCode: editForm.employeeCode || null,
          jobTitle: editForm.jobTitle || null,
        }),
      }).then((r) => r.json());
      if (res.success) {
        setSaveMsg('Đã lưu thành công');
        loadUser();
      } else {
        setSaveMsg(res.error ?? 'Lưu thất bại');
      }
    } catch {
      setSaveMsg('Lỗi kết nối');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async () => {
    if (!user) return;
    setToggling(true);
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: 'PATCH',
        headers: authHeader,
        body: JSON.stringify({ isActive: !user.isActive }),
      }).then((r) => r.json());
      if (res.success) loadUser();
    } catch {
      // ignore
    } finally {
      setToggling(false);
    }
  };

  const handleRemoveRole = async (roleId: string) => {
    setRemovingRoleId(roleId);
    try {
      const res = await fetch(`/api/users/${id}/roles/${roleId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      }).then((r) => r.json());
      if (res.success) {
        setRoleMsg(null);
        loadUser();
      } else {
        setRoleMsg(res.error ?? 'Xoá vai trò thất bại');
      }
    } catch {
      setRoleMsg('Lỗi kết nối');
    } finally {
      setRemovingRoleId(null);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 8) {
      setPwMsg('Mật khẩu tối thiểu 8 ký tự');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwMsg('Mật khẩu xác nhận không khớp');
      return;
    }
    setChangingPw(true);
    setPwMsg(null);
    try {
      const res = await fetch(`/api/users/${id}/password`, {
        method: 'PATCH',
        headers: authHeader,
        body: JSON.stringify({ password: newPassword }),
      }).then((r) => r.json());
      if (res.success) {
        setPwMsg('Đã đổi mật khẩu thành công');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setPwMsg(res.error ?? 'Đổi mật khẩu thất bại');
      }
    } catch {
      setPwMsg('Lỗi kết nối');
    } finally {
      setChangingPw(false);
    }
  };

  const handleAddRole = async () => {
    if (!newOrgId) {
      setRoleMsg('Vui lòng chọn tổ chức');
      return;
    }
    const isDuplicate = user?.roles.some((r) => r.role === newRole && r.organizationId === newOrgId);
    if (isDuplicate) {
      setRoleMsg('Vai trò này đã tồn tại trong tổ chức đã chọn');
      return;
    }
    setAddingRole(true);
    setRoleMsg(null);
    try {
      const res = await fetch(`/api/users/${id}/roles`, {
        method: 'POST',
        headers: authHeader,
        body: JSON.stringify({ role: newRole, organizationId: newOrgId }),
      }).then((r) => r.json());
      if (res.success) {
        setRoleMsg('Đã thêm vai trò');
        loadUser();
      } else {
        setRoleMsg(res.error ?? 'Thêm vai trò thất bại');
      }
    } catch {
      setRoleMsg('Lỗi kết nối');
    } finally {
      setAddingRole(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-2">
          <div className="w-7 h-7 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-gray-500">Đang tải...</p>
        </div>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <p className="text-red-600">{error ?? 'Không tìm thấy người dùng'}</p>
        <Link href="/users" className="text-sm text-blue-600 hover:underline mt-2 inline-block">
          ← Quay lại danh sách
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Back */}
      <Link href="/users" className="text-sm text-blue-600 hover:underline">
        ← Quay lại danh sách người dùng
      </Link>

      {/* Header */}
      <div className="bg-white rounded-xl border p-5 flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-blue-600 text-white text-lg flex items-center justify-center font-bold shrink-0">
            {user.fullName?.[0]?.toUpperCase() ?? 'U'}
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{user.fullName}</h1>
            <p className="text-sm text-gray-500">{user.email}</p>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium mt-1 ${
                user.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
              }`}
            >
              {user.isActive ? 'Hoạt động' : 'Vô hiệu'}
            </span>
          </div>
        </div>
        <button
          onClick={handleToggleActive}
          disabled={toggling}
          className={`px-4 py-2 text-sm font-medium rounded-lg border disabled:opacity-50 transition-colors ${
            user.isActive
              ? 'border-red-300 text-red-600 hover:bg-red-50'
              : 'border-green-300 text-green-600 hover:bg-green-50'
          }`}
        >
          {toggling ? 'Đang xử lý...' : user.isActive ? 'Vô hiệu hóa' : 'Kích hoạt'}
        </button>
      </div>

      {/* Basic info form */}
      <div className="bg-white rounded-xl border p-5 space-y-4">
        <h2 className="text-base font-semibold text-gray-800">Thông tin cơ bản</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Họ tên</label>
            <input
              type="text"
              value={editForm.fullName}
              onChange={(e) => setEditForm((f) => ({ ...f, fullName: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mã nhân viên</label>
            <input
              type="text"
              value={editForm.employeeCode}
              onChange={(e) => setEditForm((f) => ({ ...f, employeeCode: e.target.value }))}
              placeholder="NV001"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Chức danh</label>
            <input
              type="text"
              value={editForm.jobTitle}
              onChange={(e) => setEditForm((f) => ({ ...f, jobTitle: e.target.value }))}
              placeholder="Nhân viên kinh doanh"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Email đăng nhập</label>
            <input
              type="email"
              value={editForm.email}
              onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="user@company.vn"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-400 mt-1">Thay đổi email sẽ ảnh hưởng đến tài khoản đăng nhập</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Đang lưu...' : 'Lưu thông tin'}
          </button>
          {saveMsg && (
            <span
              className={`text-sm ${
                saveMsg.includes('thành công') ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {saveMsg}
            </span>
          )}
        </div>
      </div>

      {/* Change Password */}
      <div className="bg-white rounded-xl border p-5 space-y-4">
        <h2 className="text-base font-semibold text-gray-800">Đổi mật khẩu</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mật khẩu mới</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Tối thiểu 8 ký tự"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Xác nhận mật khẩu</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Nhập lại mật khẩu"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleChangePassword}
            disabled={changingPw || !newPassword}
            className="px-4 py-2 text-sm bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
          >
            {changingPw ? 'Đang đổi...' : 'Đổi mật khẩu'}
          </button>
          {pwMsg && (
            <span
              className={`text-sm ${
                pwMsg.includes('thành công') ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {pwMsg}
            </span>
          )}
        </div>
      </div>

      {/* Roles */}
      <div className="bg-white rounded-xl border p-5 space-y-4">
        <h2 className="text-base font-semibold text-gray-800">Vai trò</h2>

        {user.roles.length === 0 ? (
          <p className="text-sm text-gray-400">Chưa có vai trò nào</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left px-3 py-2 font-medium text-gray-600">Vai trò</th>
                <th className="text-left px-3 py-2 font-medium text-gray-600">Tổ chức</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {user.roles.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2">
                    <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded font-medium">
                      {r.role}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-gray-600">{r.organization?.name ?? r.organizationId}</td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => handleRemoveRole(r.id)}
                      disabled={removingRoleId === r.id}
                      className="text-xs text-red-500 hover:text-red-700 hover:underline disabled:opacity-50"
                    >
                      {removingRoleId === r.id ? 'Đang xoá...' : 'Xoá'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Add role form */}
        <div className="pt-2 border-t">
          <p className="text-sm font-medium text-gray-700 mb-3">Thêm vai trò mới</p>
          <div className="flex flex-wrap gap-2 items-end">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Vai trò</label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {ROLE_TYPES.map((rt) => (
                  <option key={rt} value={rt}>
                    {rt}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Tổ chức</label>
              <select
                value={newOrgId}
                onChange={(e) => setNewOrgId(e.target.value)}
                className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[180px]"
              >
                {organizations.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={handleAddRole}
              disabled={addingRole || organizations.length === 0}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {addingRole ? 'Đang thêm...' : 'Thêm'}
            </button>
          </div>
          {roleMsg && (
            <p
              className={`text-sm mt-2 ${
                roleMsg.includes('Đã thêm') ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {roleMsg}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
