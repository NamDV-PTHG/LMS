import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { withRole } from '@/middleware/require-role';
import { prisma } from '@/lib/prisma';
import { handleApiError } from '@/app/api/error-handler';

// ── Legacy simple templates (no auth needed) ────────────────────────────────

const SIMPLE_TEMPLATES: Record<string, { headers: string[]; sampleRow: (string | number)[]; sheetName: string }> = {
  users: {
    sheetName: 'Users',
    headers: ['email', 'fullName', 'employeeCode', 'jobTitle', 'department', 'role', 'password'],
    sampleRow: ['nguyen.van.a@company.vn', 'Nguyễn Văn A', 'EMP001', 'Nhân viên kinh doanh', 'Phòng Kinh doanh', 'learner', 'ChangeMe@123'],
  },
  org_chart: {
    sheetName: 'OrgChart',
    headers: ['name', 'code', 'type', 'parentCode', 'address', 'phone'],
    sampleRow: ['Phòng Kỹ thuật', 'KT', 'dept', 'CTYABC', '123 Đường ABC, Hà Nội', '024-1234-5678'],
  },
  job_positions: {
    sheetName: 'JobPositions',
    headers: ['title', 'code', 'level', 'description', 'departmentCode'],
    sampleRow: ['Kỹ sư phần mềm', 'SE-01', 'senior', 'Phát triển hệ thống backend', 'KT'],
  },
};

const SIMPLE_INSTRUCTIONS: Record<string, string[][]> = {
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
    ['type', 'Bắt buộc', 'Loại tổ chức', 'dept | team'],
    ['parentCode', 'Tùy chọn', 'Mã của đơn vị cấp trên (để trống nếu là gốc)', ''],
    ['address', 'Tùy chọn', 'Địa chỉ', ''],
    ['phone', 'Tùy chọn', 'Số điện thoại', ''],
  ],
  job_positions: [
    ['title', 'Bắt buộc', 'Tên vị trí công việc', ''],
    ['code', 'Tùy chọn', 'Mã vị trí (duy nhất trong công ty)', ''],
    ['level', 'Tùy chọn', 'Cấp bậc', 'junior | mid | senior | lead | manager | director | c_level'],
    ['description', 'Tùy chọn', 'Mô tả vị trí', ''],
    ['departmentCode', 'Tùy chọn', 'Mã phòng ban (phải tồn tại)', ''],
  ],
};

