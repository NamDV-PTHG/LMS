import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/public/branding — no auth required.
 * Returns the branding settings of the primary group/root organization.
 * Used by the login page to show configurable title, logo, and background.
 */
export async function GET() {
  try {
    // Find the root group-type organization (first active one)
    const rootOrg = await prisma.organization.findFirst({
      where: { type: 'group', isActive: true, parentId: null },
      select: { id: true, name: true, metadata: true },
      orderBy: { createdAt: 'asc' },
    });

    const meta = (rootOrg?.metadata as Record<string, string> | null) ?? {};

    return NextResponse.json({
      success: true,
      data: {
        loginTitle: meta.loginTitle ?? meta.companyName ?? rootOrg?.name ?? 'LMS Tập đoàn',
        loginSubtitle: meta.loginSubtitle ?? 'Đăng nhập để tiếp tục',
        loginBgUrl: meta.loginBgUrl ?? null,
        loginBgColor: meta.loginBgColor ?? null,
        logoUrl: meta.logoUrl ?? null,
        primaryColor: meta.primaryColor ?? '#1a56db',
      },
    });
  } catch {
    // Fallback defaults when DB is unavailable
    return NextResponse.json({
      success: true,
      data: {
        loginTitle: 'LMS Tập đoàn',
        loginSubtitle: 'Đăng nhập để tiếp tục',
        loginBgUrl: null,
        loginBgColor: null,
        logoUrl: null,
        primaryColor: '#1a56db',
      },
    });
  }
}
