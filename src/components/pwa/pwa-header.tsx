'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

interface PwaHeaderProps {
  title: string
  backHref?: string
  /** Nếu true: dùng router.back() thay vì backHref */
  onBack?: boolean
  rightSlot?: React.ReactNode
}

export default function PwaHeader({ title, backHref, onBack, rightSlot }: PwaHeaderProps) {
  const router = useRouter()

  return (
    <header className="sticky top-0 z-40 bg-surface border-b border-[rgba(0,0,0,0.06)]
                       h-14 flex items-center px-4 gap-3">
      {(backHref || onBack) && (
        onBack ? (
          <button
            onClick={() => router.back()}
            className="w-8 h-8 flex items-center justify-center rounded-full
                       active:bg-muted transition-colors shrink-0"
            aria-label="Quay lại"
          >
            <ArrowLeft size={22} className="text-subtle" />
          </button>
        ) : (
          <Link
            href={backHref!}
            className="w-8 h-8 flex items-center justify-center rounded-full
                       active:bg-muted transition-colors shrink-0"
            aria-label="Quay lại"
          >
            <ArrowLeft size={22} className="text-subtle" />
          </Link>
        )
      )}
      <h1 className="text-17 font-medium text-content flex-1 truncate">{title}</h1>
      {rightSlot && <div className="shrink-0">{rightSlot}</div>}
    </header>
  )
}
