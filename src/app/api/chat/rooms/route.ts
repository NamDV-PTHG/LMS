import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/middleware/require-role'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/app/api/error-handler'
import { z } from 'zod'
import { ValidationError } from '@/lib/errors'

// GET /api/chat/rooms — list rooms current user participates in
export const GET = withAuth(async (_req, { user, companyId }) => {
  try {
    const rooms = await prisma.chatRoom.findMany({
      where: {
        companyId,
        isActive: true,
        participants: { some: { userId: user.id } },
      },
      include: {
        participants: {
          include: {
            user: { select: { id: true, fullName: true, avatarUrl: true } },
          },
        },
        messages: {
          orderBy: { sentAt: 'desc' },
          take: 1,
          include: {
            sender: { select: { fullName: true } },
          },
        },
        _count: { select: { messages: true } },
      },
      orderBy: { updatedAt: 'desc' },
    })

    const result = rooms.map((room) => {
      const myParticipant = room.participants.find((p) => p.userId === user.id)
      const lastMsg = room.messages[0] ?? null
      const unreadCount = myParticipant?.lastReadAt
        ? room._count.messages  // simplified — count all for now
        : room._count.messages

      return {
        id: room.id,
        title: room.title,
        courseId: room.courseId,
        participants: room.participants.map((p) => ({
          userId: p.userId,
          fullName: p.user.fullName,
          avatarUrl: p.user.avatarUrl,
          role: p.role,
        })),
        lastMessage: lastMsg
          ? {
              content: lastMsg.content,
              senderName: lastMsg.sender.fullName,
              sentAt: lastMsg.sentAt,
            }
          : null,
        unreadCount,
        updatedAt: room.updatedAt,
      }
    })

    return NextResponse.json({ success: true, data: result })
  } catch (err) {
    return handleApiError(err)
  }
})

const createRoomSchema = z.object({
  title: z.string().min(1).max(100),
  courseId: z.string().uuid().optional(),
  participantIds: z.array(z.string().uuid()).min(1),
})

// POST /api/chat/rooms — create a new room
export const POST = withAuth(async (req, { user, companyId }) => {
  try {
    const body = await req.json()
    const parsed = createRoomSchema.safeParse(body)
    if (!parsed.success) throw new ValidationError('Dữ liệu không hợp lệ', parsed.error.flatten().fieldErrors)

    const { title, courseId, participantIds } = parsed.data
    const allParticipants = [...new Set([user.id, ...participantIds])]

    const room = await prisma.chatRoom.create({
      data: {
        companyId,
        title,
        courseId,
        participants: {
          create: allParticipants.map((uid) => ({
            userId: uid,
            role: uid === user.id ? 'member' : 'instructor',
          })),
        },
      },
      include: {
        participants: {
          include: { user: { select: { id: true, fullName: true, avatarUrl: true } } },
        },
      },
    })

    return NextResponse.json({ success: true, data: room }, { status: 201 })
  } catch (err) {
    return handleApiError(err)
  }
})
