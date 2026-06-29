import { NextResponse } from 'next/server';
import { withAuth } from '@/middleware/require-role';
import { prisma } from '@/lib/prisma';

// POST /api/tracking/fraud — ghi nhận hành vi gian lận (fire-and-forget)
// Không block UI, không trả về lỗi có nghĩa
export const POST = withAuth(async (req, { user }) => {
  try {
    const body = await req.json().catch(() => ({}));
    const { assetId, enrollmentId, violationType, detail } = body as {
      assetId?: string;
      enrollmentId?: string;
      violationType?: string;
      detail?: Record<string, unknown>;
    };

    if (!assetId || !violationType) {
      return NextResponse.json({ success: true }); // silent
    }

    // Ghi vào bảng AssetAccessLog với action đặc biệt là fraud marker
    // (Tái dụng bảng log có sẵn, hoặc có thể tạo bảng FraudLog riêng sau)
    await prisma.assetAccessLog.create({
      data: {
        assetId,
        userId: user.id,
        action: 'view_request', // placeholder — dùng metadata trong userAgent để phân biệt
        userAgent: JSON.stringify({ fraudType: violationType, detail, enrollmentId }),
        ipAddress: null,
      },
    });
  } catch {
    // Không báo lỗi — fraud tracking không được làm chậm UI
  }

  return NextResponse.json({ success: true });
});
