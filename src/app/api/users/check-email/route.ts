import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/middleware/require-role';
import { checkEmailDomain } from '@/services/user.service';

/**
 * GET /api/users/check-email?email=xxx
 * Kiểm tra tên miền email có MX record không.
 * Dùng cho real-time validation khi admin nhập email tạo user mới.
 */
export const GET = withRole(
  ['group_admin', 'company_admin', 'hr_manager'],
  async (req: NextRequest) => {
    const email = req.nextUrl.searchParams.get('email')?.trim().toLowerCase() ?? '';

    if (!email) {
      return NextResponse.json({ valid: false, reason: 'Thiếu tham số email' });
    }

    // Basic format check before DNS lookup
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ valid: false, reason: 'Định dạng email không hợp lệ' });
    }

    const result = await checkEmailDomain(email);
    return NextResponse.json(result);
  },
);
