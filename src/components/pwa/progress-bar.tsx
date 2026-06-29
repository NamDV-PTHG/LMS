interface ProgressBarProps {
  value: number       // 0–100
  thick?: boolean     // h-1.5 cho hero, h-1 cho list item
  className?: string
}

export default function ProgressBar({ value, thick = false, className = '' }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value))
  return (
    <div className={`w-full bg-[rgba(0,0,0,0.08)] rounded-full ${thick ? 'h-1.5' : 'h-1'} ${className}`}>
      <div
        className="bg-primary rounded-full h-full transition-all duration-500 ease-out"
        style={{ width: `${clamped}%` }}
      />
    </div>
  )
}
