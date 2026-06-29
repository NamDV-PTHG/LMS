import { NextResponse } from 'next/server'
import { withAuth } from '@/middleware/require-role'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/app/api/error-handler'
import { z } from 'zod'
import { ForbiddenError, ValidationError } from '@/lib/errors'

// GET /api/chat/rooms/[roomId]/messages?after=<sentAt ISO>
export const GET = withAuth(async (req, { params, user }) => {
  try {
    const roomId = params!.roomId as string
    const after = req.nextUrl.searchParams.get('after')

    // Verify participant
    const participant = await prisma.chatParticipant.findUnique({
      where: { roomId_userId: { roomId, userId: user.id } },
    })
    if (!participant) throw new ForbiddenError('Bạn không có quyền truy cập phòng chat này')

    const messages = await prisma.chatMessage.findMany({
      where: {
        roomId,
        ...(after ? { sentAt: { gt: new Date(after) } } : {}),
      },
      include: {
        sender: { select: { id: true, fullName: true, avatarUrl: true } },
      },
      orderBy: { sentAt: 'asc' },
      take: 50,
    })

    // Update lastReadAt
    if (messages.length > 0) {
      await prisma.chatParticipant.update({
        where: { roomId_userId: { roomId, userId: user.id } },
        data: { lastReadAt: new Date() },
      })
    }

    return NextResponse.json({ success: true, data: messages })
  } catch (err) {
    return handleApiError(err)
  }
})

const sendSchema = z.object({
  content: z.string().min(1).max(2000).trim(),
})

// POST /api/chat/rooms/[roomId]/messages — send message
export const POST = withAuth(async (req, { params, user }) => {
  try {
    const roomId = params!.roomId as string
    const body = await req.json()
    const parsed = sendSchema.safeParse(body)
    if (!parsed.success) throw new ValidationError('Nội dung không hợp lệ', parsed.error.flatten().fieldErrors)

    // Verify participant
    const participant = await prisma.chatParticipant.findUnique({
      where: { roomId_userId: { roomId, userId: user.id } },
    })
    if (!participant) throw new ForbiddenError('Bạn không có quyền gửi tin nhắn')

    const message = await prisma.chatMessage.create({
      data: {
        roomId,
        senderId: user.id,
        content: parsed.data.content,
      },
      include: {
        sender: { select: { id: true, fullName: true, avatarUrl: true } },
      },
    })

    // Update room updatedAt for sorting
    await prisma.chatRoom.update({
      where: { id: roomId },
      data: { updatedAt: new Date() },
    })

    return NextResponse.json({ success: true, data: message }, { status: 201 })
  } catch (err) {
    return handleApiError(err)
  }
})
