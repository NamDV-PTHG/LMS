import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/middleware/require-role';
import { handleApiError } from '@/app/api/error-handler';
import { prisma } from '@/lib/prisma';

// GET /api/notifications — returns notifications visible to current user + unread count
export const GET = withRole(
  ['group_admin', 'group_hrm', 'company_admin', 'hr_manager', 'instructor', 'learner'],
  async (req, { user, companyId }) => {
    try {
      const sp = req.nextUrl.searchParams;
      const limit = Math.min(parseInt(sp.get('limit') ?? '50'), 100);

      // Notifications the user can see:
      // 1. Targeted directly at this user
      // 2. Targeted at user's dept (targetType='dept', targetId = user.organizationId)
      // 3. Company-wide (targetType='all', companyId = user's company)
      // 4. Group-wide broadcast (companyId = null, created by group_admin)
      // user.organizationId comes from JWT payload (dept/org the user belongs to)
      const deptId = user.organizationId ?? null;

      const viewSent = sp.get('view') === 'sent';

      const notifications = await prisma.notification.findMany({
        where: viewSent
          ? { createdById: user.id }   // Admin: show sent history
          : {
              OR: [
                { targetType: 'user', targetId: user.id },
                ...(deptId ? [{ targetType: 'dept', targetId: deptId }] : []),
                { targetType: 'all', companyId },
                { companyId: null, targetType: 'all' },
                // Also show group-wide broadcasts to any admin that can see all companies
                ...(user.roles.includes('group_admin') || user.roles.includes('group_hrm')
                  ? [{ createdById: user.id }]  // group_admin can always see what they sent
                  : []),
              ],
            },
        include: {
          createdBy: { select: { id: true, fullName: true } },
          reads: { where: { userId: user.id }, select: { id: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

      const result = notifications.map((n) => ({
        id: n.id,
        title: n.title,
        body: n.body,
        targetType: n.targetType,
        createdBy: n.createdBy,
        createdAt: n.createdAt,
        isRead: n.reads.length > 0,
      }));

      const unreadCount = result.filter((n) => !n.isRead).length;

      return NextResponse.json({ success: true, data: result, meta: { unreadCount } });
    } catch (err) {
      return handleApiError(err);
    }
  },
);

// POST /api/notifications — create notification (admin roles + group_admin for company broadcast)
export const POST = withRole(
  ['group_admin', 'group_hrm', 'company_admin', 'hr_manager'],
  async (req, { user, companyId }) => {
    try {
      const body = await req.json();
      const { title, body: msgBody, targetType = 'all', targetId, targetCompanyId } = body;

      if (!title?.trim()) return NextResponse.json({ success: false, error: 'Tiêu đề là bắt buộc', code: 'VALIDATION_ERROR' }, { status: 400 });
      if (!msgBody?.trim()) return NextResponse.json({ success: false, error: 'Nội dung là bắt buộc', code: 'VALIDATION_ERROR' }, { status: 400 });

      const isGroupAdmin = user.roles.includes('group_admin') || user.roles.includes('group_hrm');

      // group_admin can target a specific company or broadcast to all (companyId=null)
      const notifCompanyId = isGroupAdmin
        ? (targetCompanyId ?? null) // null = toàn tập đoàn
        : companyId;

      const notification = await prisma.notification.create({
        data: {
          companyId: notifCompanyId,
          targetType,
          targetId: targetType !== 'all' ? targetId : null,
          title: title.trim(),
          body: msgBody.trim(),
          createdById: user.id,
        },
      });

      return NextResponse.json({ success: true, data: notification }, { status: 201 });
    } catch (err) {
      return handleApiError(err);
    }
  },
);
