# HƯỚNG DẪN SỬ DỤNG HỆ THỐNG LMS
## Dành cho Quản trị viên Công ty (Company Admin)

**Phiên bản tài liệu:** 1.0  
**Ngày ban hành:** 07/07/2026  
**Đối tượng áp dụng:** Quản trị viên công ty, Quản lý HR

---

## MỤC LỤC

1. [Giới thiệu tài liệu](#1-giới-thiệu-tài-liệu)
2. [Tổng quan hệ thống & vai trò](#2-tổng-quan-hệ-thống--vai-trò)
3. [Đăng nhập hệ thống](#3-đăng-nhập-hệ-thống)
4. [Bước 1 — Cài đặt thương hiệu & giao diện](#4-bước-1--cài-đặt-thương-hiệu--giao-diện)
5. [Bước 2 — Cấu hình email](#5-bước-2--cấu-hình-email)
6. [Bước 3 — Thiết lập cơ cấu tổ chức](#6-bước-3--thiết-lập-cơ-cấu-tổ-chức)
7. [Bước 4 — Nhập dữ liệu người dùng](#7-bước-4--nhập-dữ-liệu-người-dùng)
8. [Bước 5 — Phân quyền người dùng](#8-bước-5--phân-quyền-người-dùng)
9. [Bước 6 — Thiết lập vị trí công việc](#9-bước-6--thiết-lập-vị-trí-công-việc)
10. [Dashboard Admin — Theo dõi tổng quan](#10-dashboard-admin--theo-dõi-tổng-quan)
11. [Báo cáo công ty](#11-báo-cáo-công-ty)
12. [Sao lưu & khôi phục dữ liệu](#12-sao-lưu--khôi-phục-dữ-liệu)
13. [Phụ lục](#13-phụ-lục)

---

## 1. GIỚI THIỆU TÀI LIỆU

### 1.1 Đối tượng sử dụng

Tài liệu này được biên soạn dành riêng cho:

- **Quản trị viên công ty (Company Admin):** Người được phân công quản lý toàn bộ hệ thống LMS của một công ty con trong tập đoàn. Có quyền tạo người dùng, quản lý phòng ban, cài đặt thương hiệu, và theo dõi báo cáo.
- **Quản lý nhân sự (HR Manager):** Người hỗ trợ công tác quản lý người dùng, phân quyền, và theo dõi tuân thủ đào tạo. Có quyền hạn tương tự Company Admin trên phần lớn chức năng.

Người đọc tài liệu này cần có kiến thức cơ bản về sử dụng máy tính và trình duyệt web. Không yêu cầu kiến thức kỹ thuật chuyên sâu.

### 1.2 Phạm vi tài liệu

Tài liệu này hướng dẫn đầy đủ các tác nghiệp vận hành hệ thống LMS từ góc độ quản trị công ty, bao gồm:

- Thiết lập ban đầu hệ thống (thương hiệu, email, cơ cấu tổ chức)
- Quản lý người dùng và phân quyền
- Thiết lập vị trí công việc và khung năng lực
- Theo dõi báo cáo và tuân thủ đào tạo
- Sao lưu và khôi phục dữ liệu (dành cho Group Admin)

Tài liệu **không** bao gồm: quản lý nội dung khóa học (xem tài liệu riêng), quản lý hệ thống kỹ thuật (xem tài liệu IT), hoặc chức năng học viên.

### 1.3 Quy ước ký hiệu sử dụng trong tài liệu

Trong suốt tài liệu này, các ký hiệu sau được sử dụng thống nhất:

| Ký hiệu | Ý nghĩa |
|---------|---------|
| **Tên trường** | Tên trường nhập liệu trên giao diện, ví dụ **Email**, **Họ và tên** |
| `Nút bấm` | Nút bấm hoặc liên kết trên giao diện, ví dụ `Lưu cài đặt`, `Tạo mới` |
| *Menu → Mục con* | Đường dẫn điều hướng trên thanh menu |
| ① ② ③ | Thứ tự các bước thực hiện |

> 💡 **Lưu ý:** Hộp này chứa thông tin bổ sung hoặc mẹo hữu ích.

> ⚠️ **Cảnh báo:** Hộp này cảnh báo hành động có thể gây hậu quả không mong muốn.

> 📸 **[HÌNH X.Y]** Placeholder ảnh chụp màn hình minh họa.

---

## 2. TỔNG QUAN HỆ THỐNG & VAI TRÒ

### 2.1 Sơ đồ các vai trò trong hệ thống

Hệ thống LMS được tổ chức theo mô hình phân cấp tập đoàn — công ty con — phòng ban. Tương ứng với cấu trúc tổ chức đó, hệ thống có các vai trò (role) sau:

```
Tập đoàn
├── Group Admin         ← Quản trị toàn tập đoàn
├── Group HRM           ← HRM cấp tập đoàn
│
└── Công ty con A
    ├── Company Admin   ← Quản trị công ty (vai trò chính trong tài liệu này)
    ├── HR Manager      ← Quản lý nhân sự công ty
    ├── Instructor      ← Giảng viên / Người tạo nội dung
    └── Learner         ← Học viên
```

### 2.2 Quyền hạn từng vai trò (bảng tổng hợp)

| Chức năng | Group Admin | Company Admin | HR Manager | Instructor | Learner |
|-----------|:-----------:|:-------------:|:----------:|:----------:|:-------:|
| Quản lý tổ chức (toàn tập đoàn) | ✅ | ❌ | ❌ | ❌ | ❌ |
| Tạo phòng ban / nhóm | ✅ | ✅ | ✅ | ❌ | ❌ |
| Tạo & quản lý người dùng | ✅ | ✅ | ✅ | ❌ | ❌ |
| Phân quyền (gán role) | ✅ | ✅ | ✅ | ❌ | ❌ |
| Cài đặt thương hiệu | ✅ | ✅ | ✅ | ❌ | ❌ |
| Cấu hình email SMTP | ✅ | ✅ | ✅ | ❌ | ❌ |
| Cấu hình Backup Storage | ✅ | ❌ | ❌ | ❌ | ❌ |
| Xem báo cáo công ty | ✅ | ✅ | ✅ | ❌ | ❌ |
| Tạo & quản lý khóa học | ✅ | ❌ | ❌ | ✅ | ❌ |
| Sao lưu / khôi phục hệ thống | ✅ | ❌ | ❌ | ❌ | ❌ |
| Tham gia học khóa học | ❌ | ❌ | ❌ | ❌ | ✅ |
| Bật tính năng AI cho người dùng | ✅ | ✅ | ✅ | ❌ | ❌ |

> 💡 **Lưu ý:** Một người dùng có thể có nhiều vai trò cùng lúc. Ví dụ: một HR Manager vừa có vai trò `hr_manager` vừa có vai trò `learner` để vừa quản lý vừa có thể học khóa học.

### 2.3 Flowchart thứ tự thiết lập hệ thống từ đầu

Khi bắt đầu sử dụng hệ thống lần đầu tiên, hãy thực hiện theo thứ tự sau đây. Việc thiết lập đúng thứ tự giúp tránh phải quay lại chỉnh sửa sau:

```
[Bắt đầu]
    │
    ▼
① Đăng nhập & đổi mật khẩu lần đầu
    │
    ▼
② Cài đặt thương hiệu & giao diện (Settings → Thương hiệu)
    │ Logo, màu sắc, trang đăng nhập
    ▼
③ Cấu hình email SMTP (Settings → Mail Server)
    │ Để hệ thống gửi email chào mừng, reset mật khẩu
    ▼
④ Thiết lập cơ cấu tổ chức (Organizations)
    │ Tạo phòng ban, nhóm trực thuộc công ty
    ▼
⑤ Nhập dữ liệu người dùng (Users)
    │ Tạo thủ công hoặc import hàng loạt từ Excel
    ▼
⑥ Phân quyền người dùng
    │ Gán role phù hợp cho từng nhân viên
    ▼
⑦ Thiết lập vị trí công việc (Positions)
    │ Gán khung năng lực và lộ trình học tập
    ▼
⑧ Theo dõi hoạt động qua Dashboard & Reports
    │
    ▼
[Vận hành thường xuyên]
```

---

## 3. ĐĂNG NHẬP HỆ THỐNG

### 3.1 Truy cập đường dẫn web

Hệ thống LMS là ứng dụng web, truy cập hoàn toàn qua trình duyệt — không cần cài đặt phần mềm.

1. Mở trình duyệt web (khuyến nghị: **Google Chrome** phiên bản mới nhất, hoặc **Microsoft Edge**).
2. Nhập địa chỉ web vào thanh địa chỉ: địa chỉ này do bộ phận IT công ty cung cấp, ví dụ: `https://lms.congtycuaban.vn`
3. Nhấn **Enter** để tải trang.

> 💡 **Lưu ý:** Nên đánh dấu (bookmark) địa chỉ này để truy cập nhanh trong các lần sau. Hệ thống hoạt động tốt nhất trên Chrome và Edge phiên bản mới nhất. Không hỗ trợ Internet Explorer.

> 📸 **[HÌNH 3.1]** Trang đăng nhập với logo công ty, ô nhập email và mật khẩu.

### 3.2 Đăng nhập với email & mật khẩu

1. Tại trang đăng nhập, nhập **Email** của bạn vào ô đầu tiên. Email này thường có dạng `ten.ho@congtycuaban.vn`.
2. Nhập **Mật khẩu** vào ô thứ hai.
3. Nhấn nút `Đăng nhập`.
4. Nếu thông tin đúng, hệ thống sẽ chuyển thẳng đến trang Dashboard.
5. Nếu thông tin sai, hệ thống hiển thị thông báo lỗi — hãy kiểm tra lại email và mật khẩu.

> ⚠️ **Cảnh báo:** Sau 5 lần đăng nhập sai liên tiếp, tài khoản có thể bị khóa tạm thời. Hãy liên hệ Quản trị tập đoàn nếu bị khóa.

> 💡 **Lưu ý:** Nếu quên mật khẩu, nhấn liên kết `Quên mật khẩu?` tại trang đăng nhập. Hệ thống sẽ gửi email đặt lại mật khẩu về địa chỉ email đã đăng ký.

### 3.3 Đổi mật khẩu lần đầu (bắt buộc)

Nếu tài khoản vừa được tạo bởi quản trị viên, hệ thống yêu cầu bạn đổi mật khẩu ngay khi đăng nhập lần đầu:

1. Sau khi đăng nhập, hệ thống hiển thị màn hình **Đổi mật khẩu**.
2. Nhập **Mật khẩu hiện tại** (mật khẩu được cấp ban đầu).
3. Nhập **Mật khẩu mới** — mật khẩu phải có ít nhất 8 ký tự, bao gồm chữ hoa, chữ thường và số.
4. Nhập lại **Xác nhận mật khẩu mới** để đảm bảo nhập đúng.
5. Nhấn `Đổi mật khẩu`.
6. Hệ thống xác nhận thành công và chuyển đến Dashboard.

> 💡 **Lưu ý:** Hãy lưu mật khẩu mới ở nơi an toàn. Không chia sẻ mật khẩu với người khác. Bạn có thể thay đổi mật khẩu bất cứ lúc nào qua mục **Hồ sơ cá nhân**.

### 3.4 Giao diện tổng quan sau đăng nhập (Dashboard)

Sau khi đăng nhập thành công với vai trò Company Admin, bạn sẽ thấy màn hình Dashboard với các thành phần chính:

- **Thanh điều hướng trái (Sidebar):** Danh sách các mục chức năng chính.
- **Vùng nội dung chính:** Hiển thị nội dung của mục đang chọn.
- **Thanh tiêu đề trên cùng (Header):** Tên trang hiện tại, thông tin người dùng, nút đăng xuất.

Tại Dashboard, bạn thấy ngay các **thẻ chỉ số KPI** tổng quan:
- Tổng số người dùng
- Tổng số khóa học
- Tổng lượt đăng ký học
- Tỉ lệ hoàn thành
- Tỉ lệ tuân thủ đào tạo bắt buộc

> 📸 **[HÌNH 3.4]** Màn hình Dashboard với 5 thẻ KPI và bảng thống kê khóa học.

### 3.5 Ý nghĩa các mục trên thanh điều hướng (Sidebar)

| Mục menu | Biểu tượng | Chức năng |
|----------|-----------|-----------|
| Dashboard | 📊 | Trang tổng quan với thống kê và chỉ số KPI |
| Organizations | 🏢 | Quản lý phòng ban và cơ cấu tổ chức |
| Users | 👥 | Danh sách và quản lý tài khoản người dùng |
| Courses | 📚 | Danh sách khóa học (xem, không tạo) |
| Learning Paths | 🗺️ | Lộ trình học tập |
| Positions | 💼 | Vị trí công việc và khung năng lực |
| Reports | 📈 | Báo cáo và thống kê |
| Settings | ⚙️ | Cài đặt thương hiệu và email |
| Operations | 🔧 | Vận hành hệ thống (Group Admin) |

---

## 4. BƯỚC 1 — CÀI ĐẶT THƯƠNG HIỆU & GIAO DIỆN

**Mục đích:** Tùy chỉnh giao diện hệ thống theo nhận diện thương hiệu của công ty: logo, màu sắc, tiêu đề trang, và trang đăng nhập.

**Điều hướng:** Sidebar → `Settings` → Tab `Thương hiệu & Giao diện`

### 4.1 Chọn tổ chức cần thiết lập

Khi mở trang Settings, mục đầu tiên là **Chọn tổ chức**:

1. Nhấn vào ô dropdown **Chọn tổ chức**.
2. Danh sách hiển thị tất cả các công ty/đơn vị mà bạn có quyền quản lý.
3. Chọn tên công ty cần thiết lập thương hiệu.
4. Hệ thống tự động tải cài đặt hiện tại của tổ chức đó.

> 💡 **Lưu ý:** Với vai trò Company Admin, bạn chỉ thấy công ty của mình trong danh sách. Group Admin có thể thấy nhiều công ty và chọn từng công ty để cài đặt riêng biệt.

> 📸 **[HÌNH 4.1]** Dropdown chọn tổ chức với danh sách các công ty con.

### 4.2 Upload logo công ty

Logo sẽ hiển thị ở góc trên bên trái của giao diện và trên trang đăng nhập.

1. Tại mục **Logo công ty**, nhấn nút `Chọn ảnh từ máy tính`.
2. Hộp thoại chọn file mở ra — tìm và chọn file logo của công ty.
3. Nhấn `Mở` để xác nhận.
4. Hệ thống upload file và hiển thị xem trước logo trong ô vuông bên trái.

**Yêu cầu kỹ thuật cho file logo:**
- Định dạng: JPG, PNG, SVG, hoặc WebP
- Kích thước tối đa: 2MB
- Khuyến nghị: Ảnh nền trong suốt (PNG hoặc SVG) với tỷ lệ 16:9 hoặc vuông

**Hoặc sử dụng URL trực tuyến:**

Nếu logo đã được lưu trữ trực tuyến (ví dụ trên website công ty), bạn có thể dán đường dẫn URL vào ô nhập liệu bên dưới nút upload.

> 📸 **[HÌNH 4.2]** Khu vực upload logo với ô xem trước và nút "Chọn ảnh từ máy tính".

> 💡 **Lưu ý:** Sau khi upload logo, hình ảnh được lưu tự động trên máy chủ. Bạn vẫn cần nhấn `Lưu cài đặt` ở cuối trang để áp dụng tất cả thay đổi.

### 4.3 Cài đặt tiêu đề & favicon tab trình duyệt

**Tiêu đề tab (Site Title):**

1. Tìm mục **Tiêu đề tab (title)**.
2. Nhập tên hiển thị trên tab trình duyệt, ví dụ: `LMS — Công ty ABC`.
3. Nếu để trống, hệ thống tự dùng tên hiển thị của tổ chức.

**Mô tả website (Site Description):**

1. Nhập đoạn mô tả ngắn vào ô **Mô tả website (description)**.
2. Mô tả này dùng cho SEO và khi chia sẻ liên kết lên mạng xã hội.
3. Ví dụ: `Hệ thống đào tạo trực tuyến của Công ty ABC — Nâng cao năng lực toàn diện`.

**Favicon (Icon tab trình duyệt):**

Favicon là biểu tượng nhỏ hiển thị trên tab trình duyệt, thường là logo thu nhỏ của công ty.

1. Tìm mục **Icon tab trình duyệt (Favicon)**.
2. Nhấn nút `Tải lên icon`.
3. Chọn file ảnh vuông, kích thước khuyến nghị: **32×32px** hoặc **64×64px**.
4. Định dạng hỗ trợ: PNG, ICO, SVG, WebP.
5. Ảnh xem trước hiển thị ngay trong ô vuông nhỏ bên trái.
6. Để xóa favicon hiện tại: nhấn nút `Xóa` (biểu tượng X màu đỏ).

> ⚠️ **Cảnh báo:** Favicon phải là ảnh vuông. Ảnh chữ nhật sẽ bị cắt xén hoặc hiển thị méo mó trên tab trình duyệt.

> 📸 **[HÌNH 4.3]** Khu vực cài đặt favicon với ô xem trước nhỏ và nút "Tải lên icon".

### 4.4 Chọn màu sắc giao diện (8 bảng màu preset)

Hệ thống cung cấp 8 bảng màu được thiết kế sẵn (preset) phù hợp với các phong cách thương hiệu khác nhau:

| Tên preset | Mô tả màu sắc | Phù hợp với |
|-----------|--------------|------------|
| **Đại dương (Ocean)** | Xanh dương — xanh lá | Công ty tài chính, bảo hiểm |
| **Hoàng hôn (Sunset)** | Cam đất — vàng | Công ty thương mại, bán lẻ |
| **Rừng xanh (Forest)** | Xanh đậm — xanh lá | Công ty môi trường, nông nghiệp |
| **Tím hoàng (Purple)** | Tím sẫm — tím nhạt | Công ty công nghệ, sáng tạo |
| **Xám đá (Slate)** | Xám đen — xám nhạt | Tổ chức nghiêm túc, chuyên nghiệp |
| **Hồng đào (Rose)** | Đỏ hồng — đỏ tươi | Công ty thời trang, làm đẹp |
| **Bầu trời (Sky)** | Xanh biển — xanh nhạt | Công ty hàng không, du lịch |
| **Hổ phách (Amber)** | Nâu vàng — vàng nhạt | Công ty giáo dục, xuất bản |

**Cách chọn bảng màu:**

1. Tại mục **Giao diện màu sắc**, bạn thấy 8 ô màu được sắp xếp thành lưới 4 cột.
2. Nhấn vào ô màu mong muốn — ô được chọn sẽ có viền đậm và dấu tích ✓ màu xanh ở góc trên phải.
3. Màu sắc giao diện áp dụng ngay cho phần xem trước trang đăng nhập bên dưới.
4. Nhấn `Lưu cài đặt` để áp dụng toàn bộ hệ thống.

> 📸 **[HÌNH 4.4]** Lưới 8 bảng màu preset với ô "Đại dương" đang được chọn (viền đậm, dấu tích xanh).

> 💡 **Lưu ý:** Màu sắc ảnh hưởng đến toàn bộ giao diện: thanh điều hướng, nút bấm, đường viền các ô nhập liệu, và biểu đồ. Hãy chọn màu phù hợp với bộ nhận diện thương hiệu của công ty.

### 4.5 Tùy chỉnh trang đăng nhập

Trang đăng nhập là điểm tiếp xúc đầu tiên của nhân viên với hệ thống. Tùy chỉnh để tạo ấn tượng chuyên nghiệp:

**Tiêu đề trang đăng nhập:**

1. Tìm mục **Trang đăng nhập** → ô **Tiêu đề**.
2. Nhập tiêu đề hiển thị trên form đăng nhập, ví dụ: `Hệ thống Đào tạo Nội bộ — Công ty ABC`.
3. Mặc định: `LMS Tập đoàn`.

**Mô tả phụ:**

1. Tại ô **Mô tả phụ**, nhập dòng chữ hiển thị bên dưới tiêu đề.
2. Ví dụ: `Đăng nhập để truy cập các khóa học và lộ trình phát triển của bạn`.
3. Mặc định: `Đăng nhập để tiếp tục`.

**Ảnh nền trang đăng nhập:**

1. Tại mục **Ảnh nền**, nhấn nút `Chọn file`.
2. Chọn ảnh chất lượng cao từ máy tính (JPG, PNG, WebP).
3. Hoặc dán URL ảnh trực tiếp vào ô nhập liệu bên phải.
4. Ảnh xem trước hiển thị ngay bên dưới.
5. Nếu không có ảnh nền, hệ thống dùng màu gradient từ bảng màu đã chọn.
6. Để xóa ảnh nền: nhấn nút X trên ảnh xem trước.

> 💡 **Lưu ý:** Khuyến nghị chọn ảnh nền có chiều rộng tối thiểu 1920px, chiều cao 1080px. Ảnh văn phòng công ty, cảnh thiên nhiên, hoặc ảnh trừu tượng chuyên nghiệp đều phù hợp.

### 4.6 Lưu và xem trước kết quả

Trước khi lưu, bạn có thể xem trước kết quả tại mục **Xem trước trang đăng nhập** ngay bên dưới — đây là mô phỏng thu nhỏ trang đăng nhập với tất cả cài đặt hiện tại.

1. Kiểm tra xem trước: đảm bảo logo, màu sắc, tiêu đề và ảnh nền hiển thị đúng.
2. Nếu hài lòng, cuộn xuống cuối trang và nhấn nút `Lưu cài đặt`.
3. Hệ thống hiển thị thông báo `Đã lưu cài đặt thành công` ở góc dưới màn hình.
4. Làm mới trang (F5) để thấy giao diện mới được áp dụng.

> 📸 **[HÌNH 4.6]** Khu vực xem trước trang đăng nhập với logo, gradient màu và form đăng nhập thu nhỏ.

> ⚠️ **Cảnh báo:** Nếu bạn thay đổi cài đặt nhưng không nhấn `Lưu cài đặt`, mọi thay đổi sẽ bị mất khi rời khỏi trang.

---

### ✅ CHECKLIST BƯỚC 1

- [ ] Đã chọn đúng tổ chức cần cài đặt
- [ ] Đã upload logo công ty (JPG/PNG/SVG/WebP, tối đa 2MB)
- [ ] Đã nhập tiêu đề tab trình duyệt
- [ ] Đã upload favicon (ảnh vuông 32×32 hoặc 64×64px)
- [ ] Đã chọn bảng màu phù hợp với thương hiệu
- [ ] Đã tùy chỉnh tiêu đề và mô tả phụ trang đăng nhập
- [ ] Đã xem trước và kiểm tra giao diện
- [ ] Đã nhấn `Lưu cài đặt` và nhận thông báo thành công

---

## 5. BƯỚC 2 — CẤU HÌNH EMAIL

**Điều hướng:** Sidebar → `Settings` → Tab `Mail Server`

### 5.1 Ý nghĩa và lý do cần cấu hình SMTP

SMTP (Simple Mail Transfer Protocol) là giao thức gửi email. Khi được cấu hình đúng, hệ thống LMS có thể tự động gửi:

- **Email chào mừng** khi tạo tài khoản mới, kèm thông tin đăng nhập
- **Email đặt lại mật khẩu** khi nhân viên nhấn "Quên mật khẩu"
- **Email thông báo** khi được gán vào khóa học hoặc lộ trình học
- **Email nhắc nhở** về hạn hoàn thành khóa học (nếu được cấu hình)

Nếu không cấu hình SMTP, bạn sẽ phải thông báo thông tin đăng nhập cho nhân viên theo cách thủ công, và nhân viên không thể tự đặt lại mật khẩu.

### 5.2 Các thông tin cần chuẩn bị

Trước khi vào trang cài đặt, hãy chuẩn bị sẵn các thông tin sau từ bộ phận IT hoặc nhà cung cấp email:

| Thông tin | Ví dụ | Ghi chú |
|-----------|-------|---------|
| SMTP Host | `smtp.gmail.com` | Địa chỉ máy chủ email |
| Port | `587` hoặc `465` | 587 = STARTTLS, 465 = SSL/TLS |
| SSL/TLS | Bật hoặc tắt | Tùy theo port |
| Tài khoản email | `noreply@congtyabc.vn` | Email dùng để gửi |
| Mật khẩu / App Password | `••••••••` | Mật khẩu hoặc app-specific password |
| Tên người gửi | `LMS Công ty ABC` | Hiển thị trong hộp thư người nhận |
| Email người gửi | `noreply@congtyabc.vn` | Địa chỉ hiển thị khi nhận |

**Thông tin SMTP phổ biến theo nhà cung cấp:**

| Nhà cung cấp | SMTP Host | Port | SSL/TLS |
|-------------|-----------|------|---------|
| Gmail | smtp.gmail.com | 587 | STARTTLS (tắt SSL) |
| Outlook/Microsoft 365 | smtp.office365.com | 587 | STARTTLS (tắt SSL) |
| Yahoo Mail | smtp.mail.yahoo.com | 587 | STARTTLS (tắt SSL) |
| Email server nội bộ | [do IT cung cấp] | 25/587/465 | Tùy cấu hình |

> 💡 **Lưu ý:** Với Gmail, bạn cần dùng **App Password** thay vì mật khẩu thông thường (yêu cầu bật xác thực 2 bước). Liên hệ bộ phận IT để được hướng dẫn tạo App Password.

### 5.3 Điền thông tin SMTP

1. Tại trang Settings, nhấn tab `Mail Server`.
2. Điền **SMTP Host** — ví dụ: `smtp.gmail.com`.
3. Điền **Port** — mặc định là `587`. Đổi thành `465` nếu dùng SSL/TLS.
4. **Dùng SSL/TLS:** Nếu dùng port 465, hãy tích chọn ô này. Nếu dùng port 587 (STARTTLS), bỏ tích.
5. Điền **Tài khoản email** — địa chỉ email dùng để gửi thông báo.
6. Điền **Mật khẩu / App Password** — nhập mật khẩu hoặc App Password tương ứng.
7. Điền **Tên người gửi** — ví dụ: `LMS Công ty ABC`. Đây là tên hiển thị trong hộp thư nhân viên.
8. Điền **Email người gửi** — thường giống với Tài khoản email.

> 📸 **[HÌNH 5.3]** Form cấu hình SMTP với các trường: Host, Port, SSL/TLS toggle, Tài khoản, Mật khẩu, Tên người gửi, Email người gửi.

### 5.4 Test kết nối và kiểm tra

Trước khi lưu chính thức, hãy kiểm tra xem cấu hình có hoạt động không:

1. Sau khi điền đầy đủ thông tin, nhấn nút `Kiểm tra kết nối`.
2. Hệ thống sẽ thử kết nối đến máy chủ SMTP và gửi email kiểm tra.
3. Nếu thành công: thông báo màu xanh `Kết nối SMTP thành công!` hiển thị.
4. Nếu thất bại: thông báo màu đỏ với mô tả lỗi cụ thể hiển thị.

> 📸 **[HÌNH 5.4]** Thông báo "Kết nối SMTP thành công!" màu xanh sau khi kiểm tra.

> 💡 **Lưu ý:** Trong quá trình kiểm tra, hệ thống gửi một email test đến chính địa chỉ email người gửi. Hãy kiểm tra hộp thư email đó để xác nhận email test đã đến nơi.

### 5.5 Lưu cấu hình

Sau khi kiểm tra kết nối thành công:

1. Nhấn nút `Lưu cấu hình`.
2. Hệ thống hiển thị thông báo `Đã lưu cài đặt mail`.
3. Trường **Mật khẩu** sẽ bị xóa sau khi lưu — đây là bảo mật bình thường, mật khẩu đã được mã hóa và lưu trong cơ sở dữ liệu.

> ⚠️ **Cảnh báo:** Không nhấn `Lưu cấu hình` nếu chưa kiểm tra kết nối thành công. Cấu hình SMTP sai sẽ khiến hệ thống không gửi được email, ảnh hưởng đến việc tạo tài khoản mới.

### 5.6 Các trường hợp lỗi thường gặp & cách xử lý

| Thông báo lỗi | Nguyên nhân thường gặp | Cách xử lý |
|--------------|----------------------|-----------|
| `Connection refused` | Host hoặc port sai | Kiểm tra lại SMTP Host và Port |
| `Authentication failed` | Sai mật khẩu hoặc cần App Password | Kiểm tra lại mật khẩu; với Gmail dùng App Password |
| `SSL handshake failed` | Cài đặt SSL/TLS không khớp | Thử bật/tắt SSL/TLS và đổi port |
| `Timeout` | Máy chủ SMTP không phản hồi | Kiểm tra kết nối internet; liên hệ IT |
| `Sender not authorized` | Địa chỉ email gửi không được phép | Dùng đúng địa chỉ email của tài khoản SMTP |

> 💡 **Lưu ý:** Nếu không xử lý được lỗi, hãy chụp màn hình thông báo lỗi và liên hệ bộ phận IT hoặc Quản trị tập đoàn để được hỗ trợ.

---

### ✅ CHECKLIST BƯỚC 2

- [ ] Đã chuẩn bị đầy đủ thông tin SMTP từ bộ phận IT
- [ ] Đã điền SMTP Host chính xác
- [ ] Đã chọn Port phù hợp (587 hoặc 465)
- [ ] Đã cài đặt SSL/TLS đúng theo port
- [ ] Đã điền tài khoản email và mật khẩu/App Password
- [ ] Đã điền tên người gửi và email người gửi
- [ ] Đã nhấn `Kiểm tra kết nối` và nhận kết quả thành công
- [ ] Đã nhấn `Lưu cấu hình` và nhận thông báo xác nhận

---

## 6. BƯỚC 3 — THIẾT LẬP CƠ CẤU TỔ CHỨC

**Mục đích:** Phản ánh cơ cấu tổ chức thực tế của công ty vào hệ thống — các phòng ban, nhóm — để quản lý người dùng, báo cáo và phân quyền theo đơn vị.

**Điều hướng:** Sidebar → `Organizations`

### 6.1 Xem danh sách tổ chức hiện tại

Trang Organizations hiển thị toàn bộ cơ cấu tổ chức:

- **Phần trên (thẻ card):** Danh sách các công ty con, mỗi công ty hiển thị dưới dạng thẻ với tên, mã, địa chỉ và trạng thái.
- **Phần dưới (bảng):** Danh sách phòng ban, nhóm và các đơn vị khác.

Mỗi thẻ công ty hiển thị:
- Chữ viết tắt từ mã tổ chức (ví dụ `ABC` từ mã `CTYABC`)
- Tên đầy đủ của tổ chức
- Mã tổ chức (dạng monospace)
- Địa chỉ (nếu có)
- Badge trạng thái: `Hoạt động` (xanh) hoặc `Vô hiệu` (xám)

Nhấn vào thẻ bất kỳ để xem chi tiết và quản lý.

> 📸 **[HÌNH 6.1]** Trang Organizations với các thẻ card hiển thị công ty và bảng phòng ban phía dưới.

### 6.2 Tạo phòng ban / đơn vị trực thuộc

Với vai trò Company Admin, bạn có thể tạo phòng ban và nhóm trực thuộc công ty mình:

1. Nhấn nút `+ Tạo phòng ban` ở góc phải trên của trang.
2. Hộp thoại **Tạo phòng ban / nhóm** mở ra.
3. Điền các thông tin:

   - **Tên tổ chức** *(bắt buộc)*: Tên đầy đủ của phòng ban, ví dụ `Phòng Kinh doanh` hoặc `Phòng Nhân sự`.
   - **Mã tổ chức** *(bắt buộc)*: Mã viết tắt, duy nhất, viết hoa, không dấu, tối đa 20 ký tự. Ví dụ: `PKKD`, `PNS`, `CNTT`. Hệ thống tự động chuyển thành chữ hoa.
   - **Loại tổ chức**: Chọn `Phòng ban` (dept) hoặc `Nhóm` (team).
   - **Tổ chức cha**: Chọn công ty hoặc phòng ban cấp trên. Ví dụ phòng ban chọn công ty làm cha; nhóm chọn phòng ban làm cha.
   - **Địa chỉ** *(tùy chọn)*: Địa chỉ văn phòng của phòng ban.
   - **Điện thoại** *(tùy chọn)*: Số điện thoại liên hệ.

4. Nhấn `Tạo tổ chức`.
5. Hệ thống hiển thị thông báo thành công và danh sách tự động cập nhật.

> 📸 **[HÌNH 6.2]** Hộp thoại tạo phòng ban với các trường nhập liệu.

> 💡 **Lưu ý:** Mã tổ chức phải duy nhất trong toàn hệ thống. Nếu mã đã tồn tại, hệ thống báo lỗi và yêu cầu chọn mã khác. Hãy đặt quy tắc đặt mã nhất quán, ví dụ: `P` + tên viết tắt cho phòng ban, `N` + tên cho nhóm.

**Ví dụ cấu trúc tổ chức:**

```
Công ty ABC (CTY-ABC)
├── Phòng Kinh doanh (P-KD)
│   ├── Nhóm Bán hàng Miền Bắc (N-BH-MB)
│   └── Nhóm Bán hàng Miền Nam (N-BH-MN)
├── Phòng Nhân sự (P-NS)
├── Phòng Công nghệ thông tin (P-CNTT)
└── Phòng Kế toán (P-KT)
```

### 6.3 Chỉnh sửa thông tin tổ chức

1. Nhấn vào thẻ công ty hoặc dòng phòng ban cần chỉnh sửa.
2. Trang chi tiết tổ chức mở ra.
3. Tìm nút `Chỉnh sửa` hoặc biểu tượng bút chì.
4. Cập nhật thông tin cần thay đổi: tên, địa chỉ, điện thoại, mô tả.
5. Nhấn `Lưu` để áp dụng thay đổi.

> ⚠️ **Cảnh báo:** Không nên thay đổi **Mã tổ chức** sau khi đã có dữ liệu người dùng và khóa học gắn với tổ chức đó. Mã tổ chức được dùng làm định danh trong nhiều báo cáo và cấu hình.

### 6.4 Xem sơ đồ tổ chức (Org Chart)

Từ trang chi tiết công ty hoặc phòng ban:

1. Tìm tab hoặc nút `Sơ đồ tổ chức` (Org Chart).
2. Sơ đồ hiển thị cấu trúc phân cấp dạng cây của toàn bộ đơn vị.
3. Nhấn vào từng nút trong sơ đồ để xem thông tin tóm tắt.

> 📸 **[HÌNH 6.4]** Sơ đồ tổ chức dạng cây với công ty ở gốc và các phòng ban/nhóm là nhánh con.

### 6.5 Vô hiệu hóa / kích hoạt tổ chức

Khi một phòng ban không còn hoạt động, hãy vô hiệu hóa thay vì xóa (để giữ lại lịch sử):

1. Mở trang chi tiết của tổ chức cần vô hiệu hóa.
2. Tìm nút `Vô hiệu hóa` hoặc `Kích hoạt` (tùy trạng thái hiện tại).
3. Xác nhận trong hộp thoại xác nhận.
4. Trạng thái tổ chức thay đổi ngay lập tức.

> ⚠️ **Cảnh báo:** Vô hiệu hóa tổ chức không xóa người dùng hoặc khóa học. Tuy nhiên, người dùng thuộc tổ chức bị vô hiệu hóa có thể bị ảnh hưởng đến một số chức năng. Hãy rà soát người dùng trước khi vô hiệu hóa tổ chức lớn.

---

### ✅ CHECKLIST BƯỚC 3

- [ ] Đã xem và hiểu cơ cấu tổ chức hiện tại trong hệ thống
- [ ] Đã tạo đủ các phòng ban/nhóm theo cơ cấu thực tế
- [ ] Đã đặt mã tổ chức nhất quán và duy nhất cho từng đơn vị
- [ ] Đã gán đúng tổ chức cha cho từng phòng ban/nhóm
- [ ] Đã kiểm tra sơ đồ tổ chức và xác nhận cấu trúc đúng

---

## 7. BƯỚC 4 — NHẬP DỮ LIỆU NGƯỜI DÙNG

**Mục đích:** Tạo tài khoản cho toàn bộ nhân viên công ty trong hệ thống LMS, để họ có thể đăng nhập và tham gia học tập.

**Điều hướng:** Sidebar → `Users`

### 7.1 Tạo tài khoản thủ công từng người

Phù hợp khi tạo tài khoản cho số lượng nhỏ (dưới 10 người), hoặc tạo cho từng cá nhân mới:

1. Nhấn nút `+ Tạo người dùng` ở góc phải trên của trang Users.
2. Hộp thoại **Tạo người dùng mới** mở ra với các trường:

   - **Tổ chức** *(bắt buộc)*: Chọn công ty hoặc phòng ban mà người dùng thuộc về.
   - **Vai trò (Role)** *(bắt buộc)*: Chọn vai trò mặc định (`Học viên`, `Giảng viên`, `Quản lý HR`…).
   - **Email** *(bắt buộc)*: Địa chỉ email chính thức của nhân viên. Sau khi rời khỏi ô này, hệ thống tự kiểm tra email có hợp lệ và chưa được dùng chưa.
   - **Họ và tên** *(bắt buộc)*: Họ tên đầy đủ.
   - **Mật khẩu** *(bắt buộc)*: Hệ thống tự tạo mật khẩu ngẫu nhiên khi mở form. Có thể nhấn nút `Tạo mật khẩu ngẫu nhiên` để tạo lại.
   - **Mã nhân viên** *(tùy chọn)*: Mã số nhân viên theo hệ thống HR của công ty.
   - **Chức danh công việc** *(tùy chọn)*: Tên chức danh, ví dụ `Chuyên viên Kinh doanh`.
   - **Gửi email chào mừng** *(checkbox)*: Nếu tích chọn, hệ thống tự gửi email thông báo thông tin đăng nhập đến nhân viên.

3. Nhấn `Tạo người dùng`.
4. Nếu thành công, hộp thoại đóng lại và danh sách người dùng tự cập nhật.

> 📸 **[HÌNH 7.1]** Hộp thoại tạo người dùng mới với đầy đủ các trường nhập liệu.

> 💡 **Lưu ý:** Hãy tích chọn **Gửi email chào mừng** nếu email SMTP đã được cấu hình (Bước 2). Nhân viên sẽ nhận được email với thông tin đăng nhập ngay sau khi tạo tài khoản.

> ⚠️ **Cảnh báo:** Email của mỗi tài khoản phải là duy nhất trong toàn hệ thống. Nếu email đã tồn tại, hệ thống báo lỗi `Email đã được sử dụng`. Hãy dùng email công ty chính thức, không dùng email cá nhân.

### 7.2 Import hàng loạt từ file Excel

Phù hợp khi cần tạo nhiều tài khoản cùng lúc (từ 10 người trở lên):

**Chuẩn bị file Excel:**

1. Tải file mẫu Excel từ hệ thống (xem Phụ lục A để biết định dạng chi tiết).
2. Mở file mẫu bằng Microsoft Excel hoặc Google Sheets.
3. Điền thông tin nhân viên vào từng dòng — mỗi dòng là một tài khoản.
4. Lưu file ở định dạng `.xlsx`.

**Thực hiện import:**

1. Trên trang Users, tìm nút `Import từ Excel` hoặc biểu tượng upload.
2. Nhấn nút và chọn file Excel đã chuẩn bị.
3. Hệ thống hiển thị bảng xem trước dữ liệu sẽ được import.
4. Kiểm tra bảng xem trước — các dòng lỗi sẽ được highlight màu đỏ.
5. Sửa lỗi trong file Excel nếu cần, rồi upload lại.
6. Khi dữ liệu hợp lệ, nhấn `Xác nhận import`.
7. Hệ thống xử lý và hiển thị kết quả: số tài khoản tạo thành công, số tài khoản lỗi.

> 💡 **Lưu ý:** Quá trình import tự động gửi email chào mừng cho tất cả tài khoản được tạo thành công (nếu email SMTP đã cấu hình). Đảm bảo cột email trong file Excel đúng định dạng và chưa tồn tại trong hệ thống.

> ⚠️ **Cảnh báo:** Không đóng tab trình duyệt khi đang import số lượng lớn. Chờ cho đến khi hệ thống hiển thị kết quả import hoàn tất.

### 7.3 Tìm kiếm và lọc người dùng

Khi số lượng người dùng lớn, dùng chức năng tìm kiếm và lọc để tìm nhanh:

**Tìm kiếm:**

1. Nhập từ khóa vào ô tìm kiếm (🔍) ở đầu trang.
2. Có thể tìm theo: tên đầy đủ, địa chỉ email, hoặc mã nhân viên.
3. Kết quả lọc ngay lập tức khi nhập.

**Lọc theo công ty (Group Admin):**

1. Nếu bạn là Group Admin, có thêm dropdown **Lọc theo công ty**.
2. Chọn tên công ty để chỉ hiển thị người dùng của công ty đó.
3. Chọn `— Tất cả —` để hiển thị toàn bộ.

**Lọc theo vai trò:**

1. Sử dụng dropdown **Lọc theo vai trò** nếu có.
2. Chọn vai trò cụ thể để chỉ hiển thị người dùng có vai trò đó.

> 📸 **[HÌNH 7.3]** Thanh tìm kiếm và các bộ lọc trên trang Users.

### 7.4 Xem chi tiết và chỉnh sửa thông tin người dùng

1. Trên danh sách người dùng, nhấn vào **tên** hoặc **email** của người dùng cần xem.
2. Trang chi tiết người dùng mở ra với các phần:

   - **Header:** Ảnh đại diện, họ tên, email, badge trạng thái (Hoạt động/Vô hiệu), badge AI (nếu bật).
   - **Thông tin cơ bản:** Các trường email, họ tên, mã nhân viên, chức danh có thể chỉnh sửa.
   - **Đổi mật khẩu:** Nhập mật khẩu mới cho người dùng khi cần.
   - **Vai trò:** Bảng danh sách các vai trò hiện tại, nút thêm vai trò mới và xóa vai trò.
   - **Vị trí công việc:** Dropdown gán vị trí công việc cho người dùng.
   - **Biểu đồ năng lực (Radar):** Xem trực quan năng lực hiện tại (có thể thu gọn).

**Chỉnh sửa thông tin cơ bản:**

1. Tại phần **Thông tin cơ bản**, thay đổi các trường cần cập nhật.
2. Nhấn `Lưu thay đổi`.
3. Thông báo xác nhận hiển thị.

**Đổi mật khẩu cho người dùng:**

1. Cuộn đến phần **Đổi mật khẩu**.
2. Nhập mật khẩu mới vào ô **Mật khẩu mới**.
3. Nhập lại vào ô **Xác nhận mật khẩu**.
4. Nhấn `Đổi mật khẩu`.

> 📸 **[HÌNH 7.4]** Trang chi tiết người dùng với header, các phần thông tin, vai trò và vị trí.

### 7.5 Kích hoạt / vô hiệu hóa tài khoản

Khi nhân viên nghỉ việc hoặc tạm thời không cần truy cập, hãy vô hiệu hóa tài khoản thay vì xóa:

1. Mở trang chi tiết của người dùng cần thay đổi.
2. Tìm nút `Vô hiệu hóa tài khoản` (nếu đang hoạt động) hoặc `Kích hoạt tài khoản` (nếu đang vô hiệu).
3. Nhấn nút — trạng thái thay đổi ngay lập tức.
4. Badge trạng thái trong header cập nhật tương ứng.

**Hiệu lực của vô hiệu hóa:**
- Tài khoản bị vô hiệu hóa không thể đăng nhập vào hệ thống.
- Dữ liệu học tập và tiến độ của người dùng được giữ nguyên.
- Tài khoản có thể kích hoạt lại bất cứ lúc nào.

> ⚠️ **Cảnh báo:** Không nên xóa tài khoản người dùng vì sẽ xóa toàn bộ lịch sử học tập, điểm số và chứng chỉ. Chỉ vô hiệu hóa khi nhân viên nghỉ việc. Chỉ xóa khi tài khoản được tạo nhầm và chưa có hoạt động học tập.

---

### ✅ CHECKLIST BƯỚC 4

- [ ] Đã tạo tài khoản cho tất cả nhân viên (thủ công hoặc import Excel)
- [ ] Đã kiểm tra mỗi tài khoản có email hợp lệ và duy nhất
- [ ] Đã gán đúng tổ chức (phòng ban) cho từng người dùng
- [ ] Đã gửi email chào mừng hoặc thông báo thông tin đăng nhập cho nhân viên
- [ ] Đã kiểm tra nhân viên có thể đăng nhập thành công
- [ ] Đã vô hiệu hóa các tài khoản không còn sử dụng

---

## 8. BƯỚC 5 — PHÂN QUYỀN NGƯỜI DÙNG

**Mục đích:** Gán đúng vai trò (role) cho từng nhân viên để mỗi người chỉ thấy và thực hiện được những chức năng phù hợp với nhiệm vụ của họ.

### 8.1 Các vai trò trong hệ thống và ý nghĩa

| Vai trò | Tên hiển thị | Ý nghĩa |
|---------|-------------|---------|
| `company_admin` | Quản trị công ty | Quản lý toàn bộ hệ thống của công ty: người dùng, tổ chức, cài đặt, báo cáo |
| `hr_manager` | Quản lý HR | Quản lý người dùng, phân quyền, xem báo cáo. Không quản lý cài đặt hệ thống |
| `instructor` | Giảng viên | Tạo và quản lý khóa học, bài giảng, câu hỏi. Không quản lý người dùng |
| `learner` | Học viên | Xem và tham gia khóa học, theo dõi tiến độ cá nhân |

> 💡 **Lưu ý:** Một người dùng có thể có nhiều vai trò. Ví dụ: Giảng viên nội bộ vừa có vai trò `instructor` (tạo khóa học) vừa có vai trò `learner` (tham gia học). Quản lý HR nên có cả `hr_manager` và `learner`.

### 8.2 Gán thêm vai trò cho người dùng

1. Mở trang chi tiết của người dùng cần phân quyền.
2. Cuộn đến phần **Vai trò** — bảng hiển thị các vai trò hiện tại.
3. Tại dòng **Thêm vai trò mới**:
   - Chọn **Vai trò** từ dropdown (ví dụ: `Giảng viên`).
   - Chọn **Tổ chức** từ dropdown — chỉ định vai trò này áp dụng cho tổ chức nào.
4. Nhấn nút `Thêm`.
5. Vai trò mới xuất hiện trong bảng vai trò.

> 📸 **[HÌNH 8.2]** Bảng vai trò với các dòng hiện tại và form thêm vai trò mới bên dưới.

> 💡 **Lưu ý:** Vai trò luôn được gắn với một tổ chức cụ thể. Ví dụ: `hr_manager` tại `Phòng Nhân sự` — người này chỉ quản lý người dùng trong phạm vi công ty của mình.

### 8.3 Gán vai trò từ trang Org Detail

Ngoài cách gán từng người, bạn có thể quản lý thành viên trực tiếp từ trang chi tiết tổ chức:

1. Vào `Organizations` → nhấn vào tên phòng ban cần quản lý.
2. Trang chi tiết phòng ban hiển thị danh sách thành viên.
3. Nhấn `+ Thêm thành viên` để thêm người dùng vào phòng ban với một vai trò cụ thể.
4. Chọn người dùng từ dropdown tìm kiếm và chọn vai trò.
5. Nhấn `Thêm`.

### 8.4 Xóa vai trò

Khi nhân viên thay đổi vị trí hoặc không còn đảm nhận chức năng cũ:

1. Mở trang chi tiết của người dùng.
2. Tại bảng **Vai trò**, tìm dòng vai trò cần xóa.
3. Nhấn biểu tượng X hoặc nút `Xóa` ở cuối dòng đó.
4. Hộp thoại xác nhận: nhấn `Xác nhận` để xóa vai trò.

> ⚠️ **Cảnh báo:** Xóa vai trò `learner` sẽ khiến người đó không còn truy cập được danh sách khóa học và tiến độ học của mình. Hãy cân nhắc trước khi xóa vai trò của người đang có khóa học dở dang.

### 8.5 Bật / tắt quyền truy cập AI

Hệ thống có tính năng AI hỗ trợ học tập (ví dụ: gợi ý nội dung, chatbot trợ lý). Quản trị viên có thể kiểm soát việc sử dụng AI cho từng người dùng:

1. Mở trang chi tiết người dùng.
2. Tìm mục **AI** trong header hoặc phần cài đặt — thường là một badge hoặc toggle.
3. Nhấn nút để bật (`AI: Bật`) hoặc tắt (`AI: Tắt`) quyền truy cập AI cho người dùng đó.
4. Thay đổi có hiệu lực ngay lập tức.

> 💡 **Lưu ý:** Tính năng AI được bật mặc định cho tài khoản mới. Nếu công ty có chính sách hạn chế sử dụng AI, hãy tắt cho những người dùng không cần thiết để tiết kiệm tài nguyên.

---

### ✅ CHECKLIST BƯỚC 5

- [ ] Đã xác định vai trò phù hợp cho từng nhóm nhân viên
- [ ] Đã gán vai trò `company_admin` hoặc `hr_manager` cho cán bộ quản lý
- [ ] Đã gán vai trò `instructor` cho giảng viên nội bộ
- [ ] Đã đảm bảo tất cả nhân viên có vai trò `learner`
- [ ] Đã kiểm tra vai trò gắn đúng với tổ chức tương ứng
- [ ] Đã cài đặt quyền truy cập AI phù hợp theo chính sách công ty

---

## 9. BƯỚC 6 — THIẾT LẬP VỊ TRÍ CÔNG VIỆC

**Mục đích:** Định nghĩa các vị trí công việc trong tổ chức, gắn khung năng lực và lộ trình học tập tương ứng, sau đó gán cho từng nhân viên để hệ thống tự động gợi ý chương trình đào tạo phù hợp.

**Điều hướng:** Sidebar → `Positions`

### 9.1 Tổng quan trang Vị trí công việc

Trang Positions sử dụng bảng dữ liệu chuyên dụng (AdminDataTable) với các cột:

| Cột | Nội dung |
|-----|---------|
| Tên & Code | Tên vị trí, mã code và badge cấp độ |
| Cấp độ (Level) | Cấp độ vị trí: Junior, Senior, Manager, Director... |
| Khung năng lực | Tên khung năng lực liên kết |
| Số nhân viên | Số người đang giữ vị trí này |
| Trạng thái | Badge Hoạt động / Vô hiệu |
| Thao tác | 3 nút: Sửa, Quản lý Khung, Bật/Tắt |

> 📸 **[HÌNH 9.1]** Bảng danh sách vị trí công việc với các cột và nút thao tác.

### 9.2 Tạo vị trí mới

1. Nhấn nút `+ Tạo vị trí` ở góc phải trên trang.
2. Hộp thoại tạo vị trí mở ra với các trường:

   - **Danh mục vị trí (Catalog)** *(tùy chọn)*: Chọn từ danh mục chuẩn của tập đoàn nếu có. Khi chọn từ catalog, các trường Tên, Code, Cấp độ sẽ được điền tự động.
   - **Tên vị trí** *(bắt buộc)*: Ví dụ `Chuyên viên Kinh doanh`, `Trưởng phòng Nhân sự`.
   - **Mã vị trí (Code)** *(bắt buộc)*: Mã viết tắt, ví dụ `CVKD`, `TPNS`.
   - **Cấp độ (Level)** *(tùy chọn)*: Junior, Mid-level, Senior, Lead, Manager, Director...
   - **Mô tả** *(tùy chọn)*: Mô tả ngắn về vai trò và trách nhiệm của vị trí.

3. Nhấn `Tạo vị trí`.
4. Vị trí mới xuất hiện trong bảng danh sách.

> 📸 **[HÌNH 9.2]** Hộp thoại tạo vị trí với dropdown catalog và các trường nhập liệu.

> 💡 **Lưu ý:** Nếu tập đoàn đã định nghĩa danh mục vị trí chuẩn (Job Title Catalog), hãy ưu tiên chọn từ catalog thay vì tạo mới từ đầu. Điều này đảm bảo tính nhất quán khi báo cáo theo chuẩn tập đoàn.

### 9.3 Gán khung năng lực cho vị trí

Khung năng lực (Competency Framework) định nghĩa các năng lực cần có cho từng vị trí. Gán khung năng lực giúp hệ thống đánh giá gap năng lực và đề xuất lộ trình học phù hợp:

1. Trong bảng Positions, nhấn nút **Quản lý Khung** (biểu tượng lưới/grid) ở cột thao tác.
2. Hộp thoại **Quản lý Khung năng lực** mở ra với danh sách các khung đã gắn.
3. Để thêm khung mới:
   - Chọn **Khung năng lực** từ dropdown.
   - Chọn **Lộ trình học tập** liên quan (tùy chọn) — đây là lộ trình được gợi ý khi nhân viên thiếu hụt năng lực theo khung này.
   - Nhập **Trọng số (Weight)** — số từ 0.1 đến 1.0, thể hiện mức độ quan trọng của khung này với vị trí.
   - Tích chọn **Khung chính (Primary)** nếu đây là khung năng lực cốt lõi nhất.
4. Nhấn `Thêm khung`.
5. Khung mới xuất hiện trong danh sách với thông tin trọng số và lộ trình.

> 📸 **[HÌNH 9.3]** Hộp thoại quản lý khung năng lực với bảng các khung đã gắn và form thêm mới.

> 💡 **Lưu ý:** Một vị trí có thể gắn nhiều khung năng lực với trọng số khác nhau. Ví dụ: Chuyên viên Kinh doanh có thể gắn Khung Năng lực Bán hàng (trọng số 0.7) và Khung Kỹ năng Giao tiếp (trọng số 0.3).

### 9.4 Gán vị trí cho nhân viên

Sau khi tạo vị trí xong, gán vị trí cho từng nhân viên:

**Cách 1: Từ trang chi tiết người dùng**

1. Vào `Users` → nhấn vào tên nhân viên.
2. Tại phần **Vị trí công việc**, nhấn vào dropdown.
3. Chọn vị trí phù hợp từ danh sách.
4. Nhấn `Lưu` hoặc hệ thống tự động lưu khi chọn.

**Cách 2: Từ trang import Excel**

Thêm cột `positionCode` vào file Excel khi import hàng loạt (xem Phụ lục A).

### 9.5 Theo dõi thay đổi vị trí

Hệ thống ghi lại lịch sử thay đổi vị trí công việc của nhân viên:

1. Mở trang chi tiết người dùng.
2. Tìm mục **Lịch sử vị trí** hoặc tab tương ứng.
3. Danh sách hiển thị các vị trí trước đây với thời gian bắt đầu và kết thúc.

> 📸 **[HÌNH 9.5]** Biểu đồ Radar năng lực của nhân viên, so sánh năng lực hiện tại với yêu cầu vị trí.

---

### ✅ CHECKLIST BƯỚC 6

- [ ] Đã tạo đủ các vị trí công việc cho tổ chức
- [ ] Đã ưu tiên chọn từ Job Title Catalog của tập đoàn nếu có
- [ ] Đã gán khung năng lực phù hợp cho từng vị trí (ít nhất 1 khung/vị trí)
- [ ] Đã cài đặt trọng số và lộ trình học tập cho từng khung năng lực
- [ ] Đã gán vị trí công việc cho nhân viên
- [ ] Đã kiểm tra biểu đồ radar năng lực hiển thị đúng

---

## 10. DASHBOARD ADMIN — THEO DÕI TỔNG QUAN

**Điều hướng:** Sidebar → `Dashboard`

### 10.1 Ý nghĩa các chỉ số KPI

Khi đăng nhập với vai trò Company Admin, Dashboard hiển thị 5 thẻ chỉ số KPI (Key Performance Indicators) quan trọng nhất:

| Chỉ số KPI | Ý nghĩa | Mục tiêu lý tưởng |
|-----------|---------|-----------------|
| **Người dùng** | Tổng số tài khoản đang hoạt động trong công ty | Bằng số nhân viên hiện tại |
| **Khóa học** | Tổng số khóa học đang được cung cấp cho công ty | Tùy nhu cầu đào tạo |
| **Lượt đăng ký** | Tổng số lượt nhân viên đăng ký vào khóa học | Cao so với Người dùng |
| **Tỉ lệ hoàn thành** | % khóa học đã hoàn thành / tổng đăng ký | Trên 80% là tốt |
| **Tuân thủ bắt buộc** | % hoàn thành các khóa đào tạo bắt buộc | Phải đạt 100% |

> 📸 **[HÌNH 10.1]** 5 thẻ KPI trên Dashboard với số liệu và icon minh họa.

> 💡 **Lưu ý:** **Tỉ lệ tuân thủ bắt buộc** là chỉ số quan trọng nhất về mặt pháp lý. Các khóa học bắt buộc thường liên quan đến an toàn lao động, phòng chống tham nhũng, quy định nội bộ... Chỉ số này phải đạt 100% để tránh vi phạm quy định.

### 10.2 Bảng thống kê khóa học

Bên dưới các thẻ KPI là bảng thống kê chi tiết theo từng khóa học:

| Cột | Ý nghĩa |
|-----|---------|
| Tên khóa học | Tên và số giờ học ước tính |
| Đã đăng ký | Số nhân viên đã đăng ký |
| Hoàn thành | Số nhân viên đã hoàn thành |
| Tỉ lệ | % hoàn thành |
| Điểm TB | Điểm trung bình của bài kiểm tra |
| Thời gian TB | Số giờ trung bình để hoàn thành |

Nhấn vào tên khóa học để xem báo cáo chi tiết theo từng người học.

> 📸 **[HÌNH 10.2]** Bảng thống kê khóa học với các cột số liệu và tỉ lệ hoàn thành.

### 10.3 Điều hướng nhanh

Dashboard cung cấp các liên kết điều hướng nhanh đến các tính năng thường dùng:

- Nhấn số trên thẻ **Người dùng** → chuyển thẳng đến trang Users
- Nhấn số trên thẻ **Khóa học** → chuyển đến trang Courses
- Nhấn `Xem báo cáo đầy đủ` → chuyển đến trang Reports
- Mũi tên → bên cạnh tên khóa học → xem báo cáo chi tiết khóa học đó

---

## 11. BÁO CÁO CÔNG TY

**Điều hướng:** Sidebar → `Reports`

### 11.1 Báo cáo tổng quan (KPI Cards)

Trang Reports bắt đầu với bảng KPI tổng quan giống Dashboard nhưng có thêm bộ lọc thời gian và nhiều chỉ số hơn:

- **Tổng người dùng:** Số tài khoản đang hoạt động
- **Tổng khóa học:** Số khóa học hiện hành
- **Tổng lượt đăng ký:** Cộng dồn toàn bộ lịch sử
- **Tỉ lệ hoàn thành:** % trên tổng đăng ký
- **Tuân thủ bắt buộc:** % hoàn thành khóa học bắt buộc

Bộ lọc thời gian cho phép chọn: Tháng này, Quý này, Năm này, hoặc tùy chỉnh khoảng ngày.

> 📸 **[HÌNH 11.1]** Trang Reports với các thẻ KPI và bộ lọc thời gian.

### 11.2 Bảng thống kê theo phòng ban

Phần quan trọng nhất của báo cáo — hiển thị số liệu tổng hợp theo từng phòng ban/đơn vị:

| Cột | Ý nghĩa |
|-----|---------|
| Phòng ban | Tên đơn vị tổ chức |
| Tổng nhân viên | Số người thuộc đơn vị |
| Đã đăng ký | Số người có ít nhất 1 đăng ký khóa học |
| Hoàn thành | Số người đã hoàn thành ít nhất 1 khóa |
| Tỉ lệ hoàn thành | % hoàn thành của đơn vị |
| Tuân thủ bắt buộc | % hoàn thành khóa bắt buộc |

Nhấn tên phòng ban để xem danh sách chi tiết từng nhân viên trong đơn vị đó.

> 💡 **Lưu ý:** So sánh tỉ lệ hoàn thành giữa các phòng ban giúp xác định đơn vị cần hỗ trợ thêm hoặc phòng ban đang thực hiện tốt để nhân rộng kinh nghiệm.

### 11.3 Đánh giá khóa học

Phần này hiển thị xếp hạng các khóa học dựa trên điểm đánh giá và phản hồi của học viên:

**Top khóa học được đánh giá cao:**
- Hiển thị 5–10 khóa học có điểm đánh giá cao nhất
- Thông tin: tên khóa, số học viên, điểm TB, số đánh giá

**Khóa học cần cải thiện:**
- Hiển thị các khóa học có điểm thấp hoặc tỉ lệ bỏ học cao
- Giúp xác định nội dung cần cập nhật hoặc phương pháp giảng dạy cần điều chỉnh

> 📸 **[HÌNH 11.3]** Bảng xếp hạng top khóa học được đánh giá cao và thấp.

### 11.4 Báo cáo Compliance

Báo cáo Compliance (tuân thủ) theo dõi việc hoàn thành các khóa đào tạo bắt buộc theo quy định:

1. Tại trang Reports, tìm mục **Báo cáo Tuân thủ** hoặc tab `Compliance`.
2. Bảng hiển thị từng nhân viên với danh sách khóa bắt buộc và trạng thái hoàn thành.
3. Các nhân viên chưa hoàn thành khóa bắt buộc được highlight màu đỏ/cam.
4. Nhấn tên nhân viên để xem chi tiết từng khóa còn thiếu và hạn hoàn thành.

**Hành động khuyến nghị:**
- Gửi email nhắc nhở cho nhân viên chưa hoàn thành
- Báo cáo lên quản lý phòng ban
- Gia hạn nếu có lý do chính đáng (liên hệ Group Admin)

> ⚠️ **Cảnh báo:** Tỉ lệ tuân thủ dưới 100% đối với khóa đào tạo bắt buộc là vi phạm quy định nội bộ. Cần xử lý ngay để tránh rủi ro pháp lý và kiểm tra nội bộ.

### 11.5 Xuất báo cáo

Để chia sẻ báo cáo với ban lãnh đạo hoặc lưu trữ:

1. Tại trang Reports, nhấn nút `Xuất báo cáo` hoặc biểu tượng tải xuống.
2. Chọn định dạng: **Excel (.xlsx)** để phân tích thêm, hoặc **PDF** để trình bày.
3. Chọn phạm vi dữ liệu: thời gian, phòng ban, loại báo cáo.
4. Nhấn `Tải xuống`.
5. File được tải về máy tính — kiểm tra trong thư mục Downloads.

> 📸 **[HÌNH 11.5]** Nút xuất báo cáo và hộp thoại chọn định dạng và phạm vi.

> 💡 **Lưu ý:** Nên xuất và lưu báo cáo cuối mỗi tháng để có dữ liệu theo dõi xu hướng theo thời gian. Lưu file với tên rõ ràng: `BaoCao_LMS_ThangXX_NamXXXX.xlsx`.

---

## 12. SAO LƯU & KHÔI PHỤC DỮ LIỆU

> ⚠️ **Cảnh báo:** Mục này dành riêng cho **Group Admin** (Quản trị tập đoàn). Company Admin và HR Manager không có quyền truy cập trang Operations. Nếu bạn cần sao lưu, hãy liên hệ Group Admin.

**Điều hướng:** Sidebar → `Operations` → Tab `Backup`

### 12.1 Cấu hình đích sao lưu

Trước khi sao lưu lần đầu, Group Admin cần cấu hình nơi lưu trữ file sao lưu. Thực hiện tại `Settings → Backup Storage`:

**Các lựa chọn đích lưu trữ:**

| Loại | Mô tả | Phù hợp với |
|------|-------|------------|
| **Local Server** | Lưu vào thư mục trên máy chủ | Môi trường đơn giản, nội bộ |
| **MinIO / NAS** | Lưu vào storage S3-compatible nội bộ | Tổ chức có hệ thống NAS/SAN |
| **Google Cloud Storage** | Lưu lên GCS | Tổ chức dùng Google Cloud |
| **Google Drive** | Lưu lên Google Drive | Lưu trữ đám mây chi phí thấp |

**Cấu hình Local Server (phổ biến nhất):**

1. Chọn `Local Server`.
2. Nhấn `Browse…` để mở trình duyệt thư mục.
3. Điều hướng đến thư mục mong muốn, hoặc nhấn `Tạo thư mục mới` để tạo thư mục `backups`.
4. Xác nhận thư mục có quyền ghi (hiển thị `✓ Có quyền ghi`).
5. Nhấn `Chọn thư mục này`.
6. Tích chọn `Kích hoạt backup tự động` nếu muốn sao lưu theo lịch.
7. Nhấn `Lưu cài đặt`.

> 💡 **Lưu ý:** Khuyến nghị kết hợp cả Local Server và một đích cloud (MinIO hoặc GCS) để bảo vệ dữ liệu khỏi hỏng ổ cứng. Đây là nguyên tắc sao lưu 3-2-1: 3 bản sao, 2 loại media, 1 bản ngoài site.

### 12.2 Kích hoạt sao lưu thủ công

1. Vào `Operations` → Tab `Backup`.
2. Nhấn nút `+ Sao lưu ngay` (nút có dropdown).
3. Chọn loại sao lưu:
   - **Full:** Sao lưu toàn bộ (cơ sở dữ liệu + tài nguyên). Thời gian dài hơn nhưng đầy đủ nhất.
   - **DB:** Chỉ sao lưu cơ sở dữ liệu. Nhanh, phù hợp sao lưu hàng ngày.
   - **Assets:** Chỉ sao lưu file tài nguyên (video, ảnh, tài liệu đính kèm).
4. Nhấn `Bắt đầu sao lưu`.
5. Job sao lưu được tạo với trạng thái `Chờ` → `Đang chạy`.
6. Chờ đến khi trạng thái chuyển thành `Hoàn thành` (màu xanh).

> 📸 **[HÌNH 12.2]** Nút sao lưu với dropdown chọn loại (Full/DB/Assets) và danh sách job.

### 12.3 Lịch sử các job sao lưu

Bảng lịch sử hiển thị tất cả các lần sao lưu với thông tin:

| Cột | Ý nghĩa |
|-----|---------|
| Loại | Full, DB, hoặc Assets |
| Trạng thái | Chờ / Đang chạy / Hoàn thành / Thất bại / Đang phục hồi / Đã phục hồi |
| Đích | Nơi lưu trữ (Local/MinIO/GCS/Drive) |
| Kích thước | Dung lượng file sao lưu |
| Số file | Số lượng file trong gói sao lưu |
| Thời gian | Thời điểm bắt đầu và kết thúc |
| Người thực hiện | Tên và email người kích hoạt |

**Màu sắc badge trạng thái:**
- 🔘 **Chờ** (xám): Đang chờ xử lý
- 🔵 **Đang chạy** (xanh nhấp nháy): Đang thực hiện
- 🟢 **Hoàn thành** (xanh lá): Thành công
- 🔴 **Thất bại** (đỏ): Lỗi — xem chi tiết lỗi trong cột Error
- 🟡 **Đang phục hồi** (vàng nhấp nháy): Đang khôi phục dữ liệu
- 🟣 **Đã phục hồi** (tím): Đã khôi phục thành công

> 💡 **Lưu ý:** Danh sách tự động làm mới mỗi 30 giây khi có job đang chạy. Không cần nhấn làm mới thủ công.

### 12.4 Khôi phục dữ liệu

> ⚠️ **Cảnh báo:** Khôi phục dữ liệu là thao tác **không thể đảo ngược**. Dữ liệu hiện tại sẽ bị ghi đè bởi dữ liệu từ bản sao lưu. Chỉ thực hiện khi thực sự cần thiết và đã cân nhắc kỹ.

Khi cần khôi phục từ bản sao lưu trước đó:

1. Trong bảng lịch sử backup, tìm job sao lưu muốn khôi phục.
2. Nhấn nút `Khôi phục` ở cột thao tác.
3. Hộp thoại xác nhận khôi phục mở ra:
   - **Phạm vi khôi phục:** Chọn `Tất cả công ty` hoặc một công ty cụ thể (để hạn chế ảnh hưởng).
   - **Lý do khôi phục:** Nhập lý do bắt buộc để ghi log — ví dụ: `Lỗi import nhầm dữ liệu ngày 05/07`.
4. Đọc kỹ cảnh báo trong hộp thoại.
5. Nhấn `Xác nhận khôi phục`.
6. Theo dõi tiến trình — trạng thái job chuyển sang `Đang phục hồi` (vàng nhấp nháy).
7. Khi hoàn tất, trạng thái chuyển thành `Đã phục hồi` (tím).

> 📸 **[HÌNH 12.4]** Hộp thoại xác nhận khôi phục với dropdown phạm vi và ô nhập lý do.

### 12.5 Lịch sao lưu tự động

Để tự động hóa việc sao lưu, cấu hình lịch tại `Settings → Backup Storage`:

1. Tích chọn `Kích hoạt backup tự động`.
2. Cấu hình **Cron Schedule** — biểu thức lịch theo cú pháp cron:
   - `0 2 * * *` = 02:00 AM hàng ngày (mặc định và khuyến nghị)
   - `0 2 * * 0` = 02:00 AM mỗi Chủ nhật (sao lưu tuần)
   - `0 2 1 * *` = 02:00 AM ngày 1 hàng tháng
3. Cấu hình **Giữ backup (ngày)** — số ngày giữ lại bản sao lưu cũ trước khi tự xóa:
   - Mặc định: 30 ngày
   - Khuyến nghị: 30–90 ngày tùy dung lượng lưu trữ
4. Nhấn `Lưu cài đặt`.

> 💡 **Lưu ý:** Sao lưu tự động thường chạy vào 02:00 AM — giờ ít người dùng nhất để tránh ảnh hưởng hiệu năng. Đảm bảo máy chủ không tắt vào khung giờ này.

---

## 13. PHỤ LỤC

### A. Định dạng file import Excel

File Excel import người dùng cần có các cột theo thứ tự sau:

| STT | Tên cột | Bắt buộc | Ví dụ | Ghi chú |
|-----|---------|:--------:|-------|---------|
| 1 | `email` | ✅ | `nguyenvana@congtyabc.vn` | Duy nhất, đúng định dạng email |
| 2 | `fullName` | ✅ | `Nguyễn Văn A` | Họ tên đầy đủ, có dấu |
| 3 | `password` | ❌ | `Abc@123456` | Nếu để trống, hệ thống tự tạo |
| 4 | `employeeCode` | ❌ | `NV001` | Mã nhân viên theo hệ thống HR |
| 5 | `jobTitle` | ❌ | `Chuyên viên Kinh doanh` | Chức danh |
| 6 | `organizationCode` | ✅ | `P-KD` | Mã phòng ban đã tồn tại trong hệ thống |
| 7 | `role` | ❌ | `learner` | Vai trò mặc định, nếu trống = learner |
| 8 | `positionCode` | ❌ | `CVKD` | Mã vị trí công việc đã tồn tại |

**Các lưu ý quan trọng khi chuẩn bị file:**

- Hàng đầu tiên là **tiêu đề cột** — không điền dữ liệu.
- Mỗi nhân viên chiếm một hàng dữ liệu.
- Cột `organizationCode` phải khớp chính xác với mã tổ chức đã tạo trong hệ thống.
- Xóa các dòng trống ở cuối file trước khi upload.
- Không dùng ký tự đặc biệt trong mã nhân viên và mã tổ chức.
- Lưu file ở định dạng `.xlsx` (Excel 2007 trở lên).

**File mẫu:** Tải template mẫu từ trang Users → nút `Import` → `Tải mẫu`.

---

### B. Checklist thiết lập toàn bộ từ đầu

Sử dụng checklist tổng hợp này khi bắt đầu thiết lập hệ thống lần đầu:

**Giai đoạn 1 — Cài đặt cơ bản (Tuần 1)**

- [ ] Đăng nhập thành công với tài khoản Company Admin
- [ ] Đã đổi mật khẩu lần đầu
- [ ] Đã upload logo công ty
- [ ] Đã cài đặt favicon
- [ ] Đã chọn bảng màu phù hợp thương hiệu
- [ ] Đã tùy chỉnh trang đăng nhập (tiêu đề, ảnh nền)
- [ ] Đã lưu cài đặt thương hiệu
- [ ] Đã cấu hình SMTP và kiểm tra kết nối thành công
- [ ] Đã lưu cấu hình email

**Giai đoạn 2 — Cơ cấu tổ chức (Tuần 1-2)**

- [ ] Đã tạo đủ phòng ban theo cơ cấu thực tế
- [ ] Đã xác minh sơ đồ tổ chức chính xác
- [ ] Đã tạo đủ vị trí công việc
- [ ] Đã gán khung năng lực cho các vị trí chính

**Giai đoạn 3 — Người dùng (Tuần 2-3)**

- [ ] Đã chuẩn bị file Excel danh sách nhân viên
- [ ] Đã import hoặc tạo thủ công tất cả tài khoản
- [ ] Đã kiểm tra email chào mừng đã được gửi
- [ ] Đã phân quyền cho cán bộ quản lý (company_admin, hr_manager)
- [ ] Đã phân quyền cho giảng viên nội bộ (instructor)
- [ ] Đã gán vị trí công việc cho nhân viên
- [ ] Đã thử nghiệm đăng nhập với 2-3 tài khoản mẫu

**Giai đoạn 4 — Vận hành (Từ tuần 3)**

- [ ] Đã theo dõi Dashboard ít nhất 1 lần/tuần
- [ ] Đã xuất báo cáo tháng đầu tiên
- [ ] Đã kiểm tra tỉ lệ tuân thủ đào tạo bắt buộc
- [ ] Đã xử lý các tài khoản lỗi hoặc chưa đăng nhập

---

### C. Xử lý lỗi thường gặp

**Lỗi đăng nhập:**

| Vấn đề | Nguyên nhân | Giải pháp |
|--------|-------------|----------|
| "Sai email hoặc mật khẩu" | Email/mật khẩu không đúng | Kiểm tra lại, dùng Quên mật khẩu nếu cần |
| "Tài khoản bị vô hiệu hóa" | Admin đã vô hiệu hóa tài khoản | Liên hệ Company Admin để kích hoạt lại |
| Không nhận được email reset mật khẩu | SMTP chưa cấu hình hoặc lỗi | Liên hệ Company Admin |

**Lỗi tạo người dùng:**

| Vấn đề | Nguyên nhân | Giải pháp |
|--------|-------------|----------|
| "Email đã được sử dụng" | Email tồn tại trong hệ thống | Kiểm tra danh sách users, dùng email khác |
| "Email không hợp lệ" | Sai định dạng email | Kiểm tra lại định dạng `ten@domain.vn` |
| "Tổ chức không tồn tại" | Mã tổ chức sai khi import | Kiểm tra lại mã tổ chức trong phần Organizations |

**Lỗi cài đặt:**

| Vấn đề | Nguyên nhân | Giải pháp |
|--------|-------------|----------|
| Logo không hiển thị sau khi lưu | File quá lớn hoặc định dạng sai | Kiểm tra file < 2MB, định dạng JPG/PNG/SVG/WebP |
| Email test SMTP thất bại | Thông tin SMTP sai | Kiểm tra lại host, port, SSL/TLS, mật khẩu |
| Favicon không cập nhật | Cache trình duyệt | Nhấn Ctrl+F5 để xóa cache và tải lại trang |

**Báo cáo không có dữ liệu:**

| Vấn đề | Nguyên nhân | Giải pháp |
|--------|-------------|----------|
| KPI đều bằng 0 | Chưa có khóa học hoặc đăng ký | Kiểm tra với Group Admin về việc phát hành khóa học |
| Phòng ban không có trong báo cáo | Chưa gán nhân viên vào phòng ban | Kiểm tra và gán đúng tổ chức cho người dùng |
| Tuân thủ bắt buộc trống | Chưa có khóa học bắt buộc | Liên hệ Group Admin để gán khóa bắt buộc |

**Khi không tự xử lý được lỗi:**

1. Chụp màn hình thông báo lỗi (nhấn `PrintScreen` hoặc `Win+Shift+S`).
2. Ghi lại: các bước đã thực hiện, thời điểm xảy ra lỗi, trình duyệt đang dùng.
3. Liên hệ **Quản trị tập đoàn (Group Admin)** hoặc **bộ phận IT** với đầy đủ thông tin trên.

---

*Tài liệu này được cập nhật định kỳ. Phiên bản mới nhất luôn có sẵn trong hệ thống LMS tại mục Help hoặc do bộ phận IT công ty cung cấp.*

*Để góp ý hoặc báo lỗi trong tài liệu, vui lòng liên hệ bộ phận IT hoặc Quản trị tập đoàn.*
