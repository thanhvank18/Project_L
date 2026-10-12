# Project_L 0.0.1

Website học ngoại ngữ với React + Vite + TypeScript strict, Tailwind CSS và một
API TypeScript độc lập trên Node.js 24 + SQLite. Landing Elite Pathway ở `/`
(`/vi`, `/en`), danh mục công khai ở `/courses`, đăng nhập ở `/login` và cổng học
tập có xác thực ở `/learn`. Trang studio cũ còn tại `/studio-demo`.

Cổng học tập lưu tài khoản và dữ liệu học vụ trên máy chủ. Cài đặt mới bắt đầu
với dữ liệu trống; không tự nhập tài khoản hoặc dữ liệu mẫu từ bản Globussoft.
Đây là ứng dụng chạy cục bộ, chưa được triển khai lên hosting production.

Bản **0.0.1** cung cấp mã nguồn và frontend build, có hướng dẫn
chạy, manifest từng tệp và checksum gói. Xem [ghi chú phát hành](docs/RELEASE-0.0.1.md)
để biết trạng thái kiểm tra, cấu hình riêng và các mục còn cần nghiệm thu.

## Chạy dự án

Yêu cầu: Node.js 24 trở lên và pnpm 11.25.0. Cài dependencies và tạo quản trị viên
đầu tiên từ thư mục dự án:

```sh
pnpm install --frozen-lockfile
pnpm admin:bootstrap --email admin@gmail.com --name Administrator
```

Lệnh bootstrap tạo mật khẩu ngẫu nhiên và ghi thông tin đăng nhập vào file riêng
`.local/portal/admin-access.txt`. Lệnh chỉ tạo quản trị viên khi chưa có quản trị
viên; chạy lại không thay đổi tài khoản hoặc mật khẩu đã có. Đọc file này trên máy,
đăng nhập rồi đổi mật khẩu trong mục **Cài đặt** và xóa file thông tin ban đầu khi
không còn cần. Không đưa mật khẩu vào mã nguồn, tài liệu hoặc Git.

Mở hai terminal:

```sh
# Terminal 1: API và database
pnpm server:dev
```

Để nạp cấu hình tích hợp riêng đã lưu trên máy, dùng `pnpm server:local`
thay cho `server:dev`. Lệnh đọc `.local/portal/speaking.env`, `google.env`,
`email.env` và cuối cùng `gemini.env` nếu có; không tự bật dịch vụ đang để tắt.

```sh
# Terminal 2: giao diện
pnpm dev
```

- Giao diện: <http://127.0.0.1:5173>; đăng nhập tại `/login`.
- API riêng của Project_L: <http://127.0.0.1:4003/api/v1/health>.
- SQLite: `.local/portal/portal.sqlite`; tài khoản, học vụ và tệp đính kèm được lưu
  trong database theo cấu hình mặc định. Tệp bài làm mới có thể chọn Google Drive
  sau khi cấu hình phía máy chủ; tệp cũ không tự chuyển. Thư mục `.local/` được
  Git bỏ qua.
- Vite gửi cùng-origin `/api/v1` đến `http://127.0.0.1:4003` mặc định. Nếu đã có
  `.env.local` trỏ `PORTAL_API_TARGET` về cổng 4002, cập nhật sang cổng 4003 rồi
  khởi động lại Vite. `.env.example` mô tả cấu hình an toàn.
- `PORTAL_API_PORT`, `PORTAL_DB_PATH` và `PORTAL_WEB_ORIGIN` là cấu hình phía máy
  chủ; giữ đích proxy Vite và origin được phép khớp với môi trường chạy.

Nếu pnpm chưa có trong PATH trên máy hiện tại, thay `pnpm` bằng
`./scripts/pnpm.ps1` trong các lệnh trên. Script dùng runtime cục bộ của Codex.

Xem bản build bằng `pnpm build` rồi `pnpm preview` tại
<http://127.0.0.1:4173>; API vẫn phải chạy riêng. Vite preview không phải cấu hình
hosting production. Khi triển khai cần SPA fallback về `index.html` và reverse
proxy `/api/v1` đến API, cùng cấu hình HTTPS, database và vận hành đã được duyệt.

Bản thử online được chuẩn bị theo phương án **Vercel cho frontend + Railway
cho backend có volume SQLite riêng**. Làm theo
[hướng dẫn triển khai Vercel + Railway](docs/DEPLOY-VERCEL-RAILWAY.md) để nối hai
dịch vụ, khởi tạo quản trị viên và kiểm tra dữ liệu sau redeploy. Cấu hình trong
repo chưa xác nhận đã triển khai hoặc kiểm thử cloud thành công.

## Khởi tạo lớp học thật

1. Đăng nhập quản trị viên. Trong **Tài khoản**, tạo tài khoản giáo viên, trợ
   giảng và học viên với mật khẩu riêng. Tạo/khóa/đổi vai trò tác động đến quyền
   truy cập thật; quản trị có thể đặt lại mật khẩu thủ công.
2. Trong **Lớp học**, tạo lớp, chọn giáo viên/trợ giảng phụ trách và ghi danh các
   tài khoản học viên. Chỉ tài khoản đúng vai trò, đang hoạt động được ghi danh.
3. Giáo viên đăng nhập tài khoản của mình, tạo **Chương trình học**, **Học liệu** và
   **Bài tập** cho lớp được phân công. Điền tiêu đề/hướng dẫn VI/EN, chọn kỹ năng,
   hạn nộp và trạng thái xuất bản. Có thể đính kèm học liệu hoặc âm thanh.
