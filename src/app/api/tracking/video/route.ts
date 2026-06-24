import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/middleware/require-role';
import { trackingQueue } from '@/lib/queue';

export const POST = withAuth(async (req, { user }) => {
  // Fire-and-forget: always return 200 immediately
  req.json().then((body) => {
    trackingQueue.add('video-event', {
      ...body,
      userId: user.id,
      receivedAt: new Date().toISOString(),
    }).catch(() => {});
  }).catch(() => {});

  return NextResponse.json({ success: true, data: { ok: true } });
});
