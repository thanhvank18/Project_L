# Tiếng Việt

## Chức năng nền tảng quản lý đào tạo

Vai trò người dùng và yêu cầu kỹ thuật cần làm rõ

Nền tảng kết nối quản lý khóa học, hoạt động giảng dạy, lớp học trực tuyến và theo dõi kết quả học tập. Tài liệu trình bày chức năng theo vai trò và các yêu cầu cần làm rõ về dữ liệu, phân quyền, tích hợp, quy tắc xử lý và kết quả mong đợi.

### Quy trình học tập

- Zoom cho lớp học chính và buổi hỗ trợ 1:1; email cho thông báo và nhắc lịch.
- **Xác nhận 10/10/2026:** quản trị viên, giáo viên hoặc trợ giảng được phân công nhập link Zoom có sẵn một lần cho lớp hoặc riêng từng buổi. Tự tạo cuộc họp là tùy chọn tương lai; nhập link không cần tài khoản/khóa API Zoom.
- **Đăng ký lớp đã chốt:** học viên gửi yêu cầu vào lớp đang mở đăng ký; quản trị phải duyệt mới có quyền học. Gửi yêu cầu không tự ghi danh.
- Học viên có thể đặt lịch trước. Quyền vào buổi 1:1 được gửi sau khi có lịch hợp lệ và đã nộp đủ bài bắt buộc.
- Công cụ Reading, Listening, Writing, Speaking; AI Speaking, mẫu cải thiện, sổ từ vựng, luyện từ AI và nhắc ôn.
- Giao diện tiếng Việt và tiếng Anh. Nội dung học tập và thông báo theo chính sách ngôn ngữ được xác nhận.
- Điểm danh theo tham gia thực tế khi xác minh được; có điểm danh và chỉnh sửa thủ công.

### Vai trò sử dụng

| Vai trò        | Chức năng                                                             |
| -------------- | --------------------------------------------------------------------- |
| Quản trị viên  | Quản lý học viên, lớp học, người dùng, lịch và hoạt động chung.       |
| Giáo viên      | Tổ chức giảng dạy, giao bài, đánh giá và theo dõi lớp được phân công. |
| Trợ giảng      | Xem dữ liệu hỗ trợ/chuẩn bị và quản lý link Zoom trong lớp được giao. |
| Học viên       | Học, làm bài, tham gia Zoom, nhận phản hồi và ôn tập.                 |
| Khách truy cập | Xem giới thiệu, khóa học và thông tin liên hệ.                        |

Các nhóm có dấu + là chức năng bổ sung để Quý đơn vị lựa chọn. Mục ghi Tương lai dành cho các khóa sau. Các chức năng còn lại phục vụ quy trình học tập và quản lý chính. Phần cuối làm rõ hành vi hệ thống và các thông số chưa được xác nhận.

Người dùng có đăng nhập, khôi phục tài khoản và lựa chọn ngôn ngữ/múi giờ. Một người có thể được giao nhiều vai trò; quyền xem dữ liệu, sửa điểm và công bố kết quả được cấp theo nhiệm vụ và lớp phụ trách.

## Quản trị viên

Khu vực quản trị tập hợp các nhóm chức năng dưới đây. Học phí và sự vụ nằm trong phần mở rộng để lựa chọn theo nhu cầu.

| Nhóm chức năng        | Chức năng                                                                                                                              |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Tổng quan             | Xem số học viên, lớp đang hoạt động, lịch sắp tới, bài chưa nộp và tình hình chuyên cần.                                               |
| Học viên              | Quản lý hồ sơ, thông tin liên hệ, trạng thái học, ghi danh và lịch sử tham gia lớp.                                                    |
| Tuyển sinh +          | Theo dõi yêu cầu tư vấn, hồ sơ đăng ký, trạng thái xét duyệt và chuyển thành ghi danh.                                                 |
| Khóa học và lớp       | Tạo khóa/lớp/chủ đề, phân công nhân sự, quản lý ghi danh; bật nhận đăng ký và duyệt/từ chối yêu cầu của học viên kèm ghi chú tùy chọn. |
| Điểm danh             | Theo dõi chuyên cần tổng hợp và từng buổi; xem đi muộn/vắng, ghi nhận sửa đổi có lý do.                                                |
| Chương trình học      | Quản lý kỹ năng, chương, chủ đề và nội dung cần hoàn thành theo khóa.                                                                  |
| Thời khóa biểu        | Quản lý lịch lớp, lịch 1:1 và giờ rảnh; phát hiện trùng lịch; cập nhật lịch đổi hoặc hủy.                                              |
| Học liệu              | Tổ chức tài liệu, audio, video và bài học; kiểm soát nội dung được đăng cho từng lớp.                                                  |
| Quản lý tệp +         | Tổ chức thư mục và tệp dùng chung; cấp quyền truy cập, thay thế hoặc lưu trữ tài liệu.                                                 |
| Tiến độ giảng dạy +   | Theo dõi chủ đề đã dạy, nội dung còn thiếu và mức độ hoàn thành chương trình theo lớp.                                                 |
| Bài tập               | Quản lý bài tập, hạn nộp, trạng thái đăng và yêu cầu chuẩn bị trước buổi học.                                                          |
| Kiểm tra và câu hỏi + | Tổ chức bài kiểm tra, ngân hàng câu hỏi theo kỹ năng/chủ đề/độ khó và tiêu chí chấm.                                                   |
| Điểm số và báo cáo +  | Quản lý thang điểm, bảng điểm, bước duyệt và công bố báo cáo kết quả theo khóa/giai đoạn.                                              |
| Phân tích +           | Xem kết quả theo lớp/kỹ năng, tỷ lệ nộp bài và chuyên cần; nhận diện nội dung cần củng cố.                                             |
| Người dùng            | Mời/tạo tài khoản, phân vai trò, cấp quyền theo lớp và vô hiệu hóa tài khoản khi cần.                                                  |
| Nhắc lịch qua email   | Cấu hình nhắc hạn, lịch học, lịch 1:1 và ôn từ; theo dõi gửi và thử lại khi phù hợp, giữ đúng điều kiện cấp link.                      |
| Thông báo và lịch +   | Đăng thông báo theo đối tượng; quản lý lịch hoạt động, sự kiện và ngày nghỉ.                                                           |
| Cấu hình và lịch sử   | Quản lý link Zoom chung/riêng, email, lịch và ngôn ngữ; theo dõi thay đổi quyền/dữ liệu; không yêu cầu kết nối API Zoom để nhập link.  |