4. Học viên đăng nhập, mở bài đã xuất bản, lưu nháp rồi nộp. Giáo viên xem bài
   nộp trong **Chấm bài**, trả điểm 0–9 kèm nhận xét. Học viên xem kết quả và
   lịch sử trong **Kết quả học tập**.
5. Giáo viên hoặc quản trị tạo lịch học và khung tư vấn, chọn giáo viên phụ trách
   và nhập liên kết Zoom thật nếu đã có. Học viên có thể đặt tư vấn trước khi
   hoàn thành bài; máy chủ kiểm tra bài bắt buộc khi học viên yêu cầu vào buổi tư vấn.
6. Sau giờ bắt đầu buổi review 1:1, giáo viên phụ trách mở **Thời khóa biểu**,
   chọn **Đã diễn ra** hoặc **Tất cả** rồi **Xác nhận kết quả**. Học viên xem nhận
   xét trong bộ lọc **Review đã có kết quả**; đây là kết quả buổi review, riêng
   với điểm bài tập.

Học viên vào **Tổng quan → Chọn giờ review**, hoặc **Thời khóa biểu** và lọc
**Loại buổi → Review 1:1**. Chọn giờ trống, bấm **Đặt lịch review 1:1**;
bật **Chỉ xem lịch review tôi đã đặt** để xem lịch riêng, hoặc **Hủy đặt chỗ**
khi cần. Khung do giáo viên phụ trách và có một chỗ cho học viên. Được đặt
trước khi làm đủ bài; điều kiện nộp bài vẫn kiểm tra lúc vào Zoom. Website
áp dụng quy tắc đã xác nhận ngày 11/10/2026: buổi chính đầu tiên được miễn
1:1; trước mỗi buổi chính tiếp theo, học viên phải hoàn thành review kiến
thức của buổi trước và được giáo viên phụ trách xác nhận. Khi tạo khung 1:1,
chọn buổi chính mà review chuẩn bị cho; khung phải nằm sau giờ kết thúc buổi
trước và trước giờ bắt đầu buổi được chọn. Chỉ đặt chỗ hoặc kết quả “Không
tham dự” không mở quyền vào lớp chính. Một review không mở nhiều buổi học.

Trong **Cài đặt → Học liệu tự biên soạn**, quản trị có thể tạo bộ
**English Foundations · Starter 01**: 3 bài học, 12 bài tập Reading,
Listening, Writing, Speaking và 3 audio Listening có giọng tổng hợp.
Lệnh tạo có thể chạy lại mà không tạo trùng. Lớp riêng tư, toàn bộ bài tập
ở trạng thái nháp; giáo viên cần duyệt nội dung, giao từng bài và đặt hạn
nộp. Không tự tạo học viên, lịch học hoặc kết quả. Hướng dẫn, đáp án và
transcript chỉ dành cho quản trị/giáo viên được phân công, tại **Chương
trình học** hoặc **Học liệu**.

Các tài khoản nhìn thấy cùng dữ liệu được lưu trên máy chủ theo quyền của mình.
Giao diện cập nhật sau thao tác, khi trở lại tab và định kỳ trong lúc tab đang mở;
nút tải lại dùng để kiểm tra thay đổi mới. Không còn chọn vai trò xem trước để
vào `/learn`. Tài khoản bản trial cổng 4002 không đăng nhập được vào API mới.

## Phạm vi đang hoạt động

- **Quản trị:** tạo/cập nhật tài khoản, khóa đăng nhập, đặt lại mật khẩu, quản lý
  lớp và thành viên, nội dung, lịch, điểm danh, thông báo; xem bài nộp và kết quả.
  Máy chủ ghi nhật ký hoạt động. Chỉ giáo viên được trả điểm trong luồng chấm bài.
- **Giáo viên:** quản lý nội dung, lịch và điểm danh của lớp được giao; giao bài
  bốn kỹ năng, xem bài nộp và trả nhận xét đúng phiên bản; gửi thông báo đến
  thành viên trong lớp phụ trách.
- **Trợ giảng:** đọc thông tin lớp được giao, danh sách học viên, lịch, nội dung,
  điểm danh và trạng thái chuẩn bị; thêm/đổi link Zoom trong lớp được giao.
  Quyền sửa link không cho phép sửa lịch hoặc học thuật. Nội dung câu trả lời,
  tệp bài nộp và nhận xét riêng được loại khỏi dữ liệu trả về cho trợ giảng.
- **Học viên:** xem lớp được ghi danh, học liệu và bài đã xuất bản, lưu nháp,
  nộp văn bản/tệp, nghe âm thanh và ghi âm câu trả lời khi trình duyệt cho phép;
  xem phản hồi/lịch sử của mình, điểm danh, đặt/hủy tư vấn và sổ từ vựng riêng.

Bài nộp giữ bản chụp đề bài và nội dung của lần nộp đó. Sửa nháp không đổi bài
đã nộp; nộp lại tạo phiên bản mới. Phản hồi gắn với một phiên bản cụ thể và không
tự chuyển sang lần nộp tiếp theo. Ghi chú riêng, nháp và từ vựng thuộc tài khoản
của học viên; giáo viên không nhận ghi chú riêng trong bài nộp. Xung đột phiên
bản hoặc thay đổi quyền được máy chủ kiểm tra lại khi lưu; lỗi giữ nội dung đang
nhập để người dùng kiểm tra và hợp nhất thay đổi.

PDF, ảnh và tệp âm thanh được tải qua API có xác thực, tối đa 8 MB mỗi tệp trong
giao diện. Đề bài có nút xem PDF/ảnh ngay trong vùng học liệu, với tải xuống dự
phòng. Ghi âm Speaking thông thường tối đa 5 phút; cần quyền micro. Luồng AI
riêng nhận bản ghi 3 giây–4 phút và cần cấu hình nhà cung cấp AI như hướng dẫn bên dưới.