function buildSimpleTemplate(type: string): Buffer {
  const tpl = SIMPLE_TEMPLATES[type];
  const wb = XLSX.utils.book_new();

  const ws = XLSX.utils.aoa_to_sheet([tpl.headers, tpl.sampleRow]);
  ws['!cols'] = tpl.headers.map((h) => ({ wch: Math.max(h.length + 4, 18) }));
  XLSX.utils.book_append_sheet(wb, ws, tpl.sheetName);

  const instr = SIMPLE_INSTRUCTIONS[type];
  if (instr) {
    const instrWs = XLSX.utils.aoa_to_sheet([['Cột', 'Bắt buộc', 'Mô tả', 'Giá trị hợp lệ'], ...instr]);
    instrWs['!cols'] = [{ wch: 20 }, { wch: 12 }, { wch: 50 }, { wch: 40 }];
    XLSX.utils.book_append_sheet(wb, instrWs, 'Hướng dẫn');
  }

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

// ── Full HR template with dropdown validation (ExcelJS) ────────────────────

const LEVEL_OPTIONS = ['junior', 'mid', 'senior', 'lead', 'manager', 'director', 'c_level'];
const ROLE_OPTIONS = ['learner', 'instructor', 'hr_manager', 'company_admin'];
const ORG_TYPE_OPTIONS = ['dept', 'team'];

async function buildFullTemplate(companyId: string): Promise<Buffer> {
  // Fetch reference data
  const [catalogs, orgs, frameworks, paths, positions] = await Promise.all([
    prisma.jobTitleCatalog.findMany({
      where: { companyId, isActive: true },
      orderBy: [{ category: 'asc' }, { displayOrder: 'asc' }],
      select: { code: true, title: true, level: true, category: true },
    }),
    prisma.organization.findMany({
      where: { companyId, type: { in: ['dept', 'team'] } },
      orderBy: { name: 'asc' },
      select: { code: true, name: true, type: true },
    }),
    prisma.competencyFramework.findMany({
      where: { companyId },
      orderBy: { name: 'asc' },
      select: { code: true, name: true, version: true },
    }),
    prisma.learningPath.findMany({
      where: { companyId },
      orderBy: { title: 'asc' },
      select: { code: true, title: true },
    }),
    prisma.jobPosition.findMany({
      where: { companyId },
      orderBy: { title: 'asc' },
      select: { code: true, title: true },
    }),
  ]);

  const wb = new ExcelJS.Workbook();
  wb.creator = 'LMS System';
  wb.created = new Date();

  // ── Helper: style header row ──────────────────────────────────────────────
  function styleHeader(sheet: ExcelJS.Worksheet, cols: number) {
    const headerRow = sheet.getRow(1);
    for (let c = 1; c <= cols; c++) {
      const cell = headerRow.getCell(c);
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF185FA5' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      cell.border = {
        top: { style: 'thin' }, left: { style: 'thin' },
        bottom: { style: 'thin' }, right: { style: 'thin' },
      };
    }
    headerRow.height = 22;
  }

  function addDropdown(
    sheet: ExcelJS.Worksheet,
    col: number,
    startRow: number,
    endRow: number,
    formulae: string,
    prompt: string,
  ) {
    for (let r = startRow; r <= endRow; r++) {
      sheet.getCell(r, col).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [formulae],
        showErrorMessage: true,
        errorTitle: 'Giá trị không hợp lệ',
        error: `Vui lòng chọn từ danh sách. ${prompt}`,
        showInputMessage: true,
        promptTitle: 'Gợi ý',
        prompt,
      };
    }
  }

  const DATA_ROWS = 200; // dropdown validation for rows 2..201

  // ── Sheet: OrgChart ───────────────────────────────────────────────────────
  const orgSheet = wb.addWorksheet('OrgChart', { properties: { tabColor: { argb: 'FF4CAF50' } } });
  orgSheet.columns = [
    { header: 'code *', key: 'code', width: 16 },
    { header: 'name *', key: 'name', width: 30 },
    { header: 'type *', key: 'type', width: 12 },
    { header: 'parentCode', key: 'parentCode', width: 16 },
    { header: 'description', key: 'description', width: 35 },
    { header: 'displayOrder', key: 'displayOrder', width: 14 },
  ];
  styleHeader(orgSheet, 6);
  orgSheet.addRow(['KT-001', 'Phòng Kỹ thuật', 'dept', '', 'Phòng phát triển phần mềm', 1]);
  addDropdown(orgSheet, 3, 2, DATA_ROWS + 1, `"${ORG_TYPE_OPTIONS.join(',')}"`, 'dept hoặc team');
  orgSheet.getRow(2).eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFECFDF5' } };
  });

  // ── Sheet: JobPositions ───────────────────────────────────────────────────
  const posSheet = wb.addWorksheet('JobPositions', { properties: { tabColor: { argb: 'FFFF9800' } } });
  posSheet.columns = [
    { header: 'code *', key: 'code', width: 16 },
    { header: 'title *', key: 'title', width: 35 },
    { header: 'level', key: 'level', width: 12 },
    { header: 'catalogCode', key: 'catalogCode', width: 16 },
    { header: 'orgCode', key: 'orgCode', width: 16 },
    { header: 'competencyFrameworkCode', key: 'competencyFrameworkCode', width: 26 },
    { header: 'learningPathCode', key: 'learningPathCode', width: 20 },
    { header: 'description', key: 'description', width: 40 },
  ];
  styleHeader(posSheet, 8);
  posSheet.addRow(['SE-CAO', 'Kỹ sư phần mềm cấp cao', 'senior', catalogs[0]?.code ?? '', orgs[0]?.code ?? '', frameworks[0]?.code ?? '', paths[0]?.code ?? '', '']);
  posSheet.getRow(2).eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF8E1' } };
  });
  addDropdown(posSheet, 3, 2, DATA_ROWS + 1, `"${LEVEL_OPTIONS.join(',')}"`, 'Chọn cấp bậc');
  if (catalogs.length > 0)
    addDropdown(posSheet, 4, 2, DATA_ROWS + 1, `REF_ChucDanh!$A$2:$A$${catalogs.length + 1}`, 'Chọn mã chức danh từ danh mục');
  if (orgs.length > 0)
    addDropdown(posSheet, 5, 2, DATA_ROWS + 1, `REF_PhongBan!$A$2:$A$${orgs.length + 1}`, 'Chọn mã phòng ban');
  if (frameworks.length > 0)
    addDropdown(posSheet, 6, 2, DATA_ROWS + 1, `REF_Framework!$A$2:$A$${frameworks.length + 1}`, 'Chọn mã khung năng lực');
  if (paths.length > 0)
    addDropdown(posSheet, 7, 2, DATA_ROWS + 1, `REF_LoDinh!$A$2:$A$${paths.length + 1}`, 'Chọn mã lộ trình học');

  // ── Sheet: Users ──────────────────────────────────────────────────────────
  const usrSheet = wb.addWorksheet('Users', { properties: { tabColor: { argb: 'FF2196F3' } } });
  usrSheet.columns = [
    { header: 'email *', key: 'email', width: 30 },
    { header: 'fullName *', key: 'fullName', width: 28 },
    { header: 'employeeCode', key: 'employeeCode', width: 16 },
    { header: 'role *', key: 'role', width: 16 },
    { header: 'orgCode', key: 'orgCode', width: 16 },
    { header: 'positionCode', key: 'positionCode', width: 18 },
    { header: 'jobTitle', key: 'jobTitle', width: 28 },
    { header: 'jobLevel', key: 'jobLevel', width: 12 },
    { header: 'password', key: 'password', width: 18 },
  ];
  styleHeader(usrSheet, 9);
  usrSheet.addRow(['nguyen.van.a@company.vn', 'Nguyễn Văn A', 'EMP001', 'learner', orgs[0]?.code ?? '', positions[0]?.code ?? '', '', '', 'ChangeMe@123']);
  usrSheet.getRow(2).eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE3F2FD' } };
  });
  addDropdown(usrSheet, 4, 2, DATA_ROWS + 1, `"${ROLE_OPTIONS.join(',')}"`, 'Chọn vai trò');
  if (orgs.length > 0)
    addDropdown(usrSheet, 5, 2, DATA_ROWS + 1, `REF_PhongBan!$A$2:$A$${orgs.length + 1}`, 'Chọn mã phòng ban');
  if (positions.length > 0)
    addDropdown(usrSheet, 6, 2, DATA_ROWS + 1, `REF_ViTri!$A$2:$A$${positions.length + 1}`, 'Chọn mã vị trí');
  addDropdown(usrSheet, 8, 2, DATA_ROWS + 1, `"${LEVEL_OPTIONS.join(',')}"`, 'Chọn cấp bậc');

  // ── REF_ChucDanh (hidden) ─────────────────────────────────────────────────
  const refCatalog = wb.addWorksheet('REF_ChucDanh');
  refCatalog.state = 'veryHidden';
  refCatalog.addRow(['Mã chức danh', 'Tên chức danh', 'Cấp bậc', 'Nhóm']);
  catalogs.forEach((c) => refCatalog.addRow([c.code, c.title, c.level ?? '', c.category ?? '']));
  refCatalog.getColumn(1).width = 20;
  refCatalog.getColumn(2).width = 35;

  // ── REF_PhongBan (hidden) ─────────────────────────────────────────────────
  const refOrg = wb.addWorksheet('REF_PhongBan');
  refOrg.state = 'veryHidden';
  refOrg.addRow(['Mã phòng ban', 'Tên phòng ban', 'Loại']);
  orgs.forEach((o) => refOrg.addRow([o.code ?? '', o.name, o.type]));
  refOrg.getColumn(1).width = 18;
  refOrg.getColumn(2).width = 30;

  // ── REF_Framework (hidden) ────────────────────────────────────────────────
  const refFw = wb.addWorksheet('REF_Framework');
  refFw.state = 'veryHidden';
  refFw.addRow(['Mã framework', 'Tên', 'Phiên bản']);
  frameworks.forEach((f) => refFw.addRow([f.code ?? '', f.name, f.version ?? '']));
  refFw.getColumn(1).width = 20;
  refFw.getColumn(2).width = 35;

  // ── REF_LoDinh (hidden) ───────────────────────────────────────────────────
  const refPath = wb.addWorksheet('REF_LoDinh');
  refPath.state = 'veryHidden';
  refPath.addRow(['Mã lộ trình', 'Tên lộ trình']);
  paths.forEach((p) => refPath.addRow([p.code ?? '', p.title]));
  refPath.getColumn(1).width = 18;
  refPath.getColumn(2).width = 35;

  // ── REF_ViTri (hidden) ────────────────────────────────────────────────────
  const refPos = wb.addWorksheet('REF_ViTri');
  refPos.state = 'veryHidden';
  refPos.addRow(['Mã vị trí', 'Tên vị trí']);
  positions.forEach((p) => refPos.addRow([p.code ?? '', p.title]));
  refPos.getColumn(1).width = 18;
  refPos.getColumn(2).width = 35;

  // ── Sheet: Hướng_Dẫn ─────────────────────────────────────────────────────
  const instrSheet = wb.addWorksheet('Huong_Dan', { properties: { tabColor: { argb: 'FF9C27B0' } } });
  instrSheet.columns = [
    { header: 'Sheet', width: 18 },
    { header: 'Cột', width: 26 },
    { header: 'Bắt buộc', width: 12 },
    { header: 'Mô tả', width: 50 },
    { header: 'Ghi chú', width: 40 },
  ];
  styleHeader(instrSheet, 5);
  const instrData: string[][] = [
    ['OrgChart', 'code', 'Bắt buộc', 'Mã phòng ban duy nhất trong công ty', ''],
    ['OrgChart', 'name', 'Bắt buộc', 'Tên phòng ban/team', ''],
    ['OrgChart', 'type', 'Bắt buộc', 'Loại tổ chức', 'dept hoặc team'],
    ['OrgChart', 'parentCode', 'Tùy chọn', 'Mã đơn vị cấp trên', ''],
    ['JobPositions', 'code', 'Bắt buộc', 'Mã vị trí duy nhất trong công ty', ''],
    ['JobPositions', 'title', 'Bắt buộc', 'Tên vị trí công việc', ''],
    ['JobPositions', 'level', 'Tùy chọn', 'Cấp bậc — chọn từ dropdown', 'junior/mid/senior/lead/manager/director/c_level'],
    ['JobPositions', 'catalogCode', 'Tùy chọn', 'Mã từ danh mục chức danh', 'Chọn từ dropdown REF_ChucDanh'],
    ['JobPositions', 'orgCode', 'Tùy chọn', 'Mã phòng ban', 'Chọn từ dropdown REF_PhongBan'],
    ['JobPositions', 'competencyFrameworkCode', 'Tùy chọn', 'Mã khung năng lực', 'Chọn từ dropdown REF_Framework'],
    ['JobPositions', 'learningPathCode', 'Tùy chọn', 'Mã lộ trình học tập', 'Chọn từ dropdown REF_LoDinh'],
    ['Users', 'email', 'Bắt buộc', 'Email đăng nhập — phải duy nhất', ''],
    ['Users', 'fullName', 'Bắt buộc', 'Họ và tên đầy đủ', ''],
    ['Users', 'role', 'Bắt buộc', 'Vai trò hệ thống — chọn từ dropdown', 'learner/instructor/hr_manager/company_admin'],
    ['Users', 'orgCode', 'Tùy chọn', 'Mã phòng ban', 'Chọn từ dropdown REF_PhongBan'],
    ['Users', 'positionCode', 'Tùy chọn', 'Mã vị trí công việc', 'Chọn từ dropdown REF_ViTri'],
    ['Users', 'employeeCode', 'Tùy chọn', 'Mã nhân viên nội bộ', ''],
    ['Users', 'password', 'Tùy chọn', 'Mật khẩu ban đầu', 'Mặc định: ChangeMe@123'],
  ];
  instrData.forEach((row) => instrSheet.addRow(row));
  instrSheet.addRow([]);
  instrSheet.addRow(['📌 Lưu ý quan trọng:', '', '', '', '']);
  instrSheet.addRow(['1. Thứ tự import:', '', '', 'OrgChart → JobPositions → Users', '']);
  instrSheet.addRow(['2. Sheet REF_*:', '', '', 'Chứa dữ liệu tham chiếu — KHÔNG xóa hoặc sửa', '']);
  instrSheet.addRow(['3. Hàng màu xanh lá:', '', '', 'Dữ liệu mẫu — có thể xóa trước khi import', '']);

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

// ── Route handler ──────────────────────────────────────────────────────────

export const GET = async (req: NextRequest) => {
  const type = req.nextUrl.searchParams.get('type') ?? 'users';

  // Full template requires auth (company-scoped)
  if (type === 'full') {
    return withRole(
      ['group_admin', 'company_admin', 'hr_manager'],
      async (_req, { companyId }) => {
        try {
          const buffer = await buildFullTemplate(companyId);
          return new NextResponse(buffer, {
            headers: {
              'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
              'Content-Disposition': 'attachment; filename="template_nhansu_day_du.xlsx"',
            },
          });
        } catch (err) {
          return handleApiError(err);
        }
      },
    )(req, { params: Promise.resolve({}) });
  }

  // Legacy simple templates — no auth
  if (!SIMPLE_TEMPLATES[type]) {
    return NextResponse.json({ success: false, error: 'Loại template không hợp lệ. Dùng: users | org_chart | job_positions | full' }, { status: 400 });
  }

  const buffer = buildSimpleTemplate(type);
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="template_${type}.xlsx"`,
    },
  });
};
