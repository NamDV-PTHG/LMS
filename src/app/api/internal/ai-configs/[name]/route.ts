import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * Internal endpoint called by FastAPI AI service to fetch AI config from DB.
 * Secured by X-Internal-Key header (not JWT).
 */
export async function GET(req: NextRequest, { params }: { params: { name: string } }) {
  const key = req.headers.get('X-Internal-Key');
  if (!key || key !== process.env.NEXTJS_API_KEY) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const config = await prisma.aiServiceConfig.findFirst({
    where: { name: params.name, isActive: true },
    select: { id: true, name: true, endpoint: true, modelName: true },
  });

  if (!config) {
    return NextResponse.json(
      { success: false, error: `AI config '${params.name}' not found or inactive` },
      { status: 404 },
    );
  }

  return NextResponse.json({ success: true, data: config });
}
