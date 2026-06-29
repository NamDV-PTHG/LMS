'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { MessageCircle, Plus } from 'lucide-react'
import { useAuth } from '@/components/providers/auth-provider'
import PwaHeader from '@/components/pwa/pwa-header'

interface Participant {
  userId: string
  fullName: string
  avatarUrl?: string | null
  role: string
}

interface LastMessage {
  content: string
  senderName: string
  sentAt: string
}

interface Room {
  id: string
  title: string
  courseId?: string | null
  participants: Participant[]
  lastMessage: LastMessage | null
  unreadCount: number
  updatedAt: string
}

function formatRelativeTime(dateStr: string) {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'Vừa xong'
  if (diffMin < 60) return `${diffMin} phút`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `${diffH} giờ`
  const diffD = Math.floor(diffH / 24)
  if (diffD < 7) return `${diffD} ngày`
  return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })
}

function getOtherParticipants(room: Room, myId: string) {
  return room.participants.filter((p) => p.userId !== myId)
}

function RoomAvatar({ room, myId }: { room: Room; myId: string }) {
  const others = getOtherParticipants(room, myId)
  if (others.length === 1) {
    const p = others[0]
    return p.avatarUrl ? (
      <img src={p.avatarUrl} alt={p.fullName} className="w-12 h-12 rounded-full object-cover" />
    ) : (
      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
        <span className="text-base font-medium text-primary">{p.fullName.charAt(0).toUpperCase()}</span>
      </div>
    )
  }
  return (
    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
      <MessageCircle size={22} className="text-primary" />
    </div>
  )
}

function getRoomDisplayName(room: Room, myId: string) {
  if (room.title) return room.title
  const others = getOtherParticipants(room, myId)
  if (others.length === 0) return 'Nhóm chat'
  if (others.length === 1) return others[0].fullName
  return others.map((p) => p.fullName.split(' ').pop()).join(', ')
}

export default function ChatListPage() {
  const { user, accessToken, isLoading } = useAuth()
  const router = useRouter()
  const [rooms, setRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)

  const fetchRooms = useCallback(async () => {
    if (!accessToken) return
    try {
      const res = await fetch('/api/chat/rooms', {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: 'no-store',
      })
      if (res.ok) {
        const json = await res.json()
        setRooms(json.data ?? [])
      }
    } catch {
      // silently ignore
    } finally {
      setLoading(false)
    }
  }, [accessToken])

  useEffect(() => {
    if (!isLoading && accessToken) fetchRooms()
  }, [isLoading, accessToken, fetchRooms])

  if (isLoading || loading) {
    return (
      <div className="min-h-screen bg-surface">
        <PwaHeader title="Tin nhắn" />
        <div className="pt-[56px] pb-16 px-4 space-y-3 mt-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 animate-pulse">
              <div className="w-12 h-12 rounded-full bg-muted" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-muted rounded w-1/2" />
                <div className="h-3 bg-muted rounded w-3/4" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface">
      <PwaHeader title="Tin nhắn" />

      <div className="pt-[56px] pb-16">
        {rooms.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 px-8 text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <MessageCircle size={28} className="text-primary" />
            </div>
            <p className="font-medium text-ink mb-1">Chưa có tin nhắn</p>
            <p className="text-sm text-faint">Các cuộc trò chuyện sẽ xuất hiện ở đây</p>
          </div>
        ) : (
          <ul className="divide-y divide-[rgba(0,0,0,0.06)]">
            {rooms.map((room) => (
              <li key={room.id}>
                <button
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors active:bg-muted text-left"
                  onClick={() => router.push(`/app/chat/${room.id}`)}
                >
                  <div className="flex-shrink-0">
                    <RoomAvatar room={room} myId={user?.id ?? ''} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <span className="font-medium text-sm text-ink truncate">
                        {getRoomDisplayName(room, user?.id ?? '')}
                      </span>
                      {room.lastMessage && (
                        <span className="text-[11px] text-faint flex-shrink-0">
                          {formatRelativeTime(room.lastMessage.sentAt)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs text-faint truncate">
                        {room.lastMessage
                          ? `${room.lastMessage.senderName.split(' ').pop()}: ${room.lastMessage.content}`
                          : 'Chưa có tin nhắn'}
                      </p>
                      {room.unreadCount > 0 && (
                        <span className="flex-shrink-0 min-w-[18px] h-[18px] rounded-full bg-primary text-white text-[10px] font-medium flex items-center justify-center px-1">
                          {room.unreadCount > 99 ? '99+' : room.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
