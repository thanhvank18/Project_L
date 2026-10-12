# Google Drive submission storage · Lưu tệp bài làm trên Google Drive

**Status / Trạng thái — 11 October 2026:** the administrator connection flow is
implemented: server-side Google OAuth, a folder browser, explicit storage
activation and disconnection. The Google Cloud OAuth client has not yet been
confirmed/configured for the centre. No real Google consent, upload, download or
migration has been verified. Đã có luồng quản trị viên đăng nhập Google, duyệt và
chọn thư mục, bật lưu bài nộp và ngắt kết nối. Chưa xác nhận/cấu hình OAuth client
của trung tâm; chưa kiểm chứng cấp quyền hoặc lưu/đọc tệp trên Google thật.
SQLite remains the active default until storage is explicitly activated.

**Confirmed choice / Lựa chọn đã xác nhận — 11 October 2026:** the centre will use
the My Drive of its Gmail account, with centre-user OAuth and an administrator
sign-in/folder-selection section inside the website. Trung tâm xác nhận dùng
Google Drive của Gmail trung tâm; quản trị viên đăng nhập và chọn thư mục ngay
trong website. A folder link or ID alone does not enable storage. Shared
Drive/service-account and manually supplied credentials below are alternative
deployment references, not the selected setup.

## Scope / Phạm vi

| Item / Nội dung                  | Behavior / Cách hoạt động                                                                                                                                                                                                      |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Storage selection / Chọn nơi lưu | Managed setup defaults to SQLite; an admin confirms a writable My Drive folder to enable Drive for new submission attachments. Mặc định SQLite; quản trị viên xác nhận thư mục rồi mới bật lưu các tệp bài nộp mới trên Drive. |
| Existing files / Tệp cũ          | SQLite blobs remain readable; no migration or deletion. Tệp cũ vẫn đọc từ SQLite, không tự chuyển hoặc xóa.                                                                                                                    |
| Materials / Học liệu             | Continue using SQLite. Vẫn lưu tại SQLite.                                                                                                                                                                                     |
| Academic records / Học vụ        | Text, versions, membership and file references stay in the portal database. Nội dung, phiên bản, thành viên và tham chiếu tệp vẫn do database của portal quản lý.                                                              |
| Downloads / Tải về               | Go through authenticated portal API and current role/class/owner checks. Luôn qua API kiểm tra tài khoản, vai trò, lớp và chủ sở hữu.                                                                                          |
| Folder layout / Cấu trúc thư mục | Existing configured parent, filename `<portal UUID>--<original filename>`. Không tự tạo cây lớp/học viên hoặc thư mục trung tâm.                                                                                               |
| Sharing / Chia sẻ                | No public links or automatic public permissions. Không tạo link công khai; không cần cấp quyền Drive trực tiếp cho học viên.                                                                                                   |

Each new attachment is a separate file. Submission revisions retain references
to their own attachments; attaching another file must not overwrite an earlier
revision. Mỗi tệp mới là một đối tượng riêng; các bản bài nộp trước vẫn giữ tham
chiếu của mình. The existing 8 MB/type limits and portal access rules still apply.

## Selected setup: administrator Google connection / Cách được chọn: kết nối từ trang quản trị

### One-time server setup / Thiết lập máy chủ một lần

The technical administrator prepares the Google Cloud application; the centre's
administrator then signs in to Google through the website. Google credentials
and refresh tokens are never entered into a public browser configuration.
Người phụ trách kỹ thuật chuẩn bị ứng dụng Google Cloud; sau đó quản trị viên
trung tâm tự đăng nhập Google trên website. Không yêu cầu gửi mật khẩu Gmail hoặc
khóa bí mật trong chat.

1. Enable **Google Drive API** in the centre-controlled Google Cloud project.
   Bật Google Drive API trong dự án Cloud do trung tâm quản lý.
2. Configure the OAuth consent screen for the application. During external-app
   testing, add the centre's Gmail as an allowed test user. Cấu hình màn hình
   đồng ý cấp quyền; khi ứng dụng ở chế độ thử nghiệm, thêm Gmail trung tâm vào
   danh sách người dùng thử nghiệm.
3. Create an OAuth client of type **Web application**. Register the exact local
   redirect URI `http://127.0.0.1:5173/api/v1/portal/drive/callback`. Tạo OAuth
   client dạng Web application và đăng ký đúng địa chỉ callback này.

