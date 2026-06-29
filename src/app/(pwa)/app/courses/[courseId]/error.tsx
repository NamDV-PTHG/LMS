'use client'

import { useRouter } from 'next/navigation'

export default function CourseDetailError({ reset }: { reset: () => void }) {
  const router = useRouter()
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 px-4">
      <p className="text-content text-15 font-medium">Không tải được khóa học</p>
      <p className="text-faint text-13">Kiểm tra kết nối và thử lại</p>
      <div className="flex gap-2 mt-2">
        <button
          onClick={() => router.back()}
          className="border border-[rgba(0,0,0,0.08)] text-subtle text-13 font-medium
                     rounded-lg px-4 py-2.5 active:scale-[0.98] transition-transform"
        >
          Quay lại
        </button>
        <button
          onClick={reset}
          className="bg-primary text-white text-13 font-medium
                     rounded-lg px-4 py-2.5 active:scale-[0.98] transition-transform"
        >
          Thử lại
        </button>
      </div>
    </div>
  )
}
