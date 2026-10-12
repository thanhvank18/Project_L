# Triển khai bản thử: Vercel + Railway

Frontend chạy trên Vercel; API Node.js 24, SQLite và các tiến trình xử lý nền
chạy trên một dịch vụ Railway có volume riêng. Cấu hình trong repository mới là
phần chuẩn bị; chưa có lần triển khai hoặc kiểm thử trên hai dịch vụ này.
Tài khoản Railway cần được tạo trước khi thực hiện. Chưa mua gói hosting.

## 1. Tạo địa chỉ frontend trên Vercel

1. Đăng nhập Vercel, import repository `thanhvank18/Project_L` từ GitHub.
2. Chọn thư mục gốc repository, framework **Vite**, Node.js **24.x**. Giữ các
   lệnh cài/build và thư mục `dist` theo `vercel.ts`; cấu hình dùng đúng pnpm
   **11.25.0** và lockfile đã lưu.
3. Deploy lần đầu và ghi lại địa chỉ cố định của project, chẳng hạn
   `https://TEN-PROJECT.vercel.app`. Dùng địa chỉ này xuyên suốt bản thử, thay
   các giá trị viết hoa trong hướng dẫn bằng địa chỉ thật.

Ở bước này landing và giao diện đăng nhập có thể mở, nhưng chưa đăng nhập hoặc
đọc dữ liệu được. Khi chưa có `PORTAL_API_ORIGIN`, `/api/v1/*` trả lỗi 404 thật;
không bị rewrite thành trang HTML. Các đường dẫn `/vi`, `/en`, `/courses`,
`/login`, `/learn`, `/dashboard` và `/studio-demo` có rewrite riêng cho SPA.

Không nhập Gemini API key, Google OAuth secret hoặc khóa email vào Vercel.
Không sử dụng biến `VITE_` cho bất kỳ bí mật nào.

## 2. Tạo backend trên Railway

1. Tạo project Railway dành riêng cho bản thử; kết nối cùng repository GitHub
   và chọn thư mục gốc. Dịch vụ dùng `Dockerfile` và `railway.json` trong repo.
2. Gắn **một volume tại `/data` trước khi cho người dùng sử dụng**. Giữ một
   instance API; chưa nhân bản dịch vụ hoặc chia vùng với SQLite hiện tại.
   Runtime kiểm tra metadata volume do Railway cấp; không tự khai báo
   `RAILWAY_VOLUME_MOUNT_PATH` để bỏ qua việc gắn volume.
3. Đặt các biến của dịch vụ:

   | Biến                        | Giá trị cho bản thử              |
   | --------------------------- | -------------------------------- |
   | `PORTAL_DB_PATH`            | `/data/portal.sqlite`            |
   | `PORTAL_WEB_ORIGIN`         | `https://TEN-PROJECT.vercel.app` |
   | `PORTAL_AI_ENABLED`         | `false`                          |
   | `PORTAL_EMAIL_ENABLED`      | `false`                          |
   | `PORTAL_SUBMISSION_STORAGE` | `sqlite`                         |

4. Deploy API. Railway cung cấp `PORT`; không cần đặt `PORTAL_API_PORT`.
   Container nhận kết nối qua `0.0.0.0`. Nếu chủ động đặt `PORTAL_API_PORT`,
   phải cấu hình cổng public tương ứng vì biến này được ưu tiên hơn `PORT`.
5. Trong networking, tạo domain HTTPS của Railway, chẳng hạn
   `https://TEN-API.up.railway.app`. Kiểm tra
   `/api/v1/health` trả HTTP 200 và JSON có `status: "ok"`.

`PORTAL_WEB_ORIGIN` là origin HTTPS chính xác, không có đường dẫn hoặc dấu `/`
cuối. Nếu cần cho phép thêm một hostname thử cụ thể, phân tách các origin bằng
dấu phẩy; không mở wildcard cho toàn bộ tên miền preview. Chọn một URL Vercel
cố định để tránh lỗi origin và Google OAuth khi mỗi commit sinh URL mới.

Volume giữ SQLite, tệp bài nộp lưu cục bộ và khóa mã hóa Drive qua các lần
restart/redeploy. Không dùng `/tmp`, không chép database, tài khoản, tệp `.env`
hoặc dữ liệu QA từ máy hiện tại lên cloud. Bản cài mới bắt đầu trống.

## 3. Tạo quản trị viên trong container đang chạy

Sau khi backend đã chạy với volume đúng, kết nối **container từ xa** bằng
`railway ssh` cho đúng project, environment và service. Trong thư mục `/app`,
chạy:

```sh
node --experimental-strip-types server/bootstrap.ts --email admin@gmail.com --name Administrator
```

Với `PORTAL_DB_PATH=/data/portal.sqlite`, thông tin đăng nhập ban đầu được ghi
riêng vào `/data/admin-access.txt`. Lệnh không in mật khẩu ra log và chạy lại
không đổi tài khoản đã có. Tải riêng tệp này qua `railway volume browse` hoặc
SFTP để đọc trên máy của bạn; không đưa nội dung vào chat, Git hoặc build log.
Sau lần đăng nhập đầu, đổi mật khẩu trong **Cài đặt**, rồi xóa bản thông tin
ban đầu khi không còn cần.

