/**
 * StatusBadge — badge tái sử dụng theo semantic status
 *
 * Dùng:
 *   <StatusBadge status="published" />
 *   <StatusBadge status="draft" label="Nháp" />
 */

export type BadgeVariant =
  | 'published' | 'active'   | 'done'    | 'completed'
  | 'draft'     | 'pending'  | 'progress'
  | 'warning'   | 'inactive' | 'locked'
  | 'danger'    | 'rejected' | 'overdue'

const VARIANT_STYLE: Record<BadgeVariant, string> = {
  published:  'bg-success-tint text-success',
  active:     'bg-success-tint text-success',
  done:       'bg-success-tint text-success',
  completed:  'bg-success-tint text-success',
  draft:      'bg-muted text-subtle',
  pending:    'bg-primary-tint text-primary',
  progress:   'bg-primary-tint text-primary',
  warning:    'bg-warning-tint text-warning',
  inactive:   'bg-warning-tint text-warning',
  locked:     'bg-warning-tint text-warning',
  danger:     'bg-danger-tint text-danger',
  rejected:   'bg-danger-tint text-danger',
  overdue:    'bg-danger-tint text-danger',
}

const DEFAULT_LABELS: Record<BadgeVariant, string> = {
  published:  'Đã xuất bản',
  active:     'Hoạt động',
  done:       'Hoàn thành',
  completed:  'Hoàn thành',
  draft:      'Nháp',
  pending:    'Chờ duyệt',
  progress:   'Đang học',
  warning:    'Cảnh báo',
  inactive:   'Không hoạt động',
  locked:     'Bị khoá',
  danger:     'Lỗi',
  rejected:   'Từ chối',
  overdue:    'Quá hạn',
}

interface StatusBadgeProps {
  status: BadgeVariant
  label?: string
  className?: string
}

export function StatusBadge({ status, label, className = '' }: StatusBadgeProps) {
  const style = VARIANT_STYLE[status] ?? 'bg-muted text-subtle'
  const text  = label ?? DEFAULT_LABELS[status] ?? status

  return (
    <span
      className={`inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${style} ${className}`}
    >
      {text}
    </span>
  )
}
