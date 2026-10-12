# Architecture decisions — live learning platform

Later dated confirmations supersede earlier open decisions. The final
11 October 2026 release entry records the one-day AI authorization and actual
provider-credit failure. Earlier implementation checkpoints, including the
previously disabled AI configuration, are historical.

## 10 October 2026: independent persisted application

The user requested working functions beyond the browser demo and selected
`admin@gmail.com` for the first administrator. The React frontend stays, with
the role-based portal structure and the Elite reference system for landing/catalog.
The latest visual confirmation extends Elite brown-gold to login and the portal;
the earlier MIS-ILSMS blue-and-white palette is superseded. The Globussoft trial and its database are preserved at
ports 3001/4002; its identities and synthetic school records are not imported.

### Runtime and persistence

The runnable local service uses a modular TypeScript API on Node.js 24, using
Node's SQLite support and a separate database at `.local/portal/portal.sqlite`.
The ignored `.local/portal` directory contains local runtime data. Attachment
bytes and metadata are persisted in this database by default. The later Drive
decision below prepares optional storage of new submission bytes; metadata and
academic records remain here. Transactions and version
checks support the current single-server workflow without installing another
database service. The earlier PostgreSQL proposal remains an option for
production and scaling; hosting, expected load, backup/recovery and operational
acceptance still need agreement.

The API listens on loopback port 4003. Vite development/preview proxies
same-origin `/api/v1` to it. The trial API is not a dependency. Production would
require its own server process, HTTPS, reverse proxy, permitted frontend origin,
SPA fallback and persistence operations; no public deployment has been done.

### Accounts and authorization

The API authenticates opaque revocable sessions and checks current account
status, role and class membership for every request. Password and session
hashes stay on the server; browser session tokens live in sessionStorage. Sign
out revokes the current server session. Locking an account, changing its role or
resetting its password invalidates that account's sessions.

`pnpm admin:bootstrap --email admin@gmail.com --name Administrator` creates the
first administrator and generates credentials into ignored
`.local/portal/admin-access.txt`; it does not overwrite an existing administrator.
No public signup, fixed/default password, seeded class or synthetic learner data
is created. Administrators create the remaining real accounts, assign roles and
enroll them in classes. Manual password reset and authenticated password change
are implemented. Email account recovery awaits an email provider/workflow.

Admin manages accounts, classes, enrollment and academic operations and reads
results. Assigned teachers author content and are the only role allowed to
return submission reviews. Assistants read assigned-class operations and
preparation metadata and may edit only the Zoom-link settings confirmed below;
answer text, submission files and private review content
are removed from their read model. Students receive their own permitted data.
The frontend's route or chosen display role never grants server permissions.

### Academic commands and recovery

Resource commands validate input, access and record versions inside database
transactions. The API returns a scoped read model after actions. The browser
cannot replace the stored database snapshot. Reads refresh after actions, on
window focus and periodically while visible. Input survives save failures and
version conflicts, allowing users to inspect updated records before merging
changes. No synthetic data substitutes for failed API requests.

Bilingual assignments, materials, syllabus, attendance, schedules and membership
are actual records. Four-skill work accepts text and authorized attachments;
Speaking can record audio in the browser. Submitted work snapshots its assignment
version, prompt, answer and attachments. Draft changes do not rewrite that
snapshot. Each resubmission creates a new revision; reviews remain attached to
the exact revision and are immutable after return. Drafts, private notes and
vocabulary belong to their user. Private notes never enter submitted answers.

Uploads/downloads use authenticated routes with class/ownership checks and type
and size validation. Files are not public URLs. The current frontend allows up
to five files, each at most 8 MB, and a five-minute Speaking recording. Audio
submission and teacher grading do not constitute the required AI assessment.

### Scheduling and meeting access

Schedules and reservations enforce class access, active teacher assignment,
capacity, duplicate booking and time-conflict rules on the server. A student can
reserve a consultation before completing preparation. On consultation join, the
server requires an active reservation and a submission matching the current
version of each currently published required assignment for that class. A
teacher changing an assignment can therefore require renewed preparation. The
main-class homework blocking policy remains open and is not inferred from this
consultation rule.

