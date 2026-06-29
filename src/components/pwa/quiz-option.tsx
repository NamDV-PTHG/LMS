export type OptionState = 'default' | 'selected' | 'correct' | 'wrong' | 'correct-unselected'

interface QuizOptionProps {
  label: string      // A, B, C, D
  text: string
  state: OptionState
  disabled?: boolean
  onClick?: () => void
}

export default function QuizOption({ label, text, state, disabled, onClick }: QuizOptionProps) {
  const styles: Record<OptionState, string> = {
    default:           'bg-surface border border-[rgba(0,0,0,0.08)] text-content',
    selected:          'bg-primary-tint border border-primary text-primary',
    correct:           'bg-success-tint border border-success text-success',
    wrong:             'bg-danger-tint border border-danger text-danger',
    'correct-unselected': 'bg-success-tint border border-success text-success opacity-70',
  }

  const labelStyles: Record<OptionState, string> = {
    default:           'bg-muted text-subtle border border-[rgba(0,0,0,0.08)]',
    selected:          'bg-primary text-white border border-primary',
    correct:           'bg-success text-white border border-success',
    wrong:             'bg-danger text-white border border-danger',
    'correct-unselected': 'bg-success text-white border border-success opacity-70',
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full flex items-center gap-3 rounded-xl px-3 py-3
                  text-left transition-all duration-150
                  ${styles[state]}
                  ${!disabled ? 'active:scale-[0.99] cursor-pointer' : 'cursor-default'}
                  `}
    >
      <span className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center
                        text-[11px] font-medium transition-colors
                        ${labelStyles[state]}`}>
        {label}
      </span>
      <span className="text-[13px] leading-snug flex-1">{text}</span>
    </button>
  )
}