Quản trị có mục **Cài đặt → Google Drive** để đăng nhập Gmail trung tâm,
duyệt thư mục và xác nhận nơi lưu bài nộp. Cần cấu hình OAuth client Google
Cloud một lần trong `.local/portal/google.env`; chưa có cấu hình này nên
chưa kiểm thử đăng nhập, chọn thư mục và tải lên Google thật. Tệp mới chỉ
chuyển sang Drive sau khi quản trị xác nhận thư mục. Khi mất xác thực, tải
lên tạm dừng; chỉ thao tác ngắt kết nối rõ ràng mới chuyển tệp mới về SQLite.
Tệp cũ không tự di chuyển hoặc xóa. Nội dung bài nộp, phiên bản, quyền và
tham chiếu tệp vẫn do API/SQLite quản lý. Hướng dẫn VI/EN, biến môi
trường, cấu hình thủ công thay thế và kịch bản nghiệm thu nằm trong
[Google Drive storage](docs/GOOGLE-DRIVE-STORAGE.md). Mật khẩu, khóa riêng và
refresh token chỉ đặt trong cấu hình máy chủ/tệp riêng được Git bỏ qua.

Lịch và đặt chỗ được kiểm tra sức chứa, trùng giờ và quyền ghi danh trên máy chủ.
Liên kết Zoom do quản trị, giáo viên hoặc trợ giảng được giao nhập được giữ riêng:
danh sách lịch
chỉ trả trạng thái đã có liên kết. Khi vào tư vấn, học viên phải có đặt chỗ đang
hiệu lực và đã nộp phiên bản hiện tại của tất cả bài đang xuất bản, bắt buộc trong
lớp. Quy tắc chặn lớp chính theo bài chuẩn bị còn cần xác nhận; hiện lớp chính
kiểm tra quyền truy cập lớp và điều kiện review 1:1, không áp dụng riêng
điều kiện bài tập của tư vấn.

Thông báo trong cổng học được lưu riêng từng tài khoản, gồm thông báo gửi thủ
công, bài nộp, phản hồi, kết quả review và thay đổi lịch. Đánh dấu đã đọc được lưu
trên máy chủ. Hàng đợi email SQLite, mẫu VI/EN, kiểm tra điều kiện gửi, chống
trùng, thử lại có giới hạn và adapter Resend đã được chuẩn bị. Gửi mặc định tắt;
chưa có tài khoản nhà cung cấp, domain gửi hoặc khóa API được cấu hình, chưa gửi
email thật. Quản trị xem trạng thái tại **Cài đặt**; hướng dẫn cấu hình và vận
hành trong [Email delivery](docs/EMAIL-DELIVERY.md). Resend là adapter kỹ thuật,
chưa phải lựa chọn thương mại của khách hàng. Email/nhắc lịch, Speaking AI và
luyện từ vựng AI vẫn cần nghiệm thu tích hợp thật. Tự tạo cuộc họp Zoom là tùy
chọn tương lai theo xác nhận ngày 10/10/2026,
không còn là điều kiện nghiệm thu lõi. Nhập link có sẵn không cần khóa Zoom API.
Không tạo phản hồi AI hoặc báo gửi email thành công giả khi chưa cấu hình dịch vụ.

### Không gian làm bài và ghi chú riêng

Không gian làm bài có ba vùng: đề/học liệu, bài làm và từ điển/sổ từ; bố cục thu
gọn theo màn hình. Reading/Listening cho tô sáng và ghi chú trên đúng đoạn đề,
ngôn ngữ và phiên bản đang đọc. Phiên bản đề mới có bộ ghi chú riêng; bản cũ
vẫn được giữ, không tự gắn ghi chú vào văn bản đã đổi. Writing có ba cột trên
desktop: đề/học liệu bên trái, bài viết và sơ đồ ở giữa, từ điển/sổ từ bên phải.
Cả sơ đồ nhánh và vẽ tự do đều lưu/mở lại riêng với bài viết. Giáo viên có thể
bật hạn chế dán/kéo thả trong ô bài viết; đây là hỗ trợ trên trình duyệt, không
xác minh tác giả hoặc bảo đảm chống gian lận. Ghi chú riêng không bị hạn chế.
Bài làm văn bản/tệp vẫn được hỗ trợ. Reading và Listening có thể bổ sung bộ câu hỏi riêng
như mô tả dưới đây; bài cũ không bắt buộc chuyển đổi. Chưa có ngân hàng câu hỏi
dùng chung, bộ đáp án hoặc chấm tự động theo từng câu.

Bản nháp, ghi chú và sơ đồ tự lưu sau 5 giây ngừng chỉnh sửa khi trạng thái cho
phép, đồng thời có nút lưu thủ công. Chỉ báo đã lưu khi API xác nhận; lỗi hoặc
xung đột dừng tự lưu và giữ nội dung trong biểu mẫu để khôi phục. Máy chủ kiểm
tra phiên bản đề, phiên bản bản ghi và quyền hiện tại. Phần chưa được máy chủ
xác nhận không có bảo đảm khôi phục ngoại tuyến sau khi đóng trang. Ghi chú,
sơ đồ và sổ từ là dữ liệu riêng, không đi kèm bài nộp gửi giáo viên.

