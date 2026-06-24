'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/components/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const loginSchema = z.object({
  email: z.string().email('Email không hợp lệ'),
  password: z.string().min(1, 'Vui lòng nhập mật khẩu'),
});

type LoginForm = z.infer<typeof loginSchema>;

interface Branding {
  loginTitle: string;
  loginSubtitle: string;
  loginBgUrl: string | null;
  loginBgColor: string | null;
  logoUrl: string | null;
  primaryColor: string;
}

const DEFAULT_BRANDING: Branding = {
  loginTitle: 'LMS Tập đoàn',
  loginSubtitle: 'Đăng nhập để tiếp tục',
  loginBgUrl: null,
  loginBgColor: null,
  logoUrl: null,
  primaryColor: '#1a56db',
};

export default function LoginPage() {
  const { login } = useAuth();
  const [serverError, setServerError] = useState<string | null>(null);
  const [branding, setBranding] = useState<Branding>(DEFAULT_BRANDING);

  useEffect(() => {
    fetch('/api/public/branding')
      .then((r) => r.json())
      .then((res) => {
        if (res.success) setBranding(res.data);
      })
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
        'Đăng nhập thất bại';
      setServerError(message);
    }
  };

  // Build background style
  const bgStyle: React.CSSProperties = branding.loginBgUrl
    ? {
        backgroundImage: `url(${branding.loginBgUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }
    : branding.loginBgColor
      ? { background: branding.loginBgColor }
      : {
          background: `linear-gradient(135deg, ${branding.primaryColor}22 0%, ${branding.primaryColor}44 100%)`,
        };

  return (
    <div className="min-h-screen flex items-center justify-center" style={bgStyle}>
      {/* Overlay for background image readability */}
      {branding.loginBgUrl && (
        <div className="absolute inset-0 bg-black/40" />
      )}

      <div className="relative z-10 w-full max-w-md bg-white rounded-xl shadow-xl p-8">
        {/* Logo / title */}
        <div className="text-center mb-8">
          {branding.logoUrl && (
            <img
              src={branding.logoUrl}
              alt="Logo"
              className="h-14 w-auto mx-auto mb-4 object-contain"
            />
          )}
          <h1 className="text-2xl font-bold text-gray-900">{branding.loginTitle}</h1>
          <p className="mt-1 text-sm text-gray-500">{branding.loginSubtitle}</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
          {/* Email */}
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@company.vn"
              autoComplete="email"
              {...register('email')}
            />
            {errors.email && (
              <p className="text-xs text-destructive">{errors.email.message}</p>
            )}
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Mật khẩu</Label>
              <Link href="/forgot-password" className="text-xs text-blue-600 hover:underline">
                Quên mật khẩu?
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              autoComplete="current-password"
              {...register('password')}
            />
            {errors.password && (
              <p className="text-xs text-destructive">{errors.password.message}</p>
            )}
          </div>

          {/* Server error */}
          {serverError && (
            <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
              {serverError}
            </div>
          )}

          <Button
            type="submit"
            className="w-full text-white"
            style={{ backgroundColor: branding.primaryColor }}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </Button>
        </form>
      </div>
    </div>
  );
}