Dấu + là nhóm bổ sung cần lựa chọn. Quản trị tài khoản không tự cấp quyền đọc ghi chú riêng hoặc sửa điểm học thuật.

## Giáo viên và trợ giảng

### Giáo viên

| Nhóm chức năng                  | Chức năng                                                                                                                    |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Tổng quan và lớp học            | Xem lịch dạy, học viên, bài cần xem và nhiệm vụ của lớp được phân công.                                                      |
| Chương trình và tiến độ         | Tổ chức chủ đề tuần; cập nhật nội dung đã dạy và ghi chú cần củng cố.                                                        |
| Học liệu và bài tập             | Tạo/tải lên, sửa, thay thế, đăng, lưu trữ/xóa bài theo quyền; đặt hạn nộp và giữ lịch sử bài đã có học viên nộp.             |
| Zoom và lịch 1:1                | Quản lý lịch được giao, giờ rảnh và buổi hỗ trợ; nhập link Zoom chung của lớp hoặc riêng từng buổi, chọn nguồn link phù hợp. |
| Điểm danh theo buổi             | Xem tham gia, ghi nhận hoặc chỉnh sửa chuyên cần và lý do trong lớp phụ trách.                                               |
| Phản hồi và điểm số             | Xem bài đã nộp, phản hồi/chấm theo quy tắc; xem lại kết quả AI và lưu lý do khi điều chỉnh.                                  |
| Kiểm tra và ngân hàng câu hỏi + | Soạn câu hỏi theo kỹ năng/độ khó, tạo bài kiểm tra và dùng tiêu chí chấm thống nhất.                                         |
| Báo cáo và hỗ trợ +             | Theo dõi kết quả, học viên thiếu bài hoặc cần củng cố; nhận xét trong báo cáo học tập.                                       |
| Thảo luận và thông báo +        | Trả lời thảo luận lớp, quản lý nội dung trao đổi và đăng thông báo trong phạm vi được cấp.                                   |
| Sao chép khóa sau (tương lai)   | Sao chép cấu trúc và bài tập thành bản nháp cho khóa sau; sửa ngày rồi đăng, không sao chép dữ liệu học viên.                |

### Trợ giảng

| Nhóm chức năng         | Chức năng                                                                                                             |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Lớp được giao          | Xem học viên, lịch và nhiệm vụ hỗ trợ trong phạm vi được phân công.                                                   |
| Hỗ trợ 1:1             | Xem lịch và trạng thái chuẩn bị trong lớp được giao; sửa link chung hoặc link riêng của buổi, không sửa lịch/đặt chỗ. |
| Bài nộp và phản hồi    | Chỉ xem metadata chuẩn bị; không xem câu trả lời, tệp bài nộp hoặc phản hồi riêng; không chấm/sửa điểm.               |
| Chuyên cần và chuẩn bị | Xem điểm danh, bài còn thiếu và trạng thái chuẩn bị; không sửa điểm danh hoặc bỏ qua điều kiện vào học.               |
| Hỗ trợ lớp +           | Mở rộng ngoài quyền đọc và sửa link cần xác nhận riêng trước khi triển khai.                                          |

TA chỉ sửa cấu hình link trong lớp được giao. Quyền này không cấp thêm quyền tạo/sửa lịch, xác nhận hoàn thành, sửa học liệu/bài tập, điểm danh, chấm bài, ghi danh, vai trò hoặc bỏ qua điều kiện nộp bài.

## Học viên và khách truy cập

### Học viên

| Nhóm chức năng           | Chức năng                                                                                                                                                                                                                 |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tổng quan và khóa học    | Xem lớp đã ghi danh, chủ đề, lịch và tiến độ; xem lớp mở đăng ký, gửi yêu cầu và theo dõi quyết định của quản trị.                                                                                                        |
| Lớp học Zoom             | Chọn buổi học để mở Zoom khi đủ điều kiện; xem trạng thái chuyên cần cá nhân.                                                                                                                                             |
| Đặt lịch 1:1             | Có mục Đặt lịch ôn bài 1:1 dễ tìm ở tổng quan và lịch tư vấn riêng; chọn khung giáo viên trước lớp chính, một chỗ/học viên, kiểm tra trùng lịch và hủy theo chính sách. Đặt trước khi đủ bài, nhận Zoom sau gate nộp bài. |
| Bài tập và phản hồi      | Lưu nháp, nộp bài, xem xác nhận và phản hồi; nộp lại theo chính sách.                                                                                                                                                     |
| Reading và Listening     | Đọc/nghe, trả lời, highlight, ghi chú, tra từ và chọn lưu từ vào sổ.                                                                                                                                                      |
| Writing                  | Ba khu vực đề bài, bài viết và từ điển; lưu bài và mind map theo chế độ đã thống nhất. Hạn chế dán là tùy chọn.                                                                                                           |
| Speaking với AI          | Nghe câu hỏi của giáo viên bằng giọng AI, ghi âm/nghe lại, nhận bản chép lời và phản hồi bốn tiêu chí; mở Fluency and Coherence trước.                                                                                    |
| Mẫu cải thiện            | Xem mẫu hướng tới +1 band và Band 9; highlight và lưu từ. Điểm AI và mẫu là hỗ trợ luyện tập.                                                                                                                             |
| Sổ từ và ôn tập AI       | Gộp từ của bốn kỹ năng theo chủ đề tuần; luyện trắc nghiệm, điền từ, ghép cặp và đặt câu; nhận nhắc ôn.                                                                                                                   |
| Kết quả và báo cáo +     | Xem điểm, nhận xét, báo cáo đã công bố và chứng nhận hoàn thành nếu áp dụng.                                                                                                                                              |
| Lộ trình và thảo luận +  | Theo dõi nội dung theo chương, bước học và trao đổi trong lớp theo quyền.                                                                                                                                                 |
| Email nhắc học và ôn tập | Nhận email nhắc hạn bài, lịch học, lịch 1:1, yêu cầu đặt lịch và ôn từ; nhận link khi đủ điều kiện.                                                                                                                       |
| Thông báo và hỗ trợ +    | Xem thông báo lớp và lịch hoạt động; gửi phản hồi hoặc yêu cầu hỗ trợ.                                                                                                                                                    |

