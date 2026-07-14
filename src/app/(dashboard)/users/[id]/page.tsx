'use client';

import { useAuth } from '@/components/providers/auth-provider';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { CompetencyRadarChart } from '@/components/charts/competency-radar';
import type { CompetencyRadarData } from '@/services/competency-radar.service';

// group_admin / group_hrm are group-level roles — not assignable at company level
const ROLE_TYPES = [
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

interface JobPosition {
  id: string;
  title: string;
  code: string | null;
  level: string | null;
}

interface UserDetail {
  id: string;
  email: string;
  fullName: string;
  employeeCode: string | null;
  jobTitle: string | null;
  isActive: boolean;
  aiEnabled: boolean;
  jobPositionId: string | null;
  jobPosition: JobPosition | null;
  roles: UserRole[];
}

interface Organization {
  id: string;
  name: string;
  code: string;
  type: string;
  isActive: boolean;
}

const inputClass =
  'w-full border border-default rounded-lg px-3 py-2 text-[12px] text-content placeholder:text-faint focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors';

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { accessToken, user: currentUser } = useAuth();
  const canManageAI = currentUser?.roles.some(
    (r) => r.role === 'group_admin' || r.role === 'company_admin',
  ) ?? false;
  const router = useRouter();

  const [user, setUser] = useState<UserDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editForm, setEditForm] = useState({ email: '', fullName: '', employeeCode: '', jobTitle: '' });
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const [toggling, setToggling] = useState(false);

  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [newRole, setNewRole] = useState('learner');
  const [newOrgId, setNewOrgId] = useState('');
  const [addingRole, setAddingRole] = useState(false);
  const [roleMsg, setRoleMsg] = useState<string | null>(null);
  const [removingRoleId, setRemovingRoleId] = useState<string | null>(null);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPw, setChangingPw] = useState(false);
  const [pwMsg, setPwMsg] = useState<string | null>(null);

  const [positions, setPositions] = useState<JobPosition[]>([]);
  const [selectedPositionId, setSelectedPositionId] = useState('');
  const [assigningPosition, setAssigningPosition] = useState(false);

  const [radarData, setRadarData] = useState<CompetencyRadarData | null>(null);
  const [radarLoading, setRadarLoading] = useState(false);
  const [showRadar, setShowRadar] = useState(false);

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
          setSelectedPositionId(res.data.jobPositionId ?? '');
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

  const loadPositions = () => {
    fetch('/api/positions?isActive=true', { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((r) => r.json())
      .then((res) => { if (res.success) setPositions(res.data ?? []); })
      .catch(() => {});
  };

  const loadRadar = () => {
    setRadarLoading(true);
    fetch(`/api/users/${id}/competency-radar`, { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((r) => r.json())
      .then((res) => { if (res.success) setRadarData(res.data as CompetencyRadarData); })
      .catch(() => {})
      .finally(() => setRadarLoading(false));
  };

  useEffect(() => {
    if (accessToken) {
      loadUser();
      loadOrgs();
      loadPositions();
    }
  }, [accessToken]); // eslint-disable-line

  useEffect(() => {
    if (accessToken && showRadar && !radarData) loadRadar();
  }, [showRadar]); // eslint-disable-line

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

  const handleToggleAI = async () => {
    if (!user) return;
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: 'PATCH',
        headers: authHeader,
        body: JSON.stringify({ aiEnabled: !user.aiEnabled }),
      }).then((r) => r.json());
      if (res.success) loadUser();
    } catch {
      // ignore
    }
  };

  const handleRemoveRole = async (roleId: string) => {
    if (user && user.roles.length <= 1) {
      setRoleMsg('Không thể xóa vai trò cuối cùng. Thêm vai trò khác trước hoặc vô hiệu hóa tài khoản.');
      return;
    }
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

  const handleAssignPosition = async () => {
    setAssigningPosition(true);
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: 'PATCH',
        headers: authHeader,
        body: JSON.stringify({ jobPositionId: selectedPositionId || null }),
      }).then((r) => r.json());
      if (res.success) loadUser();
    } catch {
      // ignore
    } finally {
      setAssigningPosition(false);
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
      <div className="flex items-center justify-center py-16">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="bg-danger-tint border border-danger/20 rounded-xl p-4 text-[12px] text-danger">
          {error ?? 'Không tìm thấy người dùng'}
        </div>
        <Link href="/users" className="inline-flex items-center gap-1 text-[12px] text-primary hover:underline mt-3">
          <ChevronLeft size={14} /> Quay lại danh sách
        </Link>
      </div>
    );
  }

  const initials = user.fullName?.[0]?.toUpperCase() ?? 'U';

  return (
    <div className="max-w-3xl mx-auto space-y-4">

      {/* Back link */}
      <Link href="/users" className="inline-flex items-center gap-1 text-[12px] text-primary hover:underline">
        <ChevronLeft size={14} /> Quay lại danh sách người dùng
      </Link>

      {/* Header card */}
      <div className="bg-surface border border-default rounded-xl shadow-card p-4 flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-primary text-white text-[17px] font-medium flex items-center justify-center flex-shrink-0">
            {initials}
          </div>
          <div>
            <h1 className="text-[16px] font-medium text-content">{user.fullName}</h1>
            <p className="text-[12px] text-subtle mt-0.5">{user.email}</p>
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                user.isActive ? 'bg-success-tint text-success' : 'bg-muted text-faint'
              }`}>
                {user.isActive && <span className="w-1.5 h-1.5 bg-success rounded-full" />}
                {user.isActive ? 'Hoạt động' : 'Vô hiệu'}
              </span>
              {user.aiEnabled && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-primary-tint text-primary">
                  🤖 AI
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <button
            onClick={handleToggleActive}
            disabled={toggling}
            className={`px-3 py-1.5 text-[12px] font-medium rounded-lg border disabled:opacity-50 transition-colors ${
              user.isActive
                ? 'border-danger/30 text-danger hover:bg-danger-tint'
                : 'border-success/30 text-success hover:bg-success-tint'
            }`}
          >
            {toggling ? 'Đang xử lý...' : user.isActive ? 'Vô hiệu hóa' : 'Kích hoạt'}
          </button>
          {canManageAI && (
            <button
              onClick={handleToggleAI}
              className={`px-3 py-1.5 text-[12px] font-medium rounded-lg border transition-colors ${
                user.aiEnabled
                  ? 'border-primary/30 text-primary hover:bg-primary-tint'
                  : 'border-default text-subtle hover:bg-muted'
              }`}
              title={user.aiEnabled ? 'Tắt quyền dùng AI' : 'Bật quyền dùng AI'}
            >
              {user.aiEnabled ? '🤖 Tắt AI' : '🤖 Bật AI'}
            </button>
          )}
        </div>
      </div>

      {/* Basic info */}
      <div className="bg-surface border border-default rounded-xl shadow-card p-4 space-y-4">
        <h2 className="text-[13px] font-medium text-content">Thông tin cơ bản</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="block text-[12px] font-medium text-content">Họ tên</label>
            <input
              type="text"
              value={editForm.fullName}
              onChange={(e) => setEditForm((f) => ({ ...f, fullName: e.target.value }))}
              className={inputClass}
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-[12px] font-medium text-content">Mã nhân viên</label>
            <input
              type="text"
              value={editForm.employeeCode}
              onChange={(e) => setEditForm((f) => ({ ...f, employeeCode: e.target.value }))}
              placeholder="NV001"
              className={inputClass}
            />
          </div>
          <div className="sm:col-span-2 space-y-1.5">
            <label className="block text-[12px] font-medium text-content">Chức danh</label>
            <input
              type="text"
              value={editForm.jobTitle}
              onChange={(e) => setEditForm((f) => ({ ...f, jobTitle: e.target.value }))}
              placeholder="Nhân viên kinh doanh"
              className={inputClass}
            />
          </div>
          <div className="sm:col-span-2 space-y-1.5">
            <label className="block text-[12px] font-medium text-content">Email đăng nhập</label>
            <input
              type="email"
              value={editForm.email}
              onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="user@company.vn"
              className={inputClass}
            />
            <p className="text-[11px] text-faint">Thay đổi email sẽ ảnh hưởng đến tài khoản đăng nhập</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-[12px] bg-primary hover:bg-primary-dark text-white rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            {saving ? 'Đang lưu...' : 'Lưu thông tin'}
          </button>
          {saveMsg && (
            <span className={`text-[12px] ${saveMsg.includes('thành công') ? 'text-success' : 'text-danger'}`}>
              {saveMsg}
            </span>
          )}
        </div>
      </div>

      {/* Change Password */}
      <div className="bg-surface border border-default rounded-xl shadow-card p-4 space-y-4">
        <h2 className="text-[13px] font-medium text-content">Đổi mật khẩu</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="block text-[12px] font-medium text-content">Mật khẩu mới</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Tối thiểu 8 ký tự"
              className={inputClass}
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-[12px] font-medium text-content">Xác nhận mật khẩu</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Nhập lại mật khẩu"
              className={`${inputClass} ${confirmPassword && confirmPassword !== newPassword ? '!border-danger' : ''}`}
            />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleChangePassword}
            disabled={changingPw || !newPassword}
            className="px-4 py-2 text-[12px] bg-primary hover:bg-primary-dark text-white rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            {changingPw ? 'Đang đổi...' : 'Đổi mật khẩu'}
          </button>
          {pwMsg && (
            <span className={`text-[12px] ${pwMsg.includes('thành công') ? 'text-success' : 'text-danger'}`}>
              {pwMsg}
            </span>
          )}
        </div>
      </div>

      {/* Roles */}
      <div className="bg-surface border border-default rounded-xl shadow-card p-4 space-y-4">
        <h2 className="text-[13px] font-medium text-content">Vai trò</h2>

        {user.roles.length === 0 ? (
          <p className="text-[12px] text-faint">Chưa có vai trò nào</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-default">
                  <th className="text-left text-[10px] text-faint font-medium px-3 py-2">Vai trò</th>
                  <th className="text-left text-[10px] text-faint font-medium px-3 py-2">Tổ chức</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {user.roles.map((r) => (
                  <tr key={r.id} className="border-b border-default last:border-0 hover:bg-muted transition-colors">
                    <td className="px-3 py-2.5">
                      <span className="text-[10px] px-2 py-0.5 bg-primary-tint text-primary rounded font-medium">
                        {r.role}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-[12px] text-subtle">{r.organization?.name ?? r.organizationId}</td>
                    <td className="px-3 py-2.5 text-right">
                      <button
                        onClick={() => handleRemoveRole(r.id)}
                        disabled={removingRoleId === r.id || user.roles.length <= 1}
                        title={user.roles.length <= 1 ? 'Không thể xóa vai trò cuối cùng' : 'Xoá vai trò này'}
                        className="text-[11px] text-danger hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {removingRoleId === r.id ? 'Đang xoá...' : 'Xoá'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Add role form */}
        <div className="pt-3 border-t border-default space-y-3">
          <p className="text-[12px] font-medium text-content">Thêm vai trò mới</p>
          <div className="flex flex-wrap gap-2 items-end">
            <div className="space-y-1">
              <label className="block text-[11px] text-faint">Vai trò</label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                className="border border-default rounded-lg px-3 py-2 text-[12px] text-content focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 bg-surface"
              >
                {ROLE_TYPES.map((rt) => (
                  <option key={rt} value={rt}>{rt}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="block text-[11px] text-faint">Tổ chức</label>
              <select
                value={newOrgId}
                onChange={(e) => setNewOrgId(e.target.value)}
                className="border border-default rounded-lg px-3 py-2 text-[12px] text-content focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 bg-surface min-w-[180px]"
              >
                {organizations.map((o) => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            </div>
            <button
              onClick={handleAddRole}
              disabled={addingRole || organizations.length === 0}
              className="px-4 py-2 text-[12px] bg-primary hover:bg-primary-dark text-white rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              {addingRole ? 'Đang thêm...' : 'Thêm'}
            </button>
          </div>
          {roleMsg && (
            <p className={`text-[12px] ${roleMsg.includes('Đã thêm') ? 'text-success' : 'text-danger'}`}>
              {roleMsg}
            </p>
          )}
        </div>
      </div>

      {/* Job Position */}
      <div className="bg-surface border border-default rounded-xl shadow-card p-4 space-y-4">
        <div>
          <h2 className="text-[13px] font-medium text-content">Vị trí công việc</h2>
          <p className="text-[11px] text-faint mt-0.5">Gán vị trí (chức danh chính thức) trong hệ thống — dùng để đối chiếu khung năng lực và lộ trình học tự động</p>
        </div>

        {/* Current position badge */}
        {user.jobPosition ? (
          <div className="flex items-center gap-2 px-3 py-2 bg-primary-tint border border-primary/20 rounded-lg">
            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <span className="text-[10px] text-primary font-bold">P</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-medium text-content truncate">{user.jobPosition.title}</p>
              <p className="text-[10px] text-subtle">
                {[user.jobPosition.code, user.jobPosition.level].filter(Boolean).join(' · ') || 'Không có mã / cấp bậc'}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-[12px] text-faint italic">Chưa gán vị trí nào</p>
        )}

        {/* Assign form */}
        <div className="flex flex-wrap gap-2 items-end pt-1">
          <div className="flex-1 min-w-[200px] space-y-1">
            <label className="block text-[11px] text-faint">Chọn vị trí</label>
            {positions.length === 0 ? (
              <p className="text-[11px] text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                Chưa có vị trí nào. Vào mục <strong>Vị trí công việc</strong> để tạo trước.
              </p>
            ) : (
              <select
                value={selectedPositionId}
                onChange={(e) => setSelectedPositionId(e.target.value)}
                className="w-full border border-default rounded-lg px-3 py-2 text-[12px] text-content focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 bg-surface"
              >
                <option value="">-- Bỏ gán vị trí --</option>
                {positions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}{p.code ? ` (${p.code})` : ''}{p.level ? ` — ${p.level}` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>
          <button
            onClick={handleAssignPosition}
            disabled={assigningPosition || positions.length === 0 || selectedPositionId === (user.jobPositionId ?? '')}
            className="px-4 py-2 text-[12px] bg-primary hover:bg-primary-dark text-white rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            {assigningPosition ? 'Đang lưu...' : 'Lưu vị trí'}
          </button>
        </div>
      </div>

      {/* Competency Radar */}
      <div className="bg-surface border border-default rounded-xl shadow-card overflow-hidden">
        <button
          onClick={() => setShowRadar(!showRadar)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted transition-colors text-left"
        >
          <h2 className="text-[13px] font-medium text-content">Hồ sơ Năng lực</h2>
          <span className="text-faint text-[11px]">{showRadar ? '▲ Thu gọn' : '▼ Xem biểu đồ năng lực'}</span>
        </button>

        {showRadar && (
          <div className="p-4 border-t border-default">
            {radarLoading ? (
              <div className="flex items-center justify-center py-10">
                <div className="w-6 h-6 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : radarData ? (
              <CompetencyRadarChart data={radarData} showDetails />
            ) : (
              <p className="text-[12px] text-faint text-center py-6">Không tải được dữ liệu năng lực</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
