/**
 * EmptyState — trạng thái trống chuẩn
 *
 * Dùng:
 *   <EmptyState
 *     icon={<BookOpen size={24} className="text-faint" />}
 *     title="Chưa có khóa học"
 *     description="Bắt đầu bằng cách tạo khóa học đầu tiên"
 *     action={<button className="bg-primary ...">Tạo mới</button>}
 *   />
 */

interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}

export function EmptyState({ icon, title, description, action, className = '' }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center py-16 px-4 text-center ${className}`}>
      {icon && (
        <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mb-4">
          {icon}
        </div>
      )}
      <p className="text-[13px] font-medium text-content">{title}</p>
      {description && (
        <p className="text-[12px] text-subtle mt-1 max-w-xs">{description}</p>
      )}
      {action && (
        <div className="mt-4">{action}</div>
      )}
    </div>
  )
}
