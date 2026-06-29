'use client'

export default function ProgressError({ reset }: { reset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3 px-4">
      <p className="text-content text-15 font-medium">Không tải được tiến độ</p>
      <p className="text-faint text-13">Kiểm tra kết nối và thử lại</p>
      <button
        onClick={reset}
        className="bg-primary text-white text-13 font-medium rounded-lg px-4 py-2.5 mt-2
                   active:scale-[0.98] transition-transform"
      >
        Thử lại
      </button>
    </div>
  )
}
