# Kết quả kiểm tra hệ thống và đầu vào còn thiếu

Ngày kiểm tra: 11 tháng 10 năm 2026.

Website chạy được cục bộ và đạt các bộ kiểm tra hiện có. Chưa đủ điều kiện nghiệm
thu toàn bộ yêu cầu hoặc mở cho học viên sử dụng thật: còn lỗi phục hồi dữ liệu
đang nhập, chức năng AI và nhắc học chưa triển khai đủ, cùng các kết nối bên ngoài
chưa được nghiệm thu. Cung cấp API key không tự hoàn tất các chức năng còn thiếu.

Đợt này kiểm tra mã nguồn, đối chiếu yêu cầu khách hàng, chạy kiểm thử và thao tác
trên môi trường QA riêng. Không sửa mã ứng dụng, gửi điểm, gửi email, gọi AI trả phí,
đẩy bài nộp lên Drive hoặc triển khai công khai. Tài liệu này ghi kết quả tại thời
điểm kiểm tra; không thay thế đặc tả và các xác nhận tiếp theo của khách hàng.

## Các lựa chọn đã xác nhận

| Nội dung    | Trạng thái                                                                                                                                       |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Drive       | Dùng Google Drive của tài khoản Gmail trung tâm, theo hướng OAuth. Chưa có link thư mục hoặc kết nối đã xác minh.                                |
| Email       | Trung tâm chưa có dịch vụ gửi email; địa chỉ người gửi và tên miền gửi chưa được cung cấp. Resend mới là adapter kỹ thuật có sẵn.                |
| Speaking AI | Đã chọn OpenAI. Tệp cấu hình riêng tồn tại, khóa API còn trống và tính năng đang tắt.                                                            |
| Thử nghiệm  | Muốn chạy thử một tháng để đo mức sử dụng và chi phí. Chưa chốt số học viên, số người dùng đồng thời hoặc trần chi phí; AI trả phí tiếp tục tắt. |
| Hạ tầng     | Chưa có tên miền và hosting. Chưa triển khai production.                                                                                         |
| Zoom        | Nhân sự có quyền nhập link dùng chung cho lớp hoặc riêng từng buổi. Phạm vi này không cần API key Zoom.                                          |
| Ghi danh    | Học viên gửi yêu cầu, quản trị viên duyệt.                                                                                                       |

## Bằng chứng kiểm tra

