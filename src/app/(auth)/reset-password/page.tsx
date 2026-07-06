'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Building2, Check, ArrowLeft } from 'lucide-react';

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router       = useRouter();
  const token        = searchParams.get('token') ?? '';

  const [form,    setForm]    = useState({ newPassword: '', confirmPassword: '' });
  const [loading, setLoading] = useState(false);
  const [done,    setDone]    = useState(false);
  const [error,   setError]   = useState('');

  useEffect(() => {
    if (!token) setError('Liên kết không hợp lệ. Vui lòng yêu cầu đặt lại mật khẩu lại.');
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.newPassword.length < 8) {
      setError('Mật khẩu phải có ít nhất 8 ký tự');
      return;
    }
    if (!/[A-Z]/.test(form.newPassword)) {
      setError('Mật khẩu phải có ít nhất 1 chữ hoa');
      return;
    }
    if (!/[0-9]/.test(form.newPassword)) {
      setError('Mật khẩu phải có ít nhất 1 chữ số');
      return;
    }
    if (form.newPassword !== form.confirmPassword) {
      setError('Mật khẩu xác nhận không khớp');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/reset-password', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ token, newPassword: form.newPassword }),
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

  const fieldClass = (hasError?: boolean) =>
    `w-full border ${hasError ? 'border-danger' : 'border-default'} rounded-lg px-3 py-2 text-[12px] text-content placeholder:text-faint focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors`;

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted">
      <div className="w-full max-w-sm mx-4">
        <div className="bg-surface rounded-xl border border-default shadow-card p-6">

          {/* Logo */}
          <div className="flex justify-center mb-5">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
              <Building2 size={18} className="text-white" />
            </div>
          </div>

          {done ? (
            /* ── Success state ── */
            <div className="text-center space-y-4">
              <div className="w-12 h-12 bg-success-tint rounded-full flex items-center justify-center mx-auto">
                <Check size={20} className="text-success" />
              </div>
              <div>
                <h2 className="text-[15px] font-medium text-content">Mật khẩu đã được đặt lại!</h2>
                <p className="text-[12px] text-subtle mt-2">
                  Bạn sẽ được chuyển đến trang đăng nhập trong vài giây...
                </p>
              </div>
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 text-[12px] text-primary hover:text-primary-dark transition-colors"
              >
                Đăng nhập ngay
              </Link>
            </div>
          ) : (
            /* ── Form ── */
            <>
              <div className="text-center mb-5">
                <h1 className="text-[17px] font-medium text-content">Đặt lại mật khẩu</h1>
                <p className="text-[12px] text-subtle mt-1">Nhập mật khẩu mới của bạn</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                <div className="space-y-1.5">
                  <label className="block text-[12px] font-medium text-content">
                    Mật khẩu mới
                  </label>
                  <input
                    type="password"
                    value={form.newPassword}
                    onChange={(e) => { setForm((f) => ({ ...f, newPassword: e.target.value })); setError(''); }}
                    placeholder="••••••••"
                    required
                    minLength={8}
                    className={fieldClass()}
                  />
                  <p className="text-[11px] text-faint">Tối thiểu 8 ký tự, có ít nhất 1 chữ hoa và 1 chữ số</p>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[12px] font-medium text-content">
                    Xác nhận mật khẩu mới
                  </label>
                  <input
                    type="password"
                    value={form.confirmPassword}
                    onChange={(e) => { setForm((f) => ({ ...f, confirmPassword: e.target.value })); setError(''); }}
                    placeholder="••••••••"
                    required
                    className={fieldClass(
                      !!(form.confirmPassword && form.confirmPassword !== form.newPassword)
                    )}
                  />
                  {form.confirmPassword && form.confirmPassword !== form.newPassword && (
                    <p className="text-[11px] text-danger">Mật khẩu xác nhận không khớp</p>
                  )}
                </div>

                {error && (
                  <div className="rounded-lg bg-danger-tint px-3 py-2 text-[12px] text-danger">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || !token || !form.newPassword || form.newPassword !== form.confirmPassword}
                  className="w-full bg-primary hover:bg-primary-dark text-white text-[12px] font-medium rounded-lg py-2.5 transition-colors active:scale-[0.98] disabled:opacity-50"
                >
                  {loading ? 'Đang cập nhật...' : 'Đặt lại mật khẩu'}
                </button>

                <div className="text-center">
                  <Link
                    href="/login"
                    className="inline-flex items-center gap-1.5 text-[12px] text-subtle hover:text-content transition-colors"
                  >
                    <ArrowLeft size={13} /> Quay lại đăng nhập
                  </Link>
                </div>
              </form>
            </>
          )}

        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-muted">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
