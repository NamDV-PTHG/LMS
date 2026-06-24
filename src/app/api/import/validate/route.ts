import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/middleware/require-role';
import { parseExcel, validateOrgRows, validateUserRows } from '@/services/import.service';
import { handleApiError } from '@/app/api/error-handler';
import { ValidationError } from '@/lib/errors';

const SHEET_MAP: Record<string, string> = {
  org_chart: 'OrgChart',
  users: 'Users',
  job_positions: 'JobPositions',
};

export const POST = withRole(
  ['group_admin', 'company_admin'],
  async (req) => {
    try {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      const importType = formData.get('importType') as string | null;

      if (!file || !importType) {
        throw new ValidationError('Thiếu file hoặc importType');
      }

      const sheetName = SHEET_MAP[importType];
      if (!sheetName) throw new ValidationError(`importType không hợp lệ: ${importType}`);

      const buffer = Buffer.from(await file.arrayBuffer());
      const rows = parseExcel(buffer, sheetName);

      let errors: { row: number; field: string; message: string }[] = [];
      if (importType === 'org_chart') {
        errors = validateOrgRows(rows as Parameters<typeof validateOrgRows>[0]).map((e) => ({
          row: e.row,
          field: e.column,
          message: e.message,
        }));
      } else if (importType === 'users') {
        errors = validateUserRows(rows as Parameters<typeof validateUserRows>[0]).map((e) => ({
          row: e.row,
          field: e.column,
          message: e.message,
        }));
      }

      const validRows = rows.length - errors.length;

      return NextResponse.json({
        success: true,
        data: {
          valid: validRows > 0,
          totalRows: rows.length,
          validRows,
          errors,
        },
      });
    } catch (err) {
      return handleApiError(err);
    }
  },
);
