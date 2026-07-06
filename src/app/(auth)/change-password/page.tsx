'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Building2, Check } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import axios from 'axios';

const schema = z
  .object({
    currentPassword: z.string().min(1, 'Vui lòng nhập mật khẩu hiện tại'),
    newPassword: z
      .string()
      .min(8, 'Mật khẩu mới phải có ít nhất 8 ký tự')
      .regex(/[A-Z]/, 'Phải có ít nhất 1 chữ hoa')
      .regex(/[0-9]/, 'Phải có ít nhất 1 chữ số'),
    confirmPassword: z.string().min(1, 'Vui lòng xác nhận mật khẩu'),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'Mật khẩu xác nhận không khớp',
    path: ['confirmPassword'],
  });

type FormData = z.infer<typeof schema>;

const inputClass =
  'w-full border border-default rounded-lg px-3 py-2 text-[12px] text-content placeholder:text-faint focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors';

export default function ChangePasswordPage() {
  const { accessToken, logout } = useAuth();
  const [serverError, setServerError] = useState<string | null>(null);
  const [done,        setDone]        = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    setServerError(null);
    try {
      await axios.post(
        '/api/auth/change-password',
        { currentPassword: data.currentPassword, newPassword: data.newPassword },
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      setDone(true);
      setTimeout(() => logout(), 2000);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'Đổi mật khẩu thất bại';
      setServerError(msg);
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
                <h2 className="text-[15px] font-medium text-content">Đổi mật khẩu thành công</h2>
                <p className="text-[12px] text-subtle mt-2">
                  Đang đăng xuất, vui lòng đăng nhập lại với mật khẩu mới...
                </p>
              </div>
            </div>
          ) : (
            /* ── Form ── */
            <>
              <div className="text-center mb-5">
                <h1 className="text-[17px] font-medium text-content">Đổi mật khẩu</h1>
                <p className="text-[12px] text-subtle mt-1">
                  Đây là lần đầu bạn đăng nhập. Vui lòng đặt mật khẩu mới để tiếp tục.
                </p>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">

                <div className="space-y-1.5">
                  <label htmlFor="currentPassword" className="block text-[12px] font-medium text-content">
                    Mật khẩu hiện tại
                  </label>
                  <input
                    id="currentPassword"
                    type="password"
                    placeholder="••••••••"
                    autoComplete="current-password"
                    className={inputClass}
                    {...register('currentPassword')}
                  />
                  {errors.currentPassword && (
                    <p className="text-[11px] text-danger">{errors.currentPassword.message}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="newPassword" className="block text-[12px] font-medium text-content">
                    Mật khẩu mới
                    <span className="text-[11px] text-faint font-normal ml-1">(8+ ký tự, 1 hoa, 1 số)</span>
                  </label>
                  <input
                    id="newPassword"
                    type="password"
                    placeholder="••••••••"
                    autoComplete="new-password"
                    className={inputClass}
                    {...register('newPassword')}
                  />
                  {errors.newPassword && (
                    <p className="text-[11px] text-danger">{errors.newPassword.message}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="confirmPassword" className="block text-[12px] font-medium text-content">
                    Xác nhận mật khẩu mới
                  </label>
                  <input
                    id="confirmPassword"
                    type="password"
                    placeholder="••••••••"
                    autoComplete="new-password"
                    className={inputClass}
                    {...register('confirmPassword')}
                  />
                  {errors.confirmPassword && (
                    <p className="text-[11px] text-danger">{errors.confirmPassword.message}</p>
                  )}
                </div>

                {serverError && (
                  <div className="rounded-lg bg-danger-tint px-3 py-2 text-[12px] text-danger">
                    {serverError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-primary hover:bg-primary-dark text-white text-[12px] font-medium rounded-lg py-2.5 transition-colors active:scale-[0.98] disabled:opacity-50"
                >
                  {isSubmitting ? 'Đang xử lý...' : 'Đổi mật khẩu'}
                </button>

              </form>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
