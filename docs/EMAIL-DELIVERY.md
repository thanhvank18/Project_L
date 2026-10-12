# Email delivery preparation / Chuẩn bị gửi email

Updated / Cập nhật: 11 October 2026.

## Current status / Trạng thái hiện tại

**Client confirmation / Xác nhận khách hàng — 11 October 2026:** the centre has no
email delivery service yet and has not obtained a domain or hosting. Trung tâm
xác nhận chưa có dịch vụ gửi email, tên miền hoặc hosting. Sender/provider setup
remains open; no provider account was created or enabled during the audit.

**VI:** Chưa có nhà cung cấp, tên miền gửi hoặc khóa API được cấu hình. Gửi email
mặc định tắt. Hàng đợi SQLite, mẫu Việt/Anh, cơ chế thử lại và adapter Resend đã
được chuẩn bị; không có email thật nào được gửi hoặc xác nhận nhận trong đợt này.
Resend là adapter kỹ thuật có sẵn để thử nghiệm sau, chưa phải quyết định mua dịch
vụ của khách hàng. Email và nhắc lịch vẫn cần nghiệm thu tích hợp thật.

**EN:** No provider account, sender domain or API key is configured. Delivery is
disabled by default. The SQLite outbox, Vietnamese/English templates, retry worker
and Resend adapter are prepared; no real email was sent or confirmed received in
this change. Resend is an available technical adapter, not a confirmed commercial
provider choice. Real email and reminder acceptance remains outstanding.

## Prepared behavior / Hành vi đã chuẩn bị

| Event / Sự kiện       | Recipient and timing / Người nhận và thời điểm                                                                                                                                                                |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `booking.confirmed`   | Student who just booked a future 1:1 review / Học viên vừa đặt lịch 1:1 trong tương lai                                                                                                                       |
| `booking.cancelled`   | Student whose future reservation was cancelled, including cancellation of its lesson / Học viên có lịch 1:1 tương lai bị hủy, kể cả khi buổi học bị hủy                                                       |
| `lesson.changed`      | Current enrolled students for a changed/cancelled main lesson; currently booked students for a changed 1:1 slot / Học viên thuộc lớp khi buổi học chính đổi/hủy; học viên đang đặt lịch khi buổi 1:1 thay đổi |
| `lesson.reminder`     | One reminder before a main lesson or the student's reserved 1:1 review; default 1 hour / Một lần nhắc trước buổi học chính hoặc lịch 1:1 đã đặt; mặc định 1 giờ                                               |
| `assignment.reminder` | Student without a submission for the current published assignment version; default 24 hours before its deadline / Học viên chưa nộp phiên bản hiện tại của bài đã công bố; mặc định trước hạn 24 giờ          |

**VI:** Mốc 24 giờ/1 giờ là mặc định kỹ thuật có thể cấu hình, chưa thay thế chính
sách nhắc lịch của khách hàng. Nếu hệ thống bắt đầu chạy trong khoảng nhắc, bài/buổi
học còn trong tương lai có thể được nhắc ngay. Không gửi nhắc cho hạn hoặc buổi đã
qua. Thông báo xác nhận/hủy/thay đổi hết hạn sau tối đa 24 giờ hoặc khi buổi bắt đầu,
tùy thời điểm nào đến trước. Lần khởi tạo đầu tiên ghi nhận trạng thái đã có, không
gửi hàng loạt xác nhận cũ. Thay đổi riêng đường dẫn Zoom không tạo email đổi lịch.
Bài tập không có hạn nộp vẫn lưu và sử dụng bình thường; không tạo email nhắc hạn.

**EN:** The 24-hour/1-hour values are configurable engineering defaults, subject to
the client's reminder policy. Starting the service inside a reminder window can
make a still-future reminder immediately due. Past deadlines/lessons are not
reminded. Confirmation/cancellation/change notices expire at the earlier of
24 hours or lesson start. First initialization snapshots existing reservations and
lessons instead of sending retrospective confirmations. A Zoom-link-only change
does not generate a schedule-change email.
Assignments without deadlines remain valid and do not generate deadline reminders.

