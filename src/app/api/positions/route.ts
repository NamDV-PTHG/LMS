import { NextResponse } from 'next/server';
import { withRole } from '@/middleware/require-role';
import { getPositions, createPosition } from '@/services/position.service';
import { handleApiError } from '@/app/api/error-handler';

export const GET = withRole(
  ['group_admin', 'company_admin', 'hr_manager', 'instructor'],
  async (req, { companyId }) => {
    const { searchParams } = new URL(req.url);
    const data = await getPositions(companyId, {
      organizationId: searchParams.get('organizationId') ?? undefined,
      isActive: searchParams.has('isActive') ? searchParams.get('isActive') === 'true' : undefined,
      search: searchParams.get('search') ?? undefined,
    });
    return NextResponse.json({ success: true, data });
  },
);

export const POST = withRole(
  ['group_admin', 'company_admin', 'hr_manager'],
  async (req, { companyId }) => {
    try {
      const body = await req.json();
      if (!body.title?.trim()) return NextResponse.json({ success: false, error: 'Tên vị trí là bắt buộc', code: 'VALIDATION_ERROR' }, { status: 400 });
      const data = await createPosition(companyId, {
        title: body.title,
        code: body.code || undefined,
        level: body.level || undefined,
        description: body.description || undefined,
        organizationId: body.organizationId || undefined,
        competencyFrameworkId: body.competencyFrameworkId || undefined,
        learningPathId: body.learningPathId || undefined,
        catalogId: body.catalogId ?? null,
        impliedRole: body.impliedRole ?? null,
      });
      return NextResponse.json({ success: true, data }, { status: 201 });
    } catch (err) {
      return handleApiError(err);
    }
  },
);
