'use client'
import React from 'react'

export type BadgeVariant = 'success' | 'warning' | 'info-blue' | 'info-purple' | 'neutral'

const VARIANT_CLASS: Record<BadgeVariant, string> = {
  'success':    'bg-success-tint text-success',
  'warning':    'bg-warning-tint text-warning',
  'info-blue':  'bg-primary-tint text-primary',
  'info-purple':'bg-[#EEEDFE] text-[#3C3489]',
  'neutral':    'bg-muted text-subtle',
}

export function StatusBadge({ label, variant }: { label: string; variant: BadgeVariant }) {
  return (
    <span className={`inline-flex items-center rounded-full px-[10px] py-[3px] text-[12px] font-medium ${VARIANT_CLASS[variant]}`}>
      {label}
    </span>
  )
}
