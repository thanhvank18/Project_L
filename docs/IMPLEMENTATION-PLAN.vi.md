# Kế hoạch triển khai nền tảng học ngoại ngữ cho team

**Phiên bản:** 0.3 · **Ngày:** 11/10/2026 · **Đối tượng:** Frontend, Backend, AI/Tích hợp và QA.

**Trạng thái:** Kế hoạch triển khai đề xuất. Bốn luồng chuyên môn đã được xác nhận; số người, năng lực sẵn có và ngày bắt đầu chưa được xác nhận. Các mốc tuần là tương đối, không phải cam kết ngày bàn giao.

**English:** [Team implementation plan](IMPLEMENTATION-PLAN.en.md).

Mục tiêu bàn giao là một nền tảng có thể vận hành trọn quy trình: tạo lớp và giao bài, học viên làm đủ bốn kỹ năng, đặt lịch 1:1, nhận quyền vào Zoom sau khi nộp đủ bài, nhận phản hồi và ôn từ bằng AI. Triển khai theo các phần chạy được từ giao diện đến dữ liệu và tích hợp; QA tham gia từ bước đầu.

**Cập nhật 10/10/2026:** nhập link Zoom thủ công bởi admin, giáo viên hoặc TA được giao; một link chung theo lớp hoặc link riêng từng buổi. Tự tạo cuộc họp là tùy chọn tương lai, không phải phụ thuộc của phạm vi lõi. Email và AI vẫn bắt buộc. Học viên gửi yêu cầu đăng ký lớp đang mở và phải có quản trị duyệt trước khi ghi danh; không tự vào lớp.

### Xác nhận và hiện trạng bổ sung ngày 11/10/2026

- **Điều kiện buổi chính (D05/Q04 đã chốt):** buổi chính đầu tiên được miễn. Từ buổi chính thứ hai, học viên phải hoàn thành 1:1 ôn kiến thức của buổi chính trước đó và được đúng giáo viên phụ trách 1:1 xác nhận, rồi mới nhận link Zoom buổi chính. Chỉ đặt lịch, vắng mặt hoặc review không liên quan không đáp ứng điều kiện. Không thêm điều kiện nộp bài riêng cho lớp chính.
- **Liên kết lịch:** trường `reviewForLessonId` trỏ đến buổi chính sắp tới trong cùng lớp. Buổi 1:1 bắt đầu không sớm hơn lúc kết thúc buổi chính trước và kết thúc không muộn hơn lúc bắt đầu buổi chính đích. Máy chủ kiểm tra lại thứ tự buổi chưa hủy, phiên bản, quyền hiện tại và kết quả xác nhận.
- **Học liệu:** khách hàng cho phép tự biên soạn. Đã có cơ chế quản trị nhập một lần bộ gốc 3 bài học/12 bài tập nháp đủ bốn kỹ năng, 3 audio giọng tổng hợp ngoại tuyến và hướng dẫn riêng cho giáo viên. Lớp mới riêng tư, chưa có người học/lịch/điểm/bài nộp; cần giáo viên duyệt và công bố. Đây là nội dung giảng dạy được tạo theo yêu cầu, không phải dữ liệu hoạt động học giả lập.
- **Google Drive:** dùng Gmail My Drive của trung tâm. Giao diện quản trị đăng nhập Google, duyệt/chọn thư mục và bật lưu bài nộp đã được triển khai; vẫn cần cấu hình OAuth client, cấp quyền thật và kiểm thử upload/download với Google. Không dùng kết quả giả lập làm bằng chứng tích hợp thật.
- **OpenAI:** khóa đã có trong tệp cấu hình riêng; yêu cầu chỉ đọc danh sách model đã thành công và thấy ba model cấu hình. Cờ AI trả phí vẫn tắt vì ngân sách thử một tháng chưa chốt. Chưa chạy sinh giọng, chép lời hoặc chấm AI thật. Email, tên miền/hosting và quy mô thử vẫn chưa có/chưa chốt.

Các thay đổi trên đang chờ đợt kiểm tra cuối của lần triển khai này. Chúng không xác nhận hoàn tất toàn bộ phạm vi, các dạng luyện từ AI, bài mẫu Speaking hay email. Báo cáo audit trước đó giữ nguyên giá trị lịch sử; xem PRODUCT và bằng chứng kiểm tra mới để biết hiện trạng.

## 1 Cơ sở phạm vi và hiện trạng

Nguồn phạm vi là [danh mục chức năng và câu hỏi kỹ thuật Việt Anh](TRAINING-PLATFORM-FEATURES.vi-en.md), [đặc tả kỹ thuật](ELITE-TECHNICAL-SPEC.vi.md) và [PRODUCT.md](../PRODUCT.md). Khi có khác biệt, xác nhận mới nhất của khách hàng được ưu tiên. Mã Q01–Q18 trong kế hoạch trỏ tới câu hỏi của danh mục; mã ACC, ASN, SPK… trỏ tới yêu cầu trong đặc tả.

| Nhóm                    | Cách đưa vào kế hoạch                                                                                                                                                    |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Phạm vi cốt lõi         | Tài khoản/phân quyền, lớp/chủ đề/ghi danh, quản lý bài tập, công cụ bốn kỹ năng, ghi chú/tra từ, đặt lịch, Zoom, email, điểm danh, phản hồi, Speaking AI và luyện từ AI. |
| Mind map                | Giữ trong kế hoạch Writing; chốt cách vẽ và lưu tại Q08. Không tự thay bằng dàn ý chữ hoặc tự bỏ khỏi đợt bàn giao.                                                      |
| Điểm danh               | Có điểm danh thủ công. Tự động hóa dựa trên bằng chứng tham gia đã đối chiếu; nếu chưa khả thi, sử dụng phương án thủ công đã được khách hàng chấp nhận.                 |
| Tương lai hoặc tùy chọn | Sao chép khóa sau là tương lai; hạn chế dán là tùy chọn. Các nhóm dấu + và vai trò bổ sung chỉ đưa vào sprint khi được chọn rõ.                                          |
| Đã loại bỏ              | Vận chuyển và vận hành cơ sở không có backlog, ước lượng hoặc phụ thuộc triển khai.                                                                                      |

Phản hồi bài làm, giáo viên xem/sửa kết quả AI và tiến độ chuẩn bị là chức năng cốt lõi. Bảng điểm tổng hợp, báo cáo định kỳ, chứng nhận, tuyển sinh, học phí, phụ huynh và phân tích nâng cao là mở rộng có điều kiện. Danh mục mới bổ sung lựa chọn; chưa đồng nghĩa toàn bộ lựa chọn đã được đặt hàng.

### Baseline khi lập kế hoạch — dữ liệu lịch sử

Các đoạn dưới ghi lại mốc trước API riêng; xem README/PRODUCT và quyết định kiến trúc để biết hiện trạng mới nhất. Không dùng baseline này làm bằng chứng ứng dụng hiện tại vẫn là demo.