Bốn tiêu chí Speaking là Fluency and Coherence, Lexical Resource, Grammatical Range and Accuracy và Pronunciation. Kết quả AI không phải chứng nhận điểm thi chính thức.

### Khách truy cập

| Nhóm chức năng         | Chức năng                                                                             |
| ---------------------- | ------------------------------------------------------------------------------------- |
| Giới thiệu và khóa học | Xem thông tin trung tâm, giáo viên và khóa học bằng tiếng Việt/Anh.                   |
| Liên hệ và đăng nhập   | Dùng thông tin liên hệ và truy cập đăng nhập; tự đăng ký tài khoản nếu được lựa chọn. |
| Đăng ký quan tâm +     | Gửi nhu cầu tư vấn hoặc hồ sơ đăng ký học khi áp dụng quy trình tuyển sinh.           |

Yêu cầu đăng ký có trạng thái chờ duyệt/đã duyệt/từ chối/đã hủy. Học viên hủy khi còn chờ và gửi lại sau từ chối/hủy. Chỉ admin duyệt, việc duyệt và tạo thành viên là một giao dịch có kiểm tra phiên bản; không tạo yêu cầu chờ hoặc thành viên trùng. Chưa duyệt không nhận tài liệu lớp hoặc link Zoom. Lớp mới chưa công khai/chưa nhận đăng ký; chỉ lớp hoạt động, công khai và mở đăng ký nhận yêu cầu.

Học viên chỉ xem dữ liệu của mình. Bản nháp, notebook và ghi chú riêng không tự chia sẻ. Khách truy cập không xem tài liệu lớp hoặc link Zoom riêng tư.

## Các lựa chọn mở rộng

Quý đơn vị có thể chọn các nhóm phù hợp với mô hình đào tạo. Với mỗi nhóm được chọn, cần xác nhận cấu trúc dữ liệu, quyền truy cập, trạng thái và quy tắc xử lý.

### Vai trò bổ sung

| Vai trò           | Chức năng                                                                                                            |
| ----------------- | -------------------------------------------------------------------------------------------------------------------- |
| Quản lý học thuật | Quản lý chương trình, duyệt bài kiểm tra/kết quả, theo dõi tiến độ giảng dạy và chất lượng theo lớp.                 |
| Ban quản lý       | Xem báo cáo tổng hợp về học viên, chuyên cần, chất lượng đào tạo và học phí nếu áp dụng.                             |
| Nhân sự học phí   | Quản lý khoản phải thu, thanh toán ghi nhận, công nợ, miễn giảm và nhắc học phí trong phạm vi được giao.             |
| Phụ huynh         | Xem chuyên cần, kết quả đã công bố và học phí của học viên được liên kết; nhận thông báo và gửi yêu cầu nghỉ/hỗ trợ. |

### Nhóm chức năng lựa chọn

| Nhóm chức năng        | Chức năng                                                                                                             |
| --------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Học phí               | Khoản thu, lịch thu, ghi nhận thanh toán, công nợ và miễn giảm. Thanh toán trực tuyến là lựa chọn riêng cần xác nhận. |
| Báo cáo và chứng nhận | Báo cáo kết quả và chứng nhận hoàn thành của trung tâm; mẫu, người duyệt và thời điểm phát hành cần thống nhất.       |
| Khảo sát và hỗ trợ    | Khảo sát chất lượng, phản hồi, yêu cầu hỗ trợ và theo dõi xử lý.                                                      |
| Hoạt động và ghi nhận | Sự kiện, đăng ký tham gia, huy hiệu/điểm động viên và thư viện ảnh theo nhu cầu.                                      |
| Sự vụ và kỷ luật      | Ghi nhận sự vụ, mức độ, biện pháp xử lý và người phụ trách; giới hạn quyền xem.                                       |

Phụ huynh chỉ xem dữ liệu của học viên đã được liên kết và kết quả được công bố. Chứng nhận hoàn thành là của đơn vị đào tạo, không phải chứng chỉ IELTS.

## Làm rõ yêu cầu kỹ thuật · 1

Vui lòng cung cấp giá trị, quy tắc hoặc mẫu dữ liệu ẩn danh cho từng mục. Thông số nêu dưới dạng câu hỏi chưa được mặc định áp dụng. Zoom và email đã được thống nhất; không cần cung cấp mật khẩu hoặc khóa truy cập.

### Q01 Đăng nhập và vòng đời tài khoản

