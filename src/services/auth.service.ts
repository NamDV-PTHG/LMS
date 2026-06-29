import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { redisSet, redisDel, redisGet } from '@/lib/redis';
import { CACHE_KEYS, TTL } from '@/lib/cache';
import { signAccessToken, signRefreshToken, verifyJwt } from '@/middleware/auth.middleware';
import { UnauthorizedError, NotFoundError } from '@/lib/errors';
import { RoleType } from '@/types';

const REFRESH_TOKEN_PREFIX = 'refresh:';

// ── Types ────────────────────────────────────────────────────

interface LoginResult {
  accessToken: string;
  refreshToken: string;
  mustChangePassword: boolean;
  user: {
    id: string;
    email: string;
    fullName: string;
    companyId: string;
    roles: RoleType[];
  };
}

// ── Helpers ──────────────────────────────────────────────────

async function getUserWithRoles(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId, isActive: true },
    include: {
      roles: {
        include: { organization: true },
      },
    },
  });
}

function resolveCompanyId(
  roles: { role: string; organization: { id: string; type: string; companyId: string | null } }[],
): string {
  // Prefer company-level role's organizationId as companyId
  const companyRole = roles.find(
    (r) => r.organization.type === 'company',
  );
  if (companyRole) return companyRole.organization.id;

  // group_admin → use group org id
  const groupRole = roles.find((r) => r.organization.type === 'group');
  if (groupRole) return groupRole.organization.id;

  // dept/team → use companyId from org
  const deptRole = roles.find((r) => r.organization.companyId);
  if (deptRole?.organization.companyId) return deptRole.organization.companyId;

  return roles[0]?.organization.id ?? '';
}

// ── Service functions ─────────────────────────────────────────

export async function login(email: string, password: string): Promise<LoginResult> {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    include: {
      roles: { include: { organization: true } },
    },
  });

  if (!user || !user.isActive) {
    throw new UnauthorizedError('Email hoặc mật khẩu không đúng');
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw new UnauthorizedError('Email hoặc mật khẩu không đúng');
  }

  const roles = user.roles.map((r) => r.role as RoleType);
  const companyId = resolveCompanyId(user.roles);

  // Cache roles in Redis
  await redisSet(CACHE_KEYS.userRoles(user.id), roles, TTL.USER_ROLES);

  const accessToken = signAccessToken({
    sub: user.id,
    email: user.email,
    companyId,
    organizationId: user.roles[0]?.organizationId ?? '',
    roles,
  });

  const refreshToken = signRefreshToken(user.id);

  // Store refresh token in Redis (7d TTL)
  await redisSet(`${REFRESH_TOKEN_PREFIX}${user.id}`, refreshToken, 7 * 24 * 3600);

  return {
    accessToken,
    refreshToken,
    mustChangePassword: user.mustChangePassword,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      companyId,
      roles,
    },
  };
}

export async function refresh(refreshToken: string): Promise<{ accessToken: string }> {
  let payload: { sub: string };
  try {
    payload = verifyJwt(refreshToken) as { sub: string };
  } catch {
    throw new UnauthorizedError('Refresh token không hợp lệ');
  }

  // Verify stored token matches (graceful degradation when Redis is unavailable)
  // stored = null means either Redis is down OR token was revoked
  // Only reject if Redis returned a value AND it doesn't match (explicit revocation)
  const stored = await redisGet<string>(`${REFRESH_TOKEN_PREFIX}${payload.sub}`);
  if (stored !== null && stored !== refreshToken) {
    throw new UnauthorizedError('Refresh token đã bị thu hồi');
  }

  const user = await getUserWithRoles(payload.sub);
  if (!user) throw new NotFoundError('User');

  const roles = user.roles.map((r) => r.role as RoleType);
  const companyId = resolveCompanyId(user.roles);

  const accessToken = signAccessToken({
    sub: user.id,
    email: user.email,
    companyId,
    organizationId: user.roles[0]?.organizationId ?? '',
    roles,
  });

  return { accessToken };
}

export async function logout(userId: string): Promise<void> {
  await redisDel(
    `${REFRESH_TOKEN_PREFIX}${userId}`,
    CACHE_KEYS.userRoles(userId),
  );
}

export async function getMe(userId: string) {
  const user = await getUserWithRoles(userId);
  if (!user) throw new NotFoundError('User');

  const roles = user.roles.map((r) => ({
    role: r.role,
    organizationId: r.organizationId,
    organizationName: r.organization.name,
    organizationType: r.organization.type,
  }));

  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    avatarUrl: user.avatarUrl,
    employeeCode: user.employeeCode,
    jobTitle: user.jobTitle,
    jobLevel: user.jobLevel,
    roles,
    companyId: resolveCompanyId(user.roles),
  };
}
