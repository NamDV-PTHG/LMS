'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Building2, Check, ArrowLeft } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email,   setEmail]   = useState('');
  const [loading, setLoading] = useState(false);
  const [done,    setDone]    = useState(false);
  const [error,   setError]   = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: email.trim() }),
      }).then((r) => r.json());

      if (res.success) {
        setDone(true);
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
                <h2 className="text-[15px] font-medium text-content">Kiểm tra hộp thư của bạn</h2>
                <p className="text-[12px] text-subtle mt-2 leading-relaxed">
                  Nếu địa chỉ <span className="font-medium text-content">{email}</span> tồn tại
                  trong hệ thống, chúng tôi đã gửi email hướng dẫn đặt lại mật khẩu.
                </p>
                <p className="text-[11px] text-faint mt-2">
                  Không nhận được email? Kiểm tra thư mục spam hoặc{' '}
                  <button
                    onClick={() => { setDone(false); setEmail(''); }}
                    className="text-primary hover:text-primary-dark transition-colors"
                  >
                    thử lại
                  </button>.
                </p>
              </div>
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 text-[12px] text-primary hover:text-primary-dark transition-colors"
              >
                <ArrowLeft size={13} /> Quay lại đăng nhập
              </Link>
            </div>
          ) : (
            /* ── Form ── */
            <>
              <div className="text-center mb-5">
                <h1 className="text-[17px] font-medium text-content">Quên mật khẩu</h1>
                <p className="text-[12px] text-subtle mt-1">Đặt lại mật khẩu qua email</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <p className="text-[12px] text-subtle leading-relaxed">
                  Nhập địa chỉ email của bạn. Chúng tôi sẽ gửi liên kết đặt lại mật khẩu
                  (hiệu lực trong <span className="font-medium text-content">1 giờ</span>).
                </p>

                <div className="space-y-1.5">
                  <label className="block text-[12px] font-medium text-content">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.vn"
                    autoFocus
                    required
                    className="w-full border border-default rounded-lg px-3 py-2 text-[12px] text-content placeholder:text-faint focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors"
                  />
                </div>

                {error && (
                  <div className="rounded-lg bg-danger-tint px-3 py-2 text-[12px] text-danger">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || !email.trim()}
                  className="w-full bg-primary hover:bg-primary-dark text-white text-[12px] font-medium rounded-lg py-2.5 transition-colors active:scale-[0.98] disabled:opacity-50"
                >
                  {loading ? 'Đang gửi...' : 'Gửi liên kết đặt lại mật khẩu'}
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
