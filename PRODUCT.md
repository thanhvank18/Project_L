# Project_L

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

React + Vite + TypeScript (strict), Tailwind CSS, pnpm, ESLint and Prettier.
The independent local API uses TypeScript on Node.js 24 with SQLite and opaque,
revocable sessions. Data belongs to this application, separately from the trial.
Production hosting, operational requirements and a possible PostgreSQL migration
remain open; see [architecture decisions](docs/ARCHITECTURE-DECISIONS.md).

## Product Purpose

Project_L is a language-learning website with the Elite Pathway reference landing,
a public course catalog, native login at `/login` and an authenticated learning
portal at `/learn`. The user requested working, persisted functions beyond the
browser demo and selected `admin@gmail.com` for the first administrator. This
independent implementation preserves the reference trial for comparison. Client
requirements take priority. Zoom is confirmed for main classes and 1:1
consultations; transactional email and AI learning workflows remain core scope.

## Capabilities and Constraints

- Routes: Elite landing at `/`, `/vi` and `/en`; real public catalog at `/courses`;
  native login at `/login`; authenticated portal at `/learn`; the earlier fictional
  studio demonstration at `/studio-demo`. VI/EN interface selection persists.
- The landing retains the user-selected Elite Pathway logo, photography, copy,
  course tabs and contact details. Reference claims are not independently verified
  Project_L claims. Login stays on this frontend; the old
  `VITE_LEARNER_PORTAL_URL` redirect is ignored. Contact prepares a mailto draft;
  sending remains a separate action in the user's email application.
- `/login` and `/learn` inherit the Elite landing's brown-gold palette following
  the latest user confirmation, superseding the previous MIS-ILSMS blue-and-white
  treatment. The portal retains role-based navigation, tables and task-oriented
  Be Vietnam Pro typography. Login contains the credential form without the
  former descriptive role panel. The landing and public catalog keep their Elite
  display typography. Final commercial identity and comp-first/code-first
  preference are open.
- Vite development/preview proxies same-origin `/api/v1` to the independent API
  at `http://127.0.0.1:4003`. The Globussoft trial API on port 4002 is a separate
  reference and does not supply live authentication or academic data.
- First administrator setup uses `pnpm admin:bootstrap --email admin@gmail.com
--name Administrator`, generates a password privately and writes
  `.local/portal/admin-access.txt`. Repeating bootstrap does not reset an existing
  administrator. No default password, public registration or synthetic class,
  learner, vocabulary, schedule or assignment fixtures are created.
- Accounts and all academic records persist in `.local/portal/portal.sqlite`,
  under the ignored `.local` directory. Session tokens remain in sessionStorage;
  the server stores password and session hashes, verifies the current account and
  class permissions per request and revokes sessions when access changes.
  Login supports administrator, teacher, assistant and student accounts.
  Public role previews do not grant access to the live portal and are no longer
  offered there. Legacy demo modules remain as reference/regression code.
- Administrators create and update real accounts, reset passwords manually,
  manage active classes, teachers, assistants and student enrollment, manage
  content, attendance, schedules and notifications, and read submissions and results.
  The server records audit activity. Only teachers can return grades in the submission workflow.
- Teachers manage assigned-class bilingual assignments across all four skills,
  published materials, syllabus units, attendance and lessons. They review the
  exact submitted revision with a 0–9 score and written feedback, and send
  notifications to members of their assigned classes.
- Assistants have read-only access to assigned-class operations and preparation
  metadata, with the confirmed narrow exception of editing Zoom-link settings.
  That exception does not grant schedule, content, attendance or grading edits.
  Student answer text, submission files and private review content are
  removed from their returned submission records. Students see their own enrolled
  classes, published content, attendance, work, results and reservations.
- Students save drafts and submit text and/or permitted attachments for Reading,
  Writing, Listening and Speaking. Teachers can attach audio and learning files;
  students can listen, upload files and record a Speaking response using browser
  microphone permission. The recorder is limited to five minutes; the current
  file UI allows up to five PDF, image or supported audio attachments of up to
  8 MB each. Files are stored locally by default and served through authenticated,
  scoped API routes; the opt-in submission storage preparation is described below.
