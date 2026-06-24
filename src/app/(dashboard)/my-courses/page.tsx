'use client';

import { useAuth } from '@/components/providers/auth-provider';
import { useToast } from '@/components/ui/toast';
import Link from 'next/link';
import { useEffect, useState } from 'react';

interface MyCourse {
  id: string;
  title: string;
  description: string | null;
  thumbnailUrl: string | null;
  estimatedHours: number | null;
  enrollmentId: string | null;
  progressPercent: number;
  completedAt: string | null;
  source: string;
  isMandatory: boolean;
}

export default function MyCoursesPage() {
  const { accessToken } = useAuth();
  const { toast } = useToast();
  const [courses, setCourses] = useState<MyCourse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [enrolling, setEnrolling] = useState<string | null>(null);

  const authHeader = { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' };

  const load = () => {
    fetch('/api/my/courses', { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((r) => r.json())
      .then((res) => {
        if (res.success) setCourses(res.data ?? []);
        else setError(res.error ?? 'Lỗi tải dữ liệu');
      })
      .catch(() => setError('Không thể kết nối server'))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => { if (accessToken) load(); }, [accessToken]); // eslint-disable-line

  const handleEnroll = async (courseId: string) => {
    setEnrolling(courseId);
    try {
      const res = await fetch(`/api/my/courses/${courseId}/enroll`, {
        method: 'POST',
        headers: authHeader,
      }).then((r) => r.json());
      if (res.success) {
        toast('success', 'Đăng ký khóa học thành công');
        load();
      } else {
        toast('error', res.error ?? 'Đăng ký thất bại');
      }
    } catch {
      toast('error', 'Lỗi kết nối server');
    } finally {
      setEnrolling(null);
    }
  };

  if (isLoading) return <div className="p-8 text-center text-gray-400">Đang tải...</div>;
  if (error) return <div className="p-8 text-center text-red-500">{error}</div>;

  const enrolled = courses.filter((c) => c.enrollmentId);
  const available = courses.filter((c) => !c.enrollmentId);

  const CourseCard = ({ course }: { course: MyCourse }) => {
    const isEnrolled = !!course.enrollmentId;
    const isDone = !!course.completedAt;

    return (
      <div className="bg-white rounded-xl border hover:shadow-md transition-shadow overflow-hidden flex flex-col">
        {/* Thumbnail */}
        <div className="aspect-video bg-gradient-to-br from-blue-100 to-indigo-100 relative">
          {course.thumbnailUrl ? (
            <img src={course.thumbnailUrl} alt={course.title} className="w-full h-full object-cover" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <svg className="w-16 h-16 text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
              </svg>
            </div>
          )}
          {isDone && (
            <div className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-0.5 rounded-full">
              Hoàn thành
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-4 flex-1 flex flex-col gap-3">
          <div>
            <h3 className="font-semibold text-gray-900 line-clamp-2 text-sm leading-snug">{course.title}</h3>
            {course.description && (
              <p className="text-xs text-gray-400 mt-1 line-clamp-2">{course.description}</p>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs text-gray-400">
            {course.isMandatory && (
              <span className="bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded text-[10px] font-medium">Bắt buộc</span>
            )}
            {course.estimatedHours != null && (
              <span>{course.estimatedHours}h</span>
            )}
          </div>

          {/* Progress bar */}
          {isEnrolled && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-gray-500">
                <span>Tiến độ</span>
                <span>{course.progressPercent ?? 0}%</span>
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all"
                  style={{ width: `${course.progressPercent ?? 0}%` }}
                />
              </div>
            </div>
          )}

          {/* Action */}
          <div className="mt-auto">
            {isEnrolled ? (
              <Link
                href={`/my-courses/${course.id}`}
                className="block w-full text-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                {isDone ? 'Xem lại' : course.progressPercent > 0 ? 'Tiếp tục học' : 'Bắt đầu học'}
              </Link>
            ) : (
              <button
                onClick={() => handleEnroll(course.id)}
                disabled={enrolling === course.id}
                className="w-full px-4 py-2 border border-blue-600 text-blue-600 text-sm font-medium rounded-lg hover:bg-blue-50 transition-colors disabled:opacity-50"
              >
                {enrolling === course.id ? 'Đang đăng ký...' : 'Đăng ký khóa học'}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Khóa học của tôi</h1>
        <p className="text-sm text-gray-500 mt-0.5">Theo dõi tiến độ học tập</p>
      </div>

      {courses.length === 0 ? (
        <div className="text-center py-16 text-gray-400">Chưa có khóa học nào</div>
      ) : (
        <>
          {enrolled.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-base font-semibold text-gray-800">Đang học ({enrolled.length})</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {enrolled.map((c) => <CourseCard key={c.id} course={c} />)}
              </div>
            </section>
          )}
          {available.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-base font-semibold text-gray-800">Khóa học khả dụng ({available.length})</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {available.map((c) => <CourseCard key={c.id} course={c} />)}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