Đăng nhập bằng email/mật khẩu hay tài khoản tổ chức hiện có? Tài khoản được mời, tạo sẵn hay tự đăng ký; có cần xác minh email và xác thực hai bước? Khi khóa tài khoản, rút ghi danh hoặc kết thúc khóa học, phiên đăng nhập và quyền xem học liệu phải thay đổi thế nào?

Phản hồi ______________________________

### Q02 Ma trận quyền theo vai trò và lớp

Quyền nhập link của admin, giáo viên và TA theo lớp đã chốt; TA vẫn chỉ đọc dữ liệu học thuật ngoài ngoại lệ này. Với các quyền bổ sung còn lại, xác nhận quyền xem/tạo/sửa/xóa/xuất dữ liệu, đăng bài, sửa điểm và điểm danh; phạm vi là bản thân, lớp được giao hay toàn bộ? Khi một tài khoản có nhiều vai trò, quyền nào được ưu tiên? TA và người quản trị cần quyền ngoại lệ nào, và thao tác nào phải ghi lý do?

Phản hồi ______________________________

### Q03 Cấu trúc dữ liệu và nhập danh sách

Luồng đăng ký có admin duyệt đã chốt; không cần chọn lại giữa duyệt và tự vào lớp. Xin mẫu dữ liệu ẩn danh cho học viên, khóa, lớp, chủ đề tuần và ghi danh: trường bắt buộc, mã định danh, liên kết và trạng thái. Có cần nhập/xuất CSV hoặc Excel? Khi trùng email/mã, thiếu trường hoặc nhập lại danh sách, hệ thống phải cập nhật, bỏ qua hay báo lỗi từng dòng?

Phản hồi ______________________________

### Q04 Điều kiện cấp quyền vào buổi học

Buổi 1:1 gắn với bộ bài bắt buộc nào; trạng thái nào được tính đã nộp hợp lệ, kể cả nộp muộn hoặc nộp lại? Điều kiện đã chốt là lịch hợp lệ và nộp đủ bài. Nếu bài bị rút hoặc lịch bị hủy sau khi gửi link, quyền cũ xử lý thế nào? Với lớp chính, thiếu bài/chưa xong 1:1 sẽ cảnh báo hay chặn?

Phản hồi ______________________________

### Q05 Đặt lịch và xử lý xung đột

Đã chốt mục đặt ôn bài 1:1 trước lớp chính, khung giáo viên phụ trách và một học viên/khung; đặt được trước khi đủ bài. Xác nhận thời lượng, khoảng nghỉ, múi giờ, hạn đặt/đổi/hủy, số lịch tối đa và quy tắc vắng mặt. Học viên chọn giáo viên hay được phân công? Xin lịch mẫu liên kết hạn bài với buổi học. Khi hai người đặt cùng giờ, hoặc lịch trùng lớp cố định/người dạy, hệ thống cần từ chối và hiển thị phương án nào?

Phản hồi ______________________________

### Q06 Học liệu và vòng đời bài nộp

Cho từng kỹ năng, xác nhận loại tệp, dung lượng/thời lượng tối đa, cách giáo viên nhập đề và đáp án. Khi bài đã có người nộp, sửa/thay/xóa đề phải giữ phiên bản nào? Nộp muộn, nộp lại, tải tệp lỗi và nhấn nộp nhiều lần cần được xử lý ra sao? Bản nộp gồm bài làm, ghi âm và mind map nào?

Phản hồi ______________________________

## Làm rõ yêu cầu kỹ thuật · 2

Vui lòng cung cấp giá trị, quy tắc hoặc mẫu dữ liệu ẩn danh cho từng mục. Thông số nêu dưới dạng câu hỏi chưa được mặc định áp dụng. Zoom và email đã được thống nhất; không cần cung cấp mật khẩu hoặc khóa truy cập.

### Q07 Reading, Listening và chấm đáp án

Xin bài mẫu kèm đáp án: dạng câu hỏi, đồng hồ đếm giờ, số lần nghe và quyền tua audio. Nếu tự chấm, xử lý chữ hoa/thường, chính tả, đáp án tương đương và điểm từng câu thế nào? Highlight/ghi chú có được giữ qua lần làm lại không? Tra từ cần nghĩa, phát âm, ví dụ và nguồn từ điển nào?

Phản hồi ______________________________

### Q08 Writing, mind map và khôi phục nháp

Mind map cần vẽ tay hay ô/đường nối; lưu mở lại và xuất ra định dạng nào? Có bật hạn chế dán, cho phép ngoại lệ hoặc giới hạn từ không? Bài viết, sơ đồ và ghi chú cần tự lưu với tần suất nào; khi mất mạng, tải lại trang hoặc mở hai thiết bị thì khôi phục và xử lý bản khác nhau ra sao?

Phản hồi ______________________________

### Q09 Speaking AI và trạng thái xử lý

Xác nhận giọng đọc, thời lượng ghi âm, số lần ghi lại và thời gian chờ phản hồi chấp nhận được. Xin bài nói mẫu với điểm/nhận xét mong đợi cho bốn tiêu chí và hai bản cải thiện (+1 band, Band 9). Khi AI lỗi hoặc hết lượt, có cho thử lại/chấm thủ công không? Điểm AI và điểm giáo viên sửa được lưu, hiển thị thế nào?

Phản hồi ______________________________

### Q10 Sổ từ, luyện tập và mốc nhắc ôn

Một từ cần lưu những trường nào: nghĩa, câu nguồn, kỹ năng, chủ đề? Từ trùng ở nhiều chủ đề hoặc khác nghĩa có gộp không? Hoạt động nào tính là đã ôn; nhắc sau hai tuần tính từ buổi học, ngày lưu hay lần ôn cuối? AI tạo bao nhiêu câu mỗi lượt, chấm câu tự viết ra sao và lưu lịch sử luyện tập nào?