Học viên chủ động bấm **Tra nghĩa tiếng Anh** để gọi Free Dictionary API; chỉ
từ/cụm từ cần tra được gửi, không gửi bài làm. Kết quả có nghĩa tiếng Anh cùng
nguồn/giấy phép khi nhà cung cấp trả về; không phải dịch hoặc phản hồi AI. Có thể
tự nhập nghĩa khi tra từ lỗi. Lưu từ ngay trong bài gắn nguồn tiêu đề/phiên bản
đề đã được máy chủ xác thực, cùng ví dụ và chủ đề tự nhập. Tạo từ mới trùng cả
từ và nghĩa trong cùng sổ bị từ chối sau khi bỏ khoảng trắng đầu/cuối và so sánh
không phân biệt hoa thường; từ cũ không bị ghi đè. Sổ hiển thị nguồn và dẫn về
bài hiện tại nếu học viên còn quyền xem.

### Bài Reading và Listening có câu hỏi

Quản trị và giáo viên phụ trách có thể bật bộ câu hỏi trong Reading hoặc Listening, nhập
nhóm câu/hướng dẫn VI/EN, số bắt đầu và ba dạng: chọn một đáp án/ghép đoạn,
chọn nhiều với số lượng bắt buộc, hoặc trả lời ngắn có giới hạn từ. Một bài tối
đa 40 ô trả lời được đánh số; câu chọn hai đáp án chiếm hai số. Nội dung do người
dạy nhập, không tự sao chép bài đọc, câu hỏi hoặc đáp án của YouPass.

Giao diện tham khảo cách thao tác của trang Reading YouPass: vùng bài đọc và câu
hỏi cuộn riêng trên desktop, danh sách số câu để chuyển nhanh, tiến độ hoàn thành,
đánh dấu cần xem lại, cỡ chữ S/M/L và nền dịu. Trên màn hình nhỏ, các vùng xếp lại
theo chiều dọc. Highlight, ghi chú riêng và tra từ dùng lại không gian học tập hiện
có. Cờ xem lại tự lưu cùng ghi chú riêng theo tài khoản và phiên bản đề, giữ lại
khi mở bài lần sau; nút chuyển nhanh tìm câu chưa hoàn tất hoặc đã đánh dấu.
Đồng hồ có thể tạm dừng, tự dừng khi tab ẩn và chỉ thuộc lần mở hiện tại,
không đặt thời hạn hoặc tự nộp bài. Listening
dùng cùng bố cục và kiểu câu hỏi; giáo viên đính kèm tệp âm thanh trong vùng đề.
Học viên chủ động phát/nghe lại. Chưa áp dụng giới hạn số lần nghe hay tự chép
lời âm thanh Listening. Highlight chỉ áp dụng cho văn bản đề, không cho nội dung
bên trong PDF/ảnh hoặc âm thanh.

Tra từ hỗ trợ Enter và hủy yêu cầu đang chạy. Chọn nghĩa khác hoặc xóa nội dung
sổ từ chưa lưu có bước xác nhận ngay trong khung; ví dụ và chủ đề tự nhập được
giữ lại. Nút Ghi chú cạnh bài đọc tạo ghi chú cho đoạn đang chọn và đưa con trỏ
đến ô nhập; phím H/N/T chỉ hoạt động khi vùng bài đọc đang được focus.

Bản nháp tự lưu gồm câu trả lời theo ID câu hỏi và bản chụp bộ câu hỏi của phiên
bản đề đó. Lưu nháp cho phép chưa trả lời hết; nộp bài cần hoàn tất đúng kiểu đáp
án, đủ số lựa chọn khác nhau và đúng giới hạn từ. Tiến độ chỉ đo mức hoàn thành,
không kết luận đúng/sai. Bài nộp giữ riêng bộ câu hỏi, câu trả lời và phiên bản để
giáo viên chấm; đổi đề sau này không viết lại lịch sử. Chỉ giáo viên trả điểm 0–9
và nhận xét; chưa có đáp án chuẩn hoặc chấm tự động từng câu.

Khi đề thay đổi, lưu/nộp dừng cho đến khi học viên đọc và xác nhận phiên bản mới.
Hệ thống chỉ chuyển câu trả lời còn tương thích; không tự cắt lựa chọn hoặc đổi
ID câu. Bản trả lời trước khi đổi được giữ để đối chiếu/sao chép trong lần mở
trang hiện tại. Đây không phải kho khôi phục ngoại tuyến sau khi đóng trang.

### Speaking với Google Gemini

Ngày 12/10/2026, người dùng chọn chuyển Speaking sang Google Gemini. Nhập khóa
vào `PORTAL_GEMINI_API_KEY` trong tệp riêng `.local/portal/gemini.env`;
`PORTAL_AI_PROVIDER=gemini` chọn adapter Gemini. Không nhập khóa vào chat hoặc
biến `VITE_`. Khóa OpenAI cũ trong `speaking.env` được giữ riêng và không được
dùng thay cho khóa Gemini. Sau khi lưu cấu hình, khởi động lại API bằng
`pnpm server:local` hoặc `pnpm server:ai`; hai lệnh đọc `gemini.env` sau
`speaking.env`. `pnpm server` thông thường không nạp các tệp riêng này.

Luồng Speaking hỗ trợ đọc câu hỏi đã lưu, chép lời bản ghi và nhận xét bốn tiêu
chí. Học viên chủ động chọn bản ghi và yêu cầu xử lý; đánh giá dùng âm thanh
thật, kể cả phát âm. Kết quả chỉ để luyện tập, không thay điểm giáo viên hay
chứng nhận IELTS. Lịch sử giữ nhà cung cấp và model đã dùng; chuyển nhà cung cấp
không đổi dữ liệu cũ. Âm thanh Gemini được phục vụ dưới dạng WAV, OpenAI dưới
dạng MP3.

