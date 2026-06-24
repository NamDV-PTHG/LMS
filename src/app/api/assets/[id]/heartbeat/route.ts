import { NextResponse } from 'next/server';
import { withAuth } from '@/middleware/require-role';
import { logHeartbeat } from '@/services/asset.service';

export const POST = withAuth(async (_req, { params, user }) => {
  // Fire-and-forget — always return 200
  logHeartbeat(params!.id, user.id).catch(() => {});
  return NextResponse.json({ success: true, data: { ok: true } });
});