- Submitted work snapshots the assignment version, bilingual title/instructions,
  answer and attachments. Later draft edits preserve that snapshot. Resubmission
  creates another revision and retains earlier revisions and their feedback.
  Reviews are attached to one revision and cannot be silently overwritten or
  transferred. Private notes stay out of submissions; drafts, notes and vocabulary
  remain private to their account. Assignment editing and submission recheck
  current class access and versions; conflicts preserve typed input for recovery.
- The Writing workspace has three desktop columns: teacher prompt/materials on
  the left, the essay and both mind-map modes in the centre, and the private
  dictionary/notebook on the right. It stacks on smaller screens. Authorized
  PDF/image attachments can be explicitly previewed in the prompt area, with a
  download fallback. Preview URLs remain local authenticated blobs; highlights
  apply to prompt text, not embedded PDF/image contents. Free text and
  files remain available, with optional structured Reading/Listening questions described
  below. A reusable question bank, answer keys and per-question automatic grading
  are not implemented. Reading/Listening highlights
  and passage notes bind to exact prompt ranges, language and assignment version.
  Old-version notes remain separate when the prompt changes. The user confirmed
  both structured mind maps and freehand drawing for Writing; both save and reopen
  independently of the essay. These private workspaces never enter submissions
  or staff state.
- Staff can opt into a Writing paste/drop restriction stored with the assignment
  and submitted snapshot. It affects the browser essay field only, keeps private
  notes usable, and defaults off. It does not establish authorship, prevent all
  copying or provide server-side examination integrity.
- Administrators and assigned teachers can author an optional Reading/Listening definition
  with bilingual question groups, a starting question number, single-choice or
  matching items, fixed-count multiple choices and word-limited short answers.
  The limit is 40 numbered answer slots; a choose-two item occupies two numbers.
  Content is supplied by teaching staff, without importing YouPass passages,
  questions or answer keys. Existing assignments retain their free-response flow.
- Structured Reading and Listening use a prompt/questions layout with independent desktop
  scrolling and a stacked mobile layout, question navigation, completion progress,
  review flags, S/M/L text size and a soft background option. It reuses private
  highlights/notes and explicit dictionary lookup. The pauseable elapsed stopwatch
  belongs only to the current visit and pauses while the page is hidden, without
  overriding a learner's manual pause. The stopwatch is informational; it enforces
  no exam limit or automatic submission. Review flags now autosave with private
  study notes by account and assignment version, survive reopening, and share
  the existing conflict and permission checks. Learners can jump to the next
  incomplete or flagged question; neither flags nor notes enter submitted work.
  Listening uses teacher-attached audio with explicit playback; no playback-count
  policy or automatic Listening transcript is imposed.
- Reading/Listening drafts include the definition and answers for their assignment version.
  Partial drafts are permitted; submission requires complete, valid answer shapes,
  the required distinct choices and short-answer word limits. Completion is not a
  correctness score. Submissions snapshot their questions and responses for the
  existing teacher-only 0–9 review workflow; later edits cannot rewrite history.
  Assistants receive no Reading answer payloads. When a prompt changes, saving and
  submission pause until explicit version acknowledgement. Only compatible
  answers are carried forward; original input remains available for comparison
  and copying during that visit, without an offline recovery guarantee.
- On 12 October 2026 the user switched the selected Speaking provider from
  OpenAI to Google Gemini. The implemented UI and server adapters
  support generated question audio from saved teacher instructions, explicit
  recording selection, transcription, four expandable feedback criteria and
  private history. The browser converts supported recordings to mono 16 kHz PCM
  WAV; the server validates actual bytes and limits AI input to 3–240 seconds and
  8 MiB. The assessment receives audio, including for pronunciation; insufficient
  speech produces no invented score. Practice estimates never overwrite teacher
  reviews or claim official IELTS equivalence.