**VI:** Ngay trước mỗi lần gửi, máy chủ kiểm tra lại tài khoản còn hoạt động, vai
trò học viên, email hiện tại, lớp còn hoạt động và tư cách thành viên, lịch/giáo viên,
đặt chỗ và phiên bản bài/nộp bài khi liên quan. Tác vụ lỗi thời bị hủy. Email chỉ
chứa thời gian, thông báo chung và liên kết vào `/learn#schedule` hoặc
`/learn#assignments`; không có liên kết Zoom, bài làm, nhận xét riêng, tệp hoặc tiêu
đề tự nhập. Email nhắc 1:1 không bỏ qua điều kiện chuẩn bị để vào buổi học.

**EN:** Immediately before each dispatch the server rechecks the active student
account, current email, active class membership, lesson/teacher, booking and
assignment/submission version as applicable. Obsolete jobs are cancelled. Messages
contain a time, a generic notice and a link to `/learn#schedule` or
`/learn#assignments`; no Zoom URL, answer, private feedback, file or free-form title
is included. A 1:1 reminder does not bypass preparation checks at join time.

## Persistence and recovery / Lưu trữ và phục hồi

**VI:** Các bản ghi riêng `emailJob` và `emailCursor` nằm trong SQLite hiện có,
không nằm trong trạng thái học tập trả về người dùng. Runtime gắn hook trước
`COMMIT` của giao dịch học vụ; thay đổi đặt lịch/nội dung và outbox cùng thành công
hoặc cùng rollback. Khởi động tạo mốc ban đầu; worker đối chiếu lại mỗi 30 giây.
Không có tiến trình máy chủ chạy thì không có bộ gửi nền hoạt động. Hàng đợi cần
được sao lưu cùng database; chưa có cơ chế tự xóa lịch sử.

**EN:** Private `emailJob` and `emailCursor` records live in the existing SQLite
database and are excluded from portal state. The runtime registers a hook before
academic transaction `COMMIT`, so a booking/content change and its outbox changes
commit or roll back together. Startup establishes the baseline; the worker
reconciles every 30 seconds. The server process must remain running for background
dispatch. Back up the queue with the database; automatic history retention is not
implemented.

| State       | Meaning / Ý nghĩa                                                                                                                    |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `scheduled` | Persisted, waiting for its due time; also used while delivery is disabled / Đã lưu, chờ đến giờ; vẫn dùng khi gửi bị tắt             |
| `pending`   | Claimed by a worker with a 60-second lease / Worker giữ tác vụ với thời hạn 60 giây                                                  |
| `failed`    | Provider error, bounded retry pending or operator investigation needed / Lỗi nhà cung cấp, chờ thử lại có giới hạn hoặc cần kiểm tra |
| `sent`      | Provider accepted the message; inbox delivery is **not** verified / Nhà cung cấp đã nhận yêu cầu; **chưa** xác minh thư vào hộp thư  |
| `cancelled` | Expired, superseded or recipient no longer eligible / Hết hạn, lỗi thời hoặc người nhận không còn đủ điều kiện                       |

**VI:** Mỗi sự kiện/người nhận có khóa chống trùng ổn định. Nội dung và địa chỉ được
đóng băng ở lần thử đầu để thử lại cùng khóa; nếu email tài khoản đổi sau đó, tác
vụ cũ bị hủy. Mỗi tác vụ tối đa ba lần thử, chờ 5 rồi 15 phút; lỗi cố định không tự
thử lại. Tự thử lại dừng trước 23 giờ từ lần đầu vì Resend giữ khóa idempotency 24
giờ. Tác vụ không rõ kết quả sau cửa sổ này cần kiểm tra ở nhà cung cấp; CLI không
reset số lần thử hay tự gửi thành thư mới. Việc giữ khóa/lease giảm trùng khi lỗi
mạng hoặc khởi động lại, không phải cam kết tuyệt đối mỗi thư chỉ đến đúng một lần.
Yêu cầu đã gửi ra ngoài không thể thu hồi nếu quyền thay đổi trong lúc đang chờ.

**EN:** A stable per-event/per-recipient key deduplicates jobs. The first attempted
payload and recipient are frozen for retries with that key; a later account email
change cancels the old job. Each job has at most three attempts, with 5- then
15-minute delays; permanent errors are not automatically retried. Automatic retry
stops before 23 hours from the first attempt because Resend retains idempotency
keys for 24 hours. An uncertain result beyond this window requires provider-side
investigation; the CLI does not reset attempts or resend as a new message. Keys
and leases reduce duplicates after outages/restarts, without an absolute
exactly-once inbox guarantee. A request already sent to the provider cannot be
recalled if permissions change in flight.

