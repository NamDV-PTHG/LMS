# PROMPT CHO CLAUDE CLI — Chuẩn hóa giao diện danh sách quản trị (mẫu A: table)

## Bối cảnh
Dự án LMS Phú Thái Holdings (Next.js 14 App Router, TypeScript, Tailwind CSS, shadcn/ui, Prisma).
Hiện tại 5 trang quản trị sau đang hiển thị danh sách theo các kiểu không đồng nhất (card rời rạc, bảng tự phát riêng lẻ...):

| Trang | Route | Kiểu hiện tại |
|---|---|---|
| Lộ trình học | `/learning-paths` | Card rời, mỗi item 1 khối card riêng |
| Nhóm học tập | `/learning-groups` | Card lưới 2 cột |
| Khung năng lực | `/competency-frameworks` | Card rời, mỗi item 1 khối card riêng |
| Vị trí công việc | `/positions` | Bảng tự phát, badge màu không đồng bộ |
| Ngân hàng câu hỏi | `/question-banks` | Card lưới 3 cột |

**Yêu cầu:** thiết kế lại đồng bộ theo 1 pattern chung — dạng bảng (table) gọn gàng kiểu dashboard quản trị, dùng chung 1 component `AdminDataTable` + 1 component `StatusBadge`, áp dụng cho cả 5 trang trên.

## Trước khi code — Claude CLI cần làm gì trước
1. Đọc `LMS_MASTER_SPEC.md`, `DESIGN_SYSTEM.md`, `tailwind.config.ts` hiện có để lấy đúng token màu, font, spacing đang dùng trong dự án — **không tự bịa token mới nếu đã có token tương đương**.
2. Scan Prisma schema các model liên quan (`LearningPath`, `LearningGroup`, `CompetencyFramework`, `Position`, `QuestionBank` hoặc tên tương ứng thực tế trong schema) để xác nhận tên field chính xác trước khi map vào cột bảng — nếu tên field trong schema khác với giả định bên dưới, ưu tiên theo schema thật.
3. Xác nhận lại danh sách route/thư mục components hiện tại (`app/(admin)/...` hoặc tương đương) trước khi tạo file mới, tránh trùng tên.
4. Nếu có gate xác nhận giữa các phase theo quy trình đang dùng của dự án, dừng lại xin xác nhận trước khi sang phase implement.

## Design tokens tham chiếu (từ mockup đã duyệt)
```
--brand-blue: #185FA5       /* header, border-accent, link/action text */
--page-bg: #F1EFE8          /* nền trang, nền header cột bảng */
--surface-white: #FFFFFF    /* nền bảng */
--border-hairline: #D3D1C7  /* viền khối bảng */
--border-row: #E8E6DF       /* viền giữa các hàng */
--text-primary: #2C2C2A
--text-secondary: #5F5E5A
--text-muted: #888780

/* badge status — nền nhạt (50/100) + chữ đậm (800/900) cùng ramp */
success (Hoạt động / Đang mở / Sẵn sàng / Đã xuất bản): bg #EAF3DE, text #3B6D11
warning (Chưa có học viên / Tùy chỉnh / Trống):          bg #FAEEDA, text #854F0B
info    (Rule-based / Thủ công):                          bg #E6F1FB hoặc #EEEDFE, text #0C447C / #3C3489
neutral (Trống / không dữ liệu):                          bg #F1EFE8, text #5F5E5A

radius bảng: 10px | radius badge: 20px (pill) | radius nút: 6px
border mọi nơi: 0.5px solid (không dùng border dày 1px+)
```

## 1. Component dùng chung: `AdminDataTable`

Vị trí đề xuất: `components/admin/AdminDataTable.tsx` (điều chỉnh theo cấu trúc thư mục thật của dự án).

**Props:**
```ts
interface AdminColumn<T> {
  key: string;
  header: string;
  width?: string;          // vd '30%'
  align?: 'left' | 'right' | 'center';
  render: (row: T) => React.ReactNode;
}

interface AdminDataTableProps<T> {
  title: string;              // vd "Lộ trình học tập"
  description?: string;       // vd "Xây dựng lộ trình học cho từng vị trí công việc"
  headerLabel: string;        // label trên thanh header xanh, vd "Lộ trình học"
  primaryAction?: { label: string; onClick: () => void };
  columns: AdminColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  emptyState?: React.ReactNode;
}
```

**Yêu cầu style (Tailwind, dùng token ở trên qua `tailwind.config.ts`, không hardcode hex nếu đã có token tương ứng):**
- Header xanh brand, chữ trắng, nút primary action nền trắng chữ xanh.
- Khối bảng: nền trắng, border hairline, radius 10px, overflow hidden.
- Header row của bảng: nền `--page-bg`, chữ `--text-secondary`, font-weight 500.
- Mỗi data row: border-top hairline `--border-row`, padding dọc ~12px, không có border dọc giữa các cột (giữ tối giản).
- Row hover: nền nhạt hơn 1 chút (dùng token surface hover nếu có).
- Cột cuối luôn là "Thao tác", căn phải, chứa 1+ nút outline nhỏ (border 0.5px màu xanh nhạt, chữ xanh brand, radius 6px, padding 5px 12px, font-size 12px).
- Responsive: nếu bảng > 700px nội dung, cho phép scroll ngang trên wrapper thay vì vỡ layout.

