import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/middleware/require-role';
import {
  getFolderDownloadPermission,
  setFolderDownloadPermission,
} from '@/services/media-library.service';
import { handleApiError } from '@/app/api/error-handler';
import { ValidationError } from '@/lib/errors';

/**
 * GET /api/media-library/folder-download-permission
 * Returns whether the current user/company can perform folder bulk-downloads.
 * Optional ?companyId=xxx lets group_admin check a specific company.
 */
export const GET = withRole(
  ['company_admin', 'hr_manager', 'group_admin', 'group_hrm'],
  async (req, { user, companyId }) => {
    try {
      const sp = req.nextUrl.searchParams;
      const targetCompanyId = sp.get('companyId') ?? companyId;
      const result = await getFolderDownloadPermission(targetCompanyId, user.roles as string[]);
      return NextResponse.json({ success: true, data: result });
    } catch (err) {
      return handleApiError(err);
    }
  },
);

/**
 * PUT /api/media-library/folder-download-permission
 * body: { targetCompanyId: string, allow: boolean }
 * Only group_admin can call.
 */
export const PUT = withRole(
  ['group_admin'],
  async (req, { user }) => {
    try {
      const body = await req.json();
      if (!body.targetCompanyId || typeof body.allow !== 'boolean') {
        throw new ValidationError('Thiếu targetCompanyId hoặc allow');
      }
      await setFolderDownloadPermission(body.targetCompanyId, body.allow, user.roles as string[]);
      return NextResponse.json({ success: true, data: { message: 'Đã cập nhật quyền tải thư mục' } });
    } catch (err) {
      return handleApiError(err);
    }
  },
);
