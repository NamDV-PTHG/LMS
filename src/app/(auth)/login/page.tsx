'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Building2, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';

const loginSchema = z.object({
  email:    z.string().email('Email không hợp lệ'),
  password: z.string().min(1, 'Vui lòng nhập mật khẩu'),
});
type LoginForm = z.infer<typeof loginSchema>;

interface Branding {
  loginTitle:    string;
  loginSubtitle: string;
  loginBgUrl:    string | null;
  loginBgColor:  string | null;
  logoUrl:       string | null;
  primaryColor:  string;
}

const DEFAULT_BRANDING: Branding = {
  loginTitle:    'LMS Tập đoàn',
  loginSubtitle: 'Đăng nhập để tiếp tục',
  loginBgUrl:    null,
  loginBgColor:  null,
  logoUrl:       null,
  primaryColor:  '#185FA5',
};

export default function LoginPage() {
  const { login } = useAuth();
  const [serverError, setServerError] = useState<string | null>(null);
  const [branding, setBranding]       = useState<Branding>(DEFAULT_BRANDING);
  const [showPass, setShowPass]       = useState(false);

  useEffect(() => {
    fetch('/api/public/branding')
      .then((r) => r.json())
      .then((res) => { if (res.success) setBranding(res.data); })
      .catch(() => {});
  }, []);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (data: LoginForm) => {
    setServerError(null);
    try {
      await login(data.email, data.password);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin.';
      setServerError(message);
    }
  };

  // Dynamic background (image URL or color from branding — keep inline style)
  const bgStyle: React.CSSProperties = branding.loginBgUrl
    ? { backgroundImage: `url(${branding.loginBgUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : branding.loginBgColor
      ? { background: branding.loginBgColor }
      : {};

  const hasBg = !!(branding.loginBgUrl || branding.loginBgColor);

  return (
    <div
      className={`min-h-screen flex items-center justify-center ${hasBg ? 'relative' : 'bg-muted'}`}
      style={hasBg ? bgStyle : undefined}
    >
      {/* Overlay for readability when background image is set */}
      {branding.loginBgUrl && <div className="absolute inset-0 bg-black/40" />}

      <div className="relative z-10 w-full max-w-sm mx-4">
        <div className="bg-surface rounded-xl border border-default shadow-card p-6">

          {/* Logo / Brand */}
          <div className="text-center mb-6">
            {branding.logoUrl ? (
              <img
                src={branding.logoUrl}
                alt="Logo"
                className="h-12 w-auto mx-auto mb-4 object-contain"
              />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center mx-auto mb-4">
                <Building2 size={22} className="text-white" />
              </div>
            )}
            <h1 className="text-[17px] font-medium text-content">{branding.loginTitle}</h1>
            <p className="text-[12px] text-subtle mt-1">{branding.loginSubtitle}</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">

            {/* Email */}
            <div className="space-y-1.5">
              <label htmlFor="email" className="block text-[12px] font-medium text-content">
                Email
              </label>
              <input
                id="email"
                type="email"
                placeholder="you@company.vn"
                autoComplete="email"
                className="w-full border border-default rounded-lg px-3 py-2 text-[12px] text-content placeholder:text-faint focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors"
                {...register('email')}
              />
              {errors.email && (
                <p className="text-[11px] text-danger">{errors.email.message}</p>
              )}
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="text-[12px] font-medium text-content">
                  Mật khẩu
                </label>
                <Link
                  href="/forgot-password"
                  className="text-[11px] text-primary hover:text-primary-dark transition-colors"
                >
                  Quên mật khẩu?
                </Link>
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={showPass ? 'text' : 'password'}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full border border-default rounded-lg px-3 py-2 pr-9 text-[12px] text-content placeholder:text-faint focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors"
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-faint hover:text-subtle transition-colors"
                >
                  {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              {errors.password && (
                <p className="text-[11px] text-danger">{errors.password.message}</p>
              )}
            </div>

            {/* Server error */}
            {serverError && (
              <div className="rounded-lg bg-danger-tint px-3 py-2 text-[12px] text-danger">
                {serverError}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-primary hover:bg-primary-dark text-white text-[12px] font-medium rounded-lg py-2.5 transition-colors active:scale-[0.98] disabled:opacity-50 mt-1"
            >
              {isSubmitting ? 'Đang đăng nhập...' : 'Đăng nhập'}
            </button>

          </form>
        </div>

        <p className="text-center text-[11px] text-subtle mt-4">
          © {new Date().getFullYear()} Phú Thái Holdings
        </p>
      </div>
    </div>
  );
}
