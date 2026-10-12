# Project_L 0.0.1

Release date: 11 October 2026 (Asia/Singapore).

## Phạm vi bản phát hành / Release scope

**0.0.1** là phiên bản được đóng gói để chạy và thử nghiệm ứng dụng độc lập trên
máy chủ cục bộ. Đây là mốc bàn giao phần mềm; chưa phải xác nhận triển khai công
khai hoặc nghiệm thu toàn bộ yêu cầu của trung tâm.

**0.0.1** packages the independent application for local operation and evaluation.
It is a software release milestone, not a public deployment or full acceptance
of the centre's requirements.

Included workflows:

- Bilingual Elite reference landing, public course catalog and native login.
- Administrator, teacher, assistant and student roles, with server-enforced
  account status, membership and resource permissions.
- Class administration, student enrollment requests with administrator approval,
  syllabus, materials, attendance and notifications.
- Reading/Listening structured questions, highlights, private notes and vocabulary
  lookup/notebook; Writing prompt, essay and both mind-map modes; Speaking
  recording, private AI job history and configurable OpenAI integration.
- Versioned drafts, submission snapshots, files, teacher feedback and private
  vocabulary recall practice.
- Manual class/session Zoom settings. The first main lesson is exempt from 1:1;
  each later main lesson requires a completed, teacher-confirmed review linked
  to that lesson and its current predecessor.
- Administrator Google connection/folder-selection interface and private upload
  adapter; original starter curriculum with three units, twelve draft assignments
  and three offline synthetic Listening tracks.

The teaching pack is private and unpublished on import. Teachers must review,
adapt and publish it deliberately. It creates no learners, enrollments, schedules,
submissions, attendance, grades or completed reviews.

## AI trong đợt thử / AI trial

The user authorized enabling Speaking AI for a one-day trial on 11 October 2026.
The private API key is not part of this package. The server enforces a configured
UTC expiration when admitting new work and around provider calls. This does not
revoke the provider key or undo a request already sent before expiry.

The local window ends at **20:15:41 on 12 October 2026, Asia/Singapore (UTC+8)**
(`2026-10-12T12:15:41.633Z`), twenty-four hours after activation. The included
source does not extend this private configuration when packaged or restarted.

Real OpenAI speech-generation and transcription requests both returned HTTP 429
with `credit_balance_exhausted` / `insufficient_quota`. The provider account needs
available credits. No AI audio, transcript or assessment was produced; the failed
requests were not retried. Enabled configuration does not establish a working
provider balance or successful AI acceptance.

AI feedback is formative practice feedback, separate from teacher grades and
official IELTS assessment. Request-count caps are not a monetary spending limit.
Vocabulary AI exercise generation remains a separate unfinished requirement.

## Kiểm tra bản phát hành / Release verification

| Check                               | Result                                                                              |
| ----------------------------------- | ----------------------------------------------------------------------------------- |
| `pnpm test:portal`                  | 84 / 84 passed                                                                      |
| `pnpm test:server`                  | 154 / 154 passed                                                                    |
| `pnpm check`                        | TypeScript, ESLint, formatting and production build passed                          |
| Final server quota-error adjustment | Targeted ESLint and Speaking 18 / 18 passed; included in the 154 server tests above |
| Changed-interface detector          | Five changed UI files scanned successfully; no findings returned                    |

Expiry tests cover the fixed deadline, authorization, queue processing and
provider-stage boundaries. Quota regressions preserve a clear failure instead
of claiming generated content. Provider mocks verify application behavior;
actual OpenAI requests remain blocked by the credit result above.

Administrator browser checks covered desktop and 390 × 844 mobile layouts,
Vietnamese/English labels and a real HTTP 409 edit conflict. The form preserved
the typed name, showed the latest server value, disabled saving until explicit
rebase, and saved the retried update with server confirmation. An error-message
language issue found during this check was corrected.

The teacher's unsaved-feedback confirmation appeared. Dismissing that native
dialog and confirming input retention could not be fully verified because the
browser automation lost focus and timed out; that branch remains an explicit
manual verification item.

Speaking was observed on desktop and 390-pixel mobile layouts. The interface
displayed the fixed trial deadline and provider-credit error, retained the
recording, and showed no fabricated result. No browser console errors were
observed. Settings and Speaking copy distinguish enabled application
configuration from provider availability in both languages. Earlier 83/146 and
80/117 counts in dated audits belong to previous increments.

## Cài đặt / Setup

Use Node.js 24 or newer and pnpm 11.25.0. Extract the archive into its own folder.
It contains source, the lockfile, teaching assets and a frontend production build,
but no installed dependencies, credentials, private tokens or academic database.

```sh
pnpm install --frozen-lockfile
pnpm admin:bootstrap --email admin@gmail.com --name Administrator
pnpm server:local
```

In another terminal:

```sh
pnpm dev
```

Open `http://127.0.0.1:5173/login`. Bootstrap writes generated credentials only
to the private `.local/portal/admin-access.txt`; never include that file in a
release. On an existing installation, keep its private `.local` directory and
back it up separately. Bootstrap does not reset existing accounts.

For a local preview of the included frontend build, run `pnpm preview` while the
API is running. The frontend is then at `http://127.0.0.1:4173`; set the API's
allowed web origin and Google's callback origin to the selected frontend address
when those services are used. Vite preview is not a production web server.

Provider configuration stays server-side in ignored files. Read
[Speaking AI](SPEAKING-AI.md), [Google Drive storage](GOOGLE-DRIVE-STORAGE.md) and
[email delivery](EMAIL-DELIVERY.md) before enabling their real accounts. The
machine's private one-day AI trial is not enabled by extracting this release.

## Đóng gói lại / Repackage

```sh
pnpm check
pnpm test:portal
pnpm test:server
pnpm release:package
```

The packaging command uses only its explicit source/build allowlist and writes:

- `output/releases/project-l-0.0.1.zip`
- `output/releases/project-l-0.0.1.zip.sha256`

`RELEASE-MANIFEST.json` inside the archive lists every included source/build file
with its byte size and SHA-256 digest. ZIP entries have fixed timestamps and
stable ordering; unchanged input files with the same Node runtime produce the
same archive. Packaging uses the existing `dist` directory, so run the build
checks first. The manifest identifies the exported working tree; it is not a
Git commit or tag. No remote release is published by this command.

For a downloaded archive, compare its SHA-256 with the accompanying `.sha256`
file before extracting. On PowerShell:

```powershell
Get-FileHash ./project-l-0.0.1.zip -Algorithm SHA256
Get-Content ./project-l-0.0.1.zip.sha256
```

## Phần còn cần hoàn tất / Remaining acceptance work

- Google OAuth client configuration, actual centre-account connection and real
  upload/download acceptance have not been completed.
- Transactional email requires a configured sender/provider and real delivery
  testing. In-app notices do not establish email delivery.
- Vocabulary AI exercise formats, evaluation and the remaining client AI learning
  requirements are incomplete. Speaking transport checks alone do not establish
  pedagogical quality or scoring calibration.
- The public domain, hosting, HTTPS, operational backup/recovery, retention,
  expected concurrent load and production monitoring are not configured or
  accepted. There is no production deployment.
- Teachers must approve the authored curriculum; target learners, commercial
  content and remaining academic policies still need centre confirmation.

See the [technical specification](ELITE-TECHNICAL-SPEC.en.md),
[implementation plan](IMPLEMENTATION-PLAN.en.md) and
[11 October system audit](SYSTEM-AUDIT-2026-10-11.vi.md) for detailed scope and
earlier findings. A version number does not remove those open items.
