import { NextResponse } from 'next/server';
import { withRole } from '@/middleware/require-role';
import { updateCatalogEntry, deleteCatalogEntry } from '@/services/job-title-catalog.service';
import { handleApiError } from '@/app/api/error-handler';

export const PATCH = withRole(
  ['group_admin', 'company_admin', 'hr_manager'],
  async (req, { companyId, params }) => {
    try {
      const body = await req.json();
      const data = await updateCatalogEntry(params!.id, companyId, {
        code: body.code?.trim() || undefined,
        title: body.title?.trim() || undefined,
        level: body.level !== undefined ? body.level || undefined : undefined,
        category: body.category !== undefined ? body.category || undefined : undefined,
        description: body.description !== undefined ? body.description || undefined : undefined,
        isActive: body.isActive,
        displayOrder: body.displayOrder !== undefined ? Number(body.displayOrder) : undefined,
      });
      return NextResponse.json({ success: true, data });
    } catch (err) {
      return handleApiError(err);
    }
  },
);

export const DELETE = withRole(
  ['group_admin', 'company_admin', 'hr_manager'],
  async (_req, { companyId, params }) => {
    try {
      await deleteCatalogEntry(params!.id, companyId);
      return NextResponse.json({ success: true });
    } catch (err) {
      return handleApiError(err);
    }
  },
);
