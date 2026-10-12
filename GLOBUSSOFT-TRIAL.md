# Globussoft: bản chạy thử trên máy này

Repo [Globussoft School MIS](https://github.com/Globussoft-Technologies/globussoft-school-mis)
được clone riêng tại `.local/globussoft-school-mis`, commit
`e3c4c37aa50e4247eee87562e727db516fda4b6b`. Thư mục `.local/` được bỏ qua bởi Git,
ESLint và Prettier của Project_L. Bản thử nghiệm không thay thế frontend ở `/courses`.

Đây là môi trường đánh giá cục bộ, chưa triển khai lên Internet. Dữ liệu là dữ liệu
mẫu của repo, không phải thông tin trường học hoặc học viên thật của Project_L.

## Truy cập

- Website: <http://127.0.0.1:3001>
- API / Swagger: <http://127.0.0.1:4002/api/docs>
- Tài khoản quản trị mẫu: `admin@medicaps.edu.in`
- Mật khẩu mẫu: `admin123`

Chỉ dùng tài khoản này với bản chạy cục bộ. Không nhập dữ liệu cá nhân thật khi
đang thử nghiệm. Giao diện và dữ liệu gốc của Globussoft chưa được chuyển thành
sản phẩm dạy ngoại ngữ của Project_L.

## Khởi động, xem trạng thái và dừng

Chạy từ thư mục Project_L trong PowerShell, sau khi quá trình chuẩn bị và build
bản thử nghiệm đã hoàn tất:

```powershell
./scripts/globussoft-trial.ps1 start
./scripts/globussoft-trial.ps1 status
./scripts/globussoft-trial.ps1 stop
```

Script dùng Node có trong PATH, hoặc runtime Node được Codex cung cấp trên máy
này. Script chỉ quản lý tiến trình của bản thử nghiệm đã chuẩn bị, không cài
dependencies, không build lại và không chạy lại seed. Chạy `start` khi các dịch
vụ đã hoạt động sẽ dùng lại chúng. Dữ liệu được giữ khi dừng hoặc khởi động lại.
Không cần cài Windows service; sau khi khởi động lại máy, chạy `start` thủ công.

Các dịch vụ chỉ lắng nghe trên loopback:

| Dịch vụ    | Cổng | Vai trò                           |
| ---------- | ---- | --------------------------------- |
| MariaDB    | 3308 | Database riêng cho bản thử nghiệm |
| S3rver     | 9000 | Kho file giả lập S3 cục bộ        |
| NestJS API | 4002 | Backend Globussoft                |
| Next.js    | 3001 | Giao diện Globussoft              |

Script kiểm tra PID, đường dẫn executable, tham số đường dẫn tuyệt đối và tiến
trình chiếm cổng trước khi thao tác. PID không xác minh được hoặc cổng đang bị ứng
dụng khác chiếm sẽ được báo lỗi, không tự dừng ứng dụng đó. MariaDB được dừng bằng
lệnh shutdown có xác thực; nếu lệnh thất bại, script giữ database chạy để tránh
cưỡng bức ngắt ghi dữ liệu.

## File cục bộ và log

Các đường dẫn dưới đây tính từ `.local/globussoft-school-mis/`:

- `.local/data/mysql/`: dữ liệu MariaDB.
- `.local/data/s3/`: file lưu qua kho S3 giả lập.
- `.local/logs/`: log stdout/stderr mới nhất của từng dịch vụ; log được thay khi
  dịch vụ đó khởi động lại.
- `.local/processes.json`: PID các tiến trình do bản thử nghiệm quản lý.
- `.local/mysql.ini`: cấu hình database giới hạn trên loopback.
- `.local/database-credentials.json`: mật khẩu database sinh riêng trên máy.
- `packages/api/.env`: biến môi trường và secret của API.
- `packages/web/.env.local`: địa chỉ API cục bộ dùng khi build web.

Không commit hoặc chia sẻ các file credentials, `.env` và dữ liệu thử nghiệm.
Không chạy lại seed trên database đã có dữ liệu cần giữ: seed của repo có thao
tác xóa và tạo lại dữ liệu. Không chạy nguyên script `e2e-api-tests.js` của repo:
script gốc trỏ đến demo công khai và có thao tác thay đổi dữ liệu.

Nếu một dịch vụ không khởi động, xem `status` và file `.err.log`/`.out.log` tương
ứng trong `.local/logs/`. Sau lỗi khởi động một phần, các dịch vụ đã chạy vẫn được
ghi nhận; dùng `stop` nếu muốn dừng toàn bộ bản thử nghiệm.

## Điều chỉnh để chạy trên máy này

- MariaDB 11.4.10 bản portable thay MySQL trong cấu hình Docker gốc; khả năng
  tương thích được đánh giá trong bản thử nghiệm, chưa xác nhận cho production.
- S3rver 3.7.1 thay MinIO để thử luồng file cục bộ do đường dẫn tải MinIO Windows
  chính thức không còn cung cấp binary. Đây là bộ giả lập dành cho thử nghiệm,
  không phải phương án lưu trữ production.
- Redis không được khởi chạy vì mã API hiện tại không sử dụng nó.
- SMTP bị tắt; thông báo gửi email thực tế không thuộc phạm vi thử nghiệm này.
- API được giới hạn bind vào `127.0.0.1`.
- Lỗi cú pháp kết hợp `??` và `||` ở trang quản lý người dùng được sửa bằng
  dấu ngoặc để web có thể biên dịch.

Một số URL tài liệu/LMS do seed tạo trỏ đến `storage.example.com`; các đường dẫn
mẫu này không cung cấp file thật. Tích hợp bài học và Microsoft Teams vẫn chưa
được triển khai cho Project_L.

Repo dùng Next.js 14.2.15 và nhiều dependencies cũ. Cần nâng cấp, kiểm tra bảo
mật, phân quyền, dữ liệu, quy trình backup và cấu hình triển khai trước khi cân
nhắc đưa lên Internet. Cấu hình Next của repo bỏ qua lỗi TypeScript và ESLint khi
build; build thành công không đồng nghĩa hai bước kiểm tra đó đã đạt.

## Trạng thái kiểm tra

Đã xác minh trên máy này ngày 09/10/2026:

- Build shared package và API NestJS thành công. Next.js build thành công,
  tạo 83 trang tĩnh cùng các route động; đã chép static/public vào bản standalone.
- Prisma tạo schema thành công; sáu seed chạy theo thứ tự của repo, không có
  lỗi trong log. Database có 80 học sinh, 12 lớp, 76 môn, 30 bản ghi điểm,
  300 bản ghi điểm danh và 3 học bạ mẫu.
- Đăng nhập quản trị, dashboard, danh sách học sinh/lớp/môn/bài tập và API đọc
  điểm danh/học bạ hoạt động. Truy cập học sinh khi chưa đăng nhập trả HTTP 401.
- Upload một PNG thử nghiệm, tải lại qua signed URL và so sánh byte thành công;
  file kiểm tra đã được xóa sau đó.
- Đã dừng và khởi động lại cả bốn dịch vụ bằng script; dữ liệu được giữ.
  API có thể mất khoảng hai phút trong lần khởi động nguội.
- Trình duyệt đăng nhập được, dashboard hiển thị dữ liệu, danh sách có 80 học
  sinh và bộ lọc Class 10 trả 40 học sinh. Đã xem ở kích thước desktop và mobile.
- `pnpm check` của Project_L đạt typecheck, lint, formatting và production build.

Kết quả smoke test nằm ở `.local/logs/smoke-results.json`; ảnh kiểm tra nằm trong
`.local/review/` của clone. Các kiểm tra này chưa bao phủ toàn bộ phân hệ của repo.

### Lỗi gốc còn tồn tại

- **Tạo học bạ:** nút Generate Report Cards trả HTTP 500. Frontend gửi
  `classId`, `sectionId`, `term`, trong khi API yêu cầu thêm `studentId` và
  `academicSessionId`. Log xác nhận thiếu `studentId`; không tạo học bạ mới.
- **Hiển thị học bạ:** đọc được học bạ đã seed nhưng bảng dùng các tên trường
  khác response API, nên tên học sinh, lớp và điểm hiển thị trống/`--`.
- **Mobile:** sidebar rộng cố định 256px khiến vùng dashboard bị ép và cắt nội
  dung ở viewport 390px. Nên xem bản thử nghiệm hiện tại trên desktop.
- Khi quay về Dashboard bằng menu đã gặp trạng thái "Loading dashboard..."
  kéo dài; tải lại trang hiển thị dữ liệu bình thường.
- Chạy TypeScript riêng cho web phát hiện **13 lỗi** tại trang fees, LMS và
  promotions. Chi tiết ở `.local/logs/web-typecheck.log`. ESLint của clone chưa
  được xác minh độc lập; cấu hình build gốc bỏ qua bước này.

Các vấn đề trên được giữ lại và ghi nhận để đánh giá repo. Bản thử nghiệm đã
chạy cục bộ, nhưng chưa đủ điều kiện triển khai production hoặc nhập dữ liệu thật.
