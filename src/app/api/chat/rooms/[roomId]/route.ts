import { NextResponse } from 'next/server'
import { withAuth } from '@/middleware/require-role'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/app/api/error-handler'
import { ForbiddenError, NotFoundError } from '@/lib/errors'

// GET /api/chat/rooms/[roomId] — get room detail
export const GET = withAuth(async (_req, { params, user }) => {
  try {
    const roomId = params!.roomId as string

    const participant = await prisma.chatParticipant.findUnique({
      where: { roomId_userId: { roomId, userId: user.id } },
    })
    if (!participant) throw new ForbiddenError('Không có quyền truy cập')

    const room = await prisma.chatRoom.findUnique({
      where: { id: roomId },
      include: {
        participants: {
          include: {
            user: { select: { id: true, fullName: true, avatarUrl: true, jobTitle: true } },
          },
        },
      },
    })
    if (!room || !room.isActive) throw new NotFoundError('Phòng chat')

    return NextResponse.json({ success: true, data: room })
  } catch (err) {
    return handleApiError(err)
  }
})
