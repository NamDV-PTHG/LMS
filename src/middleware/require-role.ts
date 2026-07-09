import { NextRequest, NextResponse } from 'next/server';
import { RoleType } from '@/types';
import { getAuthUser } from './auth.middleware';
import { resolveTenantId, hasRole } from './tenant-guard';
import { ForbiddenError } from '@/lib/errors';
import { handleApiError } from '@/app/api/error-handler';
import { redis } from '@/lib/redis';

type RouteHandler = (
  req: NextRequest,
  context: {
    params?: Record<string, string>;
    user: Awaited<ReturnType<typeof getAuthUser>>;
    companyId: string;
  },
) => Promise<NextResponse> | NextResponse;

/**
 * Higher-order function: wraps a Next.js route handler with auth + role check.
 *
 * Usage:
 * export const GET = withRole(['company_admin', 'group_admin'], async (req, { user, companyId }) => { ... });
 */
export function withRole(
  requiredRoles: RoleType[],
  handler: RouteHandler,
) {
  return async (
    req: NextRequest,
    ctx?: { params?: Record<string, string> },
  ): Promise<NextResponse> => {
    try {
      const user = await getAuthUser(req);

      if (!hasRole(user, requiredRoles)) {
        throw new ForbiddenError(
          `Yêu cầu quyền: ${requiredRoles.join(' hoặc ')}`,
        );
      }

      const companyId = resolveTenantId(req, user);

      // Track user as online — fire-and-forget, never blocks the request
      redis.setex(`online:${user.id}`, 15 * 60, companyId).catch(() => {});

      return await handler(req, {
        params: ctx?.params,
        user,
        companyId,
      });
    } catch (err) {
      return handleApiError(err);
    }
  };
}

/**
 * Wrap handler with auth but no specific role requirement.
 * Still injects user + companyId.
 */
export function withAuth(handler: RouteHandler) {
  return withRole(
    ['group_admin', 'group_hrm', 'company_admin', 'hr_manager', 'dept_head', 'instructor', 'learner'],
    handler,
  );
}
