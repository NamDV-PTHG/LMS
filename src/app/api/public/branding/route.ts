import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/public/branding — no auth required.
 * Returns the branding settings of the primary group/root organization.
 * Used by the login page to show configurable title, logo, and background.
 *
 * Images are served via /api/public/image?key=<objectName> proxy so they
 * work even when MinIO port 9000 is not exposed to the internet.
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

    // Logo: use proxy endpoint so browsers don't need direct MinIO access (port 9000)
    let logoUrl: string | null = null;
    if (meta.logoObjectName) {
      logoUrl = `/api/public/image?key=${encodeURIComponent(meta.logoObjectName)}`;
    } else if (meta.logoUrl) {
      logoUrl = meta.logoUrl; // legacy: external URL
    }

    // Background: use proxy if uploaded to MinIO, else use stored URL (external URL)
    let loginBgUrl: string | null = null;
    if (meta.loginBgObjectName) {
      loginBgUrl = `/api/public/image?key=${encodeURIComponent(meta.loginBgObjectName)}`;
    } else if (meta.loginBgUrl) {
      loginBgUrl = meta.loginBgUrl;
    }

    // Favicon
    let faviconUrl: string | null = null;
    if (meta.faviconObjectName) {
      faviconUrl = `/api/public/image?key=${encodeURIComponent(meta.faviconObjectName)}`;
    } else if (meta.faviconUrl) {
      faviconUrl = meta.faviconUrl;
    }

    return NextResponse.json({
      success: true,
      data: {
        loginTitle: meta.loginTitle ?? meta.companyName ?? rootOrg?.name ?? 'LMS Tập đoàn',
        loginSubtitle: meta.loginSubtitle ?? 'Đăng nhập để tiếp tục',
        loginBgUrl,
        loginBgColor: meta.loginBgColor ?? null,
        logoUrl,
        faviconUrl,
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
        faviconUrl: null,
        primaryColor: '#1a56db',
      },
    });
  }
}