Authorized staff may manually enter an existing HTTPS Zoom meeting URL. General
portal state returns only a `hasMeeting` flag. A separate join command validates
access and applicable preparation before returning the private link. This
supports manually provisioned meetings; it does not create, synchronize or
manage Zoom meetings through a provider integration.

### Public catalog and notifications

The public catalog returns only the ID, title, level, description and
`enrollmentOpen` flag of active classes with explicit `listed: true`. New classes
default to unlisted with enrollment closed. Public
listing does not enroll a student and never publishes memberships, coursework,
private results or meeting URLs. A fresh database therefore shows an empty
catalog until an administrator chooses to publish real class information.

In-app notifications persist per recipient with independent read status. Manual
notices and relevant submission, review and lesson-change events create them.
This is separate from external email delivery. The application does not report
email or AI success without a configured provider.

### Scope and acceptance

The authenticated portal opens empty states until accounts, classes, enrollment
and learning content are created. Legacy browser demo modules and tests remain
for reference/regression, but their previews are not the live `/learn` route and
are not imported into the live database. Old demonstration screenshots and test
results cannot certify live API behavior.

Manual Zoom links, persisted audio/text work and in-app notifications are
implemented increments. Transactional email/reminders, Speaking AI
feedback/examples and vocabulary AI practice remain unconfigured and required
by the full client core. Automatic Zoom creation is optional future work under
the later confirmation below. Provider selection/credentials, deployment
and production operations remain outstanding. The bilingual client specification
and implementation plans keep their acceptance authority; this decision does
not amend or defer those requirements.

## 10 October 2026: manual Zoom links and scoped staff editing

The user confirmed that administrators, assigned teachers and assigned
assistants enter existing Zoom links, either once or for each session. This
confirmation replaces earlier questions about automatic creation versus manual
entry: automatic creation is optional future work, and pasting an existing link
does not require Zoom OAuth/app credentials. Email and AI acceptance remain
unchanged. This records the confirmed requirement, not a claim that all changes
have passed implementation checks.

The model supports a private class default and a session source of class default,
individual link or none. Sessions selecting the class source resolve its current
value; individual links are unaffected by a changed class default. Consultations
start unconfigured and explicitly select shared or individual links. Reusing a
Zoom URL does not combine lesson, reservation, preparation or attendance records.

Link mutations check the active account, current class assignment and expected
record version in a transaction, with an audit entry. Editors retain typed input
on errors and conflicts. Assistants gain this narrowly scoped mutation only;
content, schedules, attendance and reviews remain read-only, and student answers,
submission files and private feedback remain redacted. Staff cannot obtain the
stored URL through general state or public catalog responses. The authorized
join flow alone returns the effective URL after the existing access/preparation
checks. Changing or removing a link does not bypass those checks.

Zoom attendance-event ingestion and participant identity mapping remain separate
work requiring validation. A pasted link and a click do not establish attendance;
manual attendance remains available. Provider-level admission settings and the
limits of revoking a previously disclosed URL still require an operational rule.

## 10 October 2026: discoverable pre-class 1:1 booking

The user confirmed that students need a clear place to book a review consultation
before the main class. Provide a prominent overview entry and a consultation-only
schedule view. New or edited consultation slots have an assigned teacher and
capacity one; enforce availability, current enrollment, conflicts and cancellation
on the server. Booking may precede completed homework; the existing preparation
gate still applies when joining Zoom. This does not decide whether attendance in
the main class is blocked by unfinished homework or an incomplete consultation.

## 10 October 2026: enrollment requests require administrator approval

The user confirmed that students browse classes accepting enrollment and submit
requests, with administrator approval required. The public payload adds only an
`enrollmentOpen` boolean to the existing public metadata. Requests are permitted
only for active, listed classes accepting enrollment. Authenticated students see
their own requests, not other applicants or private class records.

