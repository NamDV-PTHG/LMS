'use client';

import { useAuth } from '@/components/providers/auth-provider';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';

interface UserRole {
  role: string;
  organizationId: string;
  organizationName: string;
  organizationType?: string;
}

interface User {
  id: string;
  email: string;
  fullName: string;
  employeeCode: string | null;
  jobTitle: string | null;
  isActive: boolean;
  aiEnabled: boolean;
  roles: UserRole[];
}

interface Organization {
  id: string;
  name: string;
  code: string;
  type: string;
}

const ROLE_LABEL: Record<string, string> = {
  group_admin: 'Quản trị tập đoàn',
  group_hrm: 'HRM tập đoàn',
  company_admin: 'Quản trị công ty',
  hr_manager: 'Quản lý HR',
  instructor: 'Giảng viên',
  learner: 'Học viên',
};

const inputClass =
  'w-full border border-default rounded-lg px-3 py-2 text-[12px] text-content placeholder:text-faint focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors bg-surface';

export default function UsersPage() {
  const { accessToken, user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterCompanyId, setFilterCompanyId] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    email: '',
    fullName: '',
    password: '',
    employeeCode: '',
    jobTitle: '',
    organizationId: '',
    role: 'learner',
  });
  const [sendEmail, setSendEmail] = useState(true);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const generatePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#!';
    let pwd = '';
    for (let i = 0; i < 10; i++) pwd += chars[Math.floor(Math.random() * chars.length)];
    setForm((f) => ({ ...f, password: pwd }));
  };

  const [emailCheck, setEmailCheck] = useState<'idle' | 'checking' | 'valid' | 'invalid'>('idle');
  const [emailCheckMsg, setEmailCheckMsg] = useState<string>('');

  const getRole = (r: unknown): string =>
    typeof r === 'string' ? r : (r as { role: string }).role;
  const userRoles = currentUser?.roles?.map(getRole) ?? [];
  const isGroupAdmin = userRoles.includes('group_admin');

  const authHeader = { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' };

  const load = () => {
    setIsLoading(true);
    const params = new URLSearchParams({ limit: '200' });
    if (isGroupAdmin && filterCompanyId) params.set('filterCompanyId', filterCompanyId);
    fetch(`/api/users?${params}`, { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((r) => r.json())
      .then((res) => {
        if (res.success) setUsers(res.data ?? []);
        else setError(res.error ?? 'Lỗi tải dữ liệu');
      })
      .catch(() => setError('Không thể kết nối server'))
      .finally(() => setIsLoading(false));
  };

  const loadOrgs = () => {
    fetch('/api/organizations', { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((r) => r.json())
      .then((res) => {
        if (res.success) {
          const list: Organization[] = res.data ?? [];
          setOrgs(list.filter((o) => o.type !== 'group'));
          const firstCompany = list.find((o) => o.type === 'company') ?? list[0];
          if (firstCompany) setForm((f) => ({ ...f, organizationId: firstCompany.id }));
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    if (accessToken) { load(); loadOrgs(); }
  }, [accessToken]); // eslint-disable-line

  useEffect(() => {
    if (accessToken) load();
  }, [filterCompanyId]); // eslint-disable-line

  const openModal = () => {
    setCreateError(null);
    setEmailCheck('idle');
    setEmailCheckMsg('');
    setSendEmail(true);
    const pwd = (() => {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#!';
      let p = '';
      for (let i = 0; i < 10; i++) p += chars[Math.floor(Math.random() * chars.length)];
      return p;
    })();
    setForm({ email: '', fullName: '', password: pwd, employeeCode: '', jobTitle: '', organizationId: orgs[0]?.id ?? '', role: 'learner' });
    setShowModal(true);
  };

  const handleEmailBlur = async () => {
    const email = form.email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      setEmailCheck('idle');
      return;
    }
    setEmailCheck('checking');
    setEmailCheckMsg('');
    try {
      const res = await fetch(
        `/api/users/check-email?email=${encodeURIComponent(email)}`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      ).then((r) => r.json());
      if (res.valid) {
        setEmailCheck('valid');
        setEmailCheckMsg('Tên miền email hợp lệ');
      } else {
        setEmailCheck('invalid');
        setEmailCheckMsg(res.reason ?? 'Email không hợp lệ');
      }
    } catch {
      setEmailCheck('idle');
    }
  };

  const handleCreate = async () => {
    if (!form.email.trim() || !form.fullName.trim()) {
      setCreateError('Email và họ tên không được để trống');
      return;
    }
    if (!form.password || form.password.length < 8) {
      setCreateError('Mật khẩu tối thiểu 8 ký tự');
      return;
    }
    if (!form.organizationId) {
      setCreateError('Vui lòng chọn tổ chức / công ty');
      return;
    }
    if (emailCheck === 'invalid') {
      setCreateError(emailCheckMsg || 'Email không hợp lệ — tên miền không nhận thư');
      return;
    }
    if (emailCheck === 'idle') {
      await handleEmailBlur();
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: authHeader,
        body: JSON.stringify({
          email: form.email.trim(),
          fullName: form.fullName.trim(),
          password: form.password,
          employeeCode: form.employeeCode.trim() || undefined,
          jobTitle: form.jobTitle.trim() || undefined,
          organizationId: form.organizationId,
          role: form.role,
          sendWelcomeEmail: sendEmail,
        }),
      }).then((r) => r.json());

      if (res.success) {
        setShowModal(false);
        load();
      } else {
        setCreateError(res.error ?? 'Tạo thất bại');
      }
    } catch {
      setCreateError('Lỗi kết nối');
    } finally {
      setCreating(false);
    }
  };

  const filtered = users.filter(
    (u) =>
      u.fullName?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase()) ||
      (u.employeeCode ?? '').toLowerCase().includes(search.toLowerCase()),
  );

  const companies = orgs.filter((o) => o.type === 'company');
  const depts = orgs.filter((o) => o.type !== 'company');

  const getUserCompany = (u: User): string => {
    const companyRole = u.roles.find((r) => r.organizationType === 'company');
    if (companyRole) return companyRole.organizationName;
    return u.roles[0]?.organizationName ?? '—';
  };

  return (
    <div className="max-w-6xl mx-auto space-y-4">

      {/* Toolbar */}
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex flex-wrap gap-3 items-center flex-1">
          <input
            type="text"
            placeholder="Tìm theo tên, email, mã nhân viên..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-[200px] max-w-sm border border-default rounded-lg px-3 py-2 text-[12px] text-content placeholder:text-faint focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors"
          />
          {isGroupAdmin && companies.length > 0 && (
            <div className="flex items-center gap-2">
              <label className="text-[12px] text-subtle whitespace-nowrap">Công ty:</label>
              <select
                value={filterCompanyId}
                onChange={(e) => setFilterCompanyId(e.target.value)}
                className="border border-default rounded-lg px-3 py-2 text-[12px] text-content focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 bg-surface"
              >
                <option value="">— Tất cả —</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                ))}
              </select>
            </div>
          )}
        </div>
        <button
          onClick={openModal}
          className="flex items-center gap-1.5 bg-primary hover:bg-primary-dark text-white text-[12px] font-medium rounded-lg px-3 py-2 transition-colors active:scale-[0.98]"
        >
          <Plus size={14} /> Thêm người dùng
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="bg-danger-tint border border-danger/20 rounded-xl p-4 text-[12px] text-danger">{error}</div>
      ) : filtered.length === 0 ? (
        <div className="bg-surface border border-default rounded-xl shadow-card flex flex-col items-center justify-center py-16 px-4 text-center">
          <p className="text-[13px] font-medium text-content">
            {filterCompanyId ? 'Công ty này chưa có người dùng nào' : 'Không có kết quả'}
          </p>
        </div>
      ) : (
        <div className="bg-surface border border-default rounded-xl shadow-card overflow-hidden">
          <div className="px-4 py-2.5 border-b border-default">
            <p className="text-[11px] text-faint">
              {filtered.length} người dùng{filterCompanyId ? ' (đã lọc theo công ty)' : isGroupAdmin ? ' (tất cả công ty)' : ''}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-default">
                  <th className="text-left text-[10px] text-faint font-medium px-4 py-2.5">Họ tên</th>
                  <th className="text-left text-[10px] text-faint font-medium px-4 py-2.5">Email</th>
                  <th className="text-left text-[10px] text-faint font-medium px-4 py-2.5">Mã NV</th>
                  {isGroupAdmin && (
                    <th className="text-left text-[10px] text-faint font-medium px-4 py-2.5">Công ty</th>
                  )}
                  <th className="text-left text-[10px] text-faint font-medium px-4 py-2.5">Vai trò</th>
                  <th className="text-left text-[10px] text-faint font-medium px-4 py-2.5">Trạng thái</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <tr key={u.id} className="border-b border-default last:border-0 hover:bg-muted transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-[12px] font-medium text-content">{u.fullName}</p>
                      {u.jobTitle && <p className="text-[10px] text-faint">{u.jobTitle}</p>}
                    </td>
                    <td className="px-4 py-3 text-[11px] text-subtle">{u.email}</td>
                    <td className="px-4 py-3 text-[11px] text-faint font-mono">{u.employeeCode ?? '—'}</td>
                    {isGroupAdmin && (
                      <td className="px-4 py-3 text-[11px] text-subtle">{getUserCompany(u)}</td>
                    )}
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        {(u.roles ?? []).slice(0, 2).map((r, i) => (
                          <span key={i} className="text-[10px] px-1.5 py-0.5 bg-primary-tint text-primary rounded font-medium whitespace-nowrap w-fit">
                            {ROLE_LABEL[r.role] ?? r.role}
                          </span>
                        ))}
                        {u.roles.length > 2 && (
                          <span className="text-[10px] text-faint">+{u.roles.length - 2} khác</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                          u.isActive ? 'bg-success-tint text-success' : 'bg-muted text-faint'
                        }`}>
                          {u.isActive && <span className="w-1.5 h-1.5 bg-success rounded-full" />}
                          {u.isActive ? 'Hoạt động' : 'Vô hiệu'}
                        </span>
                        {u.aiEnabled && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary-tint text-primary">
                            AI
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/users/${u.id}`} className="text-[12px] text-primary hover:underline font-medium">
                        Chi tiết
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-surface rounded-xl shadow-card border border-default w-full max-w-lg">
            <div className="px-5 py-4 border-b border-default flex items-center justify-between">
              <h2 className="text-[14px] font-medium text-content">Thêm người dùng mới</h2>
              <button onClick={() => setShowModal(false)} className="text-faint hover:text-content transition-colors">
                <X size={16} />
              </button>
            </div>
            <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">

              {/* Org + Role */}
              <div className="bg-primary-tint rounded-xl p-4 space-y-3 border border-primary/15">
                <p className="text-[12px] font-medium text-primary">Thuộc tổ chức & Vai trò</p>
                <div className="space-y-1.5">
                  <label className="block text-[12px] font-medium text-content">
                    Tổ chức / Công ty <span className="text-danger">*</span>
                  </label>
                  <select
                    value={form.organizationId}
                    onChange={(e) => setForm((f) => ({ ...f, organizationId: e.target.value }))}
                    className="w-full border border-default rounded-lg px-3 py-2 text-[12px] text-content focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 bg-surface"
                  >
                    <option value="">— Chọn tổ chức —</option>
                    {companies.length > 0 && (
                      <optgroup label="── Công ty ──">
                        {companies.map((o) => (
                          <option key={o.id} value={o.id}>{o.name} ({o.code})</option>
                        ))}
                      </optgroup>
                    )}
                    {depts.length > 0 && (
                      <optgroup label="── Phòng ban / Nhóm ──">
                        {depts.map((o) => (
                          <option key={o.id} value={o.id}>{o.name} ({o.code})</option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                  {isGroupAdmin && (
                    <p className="text-[11px] text-primary/70">Bạn đang tạo user với quyền group_admin — có thể chọn bất kỳ công ty nào.</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <label className="block text-[12px] font-medium text-content">
                    Vai trò <span className="text-danger">*</span>
                  </label>
                  <select
                    value={form.role}
                    onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                    className="w-full border border-default rounded-lg px-3 py-2 text-[12px] text-content focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 bg-surface"
                  >
                    {isGroupAdmin && <option value="group_admin">Quản trị tập đoàn (group_admin)</option>}
                    {isGroupAdmin && <option value="group_hrm">HRM tập đoàn (group_hrm)</option>}
                    <option value="company_admin">Quản trị công ty (company_admin)</option>
                    <option value="hr_manager">Quản lý HR (hr_manager)</option>
                    <option value="instructor">Giảng viên (instructor)</option>
                    <option value="learner">Học viên (learner)</option>
                  </select>
                </div>
              </div>

              {/* Personal info */}
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="block text-[12px] font-medium text-content">Email <span className="text-danger">*</span></label>
                  <div className="relative">
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => {
                        setForm((f) => ({ ...f, email: e.target.value }));
                        setEmailCheck('idle');
                        setEmailCheckMsg('');
                      }}
                      onBlur={handleEmailBlur}
                      placeholder="nguyen.van.a@company.com"
                      className={`w-full border rounded-lg px-3 py-2 pr-9 text-[12px] text-content placeholder:text-faint focus:outline-none focus:ring-2 transition-colors ${
                        emailCheck === 'invalid'
                          ? 'border-danger focus:border-danger focus:ring-danger/20'
                          : emailCheck === 'valid'
                          ? 'border-success focus:border-success focus:ring-success/20'
                          : 'border-default focus:border-primary focus:ring-primary/20'
                      }`}
                    />
                    {emailCheck === 'checking' && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-faint text-[10px] animate-pulse">⏳</span>
                    )}
                    {emailCheck === 'valid' && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-success text-sm">✓</span>
                    )}
                    {emailCheck === 'invalid' && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-danger text-sm">✗</span>
                    )}
                  </div>
                  {emailCheck === 'valid' && (
                    <p className="text-[11px] text-success">{emailCheckMsg}</p>
                  )}
                  {emailCheck === 'invalid' && (
                    <p className="text-[11px] text-danger">{emailCheckMsg}</p>
                  )}
                  {emailCheck === 'checking' && (
                    <p className="text-[11px] text-faint">Đang kiểm tra tên miền email...</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <label className="block text-[12px] font-medium text-content">Họ tên <span className="text-danger">*</span></label>
                  <input type="text" value={form.fullName}
                    onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                    placeholder="Nguyễn Văn A"
                    className={inputClass} />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-[12px] font-medium text-content">
                    Mật khẩu <span className="text-danger">*</span>
                    <span className="text-[11px] text-faint font-normal ml-1">(tối thiểu 8 ký tự)</span>
                  </label>
                  <div className="flex gap-2">
                    <input type="text" value={form.password}
                      onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                      placeholder="Mật khẩu"
                      className="flex-1 border border-default rounded-lg px-3 py-2 text-[12px] text-content font-mono focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors" />
                    <button type="button" onClick={generatePassword}
                      className="px-3 py-2 border border-default text-[11px] text-subtle rounded-lg hover:bg-muted whitespace-nowrap transition-colors">
                      Tạo ngẫu nhiên
                    </button>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <input type="checkbox" id="sendEmailChk" checked={sendEmail}
                      onChange={(e) => setSendEmail(e.target.checked)}
                      className="w-3.5 h-3.5 accent-primary rounded" />
                    <label htmlFor="sendEmailChk" className="text-[11px] text-subtle cursor-pointer">
                      Gửi thông tin tài khoản và mật khẩu qua email cho người dùng
                    </label>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="block text-[12px] font-medium text-content">Mã nhân viên</label>
                    <input type="text" value={form.employeeCode}
                      onChange={(e) => setForm((f) => ({ ...f, employeeCode: e.target.value }))}
                      placeholder="NV001"
                      className={inputClass} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-[12px] font-medium text-content">Chức danh</label>
                    <input type="text" value={form.jobTitle}
                      onChange={(e) => setForm((f) => ({ ...f, jobTitle: e.target.value }))}
                      placeholder="Nhân viên KD"
                      className={inputClass} />
                  </div>
                </div>
              </div>

              {createError && (
                <div className="bg-danger-tint border border-danger/20 rounded-lg px-3 py-2 text-[12px] text-danger">
                  {createError}
                </div>
              )}
            </div>
            <div className="px-5 py-4 border-t border-default flex gap-2 justify-end">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-[12px] border border-default rounded-lg text-subtle hover:bg-muted transition-colors">
                Hủy
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || emailCheck === 'checking' || emailCheck === 'invalid'}
                className="flex items-center gap-1.5 px-5 py-2 text-[12px] bg-primary hover:bg-primary-dark text-white rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                {creating ? 'Đang tạo...' : emailCheck === 'checking' ? 'Đang kiểm tra...' : 'Tạo tài khoản'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
