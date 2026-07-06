import { NextResponse } from 'next/server';
import { withRole } from '@/middleware/require-role';
import { getCatalogs, createCatalogEntry } from '@/services/job-title-catalog.service';
import { handleApiError } from '@/app/api/error-handler';

export const GET = withRole(
  ['group_admin', 'company_admin', 'hr_manager', 'instructor'],
  async (req, { companyId }) => {
    const { searchParams } = new URL(req.url);
    const data = await getCatalogs(companyId, {
      search: searchParams.get('search') ?? undefined,
      category: searchParams.get('category') ?? undefined,
      level: searchParams.get('level') ?? undefined,
      isActive: searchParams.has('isActive') ? searchParams.get('isActive') === 'true' : undefined,
    });
    return NextResponse.json({ success: true, data });
  },
);

export const POST = withRole(
  ['group_admin', 'company_admin', 'hr_manager'],
  async (req, { companyId }) => {
    try {
      const body = await req.json();
      if (!body.code?.trim())
        return NextResponse.json(
          { success: false, error: 'Mã chức danh là bắt buộc', code: 'VALIDATION_ERROR' },
          { status: 400 },
        );
      if (!body.title?.trim())
        return NextResponse.json(
          { success: false, error: 'Tên chức danh là bắt buộc', code: 'VALIDATION_ERROR' },
          { status: 400 },
        );
      const data = await createCatalogEntry(companyId, {
        code: body.code.trim(),
        title: body.title.trim(),
        level: body.level || undefined,
        category: body.category || undefined,
        description: body.description || undefined,
        displayOrder: body.displayOrder !== undefined ? Number(body.displayOrder) : undefined,
      });
      return NextResponse.json({ success: true, data }, { status: 201 });
    } catch (err) {
      return handleApiError(err);
    }
  },
);
