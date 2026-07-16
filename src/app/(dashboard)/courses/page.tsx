'use client';

import { useAuth } from '@/components/providers/auth-provider';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X, BookOpen } from 'lucide-react';

const ADMIN_ROLES = ['group_admin', 'group_hrm', 'company_admin', 'hr_manager', 'instructor'];

interface Course {
  id: string;
  title: string;
  description: string | null;
  isPublished: boolean;
  isActive: boolean;
  estimatedHours: number | null;
  isShared: boolean;
  ownerCompany: { id: string; name: string };
  _count: { sections: number; enrollments: number };
}

const inputClass =
  'w-full border border-default rounded-lg px-3 py-2 text-[12px] text-content placeholder:text-faint focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors';

export default function CoursesPage() {
  const { accessToken, user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Redirect pure learners to /my-courses — this page is management-only
  useEffect(() => {
    if (authLoading || !user) return;
    const roles = user.roles?.map((r) => (typeof r === 'string' ? r : r.role)) ?? [];
    const hasAdminRole = roles.some((r) => ADMIN_ROLES.includes(r));
    if (!hasAdminRole) router.replace('/my-courses');
  }, [authLoading, user, router]);

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ title: '', description: '' });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const headers = { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' };

  const load = () => {
    setIsLoading(true);
    fetch('/api/courses?includeShared=true', { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((r) => r.json())
      .then((res) => {
        if (res.success) setCourses(res.data ?? []);
        else setError(res.error ?? 'Lỗi tải dữ liệu');
      })
      .catch(() => setError('Không thể kết nối server'))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => { if (accessToken) load(); }, [accessToken]); // eslint-disable-line

  const handleCreate = async () => {
    if (!form.title.trim()) { setCreateError('Tên khóa học không được để trống'); return; }
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch('/api/courses', {
        method: 'POST',
        headers,
        body: JSON.stringify(form),
      }).then((r) => r.json());

      if (res.success) {
        setShowModal(false);
        setForm({ title: '', description: '' });
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

  return (
    <div className="max-w-5xl mx-auto space-y-4">

      {/* Toolbar */}
      <div className="flex items-center justify-end">
        <button
          onClick={() => { setShowModal(true); setCreateError(null); }}
          className="flex items-center gap-1.5 bg-primary hover:bg-primary-dark text-white text-[12px] font-medium rounded-lg px-3 py-2 transition-colors active:scale-[0.98]"
        >
          <Plus size={14} /> Tạo khóa học
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="bg-danger-tint border border-danger/20 rounded-xl p-4 text-[12px] text-danger">{error}</div>
      ) : courses.length === 0 ? (
        <div className="bg-surface border border-default rounded-xl shadow-card flex flex-col items-center justify-center py-16 px-4 text-center">
          <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mb-4">
            <BookOpen size={20} className="text-faint" />
          </div>
          <p className="text-[13px] font-medium text-content">Chưa có khóa học nào</p>
          <p className="text-[12px] text-subtle mt-1">Nhấn &quot;Tạo khóa học&quot; để bắt đầu</p>
        </div>
      ) : (
        <div className="bg-surface border border-default rounded-xl shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-default">
                  <th className="text-left text-[10px] text-faint font-medium px-4 py-2.5">Tên khóa học</th>
                  <th className="text-left text-[10px] text-faint font-medium px-4 py-2.5">Trạng thái</th>
                  <th className="text-right text-[10px] text-faint font-medium px-4 py-2.5">Giờ học</th>
                  <th className="text-right text-[10px] text-faint font-medium px-4 py-2.5">Học viên</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {courses.map((c) => (
                  <tr key={c.id} className="border-b border-default last:border-0 hover:bg-muted transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-[12px] font-medium text-content">
                        {c.title}
                        {c.isShared && (
                          <span className="ml-2 text-[10px] bg-primary-tint text-primary px-1.5 py-0.5 rounded font-medium">
                            Được chia sẻ
                          </span>
                        )}
                      </p>
                      {c.description && (
                        <p className="text-[11px] text-faint mt-0.5 line-clamp-1">{c.description}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {c.isPublished && !c.isActive ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-orange-100 text-orange-700">
                          <span className="w-1.5 h-1.5 bg-orange-500 rounded-full" />
                          Đã dừng
                        </span>
                      ) : (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                          c.isPublished ? 'bg-success-tint text-success' : 'bg-muted text-faint'
                        }`}>
                          {c.isPublished && <span className="w-1.5 h-1.5 bg-success rounded-full" />}
                          {c.isPublished ? 'Đã xuất bản' : 'Bản nháp'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-[11px] text-subtle">
                      {c.estimatedHours != null ? `${c.estimatedHours}h` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-[11px] text-subtle">
                      {c._count.enrollments.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/courses/${c.id}`} className="text-[12px] text-primary hover:underline font-medium">
                        Xem chi tiết →
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
          <div className="bg-surface rounded-xl shadow-card border border-default w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-[14px] font-medium text-content">Tạo khóa học mới</h2>
              <button onClick={() => setShowModal(false)} className="text-faint hover:text-content transition-colors">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="block text-[12px] font-medium text-content">Tên khóa học <span className="text-danger">*</span></label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  className={inputClass}
                  placeholder="Nhập tên khóa học"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-[12px] font-medium text-content">Mô tả</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  rows={3}
                  className={`${inputClass} resize-none`}
                  placeholder="Mô tả ngắn về khóa học"
                />
              </div>
            </div>

            {createError && (
              <div className="bg-danger-tint border border-danger/20 rounded-lg px-3 py-2 text-[12px] text-danger">{createError}</div>
            )}

            <div className="flex gap-2 justify-end pt-1">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-[12px] border border-default rounded-lg text-subtle hover:bg-muted transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={handleCreate}
                disabled={creating}
                className="flex items-center gap-1.5 px-4 py-2 text-[12px] bg-primary hover:bg-primary-dark text-white rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                {creating ? 'Đang tạo...' : 'Tạo khóa học'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
