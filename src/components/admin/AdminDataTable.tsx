'use client'
import React from 'react'

export interface AdminColumn<T> {
  key: string
  header: string
  width?: string
  align?: 'left' | 'right' | 'center'
  render: (row: T) => React.ReactNode
}

interface AdminDataTableProps<T> {
  title: string
  description?: string
  primaryAction?: { label: string; onClick: () => void }
  columns: AdminColumn<T>[]
  rows: T[]
  rowKey: (row: T) => string
  emptyState?: React.ReactNode
}

export function AdminDataTable<T>({
  title,
  description,
  primaryAction,
  columns,
  rows,
  rowKey,
  emptyState,
}: AdminDataTableProps<T>) {
  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="bg-primary rounded-lg px-4 py-3 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-[15px] font-medium text-white">{title}</h1>
          {description && <p className="text-[12px] text-white/70 mt-0.5">{description}</p>}
        </div>
        {primaryAction && (
          <button
            onClick={primaryAction.onClick}
            className="shrink-0 bg-white text-primary text-[12px] font-medium rounded-sm px-3 py-1.5 hover:bg-primary-tint transition-colors"
          >
            {primaryAction.label}
          </button>
        )}
      </div>

      {/* Table block */}
      <div className="bg-surface border border-[rgba(0,0,0,0.08)] rounded-lg overflow-hidden shadow-card">
        {rows.length === 0 ? (
          <div className="py-14 text-center text-[13px] text-faint">
            {emptyState ?? 'Chưa có dữ liệu'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-muted border-b border-[rgba(0,0,0,0.08)]">
                  {columns.map((col) => (
                    <th
                      key={col.key}
                      style={col.width ? { width: col.width } : undefined}
                      className={`px-4 py-2.5 text-[11px] font-medium text-subtle whitespace-nowrap
                        ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'}`}
                    >
                      {col.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={rowKey(row)}
                    className="border-t border-[rgba(0,0,0,0.06)] hover:bg-muted/60 transition-colors"
                  >
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={`px-4 py-3 text-[13px] text-content
                          ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : ''}`}
                      >
                        {col.render(row)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export function ActionBtn({ label, onClick, variant = 'blue' }: { label: string; onClick: () => void; variant?: 'blue' | 'purple' | 'gray' }) {
  const cls = {
    blue:   'border-primary/30 text-primary hover:bg-primary-tint',
    purple: 'border-[#3C3489]/30 text-[#3C3489] hover:bg-[#EEEDFE]',
    gray:   'border-[rgba(0,0,0,0.15)] text-subtle hover:bg-muted',
  }[variant]
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center border rounded-sm px-3 py-[5px] text-[12px] font-medium transition-colors ${cls}`}
    >
      {label}
    </button>
  )
}
