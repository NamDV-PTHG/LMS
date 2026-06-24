'use client';

import { useState } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import { useToast } from '@/components/ui/toast';

export default function ProfilePage() {
  const { user, accessToken } = useAuth();
  const { toast } = useToast();

  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [saving, setSaving] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.newPassword !== form.confirmPassword) {
      toast('error', 'Mật khẩu mới và xác nhận không khớp');
      return;
    }
    if (form.newPassword.length < 8) {
      toast('error', 'Mật khẩu mới tối thiểu 8 ký tự');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/auth/me', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: form.currentPassword,
          newPassword: form.newPassword,
        }),
      }).then((r) => r.json());

      if (res.success) {
        toast('success', 'Đổi mật khẩu thành công!');
        setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      } else {
        const msg = res.details?.currentPassword?.[0] ?? res.error ?? 'Đổi mật khẩu thất bại';
        toast('error', msg);
      }
    } catch {
      toast('error', 'Lỗi kết nối');
    } finally {
      setSaving(false);
    }
  };

  const getRole = (r: unknown): string =>
    typeof r === 'string' ? r : (r as { role: string }).role;

  return (
    <div className="p-6 max-w-xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Tài khoản của tôi</h1>
        <p className="text-sm text-gray-500 mt-0.5">Thông tin cá nhân và bảo mật</p>
      </div>

      {/* Profile info */}
      <div className="bg-white rounded-xl border p-6 space-y-4">
        <h2 className="text-base font-semibold text-gray-800">Thông tin tài khoản</h2>
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-blue-600 text-white text-xl flex items-center justify-center font-bold shrink-0">
            {user?.fullName?.[0]?.toUpperCase() ?? 'U'}
          </div>
          <div>
            <p className="font-semibold text-gray-900 text-lg">{user?.fullName}</p>
            <p className="text-sm text-gray-500">{user?.email}</p>
            <div className="flex gap-1 flex-wrap mt-1">
              {(user?.roles ?? []).map(getRole).map((r) => (
                <span key={r} className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded font-medium">{r}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Change password */}
      <div className="bg-white rounded-xl border p-6">
        <h2 className="text-base font-semibold text-gray-800 mb-4">Đổi mật khẩu</h2>
        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Mật khẩu hiện tại <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              value={form.currentPassword}
              onChange={(e) => setForm((f) => ({ ...f, currentPassword: e.target.value }))}
              placeholder="••••••••"
              required
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Mật khẩu mới <span className="text-red-500">*</span>
              <span className="text-xs font-normal text-gray-400 ml-1">(tối thiểu 8 ký tự)</span>
            </label>
            <input
              type="password"
              value={form.newPassword}
              onChange={(e) => setForm((f) => ({ ...f, newPassword: e.target.value }))}
              placeholder="••••••••"
              required
              minLength={8}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Xác nhận mật khẩu mới <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              value={form.confirmPassword}
              onChange={(e) => setForm((f) => ({ ...f, confirmPassword: e.target.value }))}
              placeholder="••••••••"
              required
              className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                form.confirmPassword && form.confirmPassword !== form.newPassword
                  ? 'border-red-400'
                  : ''
              }`}
            />
            {form.confirmPassword && form.confirmPassword !== form.newPassword && (
              <p className="text-xs text-red-600 mt-1">Mật khẩu xác nhận không khớp</p>
            )}
          </div>
          <div className="pt-2">
            <button
              type="submit"
              disabled={saving || !form.currentPassword || !form.newPassword || form.newPassword !== form.confirmPassword}
              className="px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Đang lưu...' : 'Đổi mật khẩu'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
