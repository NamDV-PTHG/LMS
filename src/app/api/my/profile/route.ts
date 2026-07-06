import { NextResponse } from 'next/server'
import { withAuth } from '@/middleware/require-role'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/app/api/error-handler'

// GET /api/my/profile — learner profile with stats + certificates
export const GET = withAuth(async (_req, { user, companyId }) => {
  try {
    const [userRecord, enrollments, certificates] = await Promise.all([
      prisma.user.findUnique({
        where: { id: user.id },
        select: {
          id: true,
          email: true,
          fullName: true,
          avatarUrl: true,
          jobTitle: true,
          jobLevel: true,
          employeeCode: true,
          createdAt: true,
          roles: {
            select: { role: true, organizationId: true },
          },
        },
      }),
      prisma.enrollment.findMany({
        where: { userId: user.id },
        select: {
          id: true,
          completedAt: true,
          course: { select: { id: true, title: true, thumbnailUrl: true } },
          certificate: {
            select: { id: true, code: true, issuedAt: true, expiresAt: true },
          },
        },
        orderBy: { enrolledAt: 'desc' },
      }),
    ])

    if (!userRecord) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
    }

    const totalCourses = enrollments.length
    const completed = enrollments.filter((e) => e.completedAt !== null)
    const inProgress = enrollments.filter((e) => e.completedAt === null)

    const certs = completed
      .filter((e) => e.certificate)
      .map((e) => ({
        id: e.certificate!.id,
        code: e.certificate!.code,
        issuedAt: e.certificate!.issuedAt,
        expiresAt: e.certificate!.expiresAt,
        courseName: e.course.title,
        courseThumbnail: e.course.thumbnailUrl,
      }))

    return NextResponse.json({
      success: true,
      data: {
        user: userRecord,
        stats: {
          totalCourses,
          completed: completed.length,
          inProgress: inProgress.length,
          certificates: certs.length,
        },
        certificates: certs,
        recentCourses: enrollments.slice(0, 5).map((e) => ({
          courseId: e.course.id,
          title: e.course.title,
          thumbnailUrl: e.course.thumbnailUrl,
          status: e.completedAt ? 'completed' : 'in_progress',
          completedAt: e.completedAt,
        })),
      },
    })
  } catch (err) {
    return handleApiError(err)
  }
})