- Speaking requests persist as private versioned jobs with idempotency, progress,
  cancellation, daily request caps and restart recovery. The server rechecks
  account/class/file access and current assignment versions around remote work.
  Students alone read their AI practice history. On 11 October 2026 the user
  authorized a one-day trial. The private key passed read-only model-access
  checks, and configuration is enabled until `2026-10-12T12:15:41.633Z`
  (20:15:41 Singapore UTC+8), with runtime expiry checks. Actual speech-generation
  and transcription requests returned HTTP 429 `credit_balance_exhausted` /
  `insufficient_quota`; no AI audio, transcript or assessment was produced.
  These are historical OpenAI results. Gemini uses its own
  `PORTAL_GEMINI_API_KEY` in ignored `.local/portal/gemini.env`; the user has
  supplied the key, and a separate 12 October real-provider check returned
  validated speech audio, transcription and four-criterion feedback from new
  original synthetic test audio. Existing student recordings were not sent.
  Educational quality on real learner speech remains unverified.
  Switching preserves private history,
  records the provider for each job and keeps the existing fixed trial cutoff.
  The longer pilot budget remains open. `pnpm server:ai` explicitly loads
  `speaking.env` followed by `gemini.env`; ordinary server startup does not.
  See [Speaking AI](docs/SPEAKING-AI.md).
- Drafts and study notes/maps autosave after five seconds of editing inactivity
  when eligible, with manual save retained. The API rechecks current access and
  assignment/record versions; success requires server confirmation. Errors or
  conflicts pause autosave and preserve input for recovery. Unsaved browser input
  is not an offline backup. Students explicitly inspect/recover conflicting work
  rather than silently overwriting another device's version.
- Explicit dictionary lookup calls Free Dictionary API with only the requested
  English word/phrase, not the learner's response. It displays English definitions
  and returned source/license attribution; it is not AI translation. Manual
  meaning entry remains available when lookup fails. The integrated notebook
  saves verified assignment title/version snapshots with the student's words,
  meanings, examples and topics. Creating the same trimmed, case-insensitive
  word-and-meaning pair in one student's notebook is rejected without overwriting
  the existing entry. Source links open the current assignment only while it is
  accessible; source versions remain identified in the notebook.
- The browser reads scoped server state, refreshed after actions, on focus and
  periodically while visible. It cannot replace a database snapshot. API failures
  remain errors and never fall back to fixtures or claim a save succeeded.
- The overview derives next actions and four-skill progress from active, scoped
  classes and current published assignment versions. Students see overdue and
  near-deadline work, saved drafts, changed prompts, their main classes and their
  own reserved consultations. Open consultation slots remain discoverable through
  booking, rather than appearing as personal appointments. Progress counts actual
  submissions; scores use one latest reviewed submission per current assignment
  and are teacher-assessed task scores, not an inferred language-proficiency band.
  Staff see class preparation gaps and latest pending submissions; assistants
  receive only preparation metadata. Earlier revisions remain in submission
  history and do not inflate the current review queue. Vocabulary due and unread
  notification counts are explicitly account-wide when a class filter is active.
- Teachers/admins create real lesson and consultation records. Students use the
  overview's **Choose a review slot** entry and consultation-only schedule for
  pre-class 1:1 review. This local workflow implements the 10 October 2026
  confirmation. New/edited consultations have one learner place
  and an assigned teacher; show availability, conflicts, cancellation and Zoom
  status. Booking is allowed before preparation is complete. The server checks
  host/class scheduling conflicts, reservation capacity, duplicate bookings and
  student time conflicts. A student may reserve a consultation before submitting
  work. Joining that consultation requires a current booking and a submission for
  the current version of every currently published required assignment in its
  class. The 11 October confirmation adds a separate main-class review gate:
  the first noncancelled main lesson is exempt; each later main lesson requires
  a teacher-confirmed completed 1:1 review of its preceding main lesson before
  the student's Zoom link is returned. No separate main-class homework gate is added.
  A consultation's `reviewForLessonId` selects the upcoming main lesson in the
  same class. Its scheduled interval must fit between the previous lesson's end
  and that upcoming lesson's start. Booking alone, `no_show`, an unlinked or
  unrelated review and a stale lesson relationship do not satisfy the gate.
