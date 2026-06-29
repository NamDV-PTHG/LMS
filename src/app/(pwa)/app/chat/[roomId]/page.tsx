'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Send } from 'lucide-react'
import { useAuth } from '@/components/providers/auth-provider'
import { ChatBubble } from '@/components/pwa/chat-bubble'

interface Sender {
  id: string
  fullName: string
  avatarUrl?: string | null
}

interface Message {
  id: string
  roomId: string
  senderId: string
  content: string
  sentAt: string
  sender: Sender
}

interface RoomParticipant {
  userId: string
  fullName: string
  avatarUrl?: string | null
  role: string
}

interface Room {
  id: string
  title: string
  participants: { userId: string; role: string; user: { id: string; fullName: string; avatarUrl?: string | null } }[]
}

function formatDateSeparator(dateStr: string) {
  const date = new Date(dateStr)
  const now = new Date()
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear()
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear()
  if (isToday) return 'Hôm nay'
  if (isYesterday) return 'Hôm qua'
  return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function groupMessagesByDay(messages: Message[]) {
  const groups: { date: string; messages: Message[] }[] = []
  for (const msg of messages) {
    const day = new Date(msg.sentAt).toDateString()
    const last = groups[groups.length - 1]
    if (last && last.date === day) {
      last.messages.push(msg)
    } else {
      groups.push({ date: day, messages: [msg] })
    }
  }
  return groups
}

export default function ChatRoomPage() {
  const params = useParams()
  const router = useRouter()
  const roomId = params?.roomId as string
  const { user, accessToken, isLoading } = useAuth()

  const [room, setRoom] = useState<Room | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [loadingInit, setLoadingInit] = useState(true)

  const bottomRef = useRef<HTMLDivElement>(null)
  const lastSentAtRef = useRef<string | null>(null)
  const pollingRef = useRef<NodeJS.Timeout | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior }), 50)
  }, [])

  // Load room detail
  useEffect(() => {
    if (!accessToken || !roomId) return
    fetch(`/api/chat/rooms/${roomId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setRoom(json.data)
      })
      .catch(() => {})
  }, [accessToken, roomId])

  // Load initial messages
  const loadMessages = useCallback(async () => {
    if (!accessToken || !roomId) return
    try {
      const res = await fetch(`/api/chat/rooms/${roomId}/messages`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: 'no-store',
      })
      const json = await res.json()
      if (json.success && json.data.length > 0) {
        setMessages(json.data)
        lastSentAtRef.current = json.data[json.data.length - 1].sentAt
      }
    } catch {
      // ignore
    } finally {
      setLoadingInit(false)
    }
  }, [accessToken, roomId])

  useEffect(() => {
    if (!isLoading && accessToken) {
      loadMessages().then(() => scrollToBottom('auto'))
    }
  }, [isLoading, accessToken, loadMessages, scrollToBottom])

  // Long-polling every 3s
  const pollMessages = useCallback(async () => {
    if (!accessToken || !roomId) return
    try {
      const after = lastSentAtRef.current
      const url = `/api/chat/rooms/${roomId}/messages${after ? `?after=${encodeURIComponent(after)}` : ''}`
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: 'no-store',
      })
      const json = await res.json()
      if (json.success && json.data.length > 0) {
        setMessages((prev) => {
          const existingIds = new Set(prev.map((m) => m.id))
          const newMsgs = (json.data as Message[]).filter((m) => !existingIds.has(m.id))
          if (newMsgs.length === 0) return prev
          lastSentAtRef.current = newMsgs[newMsgs.length - 1].sentAt
          return [...prev, ...newMsgs]
        })
        scrollToBottom()
      }
    } catch {
      // ignore
    }
  }, [accessToken, roomId, scrollToBottom])

  useEffect(() => {
    if (loadingInit) return
    pollingRef.current = setInterval(pollMessages, 3000)
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current)
    }
  }, [loadingInit, pollMessages])

  const handleSend = async () => {
    const content = input.trim()
    if (!content || sending || !accessToken) return
    setSending(true)
    setInput('')
    inputRef.current?.focus()
    try {
      const res = await fetch(`/api/chat/rooms/${roomId}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content }),
      })
      const json = await res.json()
      if (json.success) {
        const newMsg: Message = json.data
        setMessages((prev) => {
          const exists = prev.find((m) => m.id === newMsg.id)
          if (exists) return prev
          return [...prev, newMsg]
        })
        lastSentAtRef.current = newMsg.sentAt
        scrollToBottom()
      }
    } catch {
      setInput(content) // restore on failure
    } finally {
      setSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const getRoomTitle = () => {
    if (!room) return '...'
    if (room.title) return room.title
    const others = room.participants.filter((p) => p.user.id !== user?.id)
    if (others.length === 0) return 'Nhóm chat'
    if (others.length === 1) return others[0].user.fullName
    return others.map((p) => p.user.fullName.split(' ').pop()).join(', ')
  }

  const groups = groupMessagesByDay(messages)

  if (isLoading || loadingInit) {
    return (
      <div className="flex flex-col h-screen bg-surface">
        {/* Header skeleton */}
        <div className="sticky top-0 z-10 bg-surface border-b border-[rgba(0,0,0,0.08)] flex items-center gap-3 px-4 h-[56px]">
          <div className="w-6 h-6 bg-muted rounded animate-pulse" />
          <div className="h-4 bg-muted rounded w-32 animate-pulse" />
        </div>
        <div className="flex-1 px-4 py-4 space-y-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className={`flex ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}>
              <div className={`h-8 bg-muted rounded-2xl animate-pulse ${i % 2 === 0 ? 'w-48' : 'w-36'}`} />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-surface">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-surface border-b border-[rgba(0,0,0,0.08)] flex items-center gap-3 px-4 h-[56px] shadow-sm">
        <button
          onClick={() => router.push('/app/chat')}
          className="p-1 -ml-1 rounded-lg hover:bg-muted transition-colors"
          aria-label="Quay lại"
        >
          <ArrowLeft size={20} className="text-ink" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm text-ink truncate">{getRoomTitle()}</p>
          {room && (
            <p className="text-[11px] text-faint">
              {room.participants.length} thành viên
            </p>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {groups.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <p className="text-sm text-faint">Chưa có tin nhắn nào</p>
            <p className="text-xs text-faint mt-1">Hãy bắt đầu cuộc trò chuyện!</p>
          </div>
        )}
        {groups.map((group) => (
          <div key={group.date}>
            {/* Day separator */}
            <div className="flex items-center gap-2 my-4">
              <div className="flex-1 h-px bg-[rgba(0,0,0,0.06)]" />
              <span className="text-[11px] text-faint px-2 flex-shrink-0">
                {formatDateSeparator(group.messages[0].sentAt)}
              </span>
              <div className="flex-1 h-px bg-[rgba(0,0,0,0.06)]" />
            </div>
            {group.messages.map((msg, idx) => {
              const isOwn = msg.senderId === user?.id
              const prevMsg = group.messages[idx - 1]
              const showSender = !isOwn && (!prevMsg || prevMsg.senderId !== msg.senderId)
              return (
                <ChatBubble
                  key={msg.id}
                  content={msg.content}
                  senderName={msg.sender.fullName}
                  avatarUrl={msg.sender.avatarUrl}
                  sentAt={msg.sentAt}
                  isOwn={isOwn}
                  showSender={showSender}
                />
              )
            })}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className="border-t border-[rgba(0,0,0,0.08)] bg-surface px-3 py-2 flex items-end gap-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Nhập tin nhắn..."
          rows={1}
          className="flex-1 resize-none rounded-2xl border border-[rgba(0,0,0,0.12)] bg-muted px-3 py-2 text-sm text-ink placeholder:text-faint focus:outline-none focus:border-primary transition-colors max-h-28 overflow-y-auto"
          style={{ lineHeight: '1.5' }}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || sending}
          className="w-9 h-9 rounded-full bg-primary flex items-center justify-center flex-shrink-0 disabled:opacity-40 active:scale-95 transition-all"
          aria-label="Gửi"
        >
          <Send size={16} className="text-white translate-x-0.5" />
        </button>
      </div>
    </div>
  )
}