| Kiểm tra                | Kết quả và giới hạn                                                                                                                                                                                                        |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm check`            | Đạt TypeScript, ESLint, Prettier và production build.                                                                                                                                                                      |
| `pnpm test:portal`      | 80/80 đạt; có cả kiểm thử mô hình cũ, không dùng chúng làm bằng chứng phân quyền server thật.                                                                                                                              |
| `pnpm test:server`      | 117/117 đạt; kiểm tra xác thực, quyền, phiên bản, nộp/chấm bài, tệp, đặt lịch và các nhánh tích hợp giả lập.                                                                                                               |
| HTTP cục bộ             | API 4003 và QA API 4004 trả health 200; trang đăng nhập 5173 và QA 4174 trả 200. Health không chứng minh kết nối nhà cung cấp.                                                                                             |
| Bốn vai trò             | Đăng nhập QA học viên, giáo viên, trợ giảng và quản trị. Học viên có lối vào lớp mở/đặt 1:1; giáo viên có chấm bài; trợ giảng không có chấm bài và bảng bài tập chỉ cho xem; quản trị có quản lý tài khoản.                |
| Tiếng Việt và tiếng Anh | Kiểm tra dashboard/menu tiếng Anh và trang cài đặt quản trị tiếng Việt.                                                                                                                                                    |
| Responsive              | Kiểm tra dashboard học viên desktop; dashboard/menu quản trị với viewport đặt 390 × 844, vùng nội dung đo được 375 px do thanh cuộn. Không thấy tràn ngang tại các màn hình đã xem. Không phải thử trên điện thoại vật lý. |
| Lỗi mất nhận xét        | Tái hiện trên bài Listening QA chưa chấm: nhập nhận xét, đóng chi tiết, mở lại; ô nhận xét rỗng, không có cảnh báo. Không gửi điểm.                                                                                        |
| Giới hạn đăng nhập      | Tái hiện bằng database trong bộ nhớ: 60 lần đăng nhập đúng cùng địa chỉ thành công; lần 61 trả 429. Không tạo 60 lượt trên tài khoản thật.                                                                                 |
| Detector Impeccable     | Một lượt trên các trang live, thư mục `src/features/live` và các CSS được chọn: không có cảnh báo chính; một advisory về cỡ chữ tiêu đề khóa học 1.25rem chưa nằm trong thang chữ DESIGN.md.                               |

Các luồng Reading/Listening, Writing, lưu nháp, nộp bài và từ vựng đã có bằng chứng
kiểm tra trước đó trong [READING-VERIFICATION.md](READING-VERIFICATION.md). Đợt này
chạy lại các bộ kiểm thử nhưng không lặp mọi thao tác trình duyệt ở mọi trạng thái.
Chưa nghiệm thu OpenAI thật, email vào hộp thư, Drive thật, tải đồng thời, khôi phục
sao lưu production, micro trên thiết bị thực hoặc thao tác bút/cảm ứng vật lý.

## Lỗi cần sửa

Năm lỗi P2 được ghi nhận; không tái hiện lỗi P0/P1 trong phạm vi đã kiểm tra.
Đây không phải chứng nhận không còn lỗi hoặc không còn lỗ hổng.

### P2 Nhận xét giáo viên chưa gửi bị mất

- Vị trí: `src/features/live/SubmissionViews.tsx:32`, `:170`, `:564`.
- Bằng chứng: đã tái hiện bằng trình duyệt QA như mô tả ở trên. Nhận xét và điểm
  chỉ nằm trong state của biểu mẫu; đóng chi tiết hoặc rời trang làm unmount.
- Ảnh hưởng: giáo viên có thể mất phần nhận xét dài khi chọn nhầm bài hoặc trang.
- Xử lý: bảo vệ dữ liệu chưa gửi khi đóng, đổi revision, chuyển trang và đăng xuất;
  chặn rời biểu mẫu lúc yêu cầu trả điểm đang chạy. Bảo toàn đầu vào khi API lỗi.

### P2 Quản trị không phục hồi được phiên bản sau xung đột

- Vị trí: `src/features/live/AdministrationViews.tsx:50`, `:201`, `:392`.
- Bằng chứng mã nguồn: form tài khoản/lớp giữ snapshot lúc mở. Làm mới state sau
  lỗi 409 không cập nhật snapshot này; lưu lại tiếp tục gửi phiên bản cũ.
- Ảnh hưởng: phải đóng/mở form để lấy bản mới, dễ mất phần đang nhập.
- Xử lý: hiển thị bản đã lưu mới nhất, cho xác nhận dùng phiên bản mới để thử lưu
  lại, giữ nguyên các trường đang nhập; kiểm tra xung đột bằng hai phiên QA.

### P2 Biểu mẫu tài khoản và lớp chưa cảnh báo rời khi đang sửa

- Vị trí: `src/features/live/AdministrationViews.tsx:78`, `:255`.
- Bằng chứng mã nguồn: gọi `onClose` trực tiếp; chưa có bảo vệ dirty state khi
  đóng, đổi trang, đăng xuất hoặc reload.
- Ảnh hưởng: mất nội dung mô tả lớp, lựa chọn thành viên hoặc thay đổi tài khoản.
- Xử lý: dùng cơ chế bảo vệ dữ liệu chưa lưu nhất quán với các editor đã có.

### P2 Giới hạn đăng nhập cộng dồn cả lượt thành công qua cùng proxy

- Vị trí: `server/http.ts:105`, `server/auth.ts:110`.
- Bằng chứng: request dùng địa chỉ socket; bộ đếm theo địa chỉ tăng ở mọi lần
  đăng nhập. Thành công chỉ xóa bộ đếm theo email. Có thể tái hiện lần đúng thứ 61
  bị chặn trong cửa sổ 15 phút.
- Ảnh hưởng: người dùng đi qua Vite/reverse proxy có thể chia sẻ một địa chỉ và
  bị chặn đăng nhập cùng nhau dù nhập đúng mật khẩu.
- Xử lý: thiết kế lại giới hạn thất bại và giới hạn tải đồng thời; chỉ dùng IP
  chuyển tiếp từ proxy được tin cậy rõ ràng, không tin tùy ý header do client gửi.

### P2 Cài đặt luôn báo chưa kết nối dù sau này cấu hình dịch vụ

- Vị trí: `server/domain.ts:227`, `src/features/live/PersonalViews.tsx:1943` và `:1955`.
- Bằng chứng mã nguồn: trạng thái tích hợp luôn là `false`; đoạn thông tin phía
  dưới có thể mâu thuẫn với trạng thái hàng đợi email khi bật dịch vụ.
- Ảnh hưởng: quản trị và học viên không biết chính xác tính năng nào dùng được.
- Xử lý: trả trạng thái khả dụng đã lược bỏ bí mật từ runtime; phân biệt Speaking,
  luyện từ vựng AI, cấu hình đủ và kết nối đã nghiệm thu. Không đưa key ra frontend.

## Chức năng còn thiếu so với yêu cầu

| Nhóm                      | Đã có                                                                                                      | Phần phát triển hoặc nghiệm thu còn lại                                                                                                                                         |
| ------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Reading và Listening      | Câu hỏi có cấu trúc, bản nháp, bài nộp giữ phiên bản, highlight, ghi chú, tra/lưu từ, audio Listening      | Chốt dạng câu hỏi thực tế, đáp án/chấm tự động nếu cần, thời gian làm và số lần nghe. Chưa có answer key hoặc chấm tự động từng câu.                                            |
| Writing                   | Ba vùng làm việc, sơ đồ nút/nhánh và vẽ tay, preview PDF/ảnh, tùy chọn hạn chế paste/drop trong ô bài viết | Nghiệm thu với học liệu thật và thiết bị mục tiêu. Hạn chế paste không phải chống gian lận tuyệt đối.                                                                           |
| Speaking                  | Adapter đọc đề, chép lời, đánh giá audio bốn tiêu chí; tác vụ riêng tư và giới hạn lượt gọi                | Kết nối/đánh giá OpenAI thật; tạo hai bài mẫu mục tiêu +1 band, tối đa 9, và Band 9; highlight/lưu từ từ bài mẫu. Đây là phần SPK-04 chưa được viết.                            |
| Giáo viên xem AI Speaking | Có chấm chính thức bài nộp riêng với AI                                                                    | Còn luồng xem lại/hiệu chỉnh ước tính AI có lý do và lịch sử theo SPK-03. Phải xác định dữ liệu được chia sẻ theo bài nộp; không mở toàn bộ lịch sử luyện riêng tư cho nhân sự. |
| Luyện từ vựng             | Notebook riêng tư, nguồn từ, ôn nhớ nghĩa/từ và tự đánh giá                                                | Chưa có bốn dạng AI: trắc nghiệm, điền khuyết, ghép cặp và đặt câu có phản hồi. Khóa Speaking không tự bổ sung các dạng này.                                                    |
| Email                     | Outbox, thử lại, mẫu VI/EN, xác nhận/hủy đặt lịch, đổi lịch, nhắc buổi và hạn bài                          | Chưa gửi thật; còn nhắc chưa đặt 1:1, thông báo đủ điều kiện vào 1:1 và nhắc ôn chủ đề khoảng 14 ngày. Ngôn ngữ gửi theo từng tài khoản chưa hoàn tất.                          |
| Google Drive              | Adapter tải/đọc tệp riêng tư, xử lý lỗi và đối chiếu quyền                                                 | Còn cấu hình OAuth cho Gmail trung tâm, nghiệm thu thư mục thử và khôi phục kết nối. Chưa có màn hình OAuth/callback/Picker. Tệp hiện tại vẫn lưu cục bộ.                       |
| Vòng đời bài tập          | Tạo, sửa, đăng/ẩn và snapshot bài nộp                                                                      | Còn chức năng lưu trữ/xóa bài tập theo ASN-01, phải giữ các bài nộp và phản hồi đã tồn tại. Sao chép khóa học ASN-03 là tương lai, không tính vào thiếu sót core.               |
| Tài khoản                 | Quản trị tạo/khóa/reset; người dùng đổi mật khẩu                                                           | Chưa có tự khôi phục mật khẩu bằng email và xác minh địa chỉ email. Luồng hiện tại nhờ quản trị hỗ trợ.                                                                         |
| Vận hành                  | API/database cục bộ, kiểm soát quyền và nhật ký                                                            | Còn hosting/HTTPS, đo tải, sao lưu và thử phục hồi, quy tắc giữ/xóa dữ liệu, giám sát lỗi, trạng thái giao thư và đo chi phí AI.                                                |

Fluency and Coherence hiện chưa tự mở trước như SPK-03 mô tả; sửa cùng lượt hoàn
thiện Speaking. Không bổ sung vận chuyển, vận hành cơ sở, phụ huynh, học phí hay
chứng chỉ thành yêu cầu bắt buộc chỉ vì có trong hệ thống tham khảo.

## Thông tin cần trung tâm cung cấp

### Để cấu hình kết nối

1. **Google Drive:** link thư mục dành cho bài nộp trong Gmail trung tâm và một
   thư mục thử riêng. Cần chủ tài khoản cấp quyền OAuth; chuẩn bị Google Cloud
   project, Drive API và OAuth client. Adapter hiện dùng quyền Drive rộng cho thư
   mục đã có, nên phải xem rõ phạm vi quyền trước khi cấp. Client secret và refresh
   token lưu trong tệp riêng bị Git bỏ qua, không gửi trong chat. Chưa thực hiện
   bước cấp quyền nào trong đợt kiểm tra này.
2. **OpenAI:** người quản lý project/API nhập key riêng tại
   `.local/portal/speaking.env`; trước khi bật thật cần quyền sử dụng mô hình,
   thanh toán phù hợp và trần chi phí thử nghiệm được chốt. Hiện chưa có key hoặc
   mức trần; giữ tắt. Không dùng tài khoản ChatGPT đang đăng nhập làm API key.
3. **Email:** vì hiện chưa có, cần chọn dịch vụ, địa chỉ/tên người gửi, địa chỉ nhận
   phản hồi và hộp thư kiểm thử. Việc chọn tên miền gửi và quyền cấu hình DNS sẽ
   được làm cùng bước thiết lập hạ tầng. Adapter có sẵn không đồng nghĩa đã chọn
   hoặc đăng ký dịch vụ.

### Để nghiệm thu học tập

4. **Một tuần học mẫu thật:** lớp/trình độ, bài đọc và câu hỏi, audio Listening,
   đề Writing, câu hỏi Speaking, danh sách chủ đề từ vựng, lịch lớp chính và 1:1.
   Gửi thêm một số bài nói đã được giáo viên nhận xét để so sánh chất lượng AI.
   Học liệu cần thuộc phạm vi trung tâm được phép sử dụng.
5. **Chính sách học thuật:** bài nào là điều kiện cho từng buổi 1:1; có chặn lớp
   chính khi chưa làm bài/hoàn thành 1:1 không; hạn nộp lại/nộp muộn; có chấm tự
   động Reading/Listening không; có giới hạn nghe hoặc thời gian làm không.
   Hiện điều kiện vào 1:1 xét mọi bài bắt buộc đã công bố trong cả lớp, chưa ánh xạ
   riêng theo tuần/buổi. Công bố bài của tuần sau có thể ảnh hưởng buổi trước.
6. **Lịch và dữ liệu:** thời lượng/hạn đặt-hủy 1:1, múi giờ, mốc nhắc và giờ không
   làm phiền; mốc tính 14 ngày ôn từ; nhóm tuổi, ngôn ngữ phản hồi AI, thời gian giữ
   audio/bài nộp và mục tiêu khôi phục khi mất dữ liệu.

Số học viên thử, tải đồng thời, ngân sách, tên miền và hosting đã được ghi là
**chưa chốt**. Có thể tiếp tục sửa lỗi và hoàn thiện chức năng cục bộ trong lúc chờ;
không cần mua hạ tầng ngay để thực hiện các việc đó.

## Chuẩn bị thử nghiệm một tháng

1. Sửa các lỗi đã xác minh và bổ sung kiểm thử hồi quy cho mất đầu vào, xung đột,
   giới hạn đăng nhập và trạng thái dịch vụ.
2. Hoàn thiện các phần core còn thiếu, dùng QA và phản hồi giả lập có nhãn rõ ràng
   để kiểm tra nhánh lỗi; không coi giả lập là nghiệm thu nhà cung cấp.
3. Khi có đầu vào, cấu hình thư mục Drive thử, người nhận email thử và project AI
   riêng; xác minh từng dịch vụ trước khi cấp cho nhóm thử.
4. Trước khi chạy AI trả phí, bổ sung theo dõi mức dùng theo loại tác vụ, số phút
   audio, lỗi/thử lại và chi phí đối chiếu với nhà cung cấp; chốt hạn mức và cơ chế
   dừng. Giới hạn số lượt gọi hiện có chưa phải giới hạn tiền theo tháng.
5. Chốt nhóm thử và cách truy cập HTTPS, sao lưu/khôi phục, cách báo lỗi và một bộ
   bài học thật. Theo dõi tuần đầu rồi tổng hợp sau một tháng để chọn ngân sách và
   cấu hình vận hành. Chưa có lịch khởi chạy được xác nhận.

## Đánh giá kỹ thuật giao diện

Hệ thống giao diện nhất quán với portal học tập theo vai trò và tông nâu vàng đang
được dùng. Detector không ghi lỗi chính trong tập tệp quét. Các khoảng trống về
bảo toàn đầu vào và trạng thái tích hợp cần xử lý trước khi hoàn tất chất lượng.

| Tiêu chí                    | Điểm tạm tính trên 4 | Bằng chứng và giới hạn                                                                                                                                    |
| --------------------------- | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Khả năng tiếp cận           | 3                    | Form có label, HTML ngữ nghĩa, focus và skip link; đã dùng bàn phím ở các thao tác kiểm tra. Chưa đo toàn bộ tương phản hoặc kiểm tra trình đọc màn hình. |
| Hiệu năng                   | 3                    | Có lazy route, tải media có chủ đích, hủy yêu cầu và thu hồi blob URL; build đạt. Chưa đo tải lớp lớn hoặc độ trễ production.                             |
| Hệ màu và kiểu chữ          | 3                    | Dùng token `edu-*`/`mis-*`; một advisory P3 về tiêu đề catalog 20 px chưa được ghi vào thang chữ. Chưa có yêu cầu dark mode.                              |
| Responsive                  | 3                    | Màn hình đã xem thích ứng, menu mobile dùng được; không tràn ngang trong phép đo. Chưa thử thiết bị cảm ứng thực và phóng lớn chữ toàn bộ.                |
| Tính nhất quán khi vận hành | 2                    | Không có fallback dữ liệu giả khi API lỗi; quyền và trạng thái tải rõ. Có nhiều editor thiếu phục hồi và trạng thái tích hợp khai báo cố định.            |
| Tổng                        | 14/20                | Điểm kỹ thuật giao diện trong phạm vi khảo sát, không phải chứng nhận WCAG, bảo mật hoặc hoàn thành sản phẩm.                                             |

Advisory kiểu chữ tại `src/styles/live-courses.css:126` là chênh lệch tài liệu được
xác nhận, chưa có bằng chứng gây khó đọc. Không đổi giao diện chỉ để xóa cảnh báo.
Một số mô tả cũ về quyền admin, màu portal, kết quả kiểm thử và tự tạo Zoom cần
đồng bộ với xác nhận mới khi cập nhật tài liệu; không tự sửa phạm vi theo đoạn cũ.

Với phần UI, lượt sửa tiếp theo phù hợp với `/impeccable harden` cho editor,
`/impeccable clarify` cho trạng thái dịch vụ, rồi `/impeccable polish` sau khi hành
vi đã đúng. Có thể xử lý từng nhóm hoặc cùng một lượt; chỉ kiểm tra lại phần thay
đổi và các hồi quy liên quan sau sửa.

## Tệp bằng chứng

- Detector: `.impeccable/review/system-audit-2026-10-11-detector.json`.
- Desktop học viên: `.impeccable/review/system-audit-student-desktop.png`.
- Mobile quản trị: `.impeccable/review/system-audit-admin-mobile.png`.
- Các ảnh chỉ chứa dữ liệu QA giả lập; không có mật khẩu hoặc token.

**English summary:** Local checks passed (80 portal tests, 117 server tests,
type/lint/format/build). Five actionable P2 defects and one documentation-level
typography advisory remain. Required Speaking examples, AI vocabulary practice,
parts of reminder delivery and other acceptance work are incomplete. The centre
selected Gmail My Drive with OAuth, has no email service/domain/hosting, and wants
a one-month pilot without a confirmed cohort or spending cap. Paid AI remains
disabled. Real-provider validation and production readiness are outstanding.