## 2. Component dùng chung: `StatusBadge`

Vị trí đề xuất: `components/admin/StatusBadge.tsx`.

```ts
type BadgeVariant = 'success' | 'warning' | 'info-purple' | 'info-blue' | 'neutral';

interface StatusBadgeProps {
  label: string;
  variant: BadgeVariant;
}
```
Style: pill (radius 20px), font-size 12px, padding 3px 10px, màu nền/chữ theo bảng variant ở mục tokens trên. Không dùng đen/xám mặc định cho chữ trên nền màu — luôn dùng đúng stop đậm cùng ramp.

## 3. Áp dụng cho từng trang

### 3.1 Lộ trình học (`/learning-paths`)
Cột: Tên lộ trình | Trạng thái (`success`="Đang mở" nếu có học viên, `warning`="Chưa có học viên" nếu 0) | Bước học | Học viên | Hạn (nếu có hạn thì text màu coral/đỏ nhạt nhấn nhẹ, không có thì "-") | toggle Hiển thị (giữ nguyên logic ẩn/hiện hiện tại) | Thao tác: nút "Xây dựng".

### 3.2 Nhóm học tập (`/learning-groups`)
Cột: Tên nhóm | Loại (`info-purple`="Rule-based", `warning`="Ngoài hệ thống", `info-blue`="Thủ công" — giữ đúng 3 loại đang có) | Thành viên | Khóa học | Thao tác: nút "Quản lý".

### 3.3 Khung năng lực (`/competency-frameworks`)
Cột: Tên khung | Phiên bản (text thường, vd "v1.0") | Trạng thái (`success`="Đã xuất bản") | Lĩnh vực | Vị trí sử dụng | Thao tác: nút "Chỉnh sửa".

### 3.4 Vị trí công việc (`/positions`)
Cột: Vị trí (dòng 1: tên + badge "Tùy chỉnh" nếu có, dòng 2 nhỏ: mã vị trí) | Cấp bậc | Khung NL (link màu tím nếu có, "—" nếu chưa gắn) | Nhân viên | Trạng thái (`success`="Hoạt động") | Thao tác: giữ 3 hành động hiện có (Sửa / Khung NL / Ẩn) nhưng style lại thành nút outline nhỏ đồng bộ, không phải link text rời rạc như hiện tại.

### 3.5 Ngân hàng câu hỏi (`/question-banks`)
Cột: Tên ngân hàng | Mô tả (rút gọn 1 dòng, `line-clamp-1` hoặc `text-overflow: ellipsis`) | Số câu hỏi | Trạng thái (`success`="Sẵn sàng" nếu >0 câu hỏi, `neutral`="Trống" nếu 0) | Thao tác: nút "Quản lý".

## 4. Việc cần làm (thứ tự thực hiện)
1. Tạo `AdminDataTable` và `StatusBadge` trong `components/admin/`.
2. Refactor lần lượt từng trang trong bảng mục 3, thay phần render danh sách card/bảng cũ bằng `<AdminDataTable columns={...} rows={...} />`, giữ nguyên toàn bộ logic fetch data, phân quyền RBAC, và action handler hiện có — chỉ thay lớp trình bày.
3. Không đổi route, không đổi API/query hiện tại.
4. Kiểm tra lại trên 3 role có quyền truy cập các trang này (`group_admin`, `group_hrm`, `company_admin` tùy trang) để đảm bảo nút thao tác vẫn ẩn/hiện đúng theo RBAC như bản cũ.
5. Build thử trên môi trường Artifact/dev trước khi đẩy lên staging, đối chiếu với `DESIGN_SYSTEM.md` để tránh lệch style giữa Artifact và production build (theo nguyên tắc đã ghi trong dự án).

## 5. Tiêu chí nghiệm thu
- [ ] Cả 5 trang dùng chung `AdminDataTable` và `StatusBadge`, không còn CSS badge/card viết tay riêng lẻ theo từng trang.
- [ ] Không có border dày, không có gradient/shadow trang trí.
- [ ] Badge dùng đúng bảng màu variant ở mục tokens, nhất quán ý nghĩa (success/warning/info/neutral) xuyên suốt 5 trang.
- [ ] Toàn bộ logic nghiệp vụ (RBAC, toggle hiển thị, đếm số liệu) hoạt động y hệt trước khi refactor.
- [ ] Responsive không vỡ layout ở màn 1920×1080 (server) và ở màn thu nhỏ trình duyệt.