Phản hồi ______________________________

### Q11 Email: sự kiện, gửi lại và ngôn ngữ

Cho mỗi sự kiện (hạn bài, yêu cầu đặt lịch, lịch học/1:1, cấp link, ôn từ), xác nhận người nhận, thời điểm và số lần nhắc, múi giờ, giờ yên lặng và mẫu song ngữ. Dùng tên miền gửi và địa chỉ nhận phản hồi nào? Khi lịch đổi/hủy, gửi lỗi hoặc sự kiện lặp, cần hủy thư chờ, thử lại và chống gửi trùng theo quy tắc nào?

Phản hồi ______________________________

### Q12 Zoom: quy tắc vào phòng và thay đổi link

**Đã chốt:** admin, giáo viên và TA được giao nhập link thủ công, dùng chung theo lớp hoặc riêng từng buổi; không cần tích hợp tạo họp. Mỗi buổi chọn nguồn chung, riêng hoặc chưa có. Tư vấn mặc định chưa cấu hình; muốn dùng phòng chung phải chọn rõ. Đổi link chung tác động các buổi đang dùng nguồn chung, không tác động link riêng. URL chỉ cấp sau kiểm tra quyền và điều kiện chuẩn bị; lưu kiểm tra phiên bản, lỗi giữ nội dung nhập.

Cần xác nhận quy tắc phòng chờ, mật mã và yêu cầu đăng nhập tại Zoom; khi nhiều buổi đồng thời cần dùng các phòng/link nào? Với URL đã cấp rồi bị thay/hủy, ai quản lý phòng Zoom và cần gửi thông báo thay đổi nào? Cổng học tập không tự thu hồi được link đã sao chép. Nếu triển khai điểm danh tích hợp, thông số tài khoản/quyền cần kiểm chứng riêng tại Q13, không chặn việc nhập link.

Phản hồi ______________________________

## Làm rõ yêu cầu kỹ thuật · 3

Vui lòng cung cấp giá trị, quy tắc hoặc mẫu dữ liệu ẩn danh cho từng mục. Thông số nêu dưới dạng câu hỏi chưa được mặc định áp dụng. Zoom và email đã được thống nhất; không cần cung cấp mật khẩu hoặc khóa truy cập.

### Q13 Điểm danh và đối soát người tham gia

Đối chiếu học viên với người tham gia Zoom bằng email, đăng ký cuộc họp hay mã nào? Xác nhận số phút tối thiểu, ngưỡng đi muộn, cách cộng thời gian khi rời/vào lại. Khi không khớp danh tính hoặc chưa có dữ liệu Zoom, trạng thái chờ là gì? Nếu giáo viên đã sửa tay, dữ liệu tự động về sau có được ghi đè không?

Phản hồi ______________________________

### Q14 Điểm số, báo cáo và công bố

Xác nhận thang điểm, trọng số, làm tròn, cách tính bài chưa nộp/nộp lại và thời điểm học viên thấy phản hồi. Với báo cáo/chứng nhận được chọn, xin mẫu trường dữ liệu và định dạng xuất. Vai trò nào duyệt/công bố/thu hồi; phụ huynh được xem gì; bản đã phát hành có giữ lịch sử khi sửa điểm không?

Phản hồi ______________________________

### Q15 Dữ liệu riêng tư, lưu giữ và xóa

Có học viên cần người giám hộ đồng ý ghi âm/xử lý AI không; cần lưu bằng chứng đồng ý nào? Xác nhận quyền đọc/tải âm thanh, bài nộp, nhật ký hoạt động và thời hạn lưu từng loại. Notebook/ghi chú riêng chỉ chia sẻ khi nào? Khi xóa tài khoản, dữ liệu nào xóa, ẩn danh hoặc giữ lại; có yêu cầu vị trí lưu trữ và dịch vụ AI được phép không?

Phản hồi ______________________________

### Q16 Song ngữ và thiết bị hỗ trợ

Tiếng Việt/Anh được chọn theo tài khoản hay trình duyệt? Khi thiếu bản dịch, dùng ngôn ngữ nào cho nội dung học, từ điển, phản hồi AI và email? Ngày giờ/hạn nộp hiển thị theo múi giờ nào? Xác nhận trình duyệt, điện thoại/máy tính bảng cần hỗ trợ, nhất là ghi âm, mind map, bàn phím và trình đọc màn hình.

Phản hồi ______________________________

### Q17 Dữ liệu và quy tắc cho nhóm bổ sung

Với các nhóm được chọn, xin mẫu trường và trạng thái: hồ sơ tuyển sinh, khoản thu/miễn giảm, liên kết phụ huynh, hỗ trợ/sự vụ. Xác nhận cách chuyển hồ sơ thành ghi danh, duyệt liên kết và giới hạn quyền xem. Học phí chỉ ghi nhận hay có thanh toán trực tuyến? Nếu trực tuyến, cần cổng nào và quy tắc đối soát, hoàn tiền, thông báo thanh toán trùng ra sao?

Phản hồi ______________________________

### Q18 Dung lượng, hiệu năng và phục hồi

Xác nhận số tài khoản/lớp, người dùng đồng thời và lượt ghi âm/AI cao điểm; tổng dữ liệu dự kiến. Thời gian tải trang, lưu bài và xử lý AI tối đa chấp nhận được là bao lâu? Mức mất dữ liệu và thời gian khôi phục cho phép là gì? Khi Zoom, email hoặc AI tạm ngừng, cần giữ dữ liệu và cho phép thao tác nào tiếp tục?

Phản hồi ______________________________

# English

## Training Management Platform Features

User Roles and Technical Requirement Clarifications

The platform connects course administration, teaching activities, live classes and learning progress. This document presents role-based features and clarifications concerning data, permissions, integrations, processing rules and expected outcomes.

