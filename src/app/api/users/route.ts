import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/middleware/require-role';
import { getUsers, createUser, createUserSchema } from '@/services/user.service';
import { handleApiError } from '@/app/api/error-handler';
import { ValidationError } from '@/lib/errors';
import { sendWelcomeEmail } from '@/services/email.service';

export const GET = withRole(
  ['group_admin', 'company_admin', 'hr_manager'],
  async (req, { user, companyId }) => {
    const sp = req.nextUrl.searchParams;
    const page = parseInt(sp.get('page') ?? '1', 10);
    const limit = Math.min(parseInt(sp.get('limit') ?? '20', 10), 100);
    const deptId = sp.get('deptId') ?? undefined;
    const role = sp.get('role') ?? undefined;

    const isGroupAdmin = user.roles.includes('group_admin');
    // group_admin can filter by specific company via ?filterCompanyId=<uuid>
    const filterCompanyId = isGroupAdmin ? (sp.get('filterCompanyId') ?? null) : null;
    const result = await getUsers(companyId, isGroupAdmin, { deptId, role, page, limit, filterCompanyId });

    return NextResponse.json({ success: true, data: result.items, meta: result });
  },
);

export const POST = withRole(
  ['group_admin', 'company_admin'],
  async (req, { user, companyId }) => {
    try {
      const body = await req.json();
      const parsed = createUserSchema.safeParse(body);
      if (!parsed.success) {
        throw new ValidationError('Dữ liệu không hợp lệ', parsed.error.flatten().fieldErrors);
      }

      const isGroupAdmin = user.roles.includes('group_admin');
      const plainPassword = parsed.data.password ?? 'ChangeMe@123';
      const newUser = await createUser(parsed.data, companyId, isGroupAdmin);

      // Gửi email chào mừng nếu được yêu cầu (không block response nếu fail)
      if (body.sendWelcomeEmail) {
        const loginUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://lms.phuthaiholdings.com:5980';
        sendWelcomeEmail(newUser.email, newUser.fullName, plainPassword, `${loginUrl}/login`)
          .catch((e) => console.error('[Email] Gửi welcome email thất bại:', e));
      }

      return NextResponse.json({ success: true, data: newUser }, { status: 201 });
    } catch (err) {
      return handleApiError(err);
    }
  },
);
