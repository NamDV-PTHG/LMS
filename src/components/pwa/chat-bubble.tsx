'use client'

interface ChatBubbleProps {
  content: string
  senderName: string
  avatarUrl?: string | null
  sentAt: string | Date
  isOwn: boolean
  showSender?: boolean
}

function formatTime(date: string | Date) {
  return new Date(date).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
}

export function ChatBubble({ content, senderName, avatarUrl, sentAt, isOwn, showSender = true }: ChatBubbleProps) {
  if (isOwn) {
    return (
      <div className="flex flex-col items-end gap-0.5 mb-2">
        <div className="bg-primary text-white rounded-2xl rounded-br-sm px-3 py-2 max-w-[75%] text-sm leading-relaxed break-words">
          {content}
        </div>
        <span className="text-[11px] text-faint pr-1">{formatTime(sentAt)}</span>
      </div>
    )
  }

  return (
    <div className="flex items-end gap-2 mb-2 max-w-[80%]">
      {avatarUrl ? (
        <img src={avatarUrl} alt={senderName} className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
      ) : (
        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
          <span className="text-[10px] font-medium text-primary">{senderName.charAt(0).toUpperCase()}</span>
        </div>
      )}
      <div className="flex flex-col gap-0.5">
        {showSender && (
          <span className="text-[11px] text-faint pl-1">{senderName}</span>
        )}
        <div className="bg-muted border border-[rgba(0,0,0,0.08)] rounded-2xl rounded-bl-sm px-3 py-2 text-sm leading-relaxed break-words text-ink">
          {content}
        </div>
        <span className="text-[11px] text-faint pl-1">{formatTime(sentAt)}</span>
      </div>
    </div>
  )
}