Không chạy bootstrap trong build hoặc pre-deploy: Railway chưa mount volume
ở các giai đoạn đó. `railway run` thực thi trên máy local với biến của Railway,
không phải trong container từ xa; dùng nhầm sẽ tạo database sai nơi.

## 4. Nối frontend tới backend

Trong biến môi trường của project Vercel, thêm:

```dotenv
PORTAL_API_ORIGIN=https://TEN-API.up.railway.app
```

Giá trị chỉ gồm origin HTTPS, không có `/api/v1` ở cuối, không chứa tài khoản
hoặc khóa. `vercel.ts` đọc biến lúc build để tạo reverse proxy
`/api/v1/:path*` tới backend và giữ nguyên đường dẫn API. Redeploy Vercel sau
khi thêm hoặc đổi biến. `PORTAL_API_TARGET` chỉ dành cho Vite local và không
thay thế cấu hình này trên Vercel.

Mở `https://TEN-PROJECT.vercel.app/api/v1/health`: phải nhận JSON HTTP 200.
Sau đó mở `/login` và dùng tài khoản vừa tạo. Trình duyệt gọi API cùng origin
Vercel; backend vẫn kiểm tra tài khoản, vai trò, lớp và origin của yêu cầu.

## 5. Kết nối dịch vụ sau khi phần học vụ chạy được

- **Gemini:** chỉ nhập `PORTAL_GEMINI_API_KEY` trong Variables của Railway;
  chọn `PORTAL_AI_PROVIDER=gemini`. Bản cloud mặc định tắt AI. Cần chốt lại
  thời gian sử dụng và ngân sách trước khi bật; không tự kéo dài hoặc bỏ hạn
  thử đã duyệt `2026-10-12T12:15:41.633Z`. Xem [Speaking AI](SPEAKING-AI.md)
  để cấu hình model, giới hạn lượt và kiểm thử âm thanh thật.
- **Google Drive:** cấu hình OAuth client/secret trên Railway; redirect URI
  phải là `https://TEN-PROJECT.vercel.app/api/v1/portal/drive/callback` và được
  khai báo chính xác trong Google Cloud. Quản trị viên vào **Cài đặt** để kết
  nối Gmail trung tâm, chọn thư mục và chủ động bật lưu trữ. Giữ riêng
  `/data/drive-oauth.key` cùng bản sao database để còn giải mã được kết nối
  khi phục hồi. Xem [hướng dẫn Drive](GOOGLE-DRIVE-STORAGE.md).
- **Email:** chỉ bật sau khi có dịch vụ gửi, địa chỉ gửi đã xác minh và
  `PORTAL_EMAIL_PORTAL_ORIGIN=https://TEN-PROJECT.vercel.app`. Xem
  [hướng dẫn email](EMAIL-DELIVERY.md).
- **Zoom:** quản trị viên, giáo viên hoặc trợ giảng nhập liên kết theo quyền
  hiện có; không cần Zoom API key để dùng liên kết thủ công.

## 6. Kiểm tra trước khi mời người dùng thử

- Mở và refresh các trang `/vi`, `/en`, `/courses`, `/login`, `/learn`; kiểm
  tra desktop và điện thoại. Kiểm tra API trả JSON, không trả HTML của SPA.
- Tạo tài khoản và lớp thử qua giao diện quản trị trong môi trường test riêng;
  thử yêu cầu ghi danh, duyệt, soạn/xuất bản bài, lưu nháp, nộp tệp, trả điểm và
  xem kết quả bằng đúng vai trò. Không dùng dữ liệu học viên thật cho lượt QA.
- Thử đặt và xác nhận 1:1, khóa vào buổi chính khi chưa đủ review, quyền riêng
  tư Zoom, quyền trợ giảng và tài khoản bị khóa.
- Restart/redeploy backend rồi kiểm tra dữ liệu và tệp vẫn còn. Không xóa hoặc
  thay volume khi redeploy. Bật sao lưu volume, giữ thêm bản sao ở nơi độc lập
  và thử phục hồi vào môi trường riêng trước khi nhận dữ liệu thật. Bản sao
  SQLite phải nhất quán; không chỉ sao chép file `.sqlite` đang ghi mà bỏ qua
  dữ liệu WAL. Khóa `drive-oauth.key` cũng phải được sao lưu riêng tư.
- Theo dõi lỗi, dung lượng volume và chi phí. Healthcheck chứng minh API trả
  lời, chưa chứng minh toàn bộ luồng nghiệp vụ hoặc tích hợp đã đạt.

Kiểm thử trên máy và build thành công không thay thế kiểm thử cloud. Chỉ ghi
nhận triển khai thành công sau khi có URL hoạt động và các kiểm tra trên đạt.

## Tài liệu nền tảng

- [Vercel: cấu hình TypeScript](https://vercel.com/docs/project-configuration/vercel-ts)
- [Vercel: reverse proxy bằng rewrites](https://vercel.com/docs/routing/rewrites)
- [Railway: Dockerfile](https://docs.railway.com/builds/dockerfiles)
- [Railway: volume và thời điểm mount](https://docs.railway.com/volumes)
- [Railway: SSH vào container](https://docs.railway.com/cli/ssh)
- [Railway: lệnh run thực thi local](https://docs.railway.com/cli/run)