### Learning workflow

- Zoom for main classes and 1:1 support; email for notifications and reminders.
- **Confirmed 10 October 2026:** administrators, assigned teachers and assigned TAs enter existing Zoom links once per cohort or individually per session. Automatic creation is optional future work; manual entry needs no Zoom API account/keys.
- **Enrollment confirmed:** students request an open cohort; administrator approval is required for learning access. Requests never auto-enroll.
- Students may book first. Release 1:1 access after a valid booking and submission of all required homework.
- Reading, Listening, Writing and Speaking tools; Speaking AI, improved examples, a vocabulary notebook, AI practice and review reminders.
- Vietnamese and English interfaces. Learning content and notifications follow the agreed language policy.
- Attendance based on verified participation where available, with manual recording and corrections.

### User roles

| Role               | Capabilities                                                                 |
| ------------------ | ---------------------------------------------------------------------------- |
| Administrator      | Manage students, cohorts, users, schedules and overall operations.           |
| Teacher            | Teach, assign work, assess and follow assigned cohorts.                      |
| Teaching assistant | Read assigned support/preparation data and manage cohort/session Zoom links. |
| Student            | Study, complete work, join Zoom, receive feedback and review.                |
| Visitor            | Browse public information, courses and contact details.                      |

Groups marked + are additional features for your organization to select. Future items serve later cohorts. Other groups support the main learning and administration workflow. The final sections clarify system behavior and parameters awaiting confirmation.

Users have sign-in, account recovery and language/timezone preferences. A person may hold multiple roles; data access, score editing and publication are granted by responsibility and assigned cohort.

## Administrator

The administration area brings together the following groups. Fees and incidents are extensions selected according to need.

| Feature group                   | Capabilities                                                                                                                                         |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dashboard                       | View learner and active-cohort counts, upcoming sessions, missing work and attendance.                                                               |
| Students                        | Manage profiles, contact details, learning status, enrollments and cohort history.                                                                   |
| Admissions +                    | Track enquiries, applications and review status, then convert accepted applications to enrollment.                                                   |
| Courses and cohorts             | Create courses/cohorts/topics and staff assignments; manage enrollment, open requests and approve/reject student applications with an optional note. |
| Attendance                      | Review overall and per-session attendance, lateness and absences; record reasoned corrections.                                                       |
| Syllabus                        | Manage skills, chapters, topics and required course content.                                                                                         |
| Timetable                       | Manage classes, 1:1 sessions and availability; identify conflicts and update changed/cancelled sessions.                                             |
| LMS content                     | Organize documents, audio, video and lessons; control publication to each cohort.                                                                    |
| File manager +                  | Organize shared folders/files; grant access and replace or archive materials.                                                                        |
| Teaching progress +             | Track taught topics, outstanding content and curriculum completion by cohort.                                                                        |
| Assignments                     | Manage assignments, deadlines, publication and session preparation requirements.                                                                     |
| Assessments and question bank + | Organize assessments, question banks by skill/topic/difficulty and marking rubrics.                                                                  |
| Grading and report cards +      | Manage grading scales, gradebooks, review steps and published course/period learning reports.                                                        |
| Analytics +                     | Analyze results by cohort/skill, submission rates and attendance; identify areas needing support.                                                    |
| Users                           | Invite/provision accounts, assign roles and cohort access, and disable accounts when needed.                                                         |
| Email reminders                 | Configure deadline, class, 1:1 and vocabulary reminders; monitor delivery and retry when appropriate while preserving access rules.                  |
| Announcements and calendar +    | Publish audience-specific notices and manage activities, events and holidays.                                                                        |
| Settings and activity history   | Manage default/individual Zoom links, email, schedules and language; review permission/data changes; link entry needs no Zoom API connection.        |

The + symbol identifies an additional group for selection. Account administration does not automatically allow private-note access or academic score editing.

## Teachers and Teaching Assistants

### Teacher

| Feature group                   | Capabilities                                                                                                                                   |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Dashboard and classes           | View teaching schedules, assigned learners, work to review and class tasks.                                                                    |
| Syllabus and progress           | Organize weekly topics; record taught content and areas needing reinforcement.                                                                 |
| Materials and assignments       | Create/upload, edit, replace, publish and archive/delete work within granted scope; set deadlines and keep previous versions used by learners. |
| Zoom and 1:1 sessions           | Manage assigned schedules, availability and consultations; enter a cohort default or individual Zoom link and select the session source.       |
| Session attendance              | Review participation, record or correct attendance and reasons within assigned cohorts.                                                        |
| Feedback and grading            | Review submissions and mark/provide feedback under policy; review AI results and record reasons for adjustments.                               |
| Assessments and question bank + | Author questions by skill/difficulty, create assessments and apply consistent rubrics.                                                         |
| Reports and support +           | Track results, missing work and learners needing support; contribute learning-report comments.                                                 |
| Discussions and notices +       | Respond to class discussions, moderate exchanges and publish notices within granted scope.                                                     |
| Cohort copying (future)         | Copy structure and assignments as drafts for future cohorts; revise dates and publish without copying learner data.                            |

### Teaching assistant

| Feature group            | Capabilities                                                                                              |
| ------------------------ | --------------------------------------------------------------------------------------------------------- |
| Assigned cohorts         | View learners, schedules and support duties within assigned scope.                                        |
| 1:1 support              | Read assigned schedules/readiness; edit default or session Zoom links without editing schedules/bookings. |
| Submissions and feedback | Preparation metadata only; no answer text, submission files or private feedback; no grading/score edits.  |
| Attendance and readiness | Read attendance, missing work and preparation status; no attendance edits or access overrides.            |
| Class support +          | Extensions beyond read access and link editing require separate confirmation before implementation.       |

