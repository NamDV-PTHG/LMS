import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/middleware/require-role';
import { addMember } from '@/services/learning-group.service';
import { handleApiError } from '@/app/api/error-handler';
import { ValidationError } from '@/lib/errors';

const TEMPLATE_CSV =
  'email\n' +
  'nguyen.van.a@example.com\n' +
  'tran.thi.b@example.com\n';

// GET — download CSV template
export const GET = withRole(
  ['group_admin', 'group_hrm', 'company_admin', 'hr_manager'],
  async (_req, _ctx) => {
    return new NextResponse('\uFEFF' + TEMPLATE_CSV, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="external-members-template.csv"',
      },
    });
  },
);

// POST — bulk import from CSV/Excel
export const POST = withRole(
  ['group_admin', 'group_hrm', 'company_admin', 'hr_manager'],
  async (req: NextRequest, { params, user }) => {
    try {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      if (!file) throw new ValidationError('Thiếu file');

      const allowed = ['text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'];
      if (!allowed.includes(file.type) && !file.name.match(/\.(csv|xlsx|xls)$/i)) {
        throw new ValidationError('Chỉ hỗ trợ CSV hoặc Excel (.csv, .xlsx, .xls)');
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      let emails: string[] = [];

      if (file.name.match(/\.csv$/i) || file.type === 'text/csv') {
        // Parse CSV — strip BOM, get email column
        const text = buffer.toString('utf-8').replace(/^\uFEFF/, '');
        const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
        const header = lines[0]?.toLowerCase();
        const emailColIdx = header?.split(',').findIndex((h) => h.replace(/"/g, '').trim() === 'email') ?? 0;
        emails = lines
          .slice(1)
          .map((line) => {
            const cols = line.split(',');
            return (cols[emailColIdx] ?? '').replace(/"/g, '').trim().toLowerCase();
          })
          .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
      } else {
        // Parse XLSX
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const XLSX = require('xlsx') as typeof import('xlsx');
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: '' });
        emails = rows
          .map((row) => {
            const key = Object.keys(row).find((k) => k.toLowerCase() === 'email');
            return (key ? String(row[key]) : '').trim().toLowerCase();
          })
          .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
      }

      if (emails.length === 0) throw new ValidationError('Không tìm thấy địa chỉ email hợp lệ trong file');
      if (emails.length > 200) throw new ValidationError('Tối đa 200 email mỗi lần import');

      const results: { email: string; status: 'added' | 'created' | 'skipped' | 'error'; message?: string }[] = [];

      for (const email of emails) {
        try {
          const result = await addMember(params!.id, user.id, email);
          results.push({ email, status: result.wasCreated ? 'created' : 'added' });
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          // ConflictError = already a member, treat as skipped
          if (msg.toLowerCase().includes('đã có') || msg.toLowerCase().includes('conflict')) {
            results.push({ email, status: 'skipped', message: 'Đã là thành viên' });
          } else {
            results.push({ email, status: 'error', message: msg });
          }
        }
      }

      const added = results.filter((r) => r.status === 'added').length;
      const created = results.filter((r) => r.status === 'created').length;
      const skipped = results.filter((r) => r.status === 'skipped').length;
      const errors = results.filter((r) => r.status === 'error').length;

      return NextResponse.json({
        success: true,
        data: { total: emails.length, added, created, skipped, errors, results },
      });
    } catch (err) {
      return handleApiError(err);
    }
  },
);