Khóa Gemini đã được nhập vào tệp riêng; API cục bộ cổng 4003 đang dùng Gemini.
Ngày 12/10/2026 đã kiểm thử Google API thật: xác nhận truy cập hai model, tạo
âm thanh WAV hợp lệ, chép lời và nhận phản hồi tiếng Việt đủ bốn tiêu chí theo
cấu trúc yêu cầu. Bài kiểm thử dùng văn bản gốc và âm thanh tổng hợp mới trong
môi trường QA riêng; không gửi bản ghi sẵn có của học viên. Giáo viên vẫn cần
đánh giá độ chính xác trên bài nói thật trước khi nghiệm thu chất lượng.
Lần thử OpenAI trước đó trả HTTP 429 `credit_balance_exhausted` /
`insufficient_quota` cho cả tạo giọng và chép lời; lần đó không tạo được đầu ra.
Xem [bằng chứng kiểm thử Gemini](docs/SPEAKING-AI.md#real-provider-verification).

Việc đổi nhà cung cấp giữ nguyên hạn thử đã duyệt:
`2026-10-12T12:15:41.633Z`, tức **20:15:41 ngày 12/10/2026, giờ Singapore**.
Khởi động lại hoặc đổi khóa không gia hạn. Máy chủ chặn công việc mới khi hết
hạn; yêu cầu đã gửi có thể vẫn được nhà cung cấp xử lý/tính phí. Giới hạn số
yêu cầu không phải trần chi phí. Chỉ bật xử lý trong thời gian được duyệt và
giữ cấu hình QA riêng. Xem [cấu hình, giới hạn và khôi phục Speaking AI](docs/SPEAKING-AI.md).

### Kết quả buổi review 1:1

Chỉ giáo viên đang được phân công làm người phụ trách buổi 1:1 được xác nhận
**Đã hoàn thành** hoặc **Không tham dự**, sau giờ bắt đầu, khi đặt chỗ còn hiệu
lực và học viên còn hoạt động trong lớp. Nhận xét hiển thị cho chính học viên;
giáo viên được giao lớp và quản trị được đọc, trợ giảng không nhận dữ liệu kết
quả/nhận xét này. Sửa kết quả cần kiểm tra phiên bản buổi, đặt chỗ và kết quả;
các lần sửa có lịch sử và nhật ký. Điểm 0–9 vẫn chỉ nằm trong chấm bài nộp.

Xác nhận không đổi trạng thái đặt chỗ lịch sử. Buổi đã có kết quả không thể
hủy, đổi giờ, đổi loại, đổi sức chứa hoặc đổi giáo viên phụ trách; vẫn sửa được
tên và link Zoom theo quyền hiện tại. Kết quả hoàn thành chỉ mở buổi chính
đã gắn với review khi quan hệ bài trước/bài kế tiếp còn đúng. Máy chủ kiểm
tra lại phiên bản hai buổi này khi xác nhận; nếu lịch thay đổi, giao diện
giữ nhận xét đã nhập để giáo viên kiểm tra trước khi lưu lại.

### Tổng quan việc học và ôn từ vựng

**Tổng quan** hiển thị việc cần làm từ dữ liệu của các lớp đang hoạt động: bài
quá hạn, bài đến hạn trong 48 giờ, bản nháp đã lưu và đề bài vừa thay đổi. Lịch
của học viên chỉ gồm lớp chính và các buổi review đã đặt; giờ review trống được
xem qua **Chọn giờ review**. Bảng bốn kỹ năng đếm bài đã nộp đúng phiên bản đề
hiện tại; điểm trung bình dùng bản đã chấm mới nhất của mỗi bài trong phiên bản
đó. Đây là điểm bài tập do giáo viên chấm, không phải điểm trình độ được suy đoán.

Giáo viên/quản trị thấy bản nộp hiện tại cần chấm và số bài chuẩn bị còn thiếu
theo lớp; các bản nộp cũ vẫn nằm trong lịch sử. Trợ giảng chỉ xem tổng hợp chuẩn
bị, không nhận câu trả lời hoặc nhận xét riêng. Khi lọc lớp, số từ đến hạn và
thông báo chưa đọc vẫn tính trên toàn tài khoản và có nhãn rõ phạm vi đó.

Học viên mở **Sổ từ vựng → Ôn từ đến hạn**, hoặc vào
`/learn#notebook/practice`. Có bộ lọc chủ đề, hướng nhớ từ → nghĩa hoặc nghĩa →
từ, tối đa 20 từ mỗi lượt. Có thể nhập câu trả lời để tự nhớ, mở đáp án đã lưu,
rồi tự đánh giá mức nhớ. Phần nhập để nhớ chỉ nằm trong phiên giao diện, không
được lưu như bài nộp hoặc gửi cho giáo viên. Lịch ôn chỉ cập nhật sau khi máy chủ
xác nhận lưu; sổ và kết quả tự ôn thuộc riêng học viên.

- Từ mới được ôn ngay. Mức `again` hẹn lại sau 10 phút; `hard` sau một ngày.
- `good` tăng một mức và `easy` tăng hai mức, dùng các khoảng 1, 3, 7, 14 và 30
  ngày theo mức hiện tại. Máy chủ quyết định thời điểm lưu và lịch ôn tiếp theo.
- `Word.practice` lưu số lượt ôn, mức hiện tại, lần tự đánh giá cuối, giờ ôn gần
  nhất và hạn ôn tiếp theo. Đây là quy tắc tự ôn cục bộ; chưa chốt chính sách
  nhắc lại chủ đề hoặc thời điểm gửi email cho khách hàng.
- Đổi từ hoặc nghĩa bắt đầu lại lịch ôn; chỉ sửa ví dụ/chủ đề giữ lịch đang có.
  Biểu mẫu cảnh báo khi rời nội dung chưa lưu. Nếu từ hoặc lịch ôn thay đổi ở
  nơi khác, nội dung nhập được giữ; kiểm tra bản mới rồi chọn dùng phiên bản mới
  trước khi lưu. Từ đã bị xóa không thể cập nhật bằng biểu mẫu cũ.

Ôn tập này dùng từ, nghĩa và ví dụ học viên tự lưu. Nó chưa tạo câu hỏi, chấm
câu trả lời hoặc phản hồi bằng AI; các dạng luyện từ AI trong đặc tả vẫn cần
triển khai và đánh giá riêng.

### Quản lý link Zoom

Quản trị viên, giáo viên và trợ giảng được phân công nhập link Zoom một lần
cho lớp hoặc riêng từng buổi. Mỗi buổi chọn dùng link chung, link riêng hoặc
chưa có link; tư vấn 1:1 mặc định chưa cấu hình và cần chọn nguồn link rõ ràng.
Đổi link chung chỉ tác động đến buổi đang dùng nguồn đó. Trợ giảng chỉ có thêm
quyền sửa link, không có thêm quyền sửa lịch, học liệu, điểm danh hoặc chấm bài.
Lưu link cần kiểm tra phiên bản và quyền hiện tại, giữ nội dung nhập khi xung đột.
URL vẫn riêng tư và chỉ được trả sau kiểm tra quyền tham gia, đặt chỗ và bài
chuẩn bị phù hợp. Luồng này đã được triển khai cục bộ; điểm danh tự động và
ánh xạ danh tính Zoom còn cần làm rõ.

- Trong **Thời khóa biểu**, chọn lớp rồi bấm **Link Zoom của lớp** để nhập
  link dùng chung và **Lưu cài đặt Zoom**.
- Ở từng buổi, chọn **Sửa link Zoom** để dùng link chung, link riêng hoặc
  chưa gắn link. Link riêng không đổi khi link chung được cập nhật.
- Giáo viên/quản trị tạo hoặc sửa lịch học; trợ giảng chỉ chỉnh phần link.
  Học viên mở link bằng **Tham gia Zoom** sau khi máy chủ kiểm tra quyền.

## Danh mục khóa học công khai

`/courses` đọc `/api/v1/public/courses`, chỉ hiển thị lớp đang hoạt động và được
quản trị chủ động bật **Hiển thị trong danh mục công khai**. Lớp mới mặc định
không được công bố và mặc định chưa mở nhận đăng ký. API chỉ trả mã lớp, tên,
trình độ, mô tả và cờ `enrollmentOpen`; không trả thành
viên, bài tập, bài nộp hoặc liên kết họp. Có tìm kiếm và lọc trình độ theo dữ
liệu thật, trạng thái tải/lỗi/thử lại và danh sách trống. Không thêm học phí,
thời lượng, tên giáo viên hay số liệu chưa được cung cấp. Ghi danh được quản
trị thực hiện; catalog không tự cấp quyền vào lớp.

### Đăng ký lớp và xét duyệt

Học viên xem lớp đang nhận đăng ký và gửi yêu cầu. Lớp phải đang hoạt động,
được công khai và được quản trị bật nhận đăng ký. **Quản trị viên phải duyệt**;
gửi yêu cầu không tự ghi danh và không cấp quyền xem bài hoặc vào Zoom.
Học viên chỉ xem yêu cầu của mình: chờ duyệt, đã duyệt, từ chối, đã hủy; có thể
hủy khi còn chờ hoặc gửi lại sau khi bị từ chối/hủy. Quản trị có thể ghi chú khi
xử lý; thao tác duyệt kiểm tra phiên bản và tạo thành viên trong cùng giao dịch.
Giáo viên/trợ giảng không có quyền duyệt. Không tạo yêu cầu chờ hoặc thành viên
trùng; quản trị vẫn có thể ghi danh trực tiếp. Luồng yêu cầu và xét duyệt đã
được triển khai cục bộ.

1. Quản trị mở **Lớp học**, bật **Lớp đang hoạt động**, **Hiển thị trong danh mục
   công khai** và **Mở đăng ký cho học viên**, rồi lưu lớp.
2. Học viên mở **Lớp học → Lớp mở đăng ký**, chọn lớp và bấm **Gửi yêu cầu
   đăng ký**. Mục **Yêu cầu của tôi** hiển thị trạng thái và phản hồi; có thể
   **Hủy yêu cầu** khi còn chờ duyệt.
3. Quản trị xử lý trong **Yêu cầu đăng ký lớp học**, nhập phản hồi nếu cần,
   rồi **Duyệt và ghi danh** hoặc từ chối. Sau khi duyệt, lớp xuất hiện trong
   **Lớp của tôi** của học viên cùng quyền truy cập nội dung tương ứng.

Dữ liệu mô phỏng theo yêu cầu chỉ nằm trong môi trường QA được ghi nhãn rõ và
dùng database riêng, không nhập vào dữ liệu thật. Kiểm thử bằng dịch vụ giả lập
không chứng minh Zoom/email/AI đã tích hợp nhà cung cấp thực.

## Kiểm tra

```sh
pnpm test:portal
pnpm test:server
pnpm check
```

`pnpm test:portal` giữ các kiểm thử hồi quy mô hình frontend và phân tích phiên
đăng nhập, gồm các mô hình demo cũ còn trong repo. `pnpm test:server` kiểm tra
xác thực, tài khoản, quyền theo lớp, lưu trữ, phiên bản bài nộp/nhận xét, tệp,
đặt chỗ, kết quả review, ghi chú theo phiên bản, sổ từ, hàng đợi email, điều kiện
vào học và dữ liệu công khai. Kiểm thử Reading bổ sung đánh số, giới hạn câu trả
lời, tiến độ, đổi phiên bản và lưu bản chụp theo quyền. Test email dùng transport
giả lập, không gửi thư.
`pnpm check` chạy TypeScript,
ESLint, Prettier và production build. Không coi kiểm thử mô hình demo cũ là bằng
chứng cho quyền trên API mới. Kiểm tra thêm desktop/mobile và thao tác nhiều
tài khoản khi đổi giao diện hoặc luồng học vụ.

Release 0.0.1 passes 84 portal tests, 154 server tests and `pnpm check`, including
structured Listening, isolated Speaking queue/provider tests, one-day expiry,
quota failures, Drive OAuth boundaries, curriculum import and the linked review
gate. The final server-only quota adjustment also passed targeted ESLint and
the complete server suite. These checks do not establish delivered OpenAI
assessment, email delivery or real Google Drive acceptance. See the
[release notes](docs/RELEASE-0.0.1.md) for browser and package verification.
The earlier Reading teacher-authoring save is now confirmed; see
[Reading verification](docs/READING-VERIFICATION.md).

Đợt cải tiến ngày 10/10/2026 đã đạt `pnpm check`, 59 kiểm thử máy chủ và 53
kiểm thử frontend/mô hình. Đã kiểm tra tổng quan bốn vai trò, VI/EN, desktop
1366 px và mobile 390 px; thử lưu lượt ôn, giữ nội dung khi xung đột và đọc lại
sau khi khởi động lại API. Ảnh QA nằm trong `output/qa/learning-improvements/`.
Kiểm thử Drive dùng dịch vụ giả lập, gồm lỗi nhà cung cấp, đổi quyền giữa yêu
cầu, toàn vẹn tệp và giữ lịch sử; chưa xác minh với Google thật. Nhánh hộp
thoại xác nhận rời trang chưa được xác minh hết do trình duyệt tự động hóa bị
chặn tại hộp thoại. Kết quả này không xác nhận tích hợp AI/email hoặc triển khai
production.

`pnpm format` tự format mã nguồn. ESLint kiểm tra React Hooks và accessibility.
VS Code có format-on-save và extension đề xuất; extension không được tự cài.
ESLint 9.39.5 và TypeScript 5.9.3 hiện được khóa cùng bộ plugin tương thích;
giữ lockfile và nâng dependency theo một thay đổi riêng.

## Cấu trúc

```text
server/                       # API Node, SQLite, xác thực và học vụ
shared/portal.ts              # Kiểu dữ liệu chung server/frontend
src/
  app/App.tsx                 # Chọn trang theo pathname
  pages/EliteLandingPage.tsx   # Landing theo mẫu Elite Pathway
  pages/LiveCoursesPage.tsx    # Catalog thật từ dữ liệu công khai của API
  pages/LoginPage.tsx          # Đăng nhập tài khoản Project_L
  pages/LiveLearningPortalPage.tsx # Khung portal có xác thực
  features/live/              # Học vụ, tài khoản, lịch, bài nộp và tệp
  features/auth/              # API client và xác minh phiên
  features/courses/           # Catalog demo cũ, không dùng cho route thật
  features/learning/          # Mô hình học tập demo cũ và hồi quy
  features/management/        # Mô hình MIS demo cũ và hồi quy
  i18n/                       # Nội dung và ngôn ngữ
  styles/                     # Token nâu vàng chung; layout landing và học vụ riêng
scripts/pnpm.ps1              # Chạy pnpm bằng runtime cục bộ
```

Import trong `src` dùng alias `@/`. Các trang dùng pathname/liên kết trình duyệt;
chưa cần thư viện router hoặc state manager. Token phiên ở sessionStorage và
được xác minh lại với API; quyền được kiểm tra trên máy chủ cho từng yêu cầu.
Đăng xuất thu hồi phiên máy chủ và xóa phiên trình duyệt. Khóa tài khoản, đổi
vai trò hoặc đặt lại mật khẩu thu hồi phiên của tài khoản bị thay đổi.

## Thiết kế và nội dung tham chiếu

`PRODUCT.md` ghi phạm vi và quyết định còn mở, `AGENTS.md` hướng dẫn triển khai,
`DESIGN.md` ghi hệ giao diện. `/login` và `/learn` dùng tông nâu vàng kế thừa
landing Elite; cổng học tập giữ cấu trúc quản lý theo vai trò và font Be Vietnam
Pro để đọc biểu mẫu, bảng và bài học. Trang đăng nhập đã bỏ khối giới thiệu các
vai trò. Landing/catalog giữ kiểu chữ hiển thị Elite riêng. Chưa lưu mặc định comp-first/code-first. Dùng
`design-taste-frontend` cho landing/redesign và `impeccable` cho giao diện sản phẩm;
kiểm tra desktop/mobile, bàn phím, lỗi và tương tác chính.

Nút VI/EN lưu lựa chọn trong localStorage với khóa `project-l-language`. Khi
storage bị chặn, lựa chọn vẫn dùng trong phiên hiện tại. Font Be Vietnam Pro
được self-host qua `@fontsource/be-vietnam-pro`; icon dùng Phosphor.

Landing `/`, `/vi`, `/en` dựng theo [mẫu Elite Pathway](https://elitepathwayeducation.com/vi),
giữ logo, ảnh, nội dung và hệ màu tham chiếu. Nút đăng nhập dẫn đến `/login` trên
cùng frontend; `VITE_LEARNER_PORTAL_URL` cũ không được dùng. Nội dung tham chiếu,
chứng chỉ, số liệu và cảm nhận không phải tuyên bố đã được xác minh về Project_L;
xem [REFERENCE-ASSETS.md](REFERENCE-ASSETS.md). Form liên hệ chỉ mở bản nháp
email, để người dùng tự gửi trong ứng dụng email, không lưu hoặc gửi yêu cầu
liên hệ trên API.

`/studio-demo` giữ bản digital studio giả định phục vụ thử giao diện; form ở đó
không gửi hoặc lưu dữ liệu. Các ảnh/kết luận kiểm tra demo trước đây chỉ mô tả
bản demo tại thời điểm kiểm tra, không xác nhận backend hoặc bản production mới.

## Môi trường, phạm vi còn mở và bản trial

Chỉ dùng biến `VITE_*` cho cấu hình công khai. Secret/khóa nhà cung cấp thuộc máy
chủ. Trang có `noindex, nofollow`; nội dung thật, metadata, SEO, hosting, HTTPS,
backup/khôi phục, tải dự kiến và nghiệm thu vận hành phải được chốt trước khi
xuất bản. SQLite là lựa chọn chạy độc lập hiện tại; lựa chọn database production
và khả năng chuyển sang PostgreSQL được ghi trong
[quyết định kiến trúc](docs/ARCHITECTURE-DECISIONS.md).

Bản Globussoft tại `.local/globussoft-school-mis` là môi trường tham chiếu riêng:
giao diện cổng 3001, API cổng 4002 và database/tài khoản riêng. Có thể xem
[GLOBUSSOFT-TRIAL.md](GLOBUSSOFT-TRIAL.md) để chạy tham chiếu; không cần bật nó để
chạy Project_L. Không nhập dữ liệu trường học mẫu hoặc các module vận chuyển,
quản lý cơ sở vào portal này.

Phạm vi lõi và tiêu chí nghiệm thu giữ theo
[đặc tả tiếng Việt](docs/ELITE-TECHNICAL-SPEC.vi.md),
[đặc tả tiếng Anh](docs/ELITE-TECHNICAL-SPEC.en.md),
[kế hoạch tiếng Việt](docs/IMPLEMENTATION-PLAN.vi.md) và
[kế hoạch tiếng Anh](docs/IMPLEMENTATION-PLAN.en.md).
[Kiểm tra hệ thống và đầu vào còn thiếu ngày 11/10/2026](docs/SYSTEM-AUDIT-2026-10-11.vi.md)
ghi nhận kết quả 80/80 kiểm thử portal, 117/117 kiểm thử server và `pnpm check`,
cùng các lỗi và phần chức năng chưa hoàn tất. Trung tâm đã chọn Drive của Gmail;
email, hosting, tên miền, quy mô và trần chi phí thử một tháng còn chưa chốt.

Đợt bổ sung Drive, học liệu và điều kiện review 1:1 sau bản kiểm tra trên đã đạt
`pnpm check`, **83/83 kiểm thử portal** và **146/146 kiểm thử server**. Đã kiểm
tra giao diện desktop/điện thoại, tạo học liệu bằng API thật trên dữ liệu QA,
chuyển thông báo VI/EN và xác nhận giáo viên mở đúng một buổi chính cho học viên.
Google OAuth dùng gateway giả lập trong kiểm thử; chưa nghiệm thu với tài khoản
Google thật. Ở thời điểm của đợt kiểm tra đó, OpenAI mới được kiểm tra xác thực
và quyền model. Đợt 0.0.1 sau đó đã thử request thật và bị nhà cung cấp từ chối
do hết credit; xem [ghi chú phát hành](docs/RELEASE-0.0.1.md).

Tài liệu trao đổi khách hàng:

[danh mục chức năng VI/EN](docs/TRAINING-PLATFORM-FEATURES.vi-en.md) và
[bản PDF](output/pdf/Training-Platform-Features-VI-EN-v2.pdf).
Nội dung chương trình thật, học viên mục tiêu, lịch, giảng viên và học phí còn
cần cung cấp; bản chạy cục bộ không thay thế việc xác nhận các nội dung này.

Ưu tiên tiếp theo là bổ sung credit cho tài khoản API để thử Speaking trong
khung một ngày đã được cho phép; ngân sách dài hơn vẫn cần chốt. Sau khi có
đầu ra thật, kiểm chứng chất lượng, hoàn thiện đầy đủ dạng luyện từ AI theo
đặc tả, cấu hình và nghiệm thu gửi email thật, rồi
nghiệm thu Drive với thư mục/tài khoản được cung cấp. Ghi chú, sơ đồ Writing,
sổ từ tích hợp, Reading/Listening ba dạng câu hỏi và kết quả review đã có phần triển khai
cục bộ. Bộ học liệu khởi đầu đã có; chương trình chính thức, các dạng câu hỏi bổ sung,
đáp án/chấm tự động, quy tắc phát âm thanh, chính sách múi giờ/nhắc lịch và điều
kiện bài tập riêng của lớp chính vẫn cần chốt. Quy tắc review 1:1 trước lớp chính
đã được xác nhận và triển khai như trên; các mặc định kỹ thuật hiện tại không thay
thế quyết định học thuật hoặc vận hành.

## Tài liệu nền tảng

- [Vite](https://vite.dev/guide/)
- [Tailwind với Vite](https://tailwindcss.com/docs/installation/using-vite)
- [ESLint configuration](https://eslint.org/docs/latest/use/configure/configuration-files)
