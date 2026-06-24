import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/middleware/require-role';
import { getCertificatePdfUrl } from '@/services/certificate.service';
import { handleApiError } from '@/app/api/error-handler';

// GET /api/my/certificates/[code] — get signed PDF download URL
export const GET = withRole(['learner', 'instructor', 'hr_manager', 'company_admin', 'group_admin', 'group_hrm'], async (req, ctx) => {
  try {
    const code = ctx.params?.code as string;
    const signedUrl = await getCertificatePdfUrl(code, ctx.user.id);

    if (!signedUrl) {
      return NextResponse.json({ success: true, data: { pdfUrl: null, message: 'PDF chưa được tạo' } });
    }

    return NextResponse.json({ success: true, data: { pdfUrl: signedUrl } });
  } catch (err) {
    return handleApiError(err);
  }
});
