/**
 * DataTable — table tái sử dụng với loading state và empty state
 *
 * Dùng:
 *   <DataTable
 *     columns={[{ key: 'name', header: 'Tên', render: (row) => row.name }]}
 *     data={users}
 *     loading={isLoading}
 *     emptyText="Chưa có người dùng nào"
 *   />
 */

interface Column<T> {
  key: string
  header: string
  width?: string
  align?: 'left' | 'center' | 'right'
  render: (row: T, index: number) => React.ReactNode
}

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  loading?: boolean
  emptyText?: string
  keyExtractor?: (row: T, index: number) => string | number
  className?: string
}

// Skeleton rows while loading
function SkeletonRows({ cols, rows = 5 }: { cols: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i} className="border-b border-default last:border-0">
          {Array.from({ length: cols }).map((_, j) => (
            <td key={j} className="px-4 py-3">
              <div className="h-3 bg-muted rounded animate-pulse" style={{ width: j === 0 ? '60%' : '40%' }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

export function DataTable<T>({
  columns,
  data,
  loading = false,
  emptyText = 'Không có dữ liệu',
  keyExtractor,
  className = '',
}: DataTableProps<T>) {
  const alignClass = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
  }

  return (
    <div className={`bg-surface rounded-xl border border-default shadow-card overflow-hidden ${className}`}>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-default">
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={col.width ? { width: col.width } : undefined}
                  className={`${alignClass[col.align ?? 'left']} text-[10px] text-faint font-medium px-4 py-2.5`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <SkeletonRows cols={columns.length} />
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10 text-center text-[12px] text-faint">
                  {emptyText}
                </td>
              </tr>
            ) : (
              data.map((row, index) => (
                <tr
                  key={keyExtractor ? keyExtractor(row, index) : index}
                  className="border-b border-default last:border-0 hover:bg-muted transition-colors"
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`px-4 py-3 ${alignClass[col.align ?? 'left']}`}
                    >
                      {col.render(row, index)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