- Consultation outcomes are separate versioned records with `completed` or
  `no_show` status and student-visible feedback. Only the current assigned host
  teacher can confirm or correct an outcome after the consultation starts, for a
  noncancelled, active reservation and an active enrolled student. Students read
  their own outcomes; assigned-class teachers/admins can read; assistants receive
  none. Corrections check lesson, booking and outcome versions and retain audit
  and revision history. Confirmation preserves booking status and prevents later
  cancellation/rescheduling, kind/capacity changes or host reassignment; title and
  Zoom edits remain available under existing permissions. It does not assign an
  assessment score. A valid linked `completed` outcome now satisfies the confirmed
  main-class review gate; the server rechecks the current host, class access and
  lesson relationship and retains the reviewed/target lesson identity.
- Manual Zoom meeting links are supported. On 10 October 2026 the user confirmed
  entry by an administrator, assigned teacher or assigned assistant, either once
  as a reusable class default or separately for each session. A session selects
  the class default, its own link or no link; consultations start unconfigured and
  require an explicit choice. Updating the class default affects sessions using
  that source, while individual links stay independent. Link edits check
  expected versions and current role/class access, retaining input on conflicts.
  Ordinary state exposes only link status/source, never the URL; the URL is
  returned separately after server-side access and preparation checks. Staff
  manage the shared class link or each lesson's link in **Timetable**; this is
  implemented locally and does not create meetings at the provider.
  Existing-link entry needs no Zoom API credentials. Automatic meeting creation
  is optional future automation, not a core acceptance requirement. Automated
  attendance and participant identity mapping remain separate open work.
- In-app notifications are real, account-specific records with persisted read
  status. Manual notices, new submissions, returned feedback and changed lessons
  can create them, as can consultation outcomes. Transactional email preparation
  now includes a durable SQLite outbox, VI/EN templates, deduplication, current
  eligibility checks, bounded retries and a configurable Resend adapter. Dispatch
  is disabled by default, with no provider account, sender domain or key configured
  and no actual email sent. Administrators can inspect sanitized delivery status
  in Settings. Resend is a technical adapter, not a confirmed procurement choice;
  see [email delivery](docs/EMAIL-DELIVERY.md). Real delivery acceptance, account
  email verification and self-service email recovery remain open.
- Vocabulary includes a private server-persisted notebook and student self-review
  at `/learn#notebook/practice`. Students filter by topic, select word-to-meaning
  or meaning-to-word recall and practise up to 20 words per session. Typed recall
  is temporary browser input; revealing the saved answer and choosing a recall
  rating persists only the word's practice summary. `Word.practice` stores the
  review count, level, last rating, last review time and next due time. This local
  exercise uses the student's own saved meanings and examples, without AI grading.
  New words are immediately due. Fixed scheduling uses `again` for 10 minutes,
  `hard` for one day, and `good`/`easy` to advance one/two levels through intervals
  of 1, 3, 7, 14 and 30 days. The server chooses the review timestamp and verifies
  ownership, current role/status and expected version. No review is acknowledged
  before a successful response. These are local practice defaults, not the final
  client policy for topic reminders or email timing.
  Changing a word or meaning resets its practice summary; editing only its
  example or topic preserves the existing summary. Editors protect unsaved input
  on close/navigation and preserve it on version conflicts, including a review
  completed elsewhere; the student explicitly rebases before saving. Deleted
  words cannot be updated. AI-generated vocabulary formats remain unconfigured
  and required. Self-review and the configurable Speaking adapter do not complete
  vocabulary AI acceptance.
- The public catalog uses only `/api/v1/public/courses`. It returns ID, title,
  level, description and `enrollmentOpen` flag of active classes explicitly
  marked `listed`; new classes default to private with enrollment closed.
  Membership, work, contact details and meeting links are not
  public catalog data. Search and level filters use actual returned content;
  an empty installation shows an empty catalog. Public listing does not enroll
  learners or grant access. No prices or course outcomes are invented.
