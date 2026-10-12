# Nghiên cứu website dạy học cho Project L

Ngày khảo sát: 2026-10-08. Phạm vi: README, cây thư mục và một số file LMS trọng tâm;
chưa cài/chạy ba hệ thống, chưa kiểm chứng toàn bộ tính năng hoặc hiệu năng.
Đây là đề xuất nghiên cứu, chưa phải phạm vi sản phẩm đã chốt.

## Nguồn và bài học

### TemiKayode / School-Management-System

- Snapshot: `b19aaac2435ba44c24ee1cf4e3e6e3511bfb0578`.
- [Repository](https://github.com/TemiKayode/School-Management-System).
- [LMS controller](https://github.com/TemiKayode/School-Management-System/blob/b19aaac2435ba44c24ee1cf4e3e6e3511bfb0578/backend/src/modules/elearning/elearning.controller.ts)
  có khóa học, bài học theo thứ tự, ghi danh, khóa học của tôi và tiến độ hoàn thành.
- [Routes](https://github.com/TemiKayode/School-Management-System/blob/b19aaac2435ba44c24ee1cf4e3e6e3511bfb0578/backend/src/modules/elearning/elearning.routes.ts)
  phân quyền thao tác theo ADMIN/TEACHER và yêu cầu đăng nhập.
- Bài học: mô hình LMS nhỏ, dễ hiểu; tách danh mục khỏi khóa học đang học.
- Điểm cần kiểm tra nếu tái sử dụng: trong controller đã đọc, sửa/xuất bản khóa học
  chỉ truy vấn theo ID, chưa thấy kiểm tra giáo viên sở hữu khóa học; lấy chi tiết
  trả bài học cùng cờ enrolled. Không coi kiểm tra vai trò là đủ cho quyền từng tài nguyên.

### Globussoft / globussoft-school-mis

- Snapshot: `e3c4c37aa50e4247eee87562e727db516fda4b6b`.
- [Repository](https://github.com/Globussoft-Technologies/globussoft-school-mis).
- [Course modules service](https://github.com/Globussoft-Technologies/globussoft-school-mis/blob/e3c4c37aa50e4247eee87562e727db516fda4b6b/packages/api/src/modules/course-modules/course-modules.service.ts)
  tổ chức module và nội dung, tiến độ theo học viên, mở theo ngày/thứ tự/điều kiện,
  tiêu chí hoàn thành và trạng thái xuất bản.
- Bài học: tách kho tài liệu khỏi lộ trình học; trạng thái khóa phải giải thích lý do.
- Điểm cần kiểm tra: hàm completeItem đã đọc ghi nhận hoàn thành mà không gọi
  checkUnlockStatus; getModuleDetail trả items cùng unlockStatus. Khi triển khai
  Project L, backend phải thực thi quyền truy cập nội dung, không chỉ gửi cờ cho UI.
- README mô tả hệ quản trị trường rất rộng; chỉ chọn các nghiệp vụ phục vụ học tập.

### igweze / fobrain

- Snapshot: `48ef59ae4ad60e54c50aa115af6928609d6755ff`.
- [Repository](https://github.com/igweze/fobrain).
- [Trang học của học viên](https://github.com/igweze/fobrain/blob/48ef59ae4ad60e54c50aa115af6928609d6755ff/student/e-course.php)
  có nội dung theo chương, tài liệu tải xuống, video, video nhúng và form quiz.
- [Form tạo khóa học](https://github.com/igweze/fobrain/blob/48ef59ae4ad60e54c50aa115af6928609d6755ff/admin/e-course-create.php)
  gắn nội dung với học kỳ/cấp lớp, thời lượng, trạng thái và mô tả.
- Bài học: học liệu đa định dạng, thông tin giáo viên và bối cảnh lớp học rõ ràng.
- Đây là PHP với HTML/JavaScript trộn trong trang; tham khảo nghiệp vụ, không chuyển
  nguyên cấu trúc đó vào frontend React của Project L. Chưa xác minh luồng chấm quiz.

## Hướng đề xuất cho Project L

Giữ React + Vite + TypeScript và giao diện VI/EN hiện có. Xây một LMS gọn với
ba vai trò ban đầu: học viên, giáo viên, quản trị viên. Vai trò phụ huynh chỉ thêm
nếu đối tượng học là trẻ em và sản phẩm cần liên kết gia đình.

Luồng chính:

1. Học viên: tìm khóa học → xem chương trình → ghi danh → tiếp tục bài đang học
   → nộp bài/quiz → xem phản hồi và tiến độ.
2. Giáo viên: tạo khóa học nháp → thêm chương/bài/tài liệu → xem trước → xuất bản
   → giao bài → chấm và phản hồi.
3. Quản trị: quản lý tài khoản, phân công giáo viên, khóa học và ghi danh.

Màn hình đầu tiên đề xuất: danh mục khóa học, chi tiết khóa học, khóa học của tôi,
trang học bài, bài tập/kết quả, khu vực giáo viên và quản trị cơ bản.
Trang học bài ưu tiên nội dung chính, mục lục chương/bài và nút tiếp tục;
trên điện thoại mục lục thu gọn. Dashboard ưu tiên việc cần làm: học tiếp, hạn nộp,
bài cần chấm. Mọi màn hình có trạng thái tải, trống, lỗi và thành công bằng VI/EN.

Mô hình dữ liệu đề xuất:

- User, Course, Module, Lesson: tài khoản và nội dung theo cấp.
- Enrollment: quan hệ học viên–khóa học và trạng thái ghi danh.
- LessonProgress: tiến độ riêng của học viên, ghi lặp không tạo bản trùng.
- Assignment, Submission, Feedback: giao bài, lần nộp, điểm và nhận xét.
- Cohort/Class và LiveSession: thêm khi có lớp học theo lịch.

Tách chuỗi giao diện VI/EN khỏi nội dung khóa học: đổi ngôn ngữ UI không tự dịch
bài giảng. Dùng ID ổn định, định dạng ngày/giờ theo locale và lưu thời điểm thống nhất.
Frontend dùng lớp truy cập dữ liệu riêng để đổi dữ liệu mẫu sang API thật sau này.
Quyền sở hữu khóa học, ghi danh, điểm và điều kiện mở bài được kiểm tra tại backend.

## Thứ tự thực hiện đề xuất

1. Chốt đối tượng học, môn học và hình thức học trực tiếp/video/kết hợp.
2. Dựng một luồng học viên hoàn chỉnh bằng dữ liệu mẫu có nhãn demo.
3. Dựng luồng giáo viên tạo nội dung và chấm bài.
4. Kết nối đăng nhập/API, lưu tiến độ và tệp; kiểm thử quyền giữa các tài khoản.
5. Bổ sung lớp trực tuyến, thanh toán hoặc phụ huynh khi có nhu cầu được xác nhận.

Các quyết định còn mở: bán khóa học hay lớp nội bộ, độ tuổi, nguồn học liệu,
cách ghi danh, backend, hosting, thương hiệu và nội dung thật.
Chưa đưa kế toán, xe đưa đón, ký túc xá, thư viện vào phạm vi đề xuất ban đầu.
Chưa sao chép mã nguồn hoặc tài sản của ba repo vào ứng dụng.
