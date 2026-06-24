'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token') ?? '';

  const [form, setForm] = useState({ newPassword: '', confirmPassword: '' });
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) setError('Liên kết không hợp lệ. Vui lòng yêu cầu đặt lại mật khẩu lại.');
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.newPassword !== form.confirmPassword) {
      setError('Mật khẩu xác nhận không khớp');
      return;
    }
    if (form.newPassword.length < 8) {
      setError('Mật khẩu tối thiểu 8 ký tự');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: form.newPassword }),
      }).then((r) => r.json());

      if (res.success) {
        setDone(true);
        setTimeout(() => router.push('/login'), 3000);
      } else {
        setError(res.error ?? 'Có lỗi xảy ra. Vui lòng thử lại.');
      }
    } catch {
      setError('Lỗi kết nối. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md bg-white rounded-xl shadow-md p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Đặt lại mật khẩu</h1>
          <p className="mt-1 text-sm text-muted-foreground">Nhập mật khẩu mới của bạn</p>
        </div>

        {done ? (
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Mật khẩu đã được đặt lại!</h2>
              <p className="mt-2 text-sm text-gray-600">Bạn sẽ được chuyển đến trang đăng nhập trong vài giây...</p>
            </div>
            <Link href="/login" className="inline-block text-sm text-blue-600 hover:underline">
              Đăng nhập ngay
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700">
                Mật khẩu mới <span className="text-red-500">*</span>
                <span className="text-xs font-normal text-gray-400 ml-1">(tối thiểu 8 ký tự)</span>
              </label>
              <input
                type="password"
                value={form.newPassword}
                onChange={(e) => { setForm((f) => ({ ...f, newPassword: e.target.value })); setError(''); }}
                placeholder="••••••••"
                required
                minLength={8}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700">
                Xác nhận mật khẩu mới <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                value={form.confirmPassword}
                onChange={(e) => { setForm((f) => ({ ...f, confirmPassword: e.target.value })); setError(''); }}
                placeholder="••••••••"
                required
                className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  form.confirmPassword && form.confirmPassword !== form.newPassword ? 'border-red-400' : ''
                }`}
              />
              {form.confirmPassword && form.confirmPassword !== form.newPassword && (
                <p className="text-xs text-red-600">Mật khẩu xác nhận không khớp</p>
              )}
            </div>

            {error && (
              <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
            )}

            <button
              type="submit"
              disabled={loading || !token || !form.newPassword || form.newPassword !== form.confirmPassword}
              className="w-full py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Đang cập nhật...' : 'Đặt lại mật khẩu'}
            </button>

            <div className="text-center">
              <Link href="/login" className="text-sm text-gray-500 hover:text-blue-600">
                ← Quay lại đăng nhập
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Đang tải...</div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