Frontend hiện dùng React, Vite, TypeScript strict, Tailwind và pnpm. Đã có landing, VI/EN, danh mục demo, lọc/tìm kiếm, khóa lưu trên trình duyệt và form tạo bản nháp email. Bằng chứng nằm tại [App.tsx](../src/app/App.tsx), [CoursesPage.tsx](../src/pages/CoursesPage.tsx), [EliteLandingPage.tsx](../src/pages/EliteLandingPage.tsx) và [package.json](../package.json).

Chưa có xác thực riêng, API học tập, cơ sở dữ liệu học viên, Zoom/email/AI tích hợp, CI hoặc bộ kiểm thử hành vi. Nút đăng nhập đang dẫn sang môi trường tham khảo riêng. `pnpm check` hiện kiểm tra kiểu, lint, định dạng và build; chưa kiểm chứng hành vi LMS.

Giữ trang công khai và VI/EN khi thêm cổng học tập. Chỉ chuyển đích đăng nhập sau khi luồng xác thực mới đã qua kiểm thử. Dữ liệu demo không được tự chuyển thành khóa học hoặc thông tin thương mại thật.

### Tiêu chí bổ sung cho link Zoom

- Link chung/riêng/chưa có được lưu bằng lệnh kiểm tra phiên bản và quyền tại thời điểm lưu; lỗi/xung đột giữ nội dung đang nhập.
- TA chỉ sửa link trong lớp được giao, vẫn không nhận câu trả lời/tệp/nhận xét riêng; không được sửa lịch, nội dung, điểm danh hoặc chấm bài.
- Link riêng không đổi khi link chung thay đổi. Tư vấn phải chủ động chọn nguồn, không tự dùng phòng chung. Dữ liệu buổi/đặt chỗ/điểm danh vẫn tách riêng.
- URL không có trong state/catalog; chỉ trả khi join hợp lệ. Kiểm thử gọi API trực tiếp bằng học viên, nhân sự ngoài lớp và tài khoản vừa mất quyền.

### Đặt ôn bài 1:1 trước lớp chính

Frontend đặt lối vào nổi bật ở tổng quan học viên và bộ lọc lịch tư vấn riêng. Backend kiểm tra giáo viên phụ trách, một học viên/khung với lịch mới/sửa, quyền lớp, xung đột và hủy. QA kiểm tra đặt trước khi đủ bài, hai người tranh một chỗ, hủy và trạng thái Zoom. Gate nộp bài vẫn kiểm tra khi tham gia tư vấn. Theo xác nhận 11/10, buổi chính đầu tiên miễn 1:1; các buổi sau bị chặn trả link Zoom nếu chưa có completed của review đúng buổi trước do giáo viên phụ trách xác nhận. Không thêm gate nộp bài riêng cho lớp chính.

### Dữ liệu mô phỏng và nghiệm thu đăng ký

Theo yêu cầu khách hàng, tạo dữ liệu mô phỏng chỉ trong môi trường QA được ghi nhãn rõ và database riêng; không seed dữ liệu thật. Kiểm thử học viên yêu cầu lớp mở, yêu cầu trùng, từ chối, hủy khi chờ, gửi lại, admin duyệt đồng thời, giáo viên/TA gọi API duyệt bị từ chối và học viên chỉ có dữ liệu lớp sau duyệt. Mô phỏng nhà cung cấp không nghiệm thu việc gửi email hoặc AI thật.

## 2 Phân công và cách phối hợp

| Luồng       | Chịu trách nhiệm chính                                                                                                               | Bàn giao cho luồng khác                                                                                                    |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| Frontend    | Điều hướng, màn hình theo vai trò, bốn không gian làm bài, ghi âm, trạng thái lưu/lỗi, VI/EN, thiết bị và khả năng tiếp cận.         | Giao diện dùng hợp đồng API; các trạng thái có thể tái hiện; hướng dẫn thao tác và bằng chứng review desktop/mobile.       |
| Backend     | Danh tính, quyền theo lớp, dữ liệu/phiên bản, API, giao dịch đặt lịch, điều kiện cấp quyền, tác vụ nền, lưu tệp và nhật ký.          | API có mô tả và dữ liệu mẫu, migration, môi trường staging, chính sách truy cập, trạng thái tác vụ và công cụ vận hành.    |
| AI/Tích hợp | Email, từ điển, giọng đọc, chuyển âm thanh thành chữ, Speaking AI, mẫu cải thiện, luyện từ; kiểm chứng điểm danh Zoom riêng nếu cần. | Adapter, bằng chứng thử nghiệm, giới hạn/chi phí và lỗi; nhập link Zoom do Backend/Frontend thực hiện, không chờ API Zoom. |
| QA          | Tiêu chí nghiệm thu, dữ liệu kiểm thử, kiểm thử API/quyền/đồng thời, luồng đầu cuối, lỗi tích hợp, thiết bị, hồi quy và UAT.         | Kịch bản tái hiện, kết quả kiểm thử, lỗi có mức ảnh hưởng, bằng chứng đạt hoặc chưa đạt từng mốc.                          |

Chỉ định một đầu mối điều phối backlog và một người chịu trách nhiệm kiến trúc trong nhân sự hiện có; không mặc định có thêm người. Đầu mối tiếp nhận xác nhận từ khách hàng ghi kết quả vào sổ quyết định, gồm giá trị đã chốt, ngày, người xác nhận và công việc bị ảnh hưởng.

Backend sở hữu quy tắc nghiệp vụ và hàng đợi; AI/Tích hợp sở hữu giao tiếp với nhà cung cấp. Ví dụ: Backend quyết định học viên đủ điều kiện; AI/Tích hợp thực hiện gửi email theo yêu cầu đã được kiểm tra. Nhà cung cấp hoặc frontend không tự mở quyền học tập.

## 3 Hướng kiến trúc để bắt đầu

Giữ frontend hiện tại. Quyết định cục bộ hiện hành là API TypeScript trên Node.js 24 và SQLite riêng; xem [quyết định kiến trúc](ARCHITECTURE-DECISIONS.md). Đề xuất ban đầu dùng PostgreSQL, kho tệp riêng và tác vụ nền lưu bền vững vẫn cần đánh giá cho production, không thay đổi hệ cục bộ chỉ vì kế hoạch cũ. Framework backend, nhà cung cấp hạ tầng, xác thực, email, AI và cơ chế hàng đợi được ghi thành quyết định kiến trúc trước khi đưa vào mã chính; không cài thêm chỉ để chuẩn bị.

API xử lý tài khoản, quyền, dữ liệu và giao dịch. Worker xử lý AI, nhắc lịch và giao tiếp dài với dịch vụ. Các nhóm mô-đun gồm danh tính, khóa/lớp, bài tập, lịch, quyền vào buổi học, điểm danh, notebook, AI và thông báo. Một backend và worker là đủ cho kế hoạch ban đầu; chỉ tách thêm dịch vụ khi có nhu cầu được chứng minh.

