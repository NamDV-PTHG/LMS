import { NextRequest } from 'next/server';
import { AuthUser, RoleType } from '@/types';
import { ForbiddenError } from '@/lib/errors';

/**
 * Inject and validate tenant context.
 *
 * - group_admin can access any company (pass companyId explicitly via query param)
 * - All other roles are locked to their own companyId from JWT
 * - NEVER accept companyId from req.body
 */
export function resolveTenantId(
  req: NextRequest,
  user: AuthUser,
): string {
  const isGroupAdmin = user.roles.includes('group_admin' as RoleType);

  if (isGroupAdmin) {
    // group_admin may specify a target company via query param for scoped operations
    const queryCompanyId = req.nextUrl.searchParams.get('companyId');
    // Falls back to their own (group-level) org if not specified
    return queryCompanyId ?? user.companyId;
  }

  return user.companyId;
}

/**
 * Verify that an entity belongs to the user's company.
 * Throws ForbiddenError on cross-tenant access attempts.
 */
export function assertSameTenant(
  entityCompanyId: string,
  userCompanyId: string,
  isGroupAdmin: boolean,
): void {
  if (isGroupAdmin) return; // group_admin bypasses — but still logged externally
  if (entityCompanyId !== userCompanyId) {
    throw new ForbiddenError('Không có quyền truy cập dữ liệu của công ty khác');
  }
}

/**
 * Check if the user has at least one of the required roles.
 */
export function hasRole(user: AuthUser, requiredRoles: RoleType[]): boolean {
  return user.roles.some((r) => requiredRoles.includes(r));
}
