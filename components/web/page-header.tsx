/**
 * PageHeader — header chuẩn cho mỗi trang (title + description + actions)
 *
 * Dùng:
 *   <PageHeader title="Khóa học" description="Quản lý toàn bộ khóa học">
 *     <button className="bg-primary ...">Thêm mới</button>
 *   </PageHeader>
 */

interface PageHeaderProps {
  title: string
  description?: string
  children?: React.ReactNode   // action buttons
  className?: string
}

export function PageHeader({ title, description, children, className = '' }: PageHeaderProps) {
  return (
    <div className={`flex items-start justify-between gap-4 mb-4 ${className}`}>
      <div>
        <h2 className="text-[15px] font-medium text-content">{title}</h2>
        {description && (
          <p className="text-[12px] text-subtle mt-0.5">{description}</p>
        )}
      </div>
      {children && (
        <div className="flex items-center gap-2 flex-shrink-0">
          {children}
        </div>
      )}
    </div>
  )
}