TA mutations are limited to link settings in assigned cohorts. This does not grant schedule creation/editing, completion changes, material/assignment edits, attendance edits, grading, enrollment/role management or prerequisite overrides.

## Students and Visitors

### Student

| Feature group                    | Capabilities                                                                                                                                                                                                                     |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dashboard and courses            | View enrolled cohorts, topics, schedules and progress; browse open enrollment and request a cohort, then track the admin decision.                                                                                               |
| Zoom classes                     | Select an eligible session to open Zoom and view personal attendance.                                                                                                                                                            |
| 1:1 booking                      | Prominent overview entry and consultation-only schedule for teacher-hosted pre-class review; one student place, conflict checks and cancellation under policy. Book before homework; receive Zoom only after preparation checks. |
| Assignments and feedback         | Save drafts, submit, view receipts and feedback, and resubmit under policy.                                                                                                                                                      |
| Reading and Listening            | Read/listen, answer, highlight, annotate, look up words and explicitly save selected vocabulary.                                                                                                                                 |
| Writing                          | Use prompt, writing and dictionary panels; save work and an agreed mind-map format. Paste restriction is optional.                                                                                                               |
| Speaking with AI                 | Hear teacher-provided questions in an AI voice, record/play back, and receive a transcript and four-criterion feedback, starting with Fluency and Coherence.                                                                     |
| Improved examples                | View approximately +1-band and Band-9-target examples; highlight and save words. AI scores/examples support practice.                                                                                                            |
| Notebook and AI practice         | Collect vocabulary across four skills by weekly topic; practice multiple choice, gap fill, matching and sentences; receive review reminders.                                                                                     |
| Results and reports +            | View released grades, feedback, learning reports and completion certificates where offered.                                                                                                                                      |
| Learning paths and discussions + | Follow course modules and learning steps, and participate in authorized class discussions.                                                                                                                                       |
| Learning and review emails       | Receive deadline, class, 1:1, booking and vocabulary reminders, and access links when eligible.                                                                                                                                  |
| Notices and support +            | View class notices and activities, and submit feedback or support requests.                                                                                                                                                      |

The Speaking criteria are Fluency and Coherence, Lexical Resource, Grammatical Range and Accuracy, and Pronunciation. AI results are not official exam certification.

### Visitor

| Feature group                | Capabilities                                                                        |
| ---------------------------- | ----------------------------------------------------------------------------------- |
| Public site and courses      | Browse organization, teacher and course information in Vietnamese/English.          |
| Contact and login            | Use contact information and access login; self-register if that option is selected. |
| Enquiries and applications + | Submit an enquiry or course application when the admissions workflow is selected.   |

Enrollment requests are pending/approved/rejected/cancelled. Students cancel while pending and reapply after rejection/cancellation. Only admin approves; a versioned transaction creates the membership and approval together, without duplicate pending requests/memberships. Pending applicants receive no private material or Zoom URL. New cohorts are unlisted/enrollment-closed; requests require an active, listed cohort accepting enrollment.

Students access their own records. Drafts, notebooks and private notes are not shared automatically. Visitors cannot access private class content or Zoom links.

## Optional Extensions

Select the groups that fit your teaching model. For each selected group, confirm data fields, permissions, states and processing rules.

### Additional roles

| Role                 | Capabilities                                                                                                       |
| -------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Academic coordinator | Manage curriculum, review assessments/results and monitor teaching progress and cohort outcomes.                   |
| Management           | View aggregate enrollment, attendance, learning-quality and fee reports where applicable.                          |
| Accounts staff       | Manage charges, recorded payments, outstanding balances, concessions and fee reminders within granted scope.       |
| Parent or guardian   | View attendance, released results and fees for linked learners; receive notices and submit leave/support requests. |

### Selectable feature groups

| Feature group              | Capabilities                                                                                                     |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Fee management             | Charges, due dates, payment records, outstanding balances and concessions. Online payment is a separate choice.  |
| Reports and certificates   | Organization-issued learning reports and completion certificates; agree templates, approvers and release timing. |
| Surveys and support        | Quality surveys, feedback, support requests and resolution tracking.                                             |
| Activities and recognition | Events, participation registration, motivational badges/points and galleries where needed.                       |
| Incidents and discipline   | Record incidents, severity, actions and ownership with restricted access.                                        |

Parents see only linked learners and released results. Completion certificates are issued by the training organization and are not IELTS certificates.

## Technical Clarifications · 1

Please supply values, rules or anonymized examples for each item. Parameters raised as questions are not assumed requirements. Zoom and email are already agreed; no passwords or access keys are needed.

### Q01 Sign-in and account lifecycle

Should users sign in with email/password or an existing organizational account? Are accounts invited, provisioned or self-registered; are email verification and two-factor authentication required? How should sessions and material access change when an account is disabled, enrollment is withdrawn or a course ends?

Response ______________________________

### Q02 Role and cohort permission matrix

Admin/assigned teacher/TA link entry is confirmed; other TA academic access remains read-only. For any remaining additional grants, confirm view/create/edit/delete/export, publishing, grading and attendance permissions, scoped to self, assigned cohorts or all records. How should overlapping roles resolve conflicting permissions? Which exceptions may TAs or administrators grant, and which actions require a recorded reason?

Response ______________________________

### Q03 Data structure and roster imports

Admin-approved enrollment requests are confirmed; approval versus automatic joining does not need reopening. Provide anonymized examples of learners, courses, cohorts, weekly topics and enrollments, including required fields, identifiers, relationships and statuses. Are CSV or Excel imports/exports required? For duplicate emails/IDs, missing fields or repeated imports, should the system update, skip or report each invalid row?

Response ______________________________

### Q04 Session access conditions

