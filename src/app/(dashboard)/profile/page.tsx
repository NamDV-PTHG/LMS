'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import { useToast } from '@/components/ui/toast';
import { User, KeyRound, ChevronDown, ChevronUp, Award } from 'lucide-react';
import { PositionUserRadar } from '@/components/charts/position-user-radar';
import type { CompetencyRadarData } from '@/services/competency-radar.service';

const inputClass =
  'w-full border border-default rounded-lg px-3 py-2 text-[12px] text-content placeholder:text-faint focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors';

const ROLE_LABELS: Record<string, string> = {
  group_admin:   'Quản trị tập đoàn',
  company_admin: 'Quản trị công ty',
  hr_manager:    'HR Manager',
  group_hrm:     'HR Tập đoàn',
  instructor:    'Giảng viên',
  learner:       'Học viên',
};

export default function ProfilePage() {
  const { user, accessToken } = useAuth();
  const { toast } = useToast();

  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [saving, setSaving] = useState(false);
  const [radarData, setRadarData] = useState<CompetencyRadarData | null>(null);
  const [radarLoading, setRadarLoading] = useState(false);
  const [showRadar, setShowRadar] = useState(false);

  useEffect(() => {
    if (!showRadar || radarData) return;
    setRadarLoading(true);
    fetch('/api/my/competency-radar', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((r) => r.json())
      .then((res) => { if (res.success) setRadarData(res.data); })
      .catch(() => {})
      .finally(() => setRadarLoading(false));
  }, [showRadar, accessToken, radarData]);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.newPassword.length < 8) {
      toast('error', 'Mật khẩu mới phải có ít nhất 8 ký tự');
      return;
    }
    if (!/[A-Z]/.test(form.newPassword)) {
      toast('error', 'Mật khẩu phải có ít nhất 1 chữ hoa');
      return;
    }
    if (!/[0-9]/.test(form.newPassword)) {
      toast('error', 'Mật khẩu phải có ít nhất 1 chữ số');
      return;
    }
    if (form.newPassword !== form.confirmPassword) {
      toast('error', 'Mật khẩu mới và xác nhận không khớp');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/auth/me', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: form.currentPassword, newPassword: form.newPassword }),
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

  const userRoles = (user?.roles ?? []).map(getRole);
  const initials = user?.fullName?.split(' ').slice(-2).map((w) => w[0]).join('').toUpperCase() ?? 'U';

  return (
    <div className="max-w-xl mx-auto space-y-4">

      {/* Profile info */}
      <div className="bg-surface rounded-xl border border-default shadow-card">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-default">
          <User size={14} className="text-faint" />
          <h2 className="text-[13px] font-medium text-content">Thông tin tài khoản</h2>
        </div>
        <div className="p-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-primary text-white text-[17px] font-medium flex items-center justify-center flex-shrink-0">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="text-[15px] font-medium text-content truncate">{user?.fullName}</p>
              <p className="text-[12px] text-subtle mt-0.5">{user?.email}</p>
              <div className="flex gap-1.5 flex-wrap mt-2">
                {userRoles.map((r) => (
                  <span
                    key={r}
                    className="text-[10px] font-medium px-2 py-0.5 bg-primary-tint text-primary rounded-full"
                  >
                    {ROLE_LABELS[r] ?? r}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Change password */}
      <div className="bg-surface rounded-xl border border-default shadow-card">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-default">
          <KeyRound size={14} className="text-faint" />
          <h2 className="text-[13px] font-medium text-content">Đổi mật khẩu</h2>
        </div>
        <div className="p-4">
          <form onSubmit={handleChangePassword} className="space-y-3">
            <div className="space-y-1.5">
              <label className="block text-[12px] font-medium text-content">
                Mật khẩu hiện tại <span className="text-danger">*</span>
              </label>
              <input
                type="password"
                value={form.currentPassword}
                onChange={(e) => setForm((f) => ({ ...f, currentPassword: e.target.value }))}
                placeholder="••••••••"
                required
                className={inputClass}
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[12px] font-medium text-content">
                Mật khẩu mới <span className="text-danger">*</span>
              </label>
              <input
                type="password"
                value={form.newPassword}
                onChange={(e) => setForm((f) => ({ ...f, newPassword: e.target.value }))}
                placeholder="••••••••"
                required
                minLength={8}
                className={inputClass}
              />
              <p className="text-[11px] text-faint">Tối thiểu 8 ký tự, có ít nhất 1 chữ hoa và 1 chữ số</p>
            </div>

            <div className="space-y-1.5">
              <label className="block text-[12px] font-medium text-content">
                Xác nhận mật khẩu mới <span className="text-danger">*</span>
              </label>
              <input
                type="password"
                value={form.confirmPassword}
                onChange={(e) => setForm((f) => ({ ...f, confirmPassword: e.target.value }))}
                placeholder="••••••••"
                required
                className={`${inputClass} ${
                  form.confirmPassword && form.confirmPassword !== form.newPassword
                    ? '!border-danger'
                    : ''
                }`}
              />
              {form.confirmPassword && form.confirmPassword !== form.newPassword && (
                <p className="text-[11px] text-danger">Mật khẩu xác nhận không khớp</p>
              )}
            </div>

            <div className="pt-1">
              <button
                type="submit"
                disabled={saving || !form.currentPassword || !form.newPassword || form.newPassword !== form.confirmPassword}
                className="flex items-center gap-1.5 bg-primary hover:bg-primary-dark text-white text-[12px] font-medium rounded-lg px-4 py-2 transition-colors active:scale-[0.98] disabled:opacity-50"
              >
                {saving ? 'Đang lưu...' : 'Đổi mật khẩu'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Competency radar */}
      <div className="bg-surface rounded-xl border border-default shadow-card">
        <button
          type="button"
          onClick={() => setShowRadar((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3 border-b border-default text-left"
        >
          <div className="flex items-center gap-2">
            <Award size={14} className="text-faint" />
            <h2 className="text-[13px] font-medium text-content">Hồ sơ Năng lực</h2>
          </div>
          {showRadar ? <ChevronUp size={14} className="text-faint" /> : <ChevronDown size={14} className="text-faint" />}
        </button>
        {showRadar && (
          <div className="p-4">
            {radarLoading ? (
              <div className="flex items-center justify-center h-32 text-[12px] text-faint">Đang tải...</div>
            ) : radarData ? (
              <PositionUserRadar
                userName={radarData.fullName}
                readinessPct={radarData.readinessScore}
                axes={radarData.radarAxes.map((a) => ({
                  domainName: a.subject,
                  requiredAvg: a.requiredRaw,
                  currentAvg: a.currentRaw,
                }))}
              />
            ) : (
              <div className="flex items-center justify-center h-32 text-[12px] text-faint">Không có dữ liệu năng lực</div>
            )}
          </div>
        )}
      </div>

    </div>
  );
}
