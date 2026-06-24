import { NextResponse } from 'next/server';
import { withRole } from '@/middleware/require-role';
import { prisma } from '@/lib/prisma';
import { NotFoundError } from '@/lib/errors';
import * as XLSX from 'xlsx';

export const GET = withRole(
  ['group_admin', 'company_admin'],
  async (_req, { params, companyId, user }) => {
    const job = await prisma.importJob.findUnique({ where: { id: params!.jobId } });
    if (!job) throw new NotFoundError('Import job');

    const isGroupAdmin = user.roles.includes('group_admin');
    if (!isGroupAdmin && job.companyId !== companyId) {
      throw new NotFoundError('Import job');
    }

    // Generate error report Excel
    const errors = (job.errorLog as { row: number; column: string; message: string }[]) ?? [];
    const ws = XLSX.utils.json_to_sheet(
      errors.map((e) => ({ Row: e.row, Column: e.column, Error: e.message })),
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Errors');
    const buffer = Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="import-errors-${params!.jobId}.xlsx"`,
      },
    });
  },
);
