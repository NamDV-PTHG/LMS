import { NextRequest } from 'next/server';
import { AuthUser, RoleType } from '@/types';
import { UnauthorizedError } from '@/lib/errors';

/**
 * Extract auth context from request headers injected by middleware.
 * Use this inside API route handlers (after middleware has run).
 */
export function getAuthContext(req: NextRequest): AuthUser {
  const userId = req.headers.get('x-user-id');
  const email = req.headers.get('x-user-email');
  const companyId = req.headers.get('x-company-id');
  const rolesHeader = req.headers.get('x-user-roles');

  if (!userId || !email || !companyId) {
    throw new UnauthorizedError('Thiếu thông tin xác thực');
  }

  const roles = (rolesHeader?.split(',').filter(Boolean) ?? []) as RoleType[];

  return {
    id: userId,
    email,
    fullName: '',         // load from DB when needed
    companyId,
    organizationId: '',   // load from DB when needed
    roles,
  };
}