The request lifecycle is `pending → approved | rejected | cancelled`.
Students can cancel only pending requests and reapply after rejection/cancellation.
Only administrators decide requests, recording an optional note and versioned outcome;
teachers and assistants cannot approve. The approve command rechecks the active
account, class and request, and creates the actual membership in the same
transaction. Duplicate pending requests and membership entries must be prevented.
Direct administrator enrollment remains available; a pending request is never a
membership and never unlocks coursework, submissions, reservations or Zoom.

This is a confirmed requirement; implementation and tests establish delivery.
The requested simulated-data exercise uses a separately labeled QA application
and database. It does not populate the real local database, import trial data
or claim real email/AI/Zoom-provider delivery from mock behavior.

## 10 October 2026: prepare centre Google Drive submission storage

The user selected the centre's Google Drive for submitted assignment files, then
confirmed that no folder exists yet and asked to prepare the integration first.
This change prepares an opt-in server adapter. It does not authorize or claim
completed account connection, folder provisioning, cloud upload or migration.

`PORTAL_SUBMISSION_STORAGE` defaults to `sqlite`. With `google-drive`, newly
uploaded submission attachments use the configured existing folder. Materials
remain SQLite-backed. Existing local blobs remain readable without copying or
deleting them. The portal database remains authoritative for identities, access,
assignment/submission versions and file references. The browser continues using
authenticated API downloads; it receives neither provider credentials nor public
Drive URLs. No public sharing permission is created.

