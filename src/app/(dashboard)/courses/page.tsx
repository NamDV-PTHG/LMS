'use client';

import { useAuth } from '@/components/providers/auth-provider';
import Link from 'next/link';
import { useEffect, useState } from 'react';

interface Course {
  id: string;
  title: string;
  description: string | null;
  status: string;
  level: string | null;
  estimatedHours: number | null;
  ownerCompanyId: string;
}

const LEVEL_LABELS: Record<string, string> = {
  beginner: 'Cơ bản',
  intermediate: 'Trung cấp',
  advanced: 'Nâng cao',
};

const STATUS_COLORS: Record<string, string> = {
  draft:     'bg-gray-100 text-gray-600',
  published: 'bg-green-100 text-green-700',
  archived:  'bg-yellow-100 text-yellow-700',
};

export default function CoursesPage() {
  const { accessToken } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', level: 'beginner' });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const headers = { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' };

  const load = () => {
    setIsLoading(true);
    fetch('/api/courses', { headers: { Authorization: `Bearer ${accessToken}` } })
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
        setForm({ title: '', description: '', level: 'beginner' });
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
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Khóa học</h1>
          <p className="text-sm text-gray-500 mt-0.5">Quản lý nội dung đào tạo</p>
        </div>
        <button
          onClick={() => { setShowModal(true); setCreateError(null); }}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          + Tạo khóa học
        </button>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="text-center py-16 text-gray-400">Đang tải...</div>
      ) : error ? (
        <div className="text-center py-16 text-red-500">{error}</div>
      ) : courses.length === 0 ? (
        <div className="text-center py-16 text-gray-400">Chưa có khóa học nào</div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-600">Tên khóa học</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Cấp độ</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Trạng thái</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Giờ học</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {courses.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{c.title}</p>
                    {c.description && (
                      <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{c.description}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {c.level ? (LEVEL_LABELS[c.level] ?? c.level) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[c.status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-500">
                    {c.estimatedHours != null ? `${c.estimatedHours}h` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/courses/${c.id}`}
                      className="text-blue-600 hover:text-blue-800 font-medium text-xs"
                    >
                      Xem chi tiết →
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
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md space-y-5 p-6">
            <h2 className="text-lg font-bold text-gray-900">Tạo khóa học mới</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tên khóa học *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Nhập tên khóa học"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mô tả</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  rows={3}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  placeholder="Mô tả ngắn về khóa học"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cấp độ</label>
                <select
                  value={form.level}
                  onChange={(e) => setForm((f) => ({ ...f, level: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="beginner">Cơ bản</option>
                  <option value="intermediate">Trung cấp</option>
                  <option value="advanced">Nâng cao</option>
                </select>
              </div>
            </div>

            {createError && (
              <p className="text-sm text-red-600">{createError}</p>
            )}

            <div className="flex gap-3 justify-end pt-1">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50"
              >
                Hủy
              </button>
              <button
                onClick={handleCreate}
                disabled={creating}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
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