Which required assignment set belongs to each 1:1, and which submission states qualify, including late work or resubmissions? The agreed gate is a valid booking plus all required submissions. What happens to released access if a submission is withdrawn or a booking cancelled? For main classes, should incomplete homework/1:1 trigger a warning or a block?

Response ______________________________

### Q05 Booking and conflict handling

A clear pre-class 1:1 review booking entry, teacher-hosted slots and one student place per slot are confirmed; booking before completed homework is allowed. Confirm duration, buffers, timezone, cutoffs, booking limits and no-show rules. Do learners choose a teacher or receive an assignment? Provide a sample schedule linking homework deadlines to sessions. What rejection and alternatives are required for simultaneous bookings or conflicts with fixed classes or staff schedules?

Response ______________________________

### Q06 Materials and submission lifecycle

For each skill, confirm file types, maximum size/duration and how teachers enter prompts and answer keys. Which versions must remain when published work with submissions is edited, replaced or deleted? How should late work, resubmissions, failed uploads and repeated submit clicks behave? Which written work, recordings and mind maps form the submitted attempt?

Response ______________________________

## Technical Clarifications · 2

Please supply values, rules or anonymized examples for each item. Parameters raised as questions are not assumed requirements. Zoom and email are already agreed; no passwords or access keys are needed.

### Q07 Reading, Listening and answer marking

Provide sample exercises and keys, including question types, timers, replay limits and audio seeking. If automatically marked, how should case, spelling, alternative answers and per-question points be handled? Should highlights/notes survive a new attempt? Which definitions, pronunciations, examples and dictionary source are required?

Response ______________________________

### Q08 Writing, mind maps and draft recovery

Should mind maps support freehand drawing or nodes/connectors, and which save/reopen and export formats are needed? Are paste restrictions, exceptions or word limits required? How often should writing, diagrams and notes autosave, and how should offline use, reloads and conflicting edits on two devices be recovered or resolved?

Response ______________________________

### Q09 Speaking AI and processing states

Confirm voice, recording duration, retake limits and acceptable feedback wait time. Provide sample recordings with expected four-criterion scores/feedback and both improved examples (+1 band and Band 9). On AI failure or quota exhaustion, is retry/manual review allowed? How should original AI scores and teacher adjustments be stored and displayed?

Response ______________________________

### Q10 Vocabulary, practice and review triggers

Which fields should a saved word contain: meaning, source sentence, skill and topic? Should duplicates across topics or different meanings be merged? What counts as review, and does the two-week reminder run from the lesson, save date or last review? How many AI questions form a session, how are learner-written sentences assessed, and what practice history is retained?

Response ______________________________

### Q11 Email events, retries and language

For deadlines, booking prompts, classes/1:1, link release and vocabulary review, confirm recipients, timing/frequency, timezone, quiet hours and bilingual templates. Which sender domain and reply address apply? On schedule changes/cancellations, delivery failures or duplicate events, what rules govern pending-message cancellation, retries and duplicate prevention?

Response ______________________________

### Q12 Zoom admission and link changes

**Confirmed:** admin, assigned teachers and TAs enter links manually, using a cohort default or an individual session link; meeting-creation integration is not required. Each session selects default, own link or none. Consultations start unconfigured and must explicitly choose a shared room. Updating the default affects shared-source sessions, not individual links. URLs are released only after access/preparation checks; saves check versions and errors preserve input.

Confirm Zoom waiting-room, passcode and sign-in rules; which rooms/links support concurrent sessions? After an already released URL is changed or canceled, who manages the Zoom room and which change notifications are needed? The portal cannot revoke a copied URL by itself. If attendance integration is selected, validate account capabilities separately under Q13; this does not block manual entry.

Response ______________________________

## Technical Clarifications · 3

Please supply values, rules or anonymized examples for each item. Parameters raised as questions are not assumed requirements. Zoom and email are already agreed; no passwords or access keys are needed.

### Q13 Attendance and participant matching

How should Zoom participants match learner records: email, meeting registration or another identifier? Confirm minimum attendance minutes, lateness thresholds and aggregation across rejoining. What pending state applies when identity cannot be matched or Zoom data is unavailable? May later automated data overwrite a teacher correction?

Response ______________________________

### Q14 Scores, reports and publication

Confirm scales, weights, rounding, handling of missing/resubmitted work and feedback visibility timing. For selected reports/certificates, provide required fields and export formats. Which roles approve, publish or withdraw them, what may guardians see, and should issued versions remain available after grade changes?

Response ______________________________

### Q15 Private data, retention and deletion

Do any learners require guardian consent for recording/AI processing, and what consent evidence must be stored? Confirm read/download permissions for audio, submissions and activity logs, plus retention per data type. When may private notebooks/notes be shared? On account deletion, which records are erased, anonymized or retained, and are storage-region or permitted-AI-service constraints required?

Response ______________________________

### Q16 Bilingual behavior and supported devices

Should Vietnamese/English follow the account or browser preference? Which fallback language applies to learning content, dictionary entries, AI feedback and email? Which timezone governs displayed dates and deadlines? Confirm supported browsers, phones/tablets and accessibility needs, especially recording, mind maps, keyboard use and screen readers.

Response ______________________________

### Q17 Data and rules for optional modules

For selected modules, provide fields and states for applications, charges/concessions, guardian links and support/incident records. Confirm enrollment conversion, link approval and access restrictions. Are fees recorded only or paid online? If online, which gateway and rules are required for reconciliation, refunds and duplicate payment notifications?

Response ______________________________

### Q18 Capacity, performance and recovery

Confirm account/cohort counts, concurrent users, peak recording/AI requests and expected data volume. What maximum page-load, save and AI-processing times are acceptable? What data-loss and recovery-time limits apply? During a Zoom, email or AI outage, which data must be preserved and which actions should remain available?

Response ______________________________