The exact server-only configuration is `PORTAL_DRIVE_FOLDER_ID`,
`PORTAL_DRIVE_AUTH_MODE`, `PORTAL_DRIVE_CREDENTIALS_FILE` and, for service-account
mode, `PORTAL_DRIVE_SHARED_DRIVE_ID`. Service accounts target a Shared Drive;
My Drive uses a centre-controlled human user's OAuth offline authorization.
Google documents that service accounts have no storage quota and cannot own
files; simply sharing a personal folder to one is not this integration's setup.
See [Google's Shared Drive guidance](https://developers.google.com/workspace/drive/api/guides/about-shareddrives).

OAuth credentials are a private `authorized_user` JSON record with client ID,
client secret and refresh token. The adapter consumes existing credentials and
does not implement an authorization callback or Google Picker. Its current OAuth
setup uses the broad `https://www.googleapis.com/auth/drive` scope for access to
the configured existing folder; narrowing to `drive.file` requires a separate
per-file/folder authorization design. Do not substitute scope names without
validating access. See [Google Drive scopes](https://developers.google.com/workspace/drive/api/guides/api-specific-auth).

New cloud objects use a portal UUID prefix plus the original filename in the
configured parent. No cohort/student subfolder tree, retention automation or
migration job is implemented. Cloud requests and SQLite transactions are separate
systems; failure/recovery behavior must be validated without claiming a single
distributed transaction. Configuration errors must fail explicitly, and failed
Drive writes must never silently report local fallback success.

The [VI/EN configuration and acceptance guide](GOOGLE-DRIVE-STORAGE.md) defines
private credential handling and isolated test-folder checks. Real provider
acceptance, retention/recovery and hosting operations remain outstanding; local
mock tests alone do not establish Google permissions or successful delivery.

## 11 October 2026: private study workspaces and integrated vocabulary

The assignment interface uses prompt/material, response and dictionary/notebook
areas with a responsive layout. Its base answer contract remains generic text and
authorized files. The later Reading decision below adds optional structured
responses. Answer keys, automatic marking and the actual curriculum remain open;
the study-workspace increment does not infer them from a prompt.

Private study records are keyed by student, assignment and assignment version,
separately from drafts and submitted snapshots. Reading/Listening annotations
store language, exact text range, quote and private note. The server validates
the quote against the current prompt in that language; annotations are not
silently reapplied when a teacher changes the text. Earlier versions remain
readable to the owner while assignment access remains valid. The user confirmed
both Writing mind-map modes: structured parent/child nodes and freehand strokes.
They persist independently of the essay, with bounded payloads and validation of
tree structure and normalized drawing coordinates. Staff never receive private
study records through the portal read model.

Drafts and study records autosave after five seconds of inactivity when the
editor is eligible; manual saves remain available. Every write checks current
account/class access, published assignment version and expected record version.
The UI acknowledges only confirmed API saves, pauses on errors/conflicts and
preserves typed input for explicit recovery. This is server persistence, not an
offline queue or a guarantee that unsaved input survives closing the browser.

Dictionary lookup is an explicit learner action against Free Dictionary API.
Only the lookup word/phrase leaves the browser; answers and private notes are
not included. English definitions and returned source/license links are shown;
there is no AI translation. Lookup failure leaves manual meaning entry available.
Vocabulary saving within the assignment uses the existing private notebook,
with a server-validated assignment title/version source snapshot and optional
exact prompt context. New entries deduplicate trimmed, case-insensitive word
and meaning within the student's notebook without replacing existing data.
This supports the existing self-review schedule, not AI-generated practice.

## 11 October 2026: teacher-confirmed consultation outcomes

A consultation outcome is a separate versioned record for a booking, containing
lesson/class/student identity, `completed` or `no_show`, student-visible feedback,
confirming teacher and timestamps. Booking status remains historical
`booked`/`cancelled`; a completed review does not change capacity bookkeeping or
become a submission grade. Only the current assigned host teacher may confirm or
correct after the lesson starts, while the consultation is not cancelled and
the reservation and enrolled student remain active. Students read only their own
outcome; assigned-class teachers and administrators may read; assistants receive
no outcome records or feedback.

Confirmation/correction runs in a transaction with expected lesson, booking and
outcome versions. Each correction retains an immutable outcome revision and
audit entry. Once an outcome exists, cancellation, rescheduling, changing session
kind/capacity and host reassignment are rejected; title and Zoom edits keep their
existing permissions. Editors preserve input on conflict and require explicit
recovery. These records do not impose a homework or completed-review gate on
main classes; that policy remains open.

## 11 October 2026: durable email preparation, disabled by default

The API runtime prepares private SQLite outbox records with academic transactions
and a recurring worker for booking confirmation/cancellation, lesson changes and
eligible lesson/assignment reminders. Jobs have stable deduplication keys,
scheduled times, delivery states, bounded retries and restart recovery. The worker
rechecks current recipient, membership, reservation and assignment eligibility
before dispatch. Email contains generic notices, times and portal links, without
Zoom URLs, answers, private feedback or files. Administrator Settings exposes
sanitized status, not provider credentials, recipient addresses or message bodies.

Dispatch requires explicit server configuration and is disabled by default.
Resend is the prepared transport adapter, not a final commercial provider choice.
No provider credentials/domain are configured and no real message has been sent
in this increment. A provider-accepted status does not prove inbox receipt.
The [VI/EN email guide](EMAIL-DELIVERY.md) defines configuration, non-sending
inspection commands, retry limits and staged provider acceptance. Technical
timezone and reminder defaults remain subject to client approval. Email address
verification, self-service recovery, bounce/delivery callbacks and operational
retention are still open.

Run `pnpm test:portal`, `pnpm test:server` and `pnpm check` for local validation;
isolated fixtures and mock transports do not establish real provider delivery.
Speaking AI, AI vocabulary practice, configured email and the centre's actual
Drive folder/account remain incomplete integration acceptance. Hosting and
production operations remain undecided; no production deployment is implied.

## 11 October 2026: optional structured Reading practice

The user requested a Reading interaction similar to the inspected YouPass page.
The implementation adopts a passage/questions workspace, independent desktop
scrolling, mobile stacking, question navigation, completion indicators, review
flags, text-size controls and a soft background. It does not import that service's
passage, questions, answer key or backend behavior. Administrators and assigned
teachers author the centre's own content in the existing assignment editor.

`shared/reading.ts` defines an optional `ReadingDefinition`: a starting number,
bilingual groups/instructions and stable question/option IDs. Supported kinds are
single choice, fixed-count multiple choice and word-limited short answer. Multiple
choice consumes its required number of numbered slots; the server permits at most
40 slots per assignment. Initially Reading-only, definitions also support
Listening in the extension below and are validated in the existing versioned
assignment transaction. Legacy assignments
without a definition keep text/file submission behavior; no migration or sample
curriculum is automatically inserted.

Private drafts store `reading` and `readingAnswers` with the exact assignment
version. Eligible edits use the existing five-second autosave and manual-save
flow. The server permits partial draft answers, rejects unknown IDs/options,
duplicate/excess choices and excessive short-answer length, and requires complete
responses when submitting. A submission stores its own definition/response
snapshot alongside the existing prompt, files and revision. Earlier submission
snapshots and feedback remain unchanged. Assistants receive no structured answer
payload; existing current-account and class access checks still apply.

The UI pauses save/submit when an assignment changes. Explicit acknowledgement
can carry forward compatible question responses by ID, without truncation or
coercion. Input from before that acknowledgement remains visible for comparison
and copying during the current visit; this is not persisted draft-version history
or an offline backup. Conflicting draft versions still require explicit recovery.
Private highlights and passage notes keep their existing version/language/range
bindings, and dictionary lookup keeps its explicit-action privacy boundary.

The elapsed stopwatch and review flags are local component state. The stopwatch
can pause but does not impose a time limit, record examination duration, submit on
expiry or enforce examination integrity. Completion checks validate response
shape, not correctness. Teachers alone return the existing 0–9 grade and feedback;
there are no stored answer keys or automatic per-question marks. A reusable
question bank, additional question kinds, timed examinations and actual curriculum
remain separate decisions. Speaking/vocabulary AI, real email delivery and Drive
provider acceptance remain outstanding and are not completed by this interface.

## 11 October 2026: Listening, Writing and configured Speaking extension

The user asked to complete the referenced four-skill workspace and selected
OpenAI for Speaking. Reference sites guide interactions; their private content,
assessment logic and commercial exam materials are not imported.

### Listening and Writing

Listening reuses the optional `reading` definition/answer wire fields and the
same three question kinds, limits, partial drafts, completion checks and immutable
submitted snapshots. Retaining these field names avoids an unnecessary migration.
Definitions remain invalid for Writing and Speaking. Teacher-attached audio uses
the authenticated file flow and explicit playback in the prompt area. The UI
supports the same highlights, private notes and dictionary/notebook entry points
as Reading. It does not infer a replay limit or create a Listening transcript.

Writing presents prompt/materials, a central essay with structured/freehand mind
maps, and the dictionary/notebook in three desktop columns, stacking at smaller
widths. The teacher can enable `pasteRestricted`, default false, for the browser
essay field. Its value is validated on the server and retained in submission
snapshots, but the interaction restriction is not an authorship or anti-cheating
guarantee. Private notes remain editable with ordinary clipboard behavior.

PDF and supported image material previews are fetched explicitly through the
authenticated file API and displayed through revocable browser blob URLs.
Downloads remain available when embedded PDF rendering is unsupported. This
does not add OCR, PDF highlights or image annotations; text highlights retain
their existing exact-range and version rules.

### Speaking provider boundary

`shared/speaking.ts` defines a separate private job contract; no AI payload is
added to general portal state or a teacher's official review. The UI offers
question speech, recording selection, transcription and expandable feedback for
fluency/coherence, vocabulary, grammar and pronunciation. The server sends the
actual audio to the assessment model; transcript text alone does not establish
pronunciation. Results are formative practice estimates, not certified IELTS
results or automatic teacher grades.

The browser prepares a mono 16 kHz, 16-bit PCM WAV copy on the student's explicit
request. The server parses actual PCM bytes, verifies the saved file's ownership
and class, and bounds input to 3–240 seconds and 8 MiB. Near-digital silence stops
locally; too little transcribed speech or insufficient evidence leaves criteria
unscored. Only the selected recording, saved question and transcript are sent;
private notes, notebook entries and unrelated student records are excluded.

SQLite persists `speakingJob` records and private generated question bytes in
`speaking_audio`. Jobs bind the assignment version, prompt, source file, requested
model identifiers and rubric version. Current account, class, publication and
version permissions are checked before work and again after remote operations.
Only the initiating student can read these practice results while current
assignment access remains valid. Teacher grading of submitted revisions remains
separate and unchanged.

The runtime serializes work, applies idempotency and per-student/global daily
request caps, and provides polling plus version-checked cancellation. Provider
requests are bounded and do not retry automatically. Restarted in-flight jobs
become interrupted; late cancelled or unauthorized responses are discarded.
These safeguards limit accidental requests but are not a monetary budget or
production retention policy.

`pnpm server:ai` explicitly loads ignored `.local/portal/speaking.env`. Ordinary
server startup does not load this file, preventing accidental live-key loading
in the isolated QA database. OpenAI is disabled and no key is configured. The
adapter and UI are implemented, but no live provider transaction or feedback
quality evaluation has been verified. Setup and operational limits are in
[Speaking AI](SPEAKING-AI.md). Email, vocabulary AI and real Drive acceptance
retain their previously recorded requirements.

At this checkpoint, 77 portal tests and 117 server tests pass with isolated data
and injected AI responses. The final full check and broader desktop/mobile UI
verification remain in progress; these counts do not establish full acceptance
or production readiness.

## 11 October 2026: subsequent client confirmations and implementation

### Previous-lesson review before each later main lesson

The client confirmed the first main lesson is exempt. Every subsequent main
lesson requires the student's completed 1:1 review of the previous main lesson,
confirmed by that consultation's currently assigned host teacher, before the API
returns the main lesson's Zoom URL. A reservation, `no_show`, unrelated review or
unlinked legacy consultation is insufficient. This supersedes earlier entries
leaving the main-class review gate open. It does not add a separate main-class
homework-submission or score gate; the existing submission gate on consultation
joining remains distinct.

`reviewForLessonId` links a consultation to its upcoming main lesson in the same
class. The current noncancelled main lessons are ordered by start time. A linked
consultation must start at or after the preceding main lesson ends and finish at
or before its target main lesson starts. The server computes the previous lesson,
checks the relationship on schedule changes, booking, confirmation and joining,
and checks current membership, teacher role/status and class assignment. Outcome
confirmation uses expected booking, consultation and related-main-lesson versions;
the outcome stores both the target and reviewed lesson IDs. Schedule changes
cannot silently reuse an old outcome for different content. No admin/TA override
or TA completion permission is inferred from their Zoom-link editing rights.

### Centre Gmail My Drive and administrator setup

The centre selected Gmail My Drive. The administrator Settings interface now
provides Google OAuth sign-in, folder browsing/selection and explicit activation
of submission storage. The connection is centre-wide, with server-owned OAuth
state, token handling and versioned mutations; students do not supply a Drive
account. Existing local attachments remain readable and teaching materials remain
local. The current approach uses the existing Drive scope, rather than claiming
Google Picker or reduced per-file permissions that are not implemented.

Google Cloud OAuth client configuration, user consent, selecting the actual
centre folder and a real upload/download/revocation check remain required. No real
Google connection or file transfer has been validated by this increment. See the
storage guide for configuration; no secret values belong in this document.

### Explicit original curriculum import

The user authorized creating original learning materials. One admin-only command
imports an original three-unit English Foundations pack into a new private class:
twelve unpublished assignments, three syllabus units, three draft learning
resources and three actual offline synthetic-speech Listening WAVs. There are no
synthetic students, memberships, lessons/dates, Zoom links, submissions, grades
or completed reviews. Teacher review and deliberate publication remain necessary.

The import commits atomically and uses an internal idempotency marker so repeated
requests do not duplicate records or overwrite teacher edits. Teacher answer keys
and Listening transcripts stay in a separate server record; only admin/current
assigned teachers can open or download the guide. They never enter student state
or the browser bundle. The fixed guide follows the original import, so staff must
maintain an updated guide if they revise questions. This is authored curriculum,
not a fabricated learning history or a certified language-level assessment.

### Speaking configuration and acceptance boundary

The private Speaking environment now contains an OpenAI key. A read-only model
listing request succeeded and found all three configured model identifiers.
`PORTAL_AI_ENABLED` remains false because the one-month pilot's spending cap is
not agreed. No paid speech generation, transcription or assessment request has
been performed; model visibility does not establish those workflows or quality.
Email service, domain/hosting, pilot size and spending allowance remain open.

These implementation changes are pending the increment's final verification.
They do not complete missing Speaking answer examples, vocabulary AI formats,
email delivery or full client acceptance. Historical audits and test results
remain unchanged; final evidence must identify the implementation it checked.

## 11 October 2026: release 0.0.1 and one-day AI authorization

The user requested enabling AI for one day, another verification pass and release
0.0.1. This explicit limited authorization supersedes the earlier requirement to
keep AI disabled pending a longer pilot budget. The private runtime is configured
with `PORTAL_AI_ENABLED=true` and a fixed
`PORTAL_AI_EXPIRES_AT=2026-10-12T12:15:41.633Z` (20:15:41 on 12 October,
Asia/Singapore UTC+8). Restarting the API does not extend that deadline. Runtime
checks reject new work after expiry and check around remote work; an already
sent request may still be processed by OpenAI, and application expiry does not
revoke the provider key. No billing change or longer authorization is implied.

Real speech-generation and transcription requests both returned HTTP 429 with
provider code `credit_balance_exhausted` and type `insufficient_quota`. They were
not retried, and no AI audio, transcript or assessment was produced. The key's
model access does not establish available credits, delivered AI or pedagogical
quality. The account needs credits before a successful provider test can run.

The release packages source and a frontend build without private configuration,
tokens, academic data, QA artifacts or installed dependencies. Its manifest and
checksum identify the exported files; packaging itself does not create a Git
commit/tag or deploy publicly. Final verification is recorded in
[the 0.0.1 release notes](RELEASE-0.0.1.md). Email, Drive acceptance, vocabulary
AI, remaining learning requirements and production operations retain their
separate acceptance requirements.

## 12 October 2026: selected Gemini Speaking provider

The user requested Google Gemini and a private settings file for its API key.
`PORTAL_AI_PROVIDER` selects the adapter; Gemini uses only
`PORTAL_GEMINI_API_KEY` and its own model/voice settings. Existing OpenAI
configuration stays intact. `server:ai` and `server:local` load ignored
`.local/portal/gemini.env` last, after the older Speaking settings. Explicit
process environment retains precedence. Secrets remain server-side.

Gemini generates question WAV audio, transcribes the validated student recording
and assesses the actual audio using the existing four-criterion validation.
Persisted jobs retain provider/model identity and generated audio format.
Provider changes cannot reuse or resume a job as work by a different provider;
previous authorized history remains available. Existing permission, version,
cancellation, request-cap and expiry checks still apply.

The fixed cutoff remains `2026-10-12T12:15:41.633Z`; selecting a provider or
restarting does not extend trial authorization. The user subsequently supplied
the key in the private file. Both configured models returned HTTP 200 on access
checks; real speech generation, transcription and four-criterion assessment
then succeeded using original test text and newly generated synthetic audio in
an isolated QA check. No existing student recordings were transmitted. The
local API at port 4003 now runs with Gemini.

Earlier OpenAI quota failures remain historical evidence. Successful Google
requests establish the checked provider path, not continuing quota availability,
educational output quality or full acceptance. Teacher evaluation against actual
learner speech remains required. No billing settings or trial duration were
changed. See [Speaking verification](SPEAKING-AI.md#real-provider-verification).
