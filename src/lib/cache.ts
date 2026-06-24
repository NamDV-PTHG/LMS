import { redisGet, redisSet, redisDel, redisDelPattern } from './redis';

// ── TTL constants (seconds) ───────────────────────────────────
export const TTL = {
  ORG_TREE: parseInt(process.env.CACHE_TTL_ORG_TREE ?? '1800', 10),
  USER_ROLES: parseInt(process.env.CACHE_TTL_USER_ROLES ?? '900', 10),
  COURSE_META: parseInt(process.env.CACHE_TTL_COURSE_META ?? '3600', 10),
  SIGNED_URL: parseInt(process.env.CACHE_TTL_SIGNED_URL ?? '1080', 10),
  MY_COURSES: 60,   // learner dashboard — union 3 sources
} as const;

// ── Cache key builders ────────────────────────────────────────
export const CACHE_KEYS = {
  orgTree: (companyId: string) => `org:tree:${companyId}`,
  orgFlat: (companyId: string) => `org:flat:${companyId}`,
  userRoles: (userId: string) => `user:roles:${userId}`,
  courseMeta: (courseId: string) => `course:meta:${courseId}`,
  myCourses: (userId: string) => `my:courses:${userId}`,
  signedUrl: (assetId: string, userId: string) => `signed:${assetId}:${userId}`,
};

// ── Cache-aside pattern ───────────────────────────────────────

/**
 * Get from cache, or fetch from DB and cache the result.
 */
export async function cacheAside<T>(
  key: string,
  ttl: number,
  fetchFn: () => Promise<T>,
): Promise<T> {
  const cached = await redisGet<T>(key);
  if (cached !== null) return cached;

  const fresh = await fetchFn();
  await redisSet(key, fresh, ttl);
  return fresh;
}

// ── Invalidation helpers ──────────────────────────────────────

export async function invalidateOrgCache(companyId: string): Promise<void> {
  await redisDel(
    CACHE_KEYS.orgTree(companyId),
    CACHE_KEYS.orgFlat(companyId),
  );
}

export async function invalidateUserRolesCache(userId: string): Promise<void> {
  await redisDel(CACHE_KEYS.userRoles(userId));
}

export async function invalidateCourseCache(courseId: string): Promise<void> {
  await redisDel(CACHE_KEYS.courseMeta(courseId));
}

export async function invalidateMyCoursesCache(userId: string): Promise<void> {
  await redisDel(CACHE_KEYS.myCourses(userId));
}

export async function invalidateAllUserCaches(userId: string): Promise<void> {
  await redisDelPattern(`*:${userId}:*`);
  await redisDel(CACHE_KEYS.userRoles(userId), CACHE_KEYS.myCourses(userId));
}
