import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/middleware/auth.middleware';
import { handleApiError } from '@/app/api/error-handler';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/me/company
 * Returns the branding/info for the current user's company.
 * Accessible by any authenticated role (learner, instructor, company_admin…).
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const authUser = await getAuthUser(req);

    const org = await prisma.organization.findFirst({
      where: {
        OR: [
          { id: authUser.companyId },
          { companyId: authUser.companyId, type: 'company' },
        ],
        isActive: true,
      },
      select: { id: true, name: true, metadata: true, type: true },
    });

    const meta = (org?.metadata as Record<string, string> | null) ?? {};

    let logoUrl: string | null = null;
    if (meta.logoObjectName) {
      logoUrl = `/api/public/image?key=${encodeURIComponent(meta.logoObjectName)}`;
    } else if (meta.logoUrl) {
      logoUrl = meta.logoUrl;
    }

    return NextResponse.json({
      success: true,
      data: {
        id: org?.id ?? authUser.companyId,
        name: meta.companyName ?? org?.name ?? '',
        logoUrl,
        primaryColor: meta.primaryColor ?? null,
        themePreset: meta.themePreset ?? null,
        loginBgUrl: meta.loginBgObjectName
          ? `/api/public/image?key=${encodeURIComponent(meta.loginBgObjectName)}`
          : (meta.loginBgUrl ?? null),
        siteTitle: meta.siteTitle ?? null,
        siteDescription: meta.siteDescription ?? null,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
