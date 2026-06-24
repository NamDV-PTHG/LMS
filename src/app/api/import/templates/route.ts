import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

const TEMPLATES: Record<string, { sheetName: string; headers: string[]; sampleRow: (string | number)[] }[]> = {
  users: [
    {
      sheetName: 'Users',
      headers: [
        'email',
        'fullName',
        'employeeCode',
        'jobTitle',
        'department',
        'role',
        'password',
      ],
      sampleRow: [
        'nguyen.van.a@company.vn',
        'Nguyễn Văn A',
        'EMP001',
        'Nhân viên kinh doanh',
        'Phòng Kinh doanh',
        'learner',
        'ChangeMe@123',
      ],
    },
    {
      sheetName: 'Hướng dẫn',
      headers: ['Cột', 'Bắt buộc', 'Mô tả', 'Giá trị hợp lệ'],
      sampleRow: [],
    },
  ],
  org_chart: [
    {
      sheetName: 'OrgChart',
      headers: [
        'name',
        'code',
        'type',
        'parentCode',
        'address',
        'phone',
      ],
      sampleRow: [
        'Tổng công ty',
        'TCT',
        'group',
        '',
        '123 Đường ABC, Hà Nội',
        '024-1234-5678',
      ],
    },
    {
      sheetName: 'Hướng dẫn',
      headers: ['Cột', 'Bắt buộc', 'Mô tả', 'Giá trị hợp lệ'],
      sampleRow: [],
    },
  ],
  job_positions: [
    {
      sheetName: 'JobPositions',
      headers: [
        'title',
        'code',
        'level',
        'description',
        'departmentCode',
      ],
      sampleRow: [
        'Kỹ sư phần mềm',
        'SE-01',
        'Senior',
        'Phát triển hệ thống backend',
        'IT',
      ],
    },
  ],
};

const INSTRUCTIONS: Record<string, string[][]> = {
  users: [
    ['email', 'Bắt buộc', 'Địa chỉ email đăng nhập', ''],
    ['fullName', 'Bắt buộc', 'Họ tên đầy đủ', ''],
    ['employeeCode', 'Tùy chọn', 'Mã nhân viên nội bộ', ''],
    ['jobTitle', 'Tùy chọn', 'Chức danh công việc', ''],
    ['department', 'Tùy chọn', 'Tên phòng ban (phải tồn tại trong hệ thống)', ''],
    ['role', 'Bắt buộc', 'Vai trò trong hệ thống', 'learner | instructor | hr_manager | company_admin'],
    ['password', 'Tùy chọn', 'Mật khẩu ban đầu (min 8 ký tự). Mặc định: ChangeMe@123', ''],
  ],
  org_chart: [
    ['name', 'Bắt buộc', 'Tên tổ chức/đơn vị', ''],
    ['code', 'Bắt buộc', 'Mã định danh duy nhất', ''],
    ['type', 'Bắt buộc', 'Loại tổ chức', 'group | company | dept | team'],
    ['parentCode', 'Tùy chọn', 'Mã của đơn vị cấp trên (để trống nếu là gốc)', ''],
    ['address', 'Tùy chọn', 'Địa chỉ', ''],
    ['phone', 'Tùy chọn', 'Số điện thoại', ''],
  ],
  job_positions: [
    ['title', 'Bắt buộc', 'Tên vị trí công việc', ''],
    ['code', 'Tùy chọn', 'Mã vị trí (duy nhất trong công ty)', ''],
    ['level', 'Tùy chọn', 'Cấp bậc', 'Junior | Senior | Manager | Director'],
    ['description', 'Tùy chọn', 'Mô tả vị trí', ''],
    ['departmentCode', 'Tùy chọn', 'Mã phòng ban (phải tồn tại)', ''],
  ],
};

/**
 * GET /api/import/templates?type=users|org_chart|job_positions
 * Returns a downloadable Excel template file.
 * No auth required so users can download before logging in.
 */
export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get('type') ?? 'users';
  const templateSheets = TEMPLATES[type];
  if (!templateSheets) {
    return NextResponse.json({ success: false, error: 'Loại template không hợp lệ' }, { status: 400 });
  }

  const wb = XLSX.utils.book_new();

  // Main data sheet
  const mainSheet = templateSheets[0];
  const dataRows = [mainSheet.headers, mainSheet.sampleRow];
  const ws = XLSX.utils.aoa_to_sheet(dataRows);

  // Style header row (bold simulation via column widths)
  const colWidths = mainSheet.headers.map((h) => ({ wch: Math.max(h.length + 4, 18) }));
  ws['!cols'] = colWidths;

  XLSX.utils.book_append_sheet(wb, ws, mainSheet.sheetName);

  // Instructions sheet
  const instructions = INSTRUCTIONS[type];
  if (instructions) {
    const instrHeaders = ['Cột', 'Bắt buộc', 'Mô tả', 'Giá trị hợp lệ'];
    const instrData = [instrHeaders, ...instructions];
    const instrWs = XLSX.utils.aoa_to_sheet(instrData);
    instrWs['!cols'] = [{ wch: 20 }, { wch: 12 }, { wch: 50 }, { wch: 40 }];
    XLSX.utils.book_append_sheet(wb, instrWs, 'Hướng dẫn');
  }

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  const filename = `template_${type}.xlsx`;
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