- On 10 October 2026 the user confirmed that students request enrollment in open
  classes and administrators must approve before membership is granted. Requests
  require an active, listed class with `enrollmentOpen`; students see their own
  pending/approved/rejected/cancelled requests, can cancel while pending, and can
  reapply after rejection or cancellation. Admin reviews record an optional note
  and version; approval and membership creation occur atomically after rechecking
  eligibility. Duplicate pending requests/memberships are prevented. Pending
  requests expose no private coursework or Zoom access. Teachers and assistants
  cannot approve; direct admin enrollment remains available. These local request
  and approval workflows are implemented in **Classes**. Admin enables active,
  publicly listed and enrollment-open flags; students choose **Open for
  enrollment**, submit and track **My requests**. Full client acceptance still
  includes the required integrations and outstanding operational decisions.
- The user requested simulated data and functional testing in an explicitly
  labeled, separate QA environment. Fixtures must never seed the real live
  database; simulated providers cannot establish AI/email acceptance.
- On 10 October 2026 the user selected the centre's Google Drive for submission
  files and requested integration preparation before providing a folder. On
  11 October, the user selected Gmail My Drive and requested administrator Google
  sign-in and folder selection. Settings now provides that OAuth connection flow,
  folder browsing/selection and explicit storage activation; provider setup and
  live Google acceptance remain outstanding. The
  server adapter is opt-in through `PORTAL_SUBMISSION_STORAGE=google-drive`;
  SQLite remains the default while no Drive folder or credentials are configured.
  Only newly uploaded submission attachments use Drive when enabled. Existing
  SQLite files remain readable and materials remain local; there is no automatic
  migration. Assignment text, submission history, access controls and file
  references remain in the portal database. Staff/student downloads still pass
  through the authenticated API, without public Drive links or browser secrets.
  Shared Drive service-account and centre-user OAuth configurations are documented
  in [the bilingual storage guide](docs/GOOGLE-DRIVE-STORAGE.md). The administrator
  connection flow is implemented, but OAuth client credentials and an actual
  selected folder are still required. No real Drive
  connection, upload or migration has been verified; mock provider tests cannot
  establish Google account permissions, quotas or operational acceptance.
- The full client core still includes all four skill workflows, Speaking AI,
  vocabulary AI practice, Zoom and email reminders. Unfinished integrations and
  real provider acceptance for AI and email remain required; this local increment does not defer them or
  assert full acceptance. Future cohort copying keeps its separate scope
  classification. No public production deployment has been done.
- Next priorities are configuring and evaluating the real Speaking provider and required AI vocabulary formats with
  evaluation, configured email delivery/retry evidence and Drive acceptance with
  the centre's actual folder/account. Private study tools, integrated notebook
  access and teacher-confirmed consultation outcomes are implemented locally;
  they do not complete integration or production acceptance. Final curriculum
  approval, question formats, automatic grading, playback rules and
  timezone/reminder policy remain open academic/operational decisions. The
  main-class review gate was confirmed on 11 October, with the first lesson exempt.
- The user authorized original teaching material on 11 October. An explicit
  admin-only import creates a private English Foundations class with three units,
  twelve draft assignments covering all four skills, three original offline
  synthetic-speech Listening recordings and a private teacher guide. The import
  is atomic and idempotent, preserves later edits and creates no learner records,
  enrollment, dates, Zoom links, submissions, grades or completed reviews. Assigned
  teachers can open the guide from Syllabus or Learning materials after selecting
  the class. This is a starter pack for teacher review, not a validated proficiency
  assessment or a replacement for final curriculum approval.
- Transport and school campus management from the reference trial are outside
  this learning portal. Do not import trial identities or school fixtures.
- Role features and final acceptance remain defined by
  [the Vietnamese specification](docs/ELITE-TECHNICAL-SPEC.vi.md),
  [the English specification](docs/ELITE-TECHNICAL-SPEC.en.md) and the bilingual
  implementation plans. The local implementation does not amend client scope.
