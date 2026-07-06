import { NextResponse } from 'next/server';
import os from 'os';
import { withRole } from '@/middleware/require-role';
import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import { handleApiError } from '@/app/api/error-handler';

export const GET = withRole(['group_admin'], async (_req, { companyId: _cid }) => {
  try {
    // ── 1. System info ─────────────────────────────────────────
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const procMem = process.memoryUsage();

    const system = {
      platform: os.platform(),
      nodeVersion: process.version,
      uptimeSeconds: Math.floor(process.uptime()),
      memory: {
        totalMB: Math.round(totalMem / 1024 / 1024),
        usedMB: Math.round(usedMem / 1024 / 1024),
        freeMB: Math.round(freeMem / 1024 / 1024),
        usedPct: Math.round((usedMem / totalMem) * 100),
        processMB: Math.round(procMem.rss / 1024 / 1024),
        heapUsedMB: Math.round(procMem.heapUsed / 1024 / 1024),
        heapTotalMB: Math.round(procMem.heapTotal / 1024 / 1024),
      },
    };

    // ── 2. Online users (Redis TTL-based, 15-min window) ───────
    let onlineTotal = 0;
    const onlineByCompany: Record<string, number> = {};

    try {
      const keys = await redis.keys('online:*');
      onlineTotal = keys.length;
      if (keys.length > 0) {
        const values = await redis.mget(...keys);
        for (const cid of values) {
          if (cid) onlineByCompany[cid] = (onlineByCompany[cid] ?? 0) + 1;
        }
      }
    } catch {
      // Redis unavailable — skip online counts
    }

    // ── 3. DB stats ────────────────────────────────────────────
    const [
      totalUsers,
      activeUsers,
      totalCourses,
      totalEnrollments,
      completedEnrollments,
      companies,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { isActive: true } }),
      prisma.course.count(),
      prisma.enrollment.count(),
      prisma.enrollment.count({ where: { completedAt: { not: null } } }),
      // Note: Organization.users is the UserRole[] relation (no isActive field on UserRole)
      prisma.organization.findMany({
        where: { type: 'company', isActive: true },
        select: {
          id: true,
          name: true,
          code: true,
        },
        orderBy: { name: 'asc' },
      }),
    ]);

    // Count active users per company — users who have any role in the company org
    // OR in a department (companyId = org.id)
    const companySummary = await Promise.all(
      companies.map(async (org) => {
        const [userCount, enrollCount, completedCount] = await Promise.all([
          prisma.user.count({
            where: {
              isActive: true,
              roles: {
                some: {
                  organization: {
                    OR: [
                      { id: org.id },           // role at company org itself
                      { companyId: org.id },     // role at dept/team under this company
                    ],
                  },
                },
              },
            },
          }),
          prisma.enrollment.count({
            where: {
              user: {
                isActive: true,
                roles: {
                  some: {
                    organization: {
                      OR: [{ id: org.id }, { companyId: org.id }],
                    },
                  },
                },
              },
            },
          }),
          prisma.enrollment.count({
            where: {
              completedAt: { not: null },
              user: {
                isActive: true,
                roles: {
                  some: {
                    organization: {
                      OR: [{ id: org.id }, { companyId: org.id }],
                    },
                  },
                },
              },
            },
          }),
        ]);

        return {
          id: org.id,
          name: org.name,
          code: org.code,
          users: userCount,
          onlineNow: onlineByCompany[org.id] ?? 0,
          enrollments: enrollCount,
          completed: completedCount,
        };
      }),
    );

    return NextResponse.json({
      success: true,
      data: {
        system,
        online: {
          total: onlineTotal,
          windowMinutes: 15,
          byCompany: onlineByCompany,
        },
        stats: {
          totalUsers,
          activeUsers,
          totalCourses,
          totalEnrollments,
          completedEnrollments,
        },
        companies: companySummary,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
});