Follow the official [web-server OAuth guide](https://developers.google.com/identity/protocols/oauth2/web-server)
and [consent-screen setup](https://developers.google.com/workspace/guides/configure-oauth-consent).
Use the canonical website origin `http://127.0.0.1:5173` for local administrator
sign-in and Google authorization. Do not interchange `localhost`, another port
or another hostname during the flow: the callback cookie and portal session
belong to that browser origin. Khi thử cục bộ, mở website bằng đúng
`http://127.0.0.1:5173`; đổi hostname/cổng sẽ làm mất liên kết giữa phiên đăng
nhập và callback. Hosting later requires an approved HTTPS origin and its exact
callback in both Google Cloud and server configuration.

Fill the following values privately in the ignored file
`.local/portal/google.env`. Dùng tệp riêng đã được Git bỏ qua; không đặt tiền tố
`VITE_` và không đưa giá trị thật vào tài liệu:

```dotenv
PORTAL_GOOGLE_CLIENT_ID=
PORTAL_GOOGLE_CLIENT_SECRET=
PORTAL_GOOGLE_REDIRECT_URI=http://127.0.0.1:5173/api/v1/portal/drive/callback
PORTAL_WEB_ORIGIN=http://127.0.0.1:5173
```

The first two values come from the Web application client. No manually obtained
refresh token or pre-entered folder ID is needed for this flow. `PORTAL_WEB_ORIGIN`
may contain an explicit comma-separated allowlist, but OAuth must still start
from the configured callback's origin. Hai giá trị đầu lấy từ OAuth client; luồng
này không cần chép refresh token hoặc điền sẵn ID thư mục.

Restart the API with `pnpm server:local`. That command loads the private
`.local/portal/speaking.env`, `.local/portal/google.env` and
`.local/portal/email.env` files when present. Ordinary `pnpm server` does not
load those files; `.env.example` is a safe template, not an automatically loaded
runtime configuration. Khởi động lại API bằng `pnpm server:local` để nạp cấu hình
riêng của AI, Google và email. This does not enable a provider whose own settings
remain disabled or absent.

### Administrator flow / Luồng thao tác quản trị

1. Sign in to the portal as an active administrator and open **Settings →
   Submission storage in Google Drive**. Đăng nhập vai trò quản trị và mở
   **Cài đặt → Lưu bài nộp trên Google Drive**. Other roles cannot manage this
   connection or browse its folders.
2. Select **Sign in with Google**, choose the centre's Gmail and review Google's
   consent screen. The server validates the single-use state, browser cookie,
   PKCE, current admin session and connection version before saving credentials.
   Chọn **Đăng nhập Google**, chọn Gmail trung tâm và cấp quyền; website không
   nhận mật khẩu Google.
3. After returning to Settings, select **Choose folder**. Browse My Drive and
   subfolders, using pagination where needed. Only writable, nontrashed My Drive
   folders are offered. The browser uses the server's real
   [Drive folder listing](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/list);
   it is not a simulated list or the Google Picker widget. Chọn **Chọn thư mục**,
   mở các thư mục con và chọn thư mục có quyền ghi. Tạo thư mục trong Google Drive
   nếu cần, rồi dùng **Tải lại thư mục**.
4. Select **Use this folder for submissions** to activate new submission-file
   uploads. Merely signing in does not enable uploads. Nhấn **Dùng thư mục này để
   lưu bài nộp** để bật; đăng nhập Google thôi chưa bật lưu trên Drive.

The managed connection uses `https://www.googleapis.com/auth/drive`, which gives
broader Drive access than the selected destination folder. Folder selection is
an application storage rule, not a Google-enforced folder-only permission.
Chức năng hiện dùng scope Drive rộng hơn một thư mục; chọn thư mục không thu hẹp
quyền OAuth tại Google. A narrower `drive.file` design would require a separate
per-file authorization/Picker flow. Review
[Google's scope definitions](https://developers.google.com/workspace/drive/api/guides/api-specific-auth)
before consent and public operation. External apps in Testing may need renewed
consent because refresh tokens can expire; see
[Google's token-expiration rules](https://developers.google.com/identity/protocols/oauth2#expiration).

### Credentials, reconnection and backup / Thông tin kết nối, phục hồi và sao lưu

When the OAuth client is configured, the server creates a private
`drive-oauth.key` beside the selected SQLite database if it does not exist.
For the live local database this is `.local/portal/drive-oauth.key`. Refresh
tokens and pending PKCE verifiers are encrypted in SQLite with this key. Back up
both the database and this matching key securely; preserving only the database
does not preserve usable credentials. Khi cấu hình OAuth, máy chủ tạo tệp khóa
cạnh database; token và thông tin PKCE được mã hóa trong SQLite. Sao lưu riêng tư
cả database và đúng tệp khóa, không đưa vào Git hoặc ảnh chụp.

Changing the selected folder affects only new submission files; existing files
keep their locations. **Reconnect Google** also requires confirmation of the
destination folder before new uploads resume. **Disconnect from website** deletes
the locally saved Google credentials and explicitly returns new uploads to local
server storage. Existing Drive bytes are not deleted, but the website cannot
download them until the same Google account is reconnected. Account switching is
blocked while earlier uploads or pending cleanup records depend on that account.
Đổi thư mục chỉ áp dụng cho tệp mới. Kết nối lại cần xác nhận thư mục để bật lưu
tệp mới; ngắt kết nối trên website xóa token đã lưu và chuyển tệp mới về máy chủ.
Tệp cũ vẫn ở Drive nhưng cần kết nối lại đúng tài khoản để đọc từ website.

Website disconnection does not revoke the application's consent in the Google
account. The account owner can remove that access separately in Google account
settings. Ngắt kết nối trên website không tự thu hồi quyền đã cấp tại Google.
Missing/invalid credentials or provider failures while Drive is selected do not
silently store the failed upload in SQLite; the operation fails and must be
retried after recovery or after the administrator explicitly disconnects.

## Alternative: manually configured storage / Phương án khác: cấu hình lưu trữ bằng biến môi trường

The following legacy setup is retained for deployments that supply provider
credentials outside the admin connection flow. Do not combine the two approaches
without planning ownership and access to earlier files. Once an administrator
has saved a managed Drive connection, its selected storage state governs new
uploads; changing `PORTAL_SUBMISSION_STORAGE` alone does not override it.
Hướng dẫn sau giữ lại cho cách cung cấp thông tin kết nối từ bên ngoài. Sau khi
có cấu hình Drive do quản trị lưu trên website, trạng thái đó quyết định nơi lưu
tệp mới; đổi biến môi trường riêng lẻ không thay thế cấu hình đã lưu.

### Prepare the account / Chuẩn bị tài khoản

Enable the Google Drive API in the centre-controlled Cloud project. Bật Google
Drive API trong Cloud project do trung tâm quản lý, theo
[Google's API setup instructions](https://developers.google.com/workspace/guides/enable-apis).
Then choose one authentication mode / Sau đó chọn một cách xác thực:

| Mode / Cách       | Requirements / Điều kiện                                                                                                                                                                                                                                                                                             |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `service-account` | An existing private folder in a Shared Drive, its Shared Drive ID, and a service account with upload/read and failed-upload cleanup rights there. Cần thư mục riêng trong Shared Drive, ID Shared Drive và quyền ghi/đọc/dọn tệp lỗi cho service account. Keep the downloaded service-account JSON private.          |
| `oauth`           | A centre-controlled human user's My Drive folder, or Shared Drive access granted to that user. Complete offline OAuth consent separately and store the client ID, client secret and refresh token privately. Dùng tài khoản người dùng của trung tâm; cấp quyền OAuth offline riêng rồi lưu thông tin trong tệp kín. |

Service accounts cannot own files or use personal storage quota; target a Shared
Drive, or use OAuth for a human user. Chỉ chia sẻ thư mục My Drive cho service
account không đáp ứng mô hình này. See
[Google's Shared Drive ownership guidance](https://developers.google.com/workspace/drive/api/guides/about-shareddrives).

This manually configured adapter does not use the managed Google sign-in,
authorization callback or folder browser described above. Its OAuth setup needs
`https://www.googleapis.com/auth/drive` for the
pre-existing folder; this is broad account-level Drive access. Use a
centre-controlled account and have the account owner review the grant. A
`drive.file` alternative needs a separate per-file authorization flow.
Adapter cấu hình thủ công cần cấp quyền riêng; scope Drive rộng không tự thu hẹp
theo ID thư mục. See
[Google Drive scope definitions](https://developers.google.com/workspace/drive/api/guides/api-specific-auth).

Obtain a refresh token through Google's offline OAuth flow; do not paste tokens
into chat, source, browser configuration or screenshots. Thực hiện cấp quyền
offline theo [Google's web-server OAuth guide](https://developers.google.com/identity/protocols/oauth2/web-server)
và lưu token riêng trên máy chủ. External OAuth apps in Testing can have short
refresh-token lifetimes; verify the app's status before operational use.
Xác minh trạng thái ứng dụng và thời hạn token theo
[Google's token-expiration rules](https://developers.google.com/identity/protocols/oauth2#expiration).

### Server configuration / Cấu hình máy chủ

Use an ignored private file such as `.local/portal/drive.env`. The API reads its
process environment; `.env.example` is documentation and is not loaded by the
server automatically. Dùng tệp riêng bị Git bỏ qua; không dùng tiền tố `VITE_`.

The following is a template for a **separate QA database and test folder**.
Replace placeholders privately before starting; do not point a test run at the
live database. Mẫu dưới đây chỉ dành cho database QA và thư mục thử riêng:

```dotenv
PORTAL_API_PORT=4004
PORTAL_WEB_ORIGIN=http://127.0.0.1:4174
PORTAL_DB_PATH=.local/drive-qa/portal.sqlite
PORTAL_SUBMISSION_STORAGE=google-drive
PORTAL_DRIVE_FOLDER_ID=REPLACE_WITH_PRIVATE_TEST_FOLDER_ID
PORTAL_DRIVE_AUTH_MODE=service-account
PORTAL_DRIVE_CREDENTIALS_FILE=.local/portal/google-drive-service-account.json
PORTAL_DRIVE_SHARED_DRIVE_ID=REPLACE_WITH_SHARED_DRIVE_ID
```

For OAuth, set `PORTAL_DRIVE_AUTH_MODE=oauth` and point the credentials path to
an `authorized_user` JSON file with these keys. Với OAuth, thay chế độ xác thực
và dùng tệp JSON riêng theo cấu trúc dưới đây; đây chỉ là placeholder:

```json
{
  "type": "authorized_user",
  "client_id": "REPLACE_PRIVATELY",
  "client_secret": "REPLACE_PRIVATELY",
  "refresh_token": "REPLACE_PRIVATELY"
}
```

Omit `PORTAL_DRIVE_SHARED_DRIVE_ID` for My Drive; keep it when OAuth targets a
Shared Drive. Service-account mode requires it and uses the standard downloaded
JSON containing `type: service_account`, `client_email` and `private_key`.
Không đổi tệp khóa service account thành JSON OAuth hoặc ngược lại.

Start the API from the repository root after creating the private env file:
Chạy API tại thư mục gốc dự án sau khi tạo tệp cấu hình riêng:

```powershell
node --env-file=.local/portal/drive.env --experimental-strip-types server/index.ts
```

In a separate terminal, point the QA frontend to that API. If port 4174 already
has a QA process, stop that process normally before restarting, or choose a
separate port and update the allowed origin to match.
Trong terminal khác, bật giao diện QA với proxy đúng API:

```powershell
$env:PORTAL_API_TARGET = 'http://127.0.0.1:4004'
pnpm dev --host 127.0.0.1 --port 4174 --strictPort
```

For a fresh QA database, create an administrator using a separate private access
path. The normal bootstrap CLI uses `.local/portal/admin-access.txt` even with a
different database; do not delete or replace that live credential file.
Với database QA mới, lệnh sau dùng đường dẫn thông tin đăng nhập riêng; nếu đã
có quản trị viên thì không đặt lại tài khoản:

```powershell
node --experimental-strip-types --input-type=module -e "import {openDatabase} from './server/db.ts'; import {bootstrapAdmin} from './server/bootstrap.ts'; const db = openDatabase('.local/drive-qa/portal.sqlite'); try { await bootstrapAdmin(db, 'qa.drive.admin@example.test', 'Drive QA Admin', '.local/drive-qa/admin-access.txt'); } finally { db.close(); }"
```

Read the generated access file locally, then create synthetic teacher/student
accounts and classes through the admin UI. Do not copy live credentials or
academic data. Đọc file riêng trên máy rồi tạo tài khoản/lớp QA từ giao diện;
không sao chép dữ liệu hay tài khoản thật. Incomplete or invalid Drive
configuration fails startup; Drive upload failures do not silently fall back
to SQLite. Startup and the API health response do not verify a Google connection;
folder permissions and token validity must pass the real upload/download checks
below. Khởi động thành công chưa chứng minh có quyền truy cập thư mục Drive.

## Recovery boundaries / Giới hạn phục hồi

The server stores private `fileStorage` mappings and `fileStoragePending` journal
records in SQLite. The latter track preallocated provider IDs, timestamps and
pending/cleanup-required states, and are excluded from portal state. Máy chủ
lưu ánh xạ và nhật ký riêng; không gửi ID nội bộ của nhà cung cấp ra giao diện.

Failed or ambiguous writes trigger best-effort cleanup. Failed or unconfirmed
cleanup leaves a journal record for operator reconciliation. A DELETE response
of 404 is not proof of deletion because it can also mean lost access. If upload
completion was unconfirmed, the journal stays even after apparently successful
cleanup, covering a write that might finish later. No automatic retention,
migration or orphan-cleanup job is provided, and no cross-provider atomicity is
claimed. Lỗi 404 khi xóa không được coi là đã dọn xong; lượt tải chưa xác nhận
kết quả vẫn giữ nhật ký dù lệnh dọn có vẻ thành công. Người vận hành cần đối
chiếu với Drive, không xóa theo phỏng đoán hoặc dọn toàn bộ thư mục. Keep earlier
submission attachments and backups until retention rules are agreed.

For the manually configured alternative, changing `PORTAL_SUBMISSION_STORAGE`
back to `sqlite` affects new uploads. Prior
Drive files remain downloadable while complete Drive configuration/credentials
are retained. Removing that configuration makes those Drive downloads fail
closed; local blobs stay readable. Chuyển lại SQLite không chuyển tệp Drive về
máy và không thay thế việc phục hồi kết nối Drive.

## Staged acceptance / Kiểm tra theo bước

No real-provider steps below have been executed. Các bước với Google thật bên
dưới chưa được thực hiện; dùng thư mục thử riêng trước khi bật cho trung tâm.

1. Run `pnpm test:server`, `pnpm test:portal` and `pnpm check`. Mocked provider
   tests check local behavior, not actual credentials or Google permissions.
   Kiểm thử giả lập không chứng minh đã kết nối Google.
2. Configure an isolated QA database, its own callback/origin and a private test
   folder. For the managed flow, sign in as the QA admin, complete real Google
   consent and confirm the folder in Settings. Verify cancelled consent,
   reconnect, folder changes, and unauthorized-role rejection. Then upload one permitted
   attachment as an enrolled student and verify its bytes/name in the intended
   private folder, plus a portal download after API restart. Thử đọc lại sau
   khởi động lại; kiểm tra học liệu và tệp cũ vẫn đọc từ SQLite.
3. Submit, review and resubmit with a different attachment; verify the previous
   revision/file and teacher feedback are unchanged. Kiểm tra lịch sử tệp không
   bị ghi đè khi nộp phiên bản mới.
4. Test owner student, another student, assigned teacher, administrator,
   assistant and removed enrollment through direct API requests. Trợ giảng và
   tài khoản không có quyền không được tải tệp bài nộp; metadata/câu trả lời riêng
   không rò rỉ qua phản hồi lỗi.
5. Revoke test-folder access or invalidate the test credentials. A failed upload
   must remain an error, retain recoverable user input and create no successful
   submission/file receipt or silent local substitute. Restore access, inspect
   pending cleanup records and retry deliberately. Test download failures too.
6. For the managed flow, disconnect in Settings: new files use SQLite, existing
   local files still work, earlier Drive files become unavailable without being
   deleted. Reconnect the same account, confirm the folder, and verify old and
   new Drive files. For the manual alternative, earlier Drive files remain
   readable after switching new uploads to SQLite only while credentials are
   retained. Verify a clear unavailable response when Drive configuration is
   removed. Record real-provider evidence separately from
   local test counts, then agree backup, retention and recovery before live use.

Google may return permission, token, quota or transient service failures; consult
[Google's Drive error guide](https://developers.google.com/workspace/drive/api/guides/handle-errors)
when reconciling the test results. Các hạn mức và quyền của tài khoản thật phải
được kiểm chứng; không báo hoàn tất tích hợp chỉ vì kiểm thử giả lập đạt.
