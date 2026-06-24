'use client';

import { useAuth } from '@/components/providers/auth-provider';
import Link from 'next/link';
import { useEffect, useState } from 'react';

interface UserRole {
  role: string;
  organizationId: string;
  organizationName: string;
}

interface User {
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
}

const ROLE_LABEL: Record<string, string> = {
  group_admin: 'Quản trị tập đoàn',
  group_hrm: 'HRM tập đoàn',
  company_admin: 'Quản trị công ty',
  hr_manager: 'Quản lý HR',
  instructor: 'Giảng viên',
  learner: 'Học viên',
};

export default function UsersPage() {
  const { accessToken, user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

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

  // Email domain validation state
  const [emailCheck, setEmailCheck] = useState<'idle' | 'checking' | 'valid' | 'invalid'>('idle');
  const [emailCheckMsg, setEmailCheckMsg] = useState<string>('');

  const getRole = (r: unknown): string =>
    typeof r === 'string' ? r : (r as { role: string }).role;
  const userRoles = currentUser?.roles?.map(getRole) ?? [];
  const isGroupAdmin = userRoles.includes('group_admin');

  const authHeader = { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' };

  const load = () => {
    setIsLoading(true);
    fetch('/api/users?limit=200', { headers: { Authorization: `Bearer ${accessToken}` } })
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
          // Default to first company for group_admin, or first org otherwise
          const firstCompany = list.find((o) => o.type === 'company') ?? list[0];
          if (firstCompany) setForm((f) => ({ ...f, organizationId: firstCompany.id }));
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    if (accessToken) { load(); loadOrgs(); }
  }, [accessToken]); // eslint-disable-line

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
      // Chưa kiểm tra — chạy kiểm tra trước khi tạo
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

  // Group orgs: companies first, then depts
  const companies = orgs.filter((o) => o.type === 'company');
  const depts = orgs.filter((o) => o.type !== 'company');

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Người dùng</h1>
          <p className="text-sm text-gray-500 mt-0.5">Quản lý tài khoản nhân viên</p>
        </div>
        <button
          onClick={openModal}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
        >
          + Thêm người dùng
        </button>
      </div>

      <input
        type="text"
        placeholder="Tìm theo tên, email, mã nhân viên..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full max-w-sm border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      {isLoading ? (
        <div className="text-center py-16 text-gray-400">Đang tải...</div>
      ) : error ? (
        <div className="text-center py-16 text-red-500">{error}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">Không có kết quả</div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-600">Họ tên</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Email</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Mã NV</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Chức danh</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Vai trò / Công ty</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Trạng thái</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{u.fullName}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{u.email}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{u.employeeCode ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{u.jobTitle ?? '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      {(u.roles ?? []).slice(0, 2).map((r, i) => (
                        <div key={i} className="flex items-center gap-1.5">
                          <span className="text-xs px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded font-medium whitespace-nowrap">
                            {ROLE_LABEL[r.role] ?? r.role}
                          </span>
                          <span className="text-xs text-gray-400 truncate max-w-[120px]">{r.organizationName}</span>
                        </div>
                      ))}
                      {u.roles.length > 2 && (
                        <span className="text-xs text-gray-400">+{u.roles.length - 2} vai trò khác</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      u.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {u.isActive ? 'Hoạt động' : 'Vô hiệu'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/users/${u.id}`} className="text-sm text-blue-600 hover:underline font-medium">
                      Chi tiết
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            <div className="px-6 py-5 border-b flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Thêm người dùng mới</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
            </div>
            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">

              {/* Org + Role — quan trọng nhất đặt lên đầu */}
              <div className="bg-blue-50 rounded-xl p-4 space-y-3 border border-blue-100">
                <p className="text-sm font-semibold text-blue-800">Thuộc tổ chức & Vai trò</p>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tổ chức / Công ty <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={form.organizationId}
                    onChange={(e) => setForm((f) => ({ ...f, organizationId: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
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
                    <p className="text-xs text-blue-600 mt-1">Bạn đang tạo user với quyền group_admin — có thể chọn bất kỳ công ty nào.</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Vai trò <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={form.role}
                    onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
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
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email <span className="text-red-500">*</span></label>
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
                      className={`w-full border rounded-lg px-3 py-2 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        emailCheck === 'invalid'
                          ? 'border-red-400 focus:ring-red-400'
                          : emailCheck === 'valid'
                          ? 'border-green-400 focus:ring-green-400'
                          : ''
                      }`}
                    />
                    {/* Status icon */}
                    {emailCheck === 'checking' && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs animate-pulse">⏳</span>
                    )}
                    {emailCheck === 'valid' && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500 text-base">✓</span>
                    )}
                    {emailCheck === 'invalid' && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-red-500 text-base">✗</span>
                    )}
                  </div>
                  {emailCheck === 'valid' && (
                    <p className="text-xs text-green-600 mt-1">{emailCheckMsg}</p>
                  )}
                  {emailCheck === 'invalid' && (
                    <p className="text-xs text-red-600 mt-1">{emailCheckMsg}</p>
                  )}
                  {emailCheck === 'checking' && (
                    <p className="text-xs text-gray-400 mt-1">Đang kiểm tra tên miền email...</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Họ tên <span className="text-red-500">*</span></label>
                  <input type="text" value={form.fullName}
                    onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                    placeholder="Nguyễn Văn A"
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Mật khẩu <span className="text-red-500">*</span>
                    <span className="text-xs font-normal text-gray-400 ml-1">(tối thiểu 8 ký tự)</span>
                  </label>
                  <div className="flex gap-2">
                    <input type="text" value={form.password}
                      onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                      placeholder="Mật khẩu"
                      className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono" />
                    <button type="button" onClick={generatePassword}
                      className="px-3 py-2 border text-xs rounded-lg hover:bg-gray-50 whitespace-nowrap text-gray-600" title="Tạo mật khẩu ngẫu nhiên">
                      🔀 Tạo ngẫu nhiên
                    </button>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <input type="checkbox" id="sendEmailChk" checked={sendEmail}
                      onChange={(e) => setSendEmail(e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded" />
                    <label htmlFor="sendEmailChk" className="text-xs text-gray-600">
                      Gửi thông tin tài khoản và mật khẩu qua email cho người dùng
                    </label>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Mã nhân viên</label>
                    <input type="text" value={form.employeeCode}
                      onChange={(e) => setForm((f) => ({ ...f, employeeCode: e.target.value }))}
                      placeholder="NV001"
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Chức danh</label>
                    <input type="text" value={form.jobTitle}
                      onChange={(e) => setForm((f) => ({ ...f, jobTitle: e.target.value }))}
                      placeholder="Nhân viên KD"
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>
              </div>

              {createError && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
                  {createError}
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t flex gap-3 justify-end">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">
                Hủy
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || emailCheck === 'checking' || emailCheck === 'invalid'}
                className="px-5 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
              >
                {creating ? 'Đang tạo...' : emailCheck === 'checking' ? 'Đang kiểm tra email...' : 'Tạo tài khoản'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