Provider references / Tài liệu nhà cung cấp:
[send API](https://resend.com/docs/api-reference/emails/send-email),
[idempotency behavior](https://resend.com/docs/dashboard/emails/idempotency-keys).

## Configuration / Cấu hình

**VI:** Chỉ cấu hình phía máy chủ, không dùng biến `VITE_`. Lưu bí mật trong môi
trường triển khai hoặc file riêng bị Git bỏ qua, ví dụ `.local/portal/email.env`.
Không gửi khóa trong chat, commit, ảnh chụp hoặc trình duyệt. API không tự đọc
`.env.example`; file đó chỉ chứa tên biến và ví dụ an toàn. Không thay đổi file cấu
hình Drive hoặc thông tin hiện có khi bổ sung email.

**EN:** Configure the server only; never use `VITE_` variables. Keep secrets in the
deployment environment or an ignored private file such as `.local/portal/email.env`.
Do not place keys in chat, source control, screenshots or browser code. The API
does not load `.env.example`; it lists safe variable names/examples. Preserve
existing Drive and server settings when adding email.

| Variable                             | Default / Mặc định      | Requirement / Yêu cầu                                                                                                                                                                            |
| ------------------------------------ | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `PORTAL_EMAIL_ENABLED`               | `false`                 | Exact `true` is required to dispatch / Chỉ `true` mới bật gửi                                                                                                                                    |
| `PORTAL_EMAIL_PROVIDER`              | `disabled`              | `disabled` or `resend`                                                                                                                                                                           |
| `PORTAL_EMAIL_API_KEY`               | Empty / Trống           | Private provider key, required when enabled / Khóa riêng, bắt buộc khi bật                                                                                                                       |
| `PORTAL_EMAIL_FROM`                  | Empty / Trống           | One bare sender email, no display-name syntax / Một email gửi, không kèm tên hiển thị                                                                                                            |
| `PORTAL_EMAIL_PORTAL_ORIGIN`         | `http://127.0.0.1:5173` | Enabled delivery requires confirmed HTTPS origin without path, credentials, query or fragment / Khi bật phải là origin HTTPS đã xác nhận, không có path, thông tin đăng nhập, query hay fragment |
| `PORTAL_EMAIL_LOCALE`                | `vi`                    | `vi` or `en`; installation-wide until account language is implemented / Dùng chung hệ thống cho đến khi có ngôn ngữ theo tài khoản                                                               |
| `PORTAL_EMAIL_TIME_ZONE`             | `Asia/Ho_Chi_Minh`      | Valid IANA time zone / Múi giờ IANA hợp lệ                                                                                                                                                       |
| `PORTAL_EMAIL_ASSIGNMENT_LEAD_HOURS` | `24`                    | Whole number 1–168 / Số nguyên 1–168                                                                                                                                                             |
| `PORTAL_EMAIL_LESSON_LEAD_HOURS`     | `1`                     | Whole number 1–168 / Số nguyên 1–168                                                                                                                                                             |

**VI:** Khởi động chỉ kiểm tra hình dạng cấu hình tại máy, chưa xác minh API key,
quyền gửi, DNS hay khả năng nhận thư. Muốn bật thật phải xác nhận nhà cung cấp và
tên miền, xác minh người gửi theo hướng dẫn nhà cung cấp, chọn origin của website
và hoàn tất thử nghiệm bằng hộp thư được chỉ định. Đặt `PORTAL_EMAIL_ENABLED=false`
và khởi động lại để dừng gửi mới; không xóa database hay lịch sử gửi.

**EN:** Startup validates local configuration shape only; it does not verify the
API key, sender authorization, DNS or delivery. Before real enablement, confirm
the provider/domain, verify the sender with that provider, select the website's
origin and complete a controlled test with designated inboxes. Set
`PORTAL_EMAIL_ENABLED=false` and restart to stop new dispatches while preserving
the database and delivery history.

## Operator commands / Lệnh vận hành

These examples are instructions, not evidence of a performed send. / Đây là lệnh
hướng dẫn, không phải bằng chứng đã gửi thư.

```powershell
# With no private env file, defaults keep delivery disabled.
node --experimental-strip-types server/email-cli.ts status
node --experimental-strip-types server/email-cli.ts reconcile

# After an operator has prepared the ignored server configuration:
node --env-file=.local/portal/email.env --experimental-strip-types server/email-cli.ts status
node --env-file=.local/portal/email.env --experimental-strip-types server/index.ts

# Expedite only an existing failed job still inside its retry limits:
node --env-file=.local/portal/email.env --experimental-strip-types server/email-cli.ts retry JOB_ID

# Explicit single batch; fails without PORTAL_EMAIL_ENABLED=true:
node --env-file=.local/portal/email.env --experimental-strip-types server/email-cli.ts dispatch
```

**VI:** `status` hiển thị số lượng, ID, loại, trạng thái, số lần thử và mã lỗi đã
lược bỏ dữ liệu riêng; không in email người nhận hay nội dung. `reconcile` cập nhật
hàng đợi nhưng không gửi. CLI dành cho người vận hành có quyền vào máy chủ, không
phải API cho học viên/giáo viên/trợ giảng. Mỗi batch xử lý tối đa 25 tác vụ; lỗi
worker chỉ ghi mã cố định `email_worker_failed`.

**EN:** `status` shows counts, job IDs/types/statuses, attempt counts and sanitized
error codes, without recipients or bodies. `reconcile` updates the queue without
sending. The CLI is for an operator with server access, not a student/teacher/TA
API. Each batch handles at most 25 jobs; worker errors log only the fixed code
`email_worker_failed`.

**Admin diagnostics / Chẩn đoán quản trị:** Authenticated administrators can read
`GET /api/v1/portal/email-status` for aggregate counts and local configuration
readiness. Other roles are rejected. It exposes no recipients, message bodies,
API keys or queue-editing action. / Quản trị viên đang đăng nhập có thể đọc endpoint
này để xem số lượng và mức sẵn sàng của cấu hình tại máy. Các vai trò khác bị từ
chối; không trả email người nhận, nội dung, khóa API hoặc thao tác sửa hàng đợi.

## Staged acceptance / Nghiệm thu từng bước

1. **Local / Tại máy:** Run
   `node --experimental-strip-types --test server/email-queue.test.ts server/email-transport.test.ts`.
   These tests inject mocked transport and isolated SQLite data; they do not send
   email. / Test dùng transport giả lập và SQLite riêng, không gửi thư.
2. **Disabled staging / Staging tắt gửi:** Use an isolated database and designated
   test accounts. Confirm baseline suppression, booking/cancellation, rescheduling,
   assignment revisions, expiry and no outbound requests while disabled. / Dùng
   database riêng để kiểm tra mốc ban đầu, đặt/hủy, đổi lịch, sửa bài, hết hạn và
   không có request gửi khi đang tắt.
3. **Explicit provider test / Thử nhà cung cấp có chủ đích:** After provider,
   sender domain and test inboxes are confirmed, enable staging only. Check VI/EN,
   timezone, safe portal links, provider acceptance and actual inbox receipt. Do
   not copy live students into a test database. / Sau khi xác nhận nhà cung cấp,
   domain và hộp thư thử, chỉ bật trên staging, kiểm tra ngôn ngữ, giờ, liên kết và
   thư thực nhận; không sao chép học viên thật làm dữ liệu thử.
4. **Recovery and scope / Phục hồi và phân quyền:** Disable accounts, remove class
   memberships, submit current work, cancel/move lessons and revoke host access
   before dispatch. Check no obsolete send; exercise provider outage, bounded
   retry, concurrent workers and restart. Verify private queue data cannot be
   read through portal state. / Thu hồi quyền, nộp bài, đổi/hủy lịch trước lần gửi;
   kiểm tra không gửi thông báo lỗi thời, lỗi provider, thử lại, worker đồng thời,
   khởi động lại và không lộ hàng đợi riêng.

**Still open / Còn mở:** provider procurement and actual delivery; account-specific
email language; sender branding/content approval; staff recipients; email address
verification and self-service password recovery; webhook-based delivery/bounce
tracking; retention and operational alerting. A mandatory reminder to book 1:1 has
not been inferred from an unspecified teaching policy. / Chưa chốt nhà cung cấp và
gửi thật, ngôn ngữ theo tài khoản, nhận diện/nội dung email, người nhận là nhân viên,
xác minh email và tự phục hồi mật khẩu, webhook thư đến/bị trả lại, lưu trữ lịch sử
và cảnh báo vận hành. Chưa tự đặt quy tắc bắt buộc nhắc đặt lịch 1:1 khi chưa có
chính sách học tập tương ứng.