Các ràng buộc cần đưa vào thiết kế ngay:

- Tách chương trình học khỏi lớp mở thực tế; tách đặt lịch khỏi quyền vào cuộc họp và khỏi trạng thái gửi email.
- Bài đã đăng có phiên bản; bài nộp, highlight, từ đã lưu và kết quả AI tham chiếu phiên bản phù hợp.
- Kiểm tra quyền ở máy chủ và khi cấp quyền tải tệp. Quản trị tài khoản không mặc nhiên đọc notebook hoặc sửa điểm học thuật.
- Giao dịch đặt lịch ngăn vượt sức chứa; yêu cầu lặp không tạo bài nộp/lịch/kết quả trùng. Ràng buộc cơ sở dữ liệu phải hỗ trợ quy tắc đó, không chỉ kiểm tra trên giao diện. [PostgreSQL constraints](https://www.postgresql.org/docs/current/ddl-constraints.html).
- Ghi sự kiện cần xử lý cùng giao dịch nghiệp vụ, sau đó worker gửi ra ngoài; worker kiểm tra lại điều kiện và loại trùng trước khi thực hiện.
- Lưu thời điểm UTC và múi giờ liên quan; không mặc định múi giờ máy chủ là múi giờ học viên.
- Khóa nhà cung cấp nằm ở máy chủ. Log dùng mã liên kết để truy vết, không ghi toàn bộ bài làm, âm thanh hoặc thông tin xác thực.

Hợp đồng API cần thống nhất kiểu dữ liệu, mã lỗi, phân trang, trạng thái tác vụ, quy tắc phiên bản và thao tác lặp an toàn. Frontend có thể dùng dữ liệu mô phỏng theo hợp đồng trong khi Backend xây dựng; dữ liệu mô phỏng không được dùng làm bằng chứng tích hợp thành công.

## 4 Lộ trình và điều kiện qua từng bước

Thứ tự dưới đây là thứ tự phụ thuộc. Các công việc độc lập trong cùng bước được làm song song. Các bản demo giữa chừng không thay thế nghiệm thu đủ phạm vi cốt lõi.

| Bước                           | Kết quả phải tạo ra                                                                                   | Điều kiện hoàn thành                                                                                                                                 |
| ------------------------------ | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0 Làm rõ và kiểm chứng         | Phạm vi cốt lõi, quyết định chặn thiết kế, hợp đồng ban đầu, thử Zoom/email/ghi âm/AI.                | Có dữ liệu bài mẫu; rủi ro tích hợp đã có bằng chứng hoặc phương án xử lý rõ; từng phần nền tảng được phép bắt đầu có đủ quyết định liên quan.       |
| 1 Nền tảng chạy thật           | Staging, CI, đăng nhập, quyền theo lớp, kho tệp, worker và khung portal.                              | Tài khoản thử nghiệm đăng nhập đúng vai trò; truy cập API và tệp trái quyền bị từ chối; triển khai staging tái lập được.                             |
| 2 Luồng bài học có lưu dữ liệu | Tạo lớp, ghi danh, đăng bài có phiên bản, lưu nháp, nộp và xem phản hồi.                              | Một giáo viên và một học viên đi hết luồng trên dữ liệu máy chủ; tải lại trang và nộp lặp không làm mất/trùng dữ liệu.                               |
| 3 Lịch Zoom và email           | Đặt lịch, kiểm tra bài bắt buộc, cấp quyền, nhắc lịch, hủy/đổi và điểm danh.                          | Chưa đủ bài không lộ link 1:1; đủ bài được cấp đúng; đặt đồng thời không trùng; đổi/hủy không gửi nhắc cũ.                                           |
| 4 Đủ công cụ bốn kỹ năng       | Reading, Listening, Writing và mind map đã chốt; Speaking AI đủ chuỗi; notebook và luyện từ AI.       | Từng kỹ năng chạy bằng dữ liệu mẫu đại diện được lưu trên máy chủ staging; đầu ra AI qua bộ đánh giá; lỗi không làm mất bài hoặc báo thành công giả. |
| 5 Tích hợp và độ tin cậy       | Dashboard theo vai trò, hồi quy, xử lý lỗi, quyền dữ liệu, hiệu năng, sao lưu/khôi phục.              | Bộ kiểm thử cốt lõi đạt; thử khôi phục thành công; mức tải/giới hạn đã thống nhất được kiểm chứng.                                                   |
| 6 UAT trên staging             | Khách hàng thực hiện quy trình trọn vẹn với lớp và dữ liệu kiểm thử được thống nhất.                  | Các yêu cầu cốt lõi được nghiệm thu; lỗi chặn đã đóng; có hướng dẫn giáo viên/TA và quy trình hỗ trợ.                                                |
| 7 Phát hành và thí điểm        | Đưa phiên bản đã nghiệm thu lên môi trường chính thức; chuyển đăng nhập, mở lớp thí điểm và theo dõi. | Có quyết định phát hành, kiểm tra sau triển khai, kế hoạch quay lui và người trực xử lý sự cố.                                                       |

Luồng phụ thuộc chính: **quyền và dữ liệu → bài tập/nộp bài → điều kiện 1:1 → email/Zoom → quy trình đầu cuối**. Nhánh AI bắt đầu kiểm chứng ngay ở bước 0, phát triển song song và phải hội tụ với bốn kỹ năng trước bước 5. Bước 3 và 4 có thể chạy đồng thời sau khi đủ phần nền của bước 2.

## 5 Backlog có thể tách thành ticket

Các dòng dưới đây là gói công việc; khi đưa vào sprint, tách thành ticket đủ nhỏ để giao một người. Trường tối thiểu của ticket: mã yêu cầu, người chịu trách nhiệm, phụ thuộc, đầu vào, hành vi cần đạt, kiểm thử và bằng chứng hoàn thành.

### Bước 0 Làm rõ và thử nghiệm

| ID    | Phụ trách                                                | Công việc và đầu ra                                                                                                                        | Phụ thuộc hoặc nghiệm thu                                                                                                                         |
| ----- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0-01 | Backend + QA, cả team rà soát                            | Chuyển Q01–Q18 thành sổ quyết định; đồng bộ các chỗ còn ghi nền tảng cũ trong tài liệu nội bộ; lập ma trận core/tùy chọn/tương lai.        | Zoom/email và yêu cầu mới nhất là chuẩn. Mỗi điểm mở có bước bị chặn và đầu mối theo dõi.                                                         |
| P0-02 | Backend, Frontend cùng duyệt                             | Chốt mô hình thực thể, luồng trạng thái, ma trận quyền, kiến trúc, môi trường và hợp đồng API đầu tiên.                                    | Dùng Q01–Q06, Q15, Q18; không khóa thiết kế trên giả định chưa ghi nhận.                                                                          |
| P0-03 | Backend + Frontend + QA; AI/Tích hợp cho email/điểm danh | Kiểm chứng link chung/riêng, quyền ba vai trò, join/thu hồi quyền tại cổng; thử email. Nhận diện tham gia Zoom đánh giá riêng theo Q13.    | Không cần OAuth để dán link. Ghi rõ giới hạn link đã tiết lộ; email có trạng thái thật; nhấp link không chứng minh có mặt.                        |
| P0-04 | AI/Tích hợp + Frontend                                   | Thử câu hỏi giáo viên → giọng đọc → ghi âm → chép lời → phản hồi bốn tiêu chí dùng cả âm thanh → hai mẫu cải thiện; thử bốn dạng luyện từ. | Có âm thanh/bài mẫu được phép dùng; báo cáo chất lượng, độ trễ, chi phí/lượt và lỗi. Transcript đơn thuần không đủ bằng chứng chấm Pronunciation. |
| P0-05 | QA, cả team cung cấp                                     | Tạo bộ dữ liệu ẩn danh/tổng hợp, bản đồ kiểm thử, baseline trang công khai; xác định bộ bài AI có nhận xét giáo viên và ngưỡng chấp nhận.  | Bộ dữ liệu gồm khác lớp, khác quyền, bài thiếu, nộp muộn, audio lỗi, mất mạng và giờ khác múi giờ.                                                |

Nhập link Zoom không yêu cầu OAuth hoặc webhook. Nếu triển khai điểm danh tích hợp hoặc sau này chọn tự tạo họp, kiểm chứng loại OAuth/quyền của tài khoản thực và xác minh webhook trước xử lý; không suy ra cấu hình từ trang demo. [Zoom API authentication](https://developers.zoom.us/docs/api/using-zoom-apis/), [Zoom webhooks](https://developers.zoom.us/docs/api/webhooks/).

Ghi âm trên web cần quyền micro và ngữ cảnh an toàn; thử trên HTTPS staging và thiết bị mục tiêu ngay trong P0-04. [MDN getUserMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia).

### Bước 1 Nền tảng

| ID     | Phụ trách             | Công việc và đầu ra                                                                          | Phụ thuộc hoặc nghiệm thu                                                                                       |
| ------ | --------------------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| FND-01 | Backend + QA          | Thiết lập API/DB/worker, migration, seed tổng hợp, cấu hình mẫu an toàn, CI và staging.      | P0-02. Clone sạch có thể cài, kiểm tra và triển khai; CI chạy kiểm tra frontend và kiểm thử backend tương ứng.  |
| FND-02 | Backend + Frontend    | Đăng nhập, khôi phục, phiên đăng nhập, cấp/khóa tài khoản và vòng đời ghi danh theo Q01.     | FND-01. Kiểm thử phiên hết hạn, tài khoản khóa và lỗi khôi phục; không tự thêm đăng ký công khai khi chưa chọn. |
| FND-03 | Backend + QA          | Áp quyền theo tài nguyên/lớp và vai trò học thuật, nhật ký thay đổi quyền.                   | FND-02, Q02. Người học A không đọc dữ liệu B; giáo viên/TA không đọc lớp khác qua API hoặc URL tệp.             |
| FND-04 | Backend + AI/Tích hợp | Kho tệp riêng tư, upload có kiểm soát, worker, chống trùng, retry và log theo mã tác vụ.     | FND-01/03. Worker khởi động lại không mất tác vụ; loại/kích thước tệp tuân Q06; không lộ secret.                |
| FND-05 | Frontend              | Điều hướng portal, phiên người dùng, menu theo quyền, API client, VI/EN và trạng thái chung. | Hợp đồng P0-02; nối FND-02/03 trước nghiệm thu. Giữ các route công khai hiện có.                                |

### Bước 2 Khóa học và bài nộp

| ID      | Phụ trách               | Công việc và đầu ra                                                                                                                            | Phụ thuộc hoặc nghiệm thu                                                                                                                                                                               |
| ------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CORE-01 | Backend + Frontend + QA | Khóa/lớp/chủ đề, phân công, ghi danh; cờ nhận đăng ký; học viên xem lớp mở/gửi/hủy/theo dõi yêu cầu, admin duyệt/từ chối với ghi chú tùy chọn. | FND-03/05, ENR-01. Lớp phải active/listed/enrollmentOpen; duyệt có phiên bản và ghi danh nguyên tử, không trùng yêu cầu chờ/thành viên; trước duyệt không lộ dữ liệu học/Zoom; gửi lại sau từ chối/hủy. |
| CORE-02 | Backend + Frontend      | Soạn/upload, sửa, đăng, thay thế và lưu trữ bài tập bốn kỹ năng; phiên bản bất biến.                                                           | CORE-01, FND-04, Q06. Bản nháp không lộ; bài đã nộp vẫn gắn phiên bản cũ khi đề được sửa.                                                                                                               |
| CORE-03 | Backend + Frontend      | Lượt làm bài, autosave, trạng thái đã lưu, nộp/xác nhận, nộp lại và xử lý xung đột phiên bản.                                                  | CORE-02, Q04/06/08. Tải lại khôi phục phần đã lưu; gửi lặp chỉ có một xác nhận; lỗi lưu không báo đã lưu.                                                                                               |
| CORE-04 | Backend + Frontend      | Giáo viên xem bài, trả điểm/nhận xét đúng phiên bản; TA chỉ metadata chuẩn bị, không câu trả lời/tệp/nhận xét riêng.                           | CORE-03, Q02/14. Giữ lịch sử; link-edit không cấp quyền chấm, lịch hoặc điểm danh cho TA.                                                                                                               |

### Bước 3 Lịch và tích hợp lớp học

| ID     | Phụ trách                        | Công việc và đầu ra                                                                                                                                                        | Phụ thuộc hoặc nghiệm thu                                                                                                                                                      |
| ------ | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| SCH-01 | Backend + Frontend               | Giờ rảnh, lịch lớp cố định, đặt/đổi/hủy, hạn đặt và múi giờ.                                                                                                               | CORE-01, Q05. Hai yêu cầu cùng đặt slot sức chứa một chỉ thành công một; loại trùng lịch học viên và người dạy.                                                                |
| INT-01 | Backend + Frontend + QA          | Lưu link mặc định riêng tư theo lớp; mỗi buổi chọn chung/riêng/chưa có; tư vấn mặc định chưa cấu hình. Admin/giáo viên/TA được giao sửa link bằng lệnh riêng có phiên bản. | CORE-01 và quyền lớp. Không cần adapter tạo họp. Đổi mặc định chỉ ảnh hưởng buổi dùng chung; không lộ URL trong state/catalog; giữ input khi lỗi; TA không sửa lịch/học thuật. |
| SCH-02 | Backend + Frontend               | Liên kết bộ bài bắt buộc, đánh giá quyền 1:1, trạng thái chuẩn bị và ngoại lệ được phép.                                                                                   | SCH-01, CORE-03, INT-01, Q04. Điều kiện là lịch hợp lệ và nộp đủ bài; không thêm yêu cầu đạt điểm, duyệt bài hoặc AI chạy xong.                                                |
| SCH-03 | Backend + Frontend               | Giáo viên được giao xác nhận hoàn thành 1:1, ghi nhận hủy/vắng; học viên chọn tham gia Zoom. Quyền bổ sung cho TA cần xác nhận riêng.                                      | SCH-02, CORE-04, Q04/05. Hiển thị điều kiện còn thiếu; chặn lớp chính theo chính sách đã chốt; không cấp link buổi hủy hoặc người không có quyền.                              |
| INT-02 | AI/Tích hợp + Backend            | Email song ngữ: xác nhận lịch, cấp link, nhắc hạn, nhắc đặt lịch, nhắc học; trạng thái và thử lại.                                                                         | FND-04, SCH-02, Q11. Kiểm tra lại quyền lúc gửi; hủy thư chờ hết hiệu lực; retry không gửi trùng có thể tránh.                                                                 |
| INT-03 | AI/Tích hợp + Backend + Frontend | Điểm danh thủ công; nếu khả thi, ghép sự kiện Zoom với học viên và tính thời gian tham gia.                                                                                | INT-01, Q13. Nhấp link chưa tính có mặt; người không khớp ở trạng thái chờ; sửa tay không bị ghi đè trái quy tắc.                                                              |

Email đã chứa link không thể được coi là đã thu hồi chỉ vì nút trên website bị ẩn. P0-03 phải xác định cách vô hiệu hóa hoặc kiểm soát truy cập thực tế của cuộc họp; giới hạn còn lại cần được thống nhất ở Q04/Q12 trước nghiệm thu SCH-02.

### Bước 4 Công cụ học tập và AI

| ID     | Phụ trách                        | Công việc và đầu ra                                                                                               | Phụ thuộc hoặc nghiệm thu                                                                                                       |
| ------ | -------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| LRN-01 | Frontend + Backend               | Reading/Listening: tài liệu, audio, câu trả lời, highlight, ghi chú riêng và tra từ.                              | CORE-02/03, Q07. Mở lại đúng phiên bản còn chú thích; lỗi từ điển có trạng thái thật; tự chấm chỉ theo đáp án/dạng câu đã chốt. |
| LRN-02 | Backend + Frontend + AI/Tích hợp | Notebook dùng chung bốn kỹ năng, lưu chủ động, nghĩa/ngữ cảnh/nguồn/chủ đề và quy tắc từ trùng.                   | CORE-01/03, FND-03, Q10. Tra từ không tự lưu; notebook riêng không lộ; kết nối nút lưu ở từng kỹ năng.                          |
| LRN-03 | Frontend + Backend               | Writing ba vùng, đếm từ, autosave, mind map có lưu/mở lại và bố cục trên màn hình nhỏ.                            | CORE-03, LRN-02, Q08. Mind map không ghi đè bài viết; mất mạng và hai thiết bị được xử lý theo quy tắc đã chốt.                 |
| AI-01  | AI/Tích hợp + Frontend + Backend | Đọc câu hỏi bằng AI, ghi âm/nghe lại/tải lên, tác vụ chép lời và trạng thái xử lý.                                | P0-04, CORE-02/03, FND-04. Câu đọc đúng đề giáo viên; từ chối micro, upload lỗi và timeout không làm mất lượt làm.              |
| AI-02  | AI/Tích hợp + Backend + Frontend | Đánh giá bốn tiêu chí, dùng âm thanh khi cần; hiển thị Fluency and Coherence trước; giáo viên xem/sửa có lịch sử. | AI-01, CORE-04, Q09. Đầu ra đúng cấu trúc; bộ đánh giá đạt ngưỡng đã thống nhất; không bịa điểm khi thiếu âm thanh hoặc AI lỗi. |
| AI-03  | AI/Tích hợp + Frontend           | Hai bản cải thiện hướng tới +1 band/Band 9, highlight và lưu từ vào notebook.                                     | AI-02, LRN-02. Hai bản gắn đúng lượt làm; lỗi/thử lại rõ; không thể hiện như cam kết điểm thi.                                  |
| AI-04  | AI/Tích hợp + Backend + Frontend | Bài luyện từ AI đủ trắc nghiệm, điền từ, ghép cặp, đặt câu; lưu lượt ôn và email nhắc sau mốc đã chốt.            | LRN-02, INT-02, Q10/11. Ngày ôn/thay đổi chủ đề cập nhật lịch nhắc đúng; câu trả lời và nội dung sinh ra được kiểm tra.         |

Kết quả AI cần lưu phiên bản mô hình, hướng dẫn đánh giá và cấu trúc đầu ra để so sánh khi thay đổi. Bộ mẫu cần gồm nhiều mức năng lực, cách phát âm, độ dài và chất lượng âm thanh. Giáo viên xác nhận tiêu chí học thuật; QA kiểm tra định dạng, tính lặp lại trong giới hạn đã chốt, xử lý lỗi và việc không lộ dữ liệu. Không coi một cuộc gọi API thành công là đã đạt chất lượng chấm Speaking.

### Bước 5 đến 7 Hoàn thiện và phát hành

| ID     | Phụ trách                       | Công việc và đầu ra                                                                                        | Phụ thuộc hoặc nghiệm thu                                                                                                        |
| ------ | ------------------------------- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| RUN-01 | Backend + Frontend              | Dashboard theo vai trò, lịch/thiếu bài, trạng thái email/AI, retry có quyền và nhật ký.                    | CORE-04, SCH-02/03, INT-02/03, AI-02/04. Dữ liệu đúng phạm vi; retry không làm sai quyền hoặc nhân đôi kết quả.                  |
| RUN-02 | Backend + AI/Tích hợp + QA      | Đồng ý ghi âm/AI, lưu giữ/xóa, sao lưu, phục hồi, giám sát và quy trình sự cố.                             | Q15/18. Thiết kế từ bước 1; hoàn tất trước dữ liệu thật. Thử restore ở môi trường riêng, đối chiếu DB/tệp/tác vụ và bản ghi xóa. |
| REL-01 | QA, cả team sửa lỗi             | Kiểm thử quy trình đầu cuối và hồi quy trang công khai, VI/EN, quyền, thiết bị, mất mạng, tác vụ lỗi.      | Các gói core hoàn tất. Không còn lỗi chặn luồng hoặc lỗi lộ dữ liệu/mất bài.                                                     |
| REL-02 | QA + Backend + AI/Tích hợp      | Kiểm tra tải, đồng thời, giới hạn, cảnh báo và lỗi nhà cung cấp; diễn tập triển khai/quay lui.             | RUN-02, Q18. Đạt tải và thời gian phản hồi đã chốt; migration và khôi phục có bằng chứng.                                        |
| REL-03 | QA điều phối, cả team hỗ trợ    | UAT với giáo viên/TA/học viên đại diện, hướng dẫn sử dụng, triage và đóng lỗi.                             | REL-01/02. Khách hàng xác nhận toàn bộ core; phạm vi mở rộng ghi riêng.                                                          |
| REL-04 | Backend điều phối, cả team trực | Phát hành theo phiên bản, dữ liệu/nội dung thật, chuyển login, kiểm tra sau triển khai và hỗ trợ thí điểm. | REL-03, quyết định phát hành. Có bản sao lưu, phiên bản quay lui, người trực, ngưỡng dừng và danh sách kiểm tra hoàn tất.        |

## 6 Các quyết định kỹ thuật phải chốt đúng thời điểm

Không cần chờ đủ cả 18 câu mới làm việc. Team có thể chuẩn bị hợp đồng, dữ liệu tổng hợp, UI và thử nghiệm độc lập; phần phụ thuộc phải giữ trạng thái chưa chốt cho đến khi có câu trả lời hoặc giả định được đồng ý rõ.

| Câu hỏi | Giá trị cần ghi lại                                                                    | Công việc bị chặn khi chưa chốt                                                                                                                                                               |
| ------- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q01     | Cấp tài khoản, đăng nhập, phiên và quyền sau kết thúc khóa.                            | FND-02.                                                                                                                                                                                       |
| Q02     | Ma trận thao tác/tài nguyên/lớp, đa vai trò và ngoại lệ.                               | FND-03; quyền CORE-04.                                                                                                                                                                        |
| Q03     | Trường, mã, liên kết và quy tắc nhập danh sách.                                        | CORE-01; phần import nếu chọn.                                                                                                                                                                |
| Q04     | Nhóm bài bắt buộc, trạng thái nộp, thu hồi quyền; gate review lớp chính đã chốt 11/10. | CORE-03/SCH-02/03: giữ gate nộp bài cho 1:1; buổi chính đầu miễn, các buổi sau cần completed của review buổi trước. Chưa cấp quyền bỏ qua gate; quy tắc nhóm bài và ngoại lệ vận hành còn mở. |
| Q05     | Slot, múi giờ, giới hạn và vòng đời đổi/hủy/vắng.                                      | SCH-01/03.                                                                                                                                                                                    |
| Q06     | Dạng đề/tệp, giới hạn, phiên bản và nộp lại.                                           | CORE-02/03; OCR không mặc nhiên đi kèm upload PDF.                                                                                                                                            |
| Q07     | Dạng câu, đáp án, nghe lại, timer và từ điển.                                          | LRN-01; tự chấm chỉ làm khi đủ quy tắc.                                                                                                                                                       |
| Q08     | Chế độ mind map, lưu nháp, xung đột và tùy chọn dán.                                   | LRN-03; chốt sớm phần ảnh hưởng CORE-03.                                                                                                                                                      |
| Q09     | Giới hạn ghi âm/AI, đầu ra và chất lượng mong đợi.                                     | Chốt hợp đồng, trạng thái, giới hạn và phương án đánh giá AI-01/02/03; kiểm chứng ngưỡng chất lượng trước nghiệm thu.                                                                         |
| Q10     | Cấu trúc từ, trùng nghĩa, lượt ôn và mốc nhắc hai tuần.                                | LRN-02, AI-04.                                                                                                                                                                                |
| Q11     | Sự kiện, người nhận, mẫu/ngôn ngữ, thời điểm và retry email.                           | INT-02; nhắc ôn AI-04.                                                                                                                                                                        |
| Q12     | Phòng chờ/mật mã/xác thực tại Zoom, buổi đồng thời và xử lý link đã cấp sau đổi/hủy.   | Chính sách vận hành/thu hồi quyền SCH-02; không chặn INT-01 nhập link thủ công. Quyền và cách nhập chung/riêng đã chốt.                                                                       |
| Q13     | Ánh xạ người tham gia, ngưỡng và ưu tiên sửa tay.                                      | INT-03; không chặn việc xây công cụ điểm danh thủ công.                                                                                                                                       |
| Q14     | Thang điểm, sửa điểm, thời điểm công bố; báo cáo nếu chọn.                             | CORE-04 đối với phản hồi cơ bản; báo cáo nâng cao thuộc backlog mở rộng.                                                                                                                      |
| Q15     | Đồng ý, quyền dữ liệu, thời hạn lưu/xóa và giới hạn dịch vụ.                           | Thiết kế FND-04/RUN-02; chặn dùng dữ liệu học viên thật khi chưa đủ điều kiện.                                                                                                                |
| Q16     | Ngôn ngữ nội dung, fallback, múi giờ và thiết bị hỗ trợ.                               | Hoàn thiện FND-05, các workspace và ma trận kiểm thử.                                                                                                                                         |
| Q17     | Các mô-đun mở rộng đã chọn, dữ liệu và chuyển trạng thái.                              | Chỉ backlog mở rộng; không giữ lại toàn bộ core.                                                                                                                                              |
| Q18     | Mức tải, dung lượng, thời gian phản hồi, mất dữ liệu/khôi phục.                        | Chọn hạ tầng P0-02 và nghiệm thu REL-02.                                                                                                                                                      |

Frontend/Backend/AI đề xuất giải pháp cho các giá trị còn mở; QA chuyển phản hồi thành tình huống kiểm thử. Lựa chọn framework và cách tổ chức mã do team quyết định trong giới hạn chức năng/hạ tầng đã thống nhất; khách hàng xác nhận hành vi và giới hạn sử dụng.

## 7 Nhịp sprint và ước lượng sơ bộ

**Kịch bản để lập lịch:** mỗi luồng có một người dành toàn thời gian; đầu mối điều phối và kiến trúc kiêm nhiệm; khách hàng có đầu mối học thuật cung cấp mẫu và phản hồi. Đây là giả định để tính, chưa phải cơ cấu nhân sự đã chốt. Một sprint dài hai tuần, dự tính khoảng tám ngày công thực hiện/người sau họp, điều phối và gián đoạn. Tám ngày này bao gồm triển khai, review, kiểm thử và sửa lỗi đã ước lượng.

| Luồng       | Khoảng công sức ban đầu | Yếu tố làm thay đổi nhiều nhất                                                                         |
| ----------- | ----------------------- | ------------------------------------------------------------------------------------------------------ |
| Frontend    | 65–85 ngày công         | Mind map, dạng đề, thiết bị/ghi âm, số trạng thái cần phục hồi.                                        |
| Backend     | 70–90 ngày công         | Quyền, phiên bản, đồng thời, lịch, dữ liệu và yêu cầu phục hồi.                                        |
| AI/Tích hợp | 55–75 ngày công         | Chất lượng Speaking có âm thanh, khả năng Zoom, từ điển và kiểm thử nhà cung cấp.                      |
| QA          | 50–70 ngày công         | Ma trận quyền/thiết bị, dữ liệu đánh giá AI, tự động hóa và số vòng sửa lỗi.                           |
| Tổng        | 240–320 ngày công       | Bao gồm thử nghiệm, triển khai, kiểm thử, review và sửa lỗi thông thường; không gồm chức năng mở rộng. |

Với giả định trên, khoảng lập kế hoạch là **18–24 tuần**. Mốc tham chiếu là 20 tuần; phần biến động nằm trong khoảng, không cộng thêm một cam kết dự phòng riêng. Thời gian chờ khách hàng, mua/cấp tài khoản, cấu hình tên miền và thay đổi lớn sau chốt phải cập nhật lịch. Không chia tổng ngày công cho bốn rồi coi là ngày bàn giao vì Frontend/Backend và nhánh AI có phụ thuộc khác nhau. Ước lượng lại sau bước 0 và sau luồng dữ liệu đầu tiên ở bước 2.

| Sprint tham chiếu | Frontend                                                                         | Backend                                                        | AI/Tích hợp                               | QA và mốc demo                                                                              |
| ----------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------- |
| 1                 | Baseline, luồng UX, thử micro/mind map.                                          | Quyền, dữ liệu, kiến trúc, hợp đồng.                           | Thử Zoom/email và chuỗi AI.               | Dữ liệu mẫu, tiêu chí core; rà rủi ro bước 0.                                               |
| 2–3               | Portal, đăng nhập, màn hình lớp.                                                 | CI/staging, auth/RBAC, file/worker.                            | Adapter, hợp đồng AI và bộ mẫu đánh giá.  | Trái quyền, phiên, môi trường; demo đăng nhập/lớp đúng quyền.                               |
| 4                 | Soạn bài, danh sách việc học, lưu/nộp.                                           | Phiên bản, bài nộp, phản hồi.                                  | TTS/STT và đánh giá âm thanh trên worker. | Hồi quy nộp bài, phiên bản; demo luồng lưu dữ liệu.                                         |
| 5                 | Lịch/đặt lịch, xác nhận xong 1:1, tham gia lớp chính; bắt đầu Reading/Listening. | Booking, gate 1:1, trạng thái hoàn thành và sự kiện thông báo. | Zoom/email/điểm danh, tiếp tục AI.        | Đồng thời, hủy/đổi, thiếu bài; demo cấp link và vào lớp chính theo chính sách.              |
| 6                 | Hoàn thiện Reading/Listening, notebook và Writing.                               | Notebook, autosave/xung đột, hỗ trợ Writing.                   | Phản hồi Speaking và mẫu cải thiện.       | Tra từ/lưu riêng, bài mẫu, mất mạng.                                                        |
| 7                 | Hoàn thiện Writing/mind map và Speaking.                                         | Kết quả AI, quyền sửa và lịch sử.                              | Bộ đánh giá Speaking, luyện từ AI.        | Bốn kỹ năng, âm thanh lỗi, khác thiết bị.                                                   |
| 8                 | Hoàn thiện mẫu Speaking, ôn từ và dashboard.                                     | Nhắc ôn, vận hành, lưu giữ/khôi phục.                          | Chất lượng luyện từ, retry/hạn mức.       | Demo đầy đủ core với dịch vụ thật trên staging, không thay tích hợp bằng phản hồi mô phỏng. |
| 9                 | Sửa hồi quy/khả năng tiếp cận.                                                   | Hiệu năng, lỗi đồng thời, triển khai.                          | Lỗi dịch vụ, chất lượng/độ trễ AI.        | E2E, tải và restore; chuẩn bị UAT.                                                          |
| 10                | Hỗ trợ UAT và phát hành.                                                         | Migration, dữ liệu, release/quay lui.                          | Theo dõi Zoom/email/AI.                   | UAT, lớp thí điểm và kiểm tra sau phát hành.                                                |

Nếu giả định nhân sự, đầu vào, kết quả thử nghiệm hoặc phạm vi thay đổi, ước lượng lại; dự báo có thể vượt khoảng 18–24 tuần. Không tự bỏ AI hoặc mind map để giữ khoảng ban đầu. Thêm người chỉ giảm thời gian ở phần có thể chạy song song và phải tính chi phí bàn giao.

## 8 Kế hoạch năm ngày làm việc đầu tiên

| Ngày | Việc cả team cần hoàn tất                                                                                                     | Đầu ra kiểm tra được                                                                              |
| ---- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| 1    | Chốt người phụ trách từng luồng; đọc cùng phạm vi; tách core và phần lựa chọn; thu thập câu trả lời Q01/02/04/06/09/12/15/18. | Backlog P0 có owner; danh sách câu hỏi chặn; baseline hiện trạng và tập bài mẫu cần xin.          |
| 2    | Backend/Frontend thống nhất dữ liệu và API mẫu; AI chuẩn bị tài khoản thử, audio; QA viết ca nghiệm thu đầu tiên.             | ERD nháp, ma trận quyền, hợp đồng cho lớp/bài nộp, bộ dữ liệu tổng hợp.                           |
| 3    | Thử Zoom/email song song với ghi âm và AI; Frontend thử tương tác workspace; QA ghi nhận lỗi/giới hạn.                        | Bằng chứng thử nghiệm thực tế hoặc mô tả blocker cụ thể; không yêu cầu gửi secret trong tài liệu. |
| 4    | Chọn hướng backend/worker/lưu tệp và chiến lược AI; điều chỉnh trạng thái/API theo kết quả thử.                               | Quyết định kiến trúc, kết quả đo ban đầu, cập nhật ca kiểm thử và rủi ro.                         |
| 5    | Demo kết quả; chia ticket nền tảng; chốt thứ tự tuần kế tiếp và phần tiếp tục kiểm chứng ở tuần 2.                            | Backlog sẵn sàng cho từng luồng, danh sách chưa được phép khóa thiết kế, ước lượng cập nhật.      |

Năm ngày đầu chưa yêu cầu xong toàn bộ bước 0. Khi tài khoản dịch vụ hoặc mẫu học thuật chưa có, tiếp tục phần độc lập bằng dữ liệu tổng hợp; giữ thử nghiệm liên quan ở trạng thái bị chặn, không đánh dấu đã qua.

## 9 Tiêu chuẩn hoàn thành và bàn giao

Mỗi gói chức năng hoàn thành khi mã được review, chạy trên staging, có dữ liệu lưu trên máy chủ theo hợp đồng API, trạng thái tải/rỗng/lỗi/thành công, VI/EN và kiểm thử phù hợp. Dữ liệu tổng hợp hoặc ẩn danh được dùng cho kiểm thử; phản hồi mô phỏng không thay thế bằng chứng tích hợp với dịch vụ. Các thay đổi UI theo quy trình design-taste-frontend khi cần định hướng thiết kế và impeccable cho review dashboard/workspace; ghi quyết định thiết kế đã chốt vào DESIGN.md. Review desktop/mobile và thao tác bàn phím trên màn hình đã đổi.

Giữ `pnpm check` trước bàn giao. Khi triển khai backend và luồng học, thêm kiểm thử có ý nghĩa: quyền tài nguyên, giao dịch đặt lịch, phiên bản/nộp lặp, tác vụ nền và E2E cốt lõi. CI chỉ thêm lệnh kiểm thử sau khi lệnh đó thực sự tồn tại. Không đánh dấu kiểm thử tích hợp đạt chỉ vì TypeScript và build thành công.

### Đối chiếu yêu cầu với công việc

Mã công việc và mã yêu cầu là hai nhóm riêng. QA liên kết từng ca kiểm thử với cả hai; các yêu cầu NFR có thông số đề xuất phải dùng giá trị đã được chốt khi nghiệm thu.

| Mã yêu cầu trong đặc tả | Gói công việc chịu trách nhiệm                                             |
| ----------------------- | -------------------------------------------------------------------------- |
| WEB-01, LOC-01          | P0-05, FND-05, REL-01, REL-04.                                             |
| ACC-01, ACC-02          | FND-02/03, RUN-02, REL-01.                                                 |
| CRS-01                  | CORE-01.                                                                   |
| ASN-01, ASN-02          | CORE-02/03/04.                                                             |
| BKG-01–04, CLS-01/02    | SCH-01/02/03, INT-01/02, CORE-04.                                          |
| ATT-01, ATT-02          | INT-03; tự động có điều kiện khả thi, thủ công là dự phòng được chấp nhận. |
| NTF-01, NTF-02          | INT-02, AI-04, RUN-01.                                                     |
| RDL-01, RDL-02          | LRN-01/02.                                                                 |
| WRT-01, WRT-03          | LRN-03; chốt hình thức mind map tại Q08.                                   |
| SPK-01–04               | P0-04, AI-01/02/03, CORE-04.                                               |
| VOC-01–03               | LRN-02, AI-04, INT-02.                                                     |
| OPS-01                  | CORE-04, RUN-01.                                                           |
| NFR-01–08               | FND-03/04/05, CORE-03, P0-04/05, RUN-02, REL-01/02.                        |
| ASN-03, WRT-02          | Backlog tương lai/tùy chọn tại mục 10; không phải điều kiện hoàn tất core. |

### Các tình huống kiểm thử bắt buộc

Các tình huống bắt buộc trước UAT:

1. Quản trị tạo lớp, ghi danh và phân công; giáo viên tạo chủ đề/đăng bài trong lớp được giao. Học viên đúng lớp nhìn thấy; người ngoài lớp bị từ chối qua UI/API/tệp.
2. Kiểm tra cả đặt lịch trước rồi nộp bài và nộp đủ bài trước rồi đặt lịch. Chưa đủ điều kiện không lộ link 1:1 trong API/email; khi đủ điều kiện cấp quyền đúng một lần, không đợi AI chạy xong.
3. Đặt đồng thời, đổi/hủy lịch và sự kiện gửi lặp không tạo slot vượt sức chứa, email cũ hoặc quyền sai; kiểm chứng xử lý link đã gửi.
4. Reading/Listening lưu highlight, note, đáp án; Writing lưu bài và mind map; từ được lưu từ đủ bốn kỹ năng vào đúng chủ đề.
5. Speaking đọc đúng câu hỏi giáo viên, ghi âm, chép lời, trả đủ bốn tiêu chí và hai bản cải thiện; giáo viên sửa có lịch sử.
6. Luyện từ đủ bốn dạng, ghi nhận lượt ôn và nhắc đúng mốc; hoàn thành ôn hoặc đổi lịch làm mất hiệu lực nhắc không còn phù hợp.
7. Nhấp link không tự thành có mặt; tham gia chưa xác minh được có trạng thái rõ; sửa điểm danh thủ công được giữ theo quy tắc.
8. Mất mạng, tắt/mở lại worker, AI/email/Zoom lỗi và tải lại trang không tạo thành công giả, mất bài đã xác nhận hoặc nhân đôi tác vụ.
9. Chuyển VI/EN không mất nháp; ngày giờ và giờ mùa hè nếu thuộc thị trường mục tiêu hiển thị/nhắc đúng.
10. Xóa/lưu giữ và khôi phục DB/tệp đáp ứng quyết định Q15/18; sau restore không tự phát lại email hoặc tác vụ đã hoàn tất.
11. Giáo viên được giao xác nhận hoàn thành 1:1; quyền xác nhận của TA cần quyết định riêng; học viên xem đúng trạng thái chuẩn bị và vào đúng buổi Zoom chính. Miễn buổi chính đầu; buổi sau thiếu review completed hợp lệ phải bị từ chối cả khi gọi API join trực tiếp; buổi hủy/vắng và thao tác sửa có lịch sử phù hợp.

Trước phát hành, có hướng dẫn giáo viên/TA, cấu hình vận hành, phiên bản API/migration, báo cáo kiểm thử, danh sách giới hạn được chấp nhận và quy trình xử lý sự cố. Các lỗi lộ dữ liệu, mất bài, sai quyền vào buổi học hoặc chặn luồng core ngăn phát hành; lỗi nhỏ còn lại có owner và thời hạn xử lý được thống nhất.

## 10 Mở rộng và quản lý thay đổi

Sau khi chọn rõ, mỗi nhóm mở rộng được tách thành epic có dữ liệu, quyền và tiêu chí nghiệm thu riêng: tuyển sinh; ngân hàng câu hỏi/kiểm tra; báo cáo/chứng nhận; phân tích; học phí; phụ huynh; file dùng chung; thảo luận/thông báo; khảo sát/hỗ trợ/sự vụ. Không ước lượng mặc định các nhóm này vào lịch core.

Sao chép khóa tương lai cần sao chép cấu trúc/bài tập thành nháp và rà lại ngày; không sao chép học viên, bài nộp, điểm danh hoặc link họp cũ. Hạn chế dán chỉ triển khai theo lựa chọn rõ và có ngoại lệ cần thiết.

Khi đổi yêu cầu, ghi nội dung thay đổi, Q hoặc mã yêu cầu liên quan, tác động dữ liệu/API/UI/kiểm thử, công sức và mốc bị ảnh hưởng. Thay đổi phạm vi cần xác nhận trước khi được coi là cam kết; team tiếp tục các phần không phụ thuộc. Theo dõi tiến độ bằng tính năng có bằng chứng nghiệm thu, không bằng tỷ lệ màn hình đã dựng.