- Open: learner age/audience, actual curriculum, instructors, schedules, pricing,
  final brand, hosting, HTTPS, remaining provider choices and credentials, backups and recovery,
  load/scaling targets, production database acceptance, browser support and SEO.

## Evidence on Hand

The 11 October 2026 system audit passes 80 portal tests, 117 server tests and
`pnpm check` (type/lint/format/build). Speaking tests use injected responses,
including cancellation, access revocation, silence, private history and restart
recovery; no real OpenAI call was made. QA browser checks cover sign-in for all
four roles, sampled VI/EN screens and desktop/mobile layouts; an unsent teacher
review losing input on close/reopen was reproduced. Five P2 defects and required
feature gaps remain; see [the system audit](docs/SYSTEM-AUDIT-2026-10-11.vi.md).
These checks do not establish full client acceptance. The earlier four-skill
interaction evidence is in [Reading verification](docs/READING-VERIFICATION.md).

On 11 October the user confirmed the centre's Gmail My Drive with user OAuth.
No target folder or OAuth connection has been supplied. The centre has no email
delivery service, domain or hosting yet. The requested one-month pilot will inform
operational costs; cohort size, concurrent use and a spending cap remain undecided.
Subsequently, the private OpenAI key and access to the three configured model IDs
were verified through a read-only model-list request. At that checkpoint AI
remained disabled pending a trial allowance. Later on 11 October, the user
authorized a one-day window ending at `2026-10-12T12:15:41.633Z`. The enabled
configuration now enforces that expiry; real speech and transcription requests
were rejected for exhausted provider credits. No AI output was generated. See
[release 0.0.1](docs/RELEASE-0.0.1.md) for that release's verification.

On 12 October the user selected Gemini and requested a private key settings
file, then supplied the key privately. Model-access checks for the configured
speech and assessment/transcription models returned HTTP 200. An isolated real
provider check generated a valid 649,314-byte WAV from original test text,
transcribed the new synthetic audio into 219 characters and returned Vietnamese
feedback passing the four-criterion schema validation. No existing learner
recordings were sent. The local API at port 4003 now uses Gemini. This proves
the checked provider path, not pedagogical accuracy or full portal acceptance;
human assessment of real learner speech remains outstanding. The one-day cutoff
and historical OpenAI quota failures remain unchanged. See
[Speaking verification](docs/SPEAKING-AI.md#real-provider-verification).

The subsequent 11 October implementation includes the confirmed main-class
review gate, original starter curriculum import and administrator Drive OAuth
interface. Final verification of this increment is recorded separately after
checks finish. The audit above remains historical evidence and does not imply
that every defect or missing core feature has been resolved.

The 10 October 2026 vocabulary self-review, learning-overview and opt-in Drive
storage increment passed `pnpm check`, 59 server tests and 53 frontend/model
tests. Browser checks covered all four overview roles, VI/EN, desktop 1366 px
and mobile 390 px, persisted reviews and explicit conflict recovery without
losing typed input. API restart preserved vocabulary edits and existing SQLite
attachment downloads. Screenshots are in `output/qa/learning-improvements/`;
the bounded UI finish review found no blocking visual issues in its inspected
packet. The native leave-confirmation dialog branch remains unverified because
it blocked browser automation. Drive tests used injected provider responses,
including failures, access changes during requests, byte integrity and revision
history; no actual Google credentials, folder access or cloud upload were
verified. These checks do not complete AI/email acceptance or production deployment.

The user selected the Elite Pathway landing reference and later requested its
brown-gold direction throughout login and the learning portal. The MIS-ILSMS
role-based workspace structure remains the functional reference; its earlier
blue treatment is superseded. Reference content/assets are recorded in REFERENCE-ASSETS.md;
credentials, numbers and testimonials there belong to the referenced website,
not independently verified Project_L claims. The old studio/catalog/portal demo
code and earlier review screenshots describe previous synthetic demonstrations.
The live routes read the independent API and start empty until authorized users
enter real accounts, enrollment, learning content and schedules. Future product
work must use supplied information rather than fabricated business claims.
