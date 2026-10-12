# Language Learning Platform Implementation Plan for the Team

**Version:** 0.3 · **Date:** 11 October 2026 · **Audience:** Frontend, Backend, AI/Integrations and QA.

**Status:** Proposed implementation plan. The four specialist workstreams are confirmed; headcount, available capacity and the start date are not. Week numbers are relative planning markers, not delivery-date commitments.

**Vietnamese:** [Kế hoạch triển khai cho team](IMPLEMENTATION-PLAN.vi.md).

The delivery goal is a platform that supports the complete teaching workflow: create cohorts and assignments, let students complete all four skills, book 1:1 consultations, grant Zoom access after the required submissions, and provide AI feedback and vocabulary practice. Build working slices across the interface, data and integrations, with QA involved from the start.

**Update — 10 October 2026:** admin, assigned teachers and assigned TAs manually enter a cohort default or individual session Zoom links. Automatic meeting creation is optional future work, not a core dependency. Email and AI remain required. Students request open cohorts and need administrator approval before enrollment; requests do not auto-enroll.

### Further confirmations and implementation status — 11 October 2026

- **Main-class access (D05/Q04 confirmed):** the first main lesson is exempt. Before each subsequent main lesson, the student must complete a 1:1 review of the previous main lesson and receive confirmation from that consultation's assigned host teacher before receiving the main-class Zoom URL. Booking alone, no-show or an unrelated review is insufficient. No separate main-class homework-submission gate is added.
- **Schedule relationship:** `reviewForLessonId` points to the upcoming main lesson in the same class. The consultation starts no earlier than the preceding main lesson's end and finishes no later than the target lesson's start. The server rechecks the current noncancelled sequence, versions, access and confirmed outcome.
- **Curriculum:** the client authorized original material creation. An explicit, idempotent admin import now provides 3 original units/12 four-skill draft assignments, 3 offline synthetic-speech recordings and a private teacher guide. The new class is private, without learners, schedules, grades or submissions; teacher review and publication are required. These are authored materials, not simulated learning activity records.
- **Google Drive:** the centre selected Gmail My Drive. Administrator Google sign-in, folder browsing/selection and explicit submission-storage activation are implemented; OAuth client configuration, actual consent and real Google upload/download verification remain required. Mock responses do not establish live integration.
- **OpenAI:** the private key is present; a read-only model-list request succeeded and found the three configured models. Paid AI remains disabled because the one-month trial allowance is undecided. No actual speech generation, transcription or assessment has run. Email service, domain/hosting and pilot size are still unavailable or undecided.

These changes await this increment's final verification. They do not establish full acceptance or completion of vocabulary AI formats, Speaking sample answers or email delivery. The earlier audit remains historical evidence; refer to PRODUCT and subsequent checks for current status.

## 1 Scope baseline and current state

The scope sources are the [bilingual feature catalog and technical questions](TRAINING-PLATFORM-FEATURES.vi-en.md), [technical specification](ELITE-TECHNICAL-SPEC.en.md) and [PRODUCT.md](../PRODUCT.md). Where they differ, the latest client confirmation takes priority. Q01–Q18 refer to questions in the catalog; ACC, ASN, SPK and similar IDs refer to requirements in the specification.

| Group              | Treatment in this plan                                                                                                                                                                                          |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Core scope         | Accounts and permissions, cohorts/topics/enrollment, assignment management, four-skill workspaces, notes/dictionary lookup, booking, Zoom, email, attendance, feedback, Speaking AI and AI vocabulary practice. |
| Mind map           | Retain it in the Writing plan; settle drawing and persistence behavior under Q08. Do not replace it with a text outline or remove it from delivery without agreement.                                           |
| Attendance         | Provide manual attendance. Automate only from matched participation evidence; where this is not yet feasible, use the manual fallback already accepted by the client.                                           |
| Future or optional | Later course copying is a future capability; paste restriction is optional. Groups marked + and additional roles enter a sprint only when explicitly selected.                                                  |
| Removed            | Transport and facilities operations have no backlog, estimate or implementation dependency.                                                                                                                     |

Submission feedback, teacher review/correction of AI results and preparation progress are core capabilities. Consolidated gradebooks, periodic reports, certificates, admissions, tuition, parent access and advanced analytics are conditional extensions. The expanded catalog adds choices; it does not mean every choice has been commissioned.

### Original planning baseline — historical

The following paragraphs record the stage before the independent API. README/PRODUCT and architecture decisions describe the latest implementation. This baseline is not evidence that the current application is still a demo.

The frontend currently uses React, Vite, strict TypeScript, Tailwind and pnpm. It has a landing page, VI/EN, a demonstration catalog, filtering/search, browser-local course bookmarks and a form that prepares an email draft. Evidence is in [App.tsx](../src/app/App.tsx), [CoursesPage.tsx](../src/pages/CoursesPage.tsx), [EliteLandingPage.tsx](../src/pages/EliteLandingPage.tsx) and [package.json](../package.json).

There is no native authentication, learning API, student database, integrated Zoom/email/AI, CI or behavior test suite. The login button currently leads to a separate reference environment. `pnpm check` covers types, lint, formatting and build; it does not verify LMS behavior.

Preserve the public pages and VI/EN when adding the learning portal. Change the login destination only after the new authentication flow passes testing. Do not turn demonstration data into real courses or commercial claims.

### Additional Zoom-link acceptance

- Default/own/none choices persist through commands checking current access and expected versions; errors/conflicts preserve input.
- TAs edit only assigned-cohort links; no answer text/files/private feedback is returned, and schedule/content/attendance/grade mutations remain forbidden.
- Individual links survive default changes. Consultations choose a source explicitly rather than inheriting a shared room. Session/booking/attendance records remain separate.
- State/catalog responses contain no URL; only authorized join returns it. Test direct API requests by students, unrelated staff and accounts whose access was revoked.

### Pre-class 1:1 review booking

Frontend adds a prominent student overview entry and consultation-only schedule filter. Backend checks the assigned teacher, one student place for new/edited slots, current class access, conflicts and cancellation. QA covers booking before homework, concurrent requests for one place, cancellation and Zoom status. Submission preparation remains checked on consultation join. Under the 11 October confirmation, the first main lesson is exempt; later main-class Zoom access is blocked until the host teacher confirms completed review of the correct previous lesson. No separate main-class submission gate is added.

### Simulated data and enrollment acceptance

Use client-requested simulated data only in an explicitly labeled, isolated QA application/database, never the real live database. Test open-cohort requests, duplicates, rejection, pending cancellation, reapplication, concurrent admin decisions, teacher/TA approval denial through direct API calls, and class access only after approval. Mocked providers cannot establish real email/AI delivery.

## 2 Ownership and collaboration

| Workstream      | Primary responsibility                                                                                                                                       | Handoff to other workstreams                                                                                                      |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| Frontend        | Navigation, role-based screens, four-skill workspaces, recording, save/error states, VI/EN, device support and accessibility.                                | Interfaces using the API contract; reproducible states; usage guidance and evidence of desktop/mobile review.                     |
| Backend         | Identity, cohort-scoped permissions, data/versioning, APIs, booking transactions, access prerequisites, background jobs, file storage and audit records.     | Documented APIs and sample data, migrations, staging, access policies, job states and operational tools.                          |
| AI/Integrations | Email, dictionary, TTS/STT, Speaking assessment, improved examples, vocabulary practice and AI evaluation; separate Zoom attendance validation where needed. | Service adapters, evidence, limits/costs and failures; Backend/Frontend own manual Zoom links without waiting for Zoom API setup. |
| QA              | Acceptance criteria, test data, API/permission/concurrency tests, end-to-end flows, integration failures, devices, regression and UAT.                       | Reproduction steps, test results, defects classified by impact, and evidence of whether each checkpoint passes.                   |

Assign a backlog coordinator and an architecture owner from the existing team; do not assume additional staff. The person receiving client confirmations records each decision, its date, who confirmed it and the affected work.

Backend owns business rules and job queues; AI/Integrations owns provider communication. For example, Backend decides whether a student is eligible, and AI/Integrations sends the email from an authorized request. Neither a provider nor the frontend independently grants learning access.

## 3 Initial architecture direction

Keep the existing frontend. The current local decision is a TypeScript API on Node.js 24 with its own SQLite database; see [architecture decisions](ARCHITECTURE-DECISIONS.md). The original PostgreSQL/private-storage/durable-worker proposal remains subject to production evaluation, not a reason to replace the local implementation. Record the backend framework, infrastructure, authentication, email and AI providers, and queue mechanism as architecture decisions before adding them to the main codebase; do not install dependencies merely in anticipation.

The API handles accounts, permissions, data and transactions. Workers handle AI, reminders and long-running service calls. Module groups cover identity, courses/cohorts, assignments, scheduling, session access, attendance, notebooks, AI and notifications. One backend and a worker are sufficient for the initial plan; split out further services only when a demonstrated need justifies it.

Include these constraints from the start:

- Separate curricula from teaching cohorts; separate bookings from meeting-access eligibility and email-delivery status.
- Version published assignments; submissions, highlights, saved vocabulary and AI results reference the appropriate version.
- Enforce permissions on the server and when authorizing file access. Account administration does not automatically permit reading notebooks or changing academic grades.
- Booking transactions prevent capacity overruns; repeated requests do not create duplicate submissions, bookings or results. Database constraints must support these rules, beyond interface validation. [PostgreSQL constraints](https://www.postgresql.org/docs/current/ddl-constraints.html).
- Record events requiring processing in the same transaction as the business change, then let workers deliver them externally; workers recheck eligibility and deduplicate before execution.
- Store timestamps in UTC together with the relevant time zone; do not assume the server's time zone is the student's.
- Keep provider credentials on the server. Use correlation IDs for tracing; do not log full submissions, audio or credentials.

Agree API data types, error codes, pagination, job states, versioning and idempotency rules. Frontend can use contract-based mock data while Backend develops; mock data is not evidence of successful integration.

## 4 Roadmap and completion checkpoints

The sequence below follows dependencies. Independent work within a step runs in parallel. Interim demos do not replace acceptance of the full core scope.

| Step                           | Required outcome                                                                                                        | Completion checkpoint                                                                                                                                                                  |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0 Clarification and validation | Core scope, decisions blocking design, initial contracts, and Zoom/email/recording/AI trials.                           | Representative teaching materials are available; integration risks have evidence or a clear treatment; each foundation task allowed to start has the decisions it needs.               |
| 1 Working foundation           | Staging, CI, login, cohort-scoped permissions, file storage, workers and the portal shell.                              | Test accounts sign in with the correct roles; unauthorized API/file access is denied; staging deployment is reproducible.                                                              |
| 2 Persisted learning workflow  | Cohort creation, enrollment, versioned assignment publication, draft saving, submission and feedback review.            | A teacher and a student complete the flow using server data; reloads and repeated submissions do not lose or duplicate data.                                                           |
| 3 Zoom scheduling and email    | Booking, prerequisite checks, access grants, reminders, cancellation/rescheduling and attendance.                       | Missing submissions do not expose the 1:1 link; complete submissions grant the correct access; concurrent bookings do not conflict; changes/cancellations do not send stale reminders. |
| 4 Complete four-skill tools    | Reading, Listening, Writing with the agreed mind map, the full Speaking AI chain, notebooks and AI vocabulary practice. | Each skill works with representative sample data persisted on the staging server; AI outputs pass evaluation; failures do not lose work or report false success.                       |
| 5 Integration and reliability  | Role-based dashboards, regression, failure handling, data permissions, performance and backup/restore.                  | Core tests pass; a restore succeeds; the agreed load and limits are verified.                                                                                                          |
| 6 UAT on staging               | The client completes the entire workflow with an agreed test cohort and dataset.                                        | Core requirements are accepted; blocking defects are closed; teacher/TA guidance and a support process are ready.                                                                      |
| 7 Release and pilot            | Deploy the accepted version to production, switch login, open the pilot cohort and monitor.                             | Release is authorized; post-deployment checks, a rollback plan and incident coverage are in place.                                                                                     |

The main dependency chain is **permissions and data → assignments/submissions → 1:1 prerequisites → email/Zoom → end-to-end workflow**. AI validation starts in step 0, develops in parallel and must converge with all four skills before step 5. Steps 3 and 4 can run concurrently once the required parts of step 2 are ready.

## 5 Backlog ready to break into tickets

Each row is a work package; split it into tickets small enough for one owner when planning a sprint. A ticket must include requirement IDs, owner, dependencies, inputs, expected behavior, tests and completion evidence.

### Step 0 Clarification and trials

| ID    | Owner                                                         | Work and deliverable                                                                                                                                                     | Dependency or acceptance                                                                                                                                                 |
| ----- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| P0-01 | Backend + QA; whole-team review                               | Convert Q01–Q18 into a decision log; update remaining references to the previous platform in internal documents; create a core/optional/future matrix.                   | Zoom/email and the latest requirements are the baseline. Every open item names the blocked step and its follow-up owner.                                                 |
| P0-02 | Backend, jointly reviewed with Frontend                       | Agree the entity model, state transitions, permission matrix, architecture, environments and first API contracts.                                                        | Use Q01–Q06, Q15 and Q18; do not finalize design around undocumented assumptions.                                                                                        |
| P0-03 | Backend + Frontend + QA; AI/Integrations for email/attendance | Validate default/individual links, three editor roles, join and portal revocation; trial email. Evaluate Zoom identity separately under Q13.                             | Pasting links needs no OAuth. Record limits of already disclosed URLs; observe real email states; a link click is not attendance.                                        |
| P0-04 | AI/Integrations + Frontend                                    | Trial teacher question → spoken prompt → recording → transcript → audio-aware four-criterion feedback → two improved examples; trial all four vocabulary exercise types. | Use authorized sample audio/materials; report quality, latency, cost per attempt and failures. A transcript alone is insufficient evidence for Pronunciation assessment. |
| P0-05 | QA, with input from the whole team                            | Create anonymized/synthetic data, test mapping and a public-site baseline; define teacher-reviewed AI samples and acceptance thresholds.                                 | Include different cohorts/permissions, missing work, late submissions, invalid audio, network loss and different time zones.                                             |

Manual link entry needs no OAuth or webhooks. If attendance integration or later automatic creation is selected, verify actual account OAuth permissions and validate webhooks; demo access does not establish that configuration. [Zoom API authentication](https://developers.zoom.us/docs/api/using-zoom-apis/), [Zoom webhooks](https://developers.zoom.us/docs/api/webhooks/).

Browser recording requires microphone permission and a secure context; test HTTPS staging and target devices during P0-04. [MDN getUserMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia).

### Step 1 Foundation

| ID     | Owner                     | Work and deliverable                                                                               | Dependency or acceptance                                                                                                |
| ------ | ------------------------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| FND-01 | Backend + QA              | Set up API/DB/workers, migrations, synthetic seeds, safe sample configuration, CI and staging.     | P0-02. A clean clone can be installed, checked and deployed; CI runs frontend checks and the relevant backend tests.    |
| FND-02 | Backend + Frontend        | Login, recovery, sessions, account provisioning/disabling and the enrollment lifecycle under Q01.  | FND-01. Test expired sessions, disabled accounts and recovery failures; do not add public registration unless selected. |
| FND-03 | Backend + QA              | Enforce resource/cohort permissions and academic roles; audit permission changes.                  | FND-02, Q02. Student A cannot read B's data; teachers/TAs cannot read other cohorts through APIs or file URLs.          |
| FND-04 | Backend + AI/Integrations | Private file storage, controlled uploads, workers, deduplication, retries and job-correlated logs. | FND-01/03. Worker restarts do not lose jobs; file types/sizes follow Q06; secrets are not exposed.                      |
| FND-05 | Frontend                  | Portal navigation, user sessions, permission-aware menus, API client, VI/EN and shared states.     | P0-02 contracts; integrate FND-02/03 before acceptance. Preserve existing public routes.                                |

### Step 2 Courses and submissions

| ID      | Owner                   | Work and deliverable                                                                                                                                              | Dependency or acceptance                                                                                                                                                                                                           |
| ------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CORE-01 | Backend + Frontend + QA | Courses/cohorts/topics, staff assignments and enrollment; enrollment-open flag, student browse/request/cancel/status, admin approve/reject with an optional note. | FND-03/05, ENR-01. Require active/listed/enrollmentOpen; versioned approval/membership is atomic with no duplicate pending requests/memberships; no private class/Zoom data before approval; reapply after rejection/cancellation. |
| CORE-02 | Backend + Frontend      | Author/upload, edit, publish, replace and archive four-skill assignments; immutable versions.                                                                     | CORE-01, FND-04, Q06. Drafts are private; submissions retain the original version when an assignment changes.                                                                                                                      |
| CORE-03 | Backend + Frontend      | Attempts, autosave, saved status, submission/receipt, resubmission and version-conflict handling.                                                                 | CORE-02, Q04/06/08. Reload restores saved work; repeated submission produces one receipt; save failures never show a saved status.                                                                                                 |
| CORE-04 | Backend + Frontend      | Teacher review/grades attached to exact submissions; TA receives preparation metadata without answers/files/private feedback.                                     | CORE-03, Q02/14. Preserve history; link editing does not grant TA grading/schedule/attendance edits.                                                                                                                               |

### Step 3 Scheduling and live-teaching integrations

| ID     | Owner                                | Work and deliverable                                                                                                                                                                    | Dependency or acceptance                                                                                                                                                                                       |
| ------ | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SCH-01 | Backend + Frontend                   | Availability, fixed class schedules, booking/rescheduling/cancellation, booking deadlines and time zones.                                                                               | CORE-01, Q05. Only one of two concurrent requests for a one-person slot succeeds; prevent student and instructor timetable conflicts.                                                                          |
| INT-01 | Backend + Frontend + QA              | Store a private cohort default; sessions select default/own/none, consultations start unconfigured. Admin/assigned teacher/assigned TA edit links through dedicated versioned commands. | CORE-01 and scoped access; no meeting-creation adapter required. Default changes affect shared-source sessions only; state/catalog expose no URL; errors retain input; TA cannot edit schedules/academic data. |
| SCH-02 | Backend + Frontend                   | Link prerequisite assignment bundles, evaluate 1:1 eligibility, show preparation status and support authorized exceptions.                                                              | SCH-01, CORE-03, INT-01, Q04. Eligibility requires a valid booking and all required submissions; do not add a passing grade, submission approval or completed AI processing as prerequisites.                  |
| SCH-03 | Backend + Frontend                   | Assigned teachers confirm 1:1 completion/cancellations/no-shows; students choose to join Zoom. Additional TA completion rights require separate confirmation.                           | SCH-02, CORE-04, Q04/05. Show missing prerequisites; gate main classes only under agreed policy; do not release canceled/unauthorized session links.                                                           |
| INT-02 | AI/Integrations + Backend            | Bilingual emails: booking confirmation, access links, deadline reminders, booking reminders and lesson reminders; status and retry.                                                     | FND-04, SCH-02, Q11. Recheck eligibility at send time; cancel stale queued messages; retries avoid duplicate delivery where possible.                                                                          |
| INT-03 | AI/Integrations + Backend + Frontend | Manual attendance; where feasible, match Zoom events to students and calculate participation duration.                                                                                  | INT-01, Q13. Clicking a link is not attendance; unmatched participants remain pending; automatic updates do not overwrite manual corrections contrary to the agreed rules.                                     |

An emailed link cannot be considered revoked merely because the website button is hidden. P0-03 must establish how to disable or control actual meeting access; agree any remaining limitations under Q04/Q12 before accepting SCH-02.

### Step 4 Learning tools and AI

| ID     | Owner                                | Work and deliverable                                                                                                                                             | Dependency or acceptance                                                                                                                                                               |
| ------ | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| LRN-01 | Frontend + Backend                   | Reading/Listening: materials, audio, answers, highlights, private notes and dictionary lookup.                                                                   | CORE-02/03, Q07. Reopening the same version preserves annotations; dictionary failures show their true status; automatic marking follows only the agreed answer keys/question formats. |
| LRN-02 | Backend + Frontend + AI/Integrations | A notebook shared across the four skills, explicit saving, definitions/context/source/topic and duplicate-word rules.                                            | CORE-01/03, FND-03, Q10. Lookup does not save automatically; private notebooks remain private; connect save controls in every skill.                                                   |
| LRN-03 | Frontend + Backend                   | Three-pane Writing, word count, autosave, persistent/reopenable mind maps and small-screen layout.                                                               | CORE-03, LRN-02, Q08. Mind maps do not overwrite essays; handle network loss and two-device use under the agreed rules.                                                                |
| AI-01  | AI/Integrations + Frontend + Backend | AI-voiced questions, recording/playback/upload, transcription jobs and processing states.                                                                        | P0-04, CORE-02/03, FND-04. The spoken prompt matches the teacher's question; denied microphone access, upload failures and timeouts do not lose the attempt.                           |
| AI-02  | AI/Integrations + Backend + Frontend | Four-criterion assessment using audio where required; show Fluency and Coherence first; teacher review/correction with history.                                  | AI-01, CORE-04, Q09. Outputs follow the schema; the evaluation dataset meets agreed thresholds; missing audio or AI failures never produce invented scores.                            |
| AI-03  | AI/Integrations + Frontend           | Two improved examples targeting +1 band/Band 9, with highlighting and vocabulary saving to the notebook.                                                         | AI-02, LRN-02. Both examples belong to the correct attempt; failures/retries are clear; do not present them as guaranteed exam scores.                                                 |
| AI-04  | AI/Integrations + Backend + Frontend | All four AI vocabulary formats: multiple choice, gap fill, matching and sentence production; save review attempts and email reminders after the agreed interval. | LRN-02, INT-02, Q10/11. Review dates/topic changes correctly update reminders; validate answers and generated content.                                                                 |

Store the model, assessment-instruction and output-schema versions with AI results so changes can be compared. Samples should cover different proficiency levels, pronunciations, response lengths and audio quality. Teachers confirm academic criteria; QA checks format, repeatability within agreed tolerances, failure handling and data privacy. A successful API call does not establish acceptable Speaking assessment quality.

### Steps 5 to 7 Completion and release

| ID     | Owner                                          | Work and deliverable                                                                                    | Dependency or acceptance                                                                                                                           |
| ------ | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| RUN-01 | Backend + Frontend                             | Role-based dashboards, schedules/missing work, email/AI status, authorized retries and audit records.   | CORE-04, SCH-02/03, INT-02/03, AI-02/04. Data stays within the permitted scope; retries do not change access incorrectly or duplicate results.     |
| RUN-02 | Backend + AI/Integrations + QA                 | Recording/AI consent, retention/deletion, backups, recovery, monitoring and incident procedures.        | Q15/18. Design from step 1; finish before using real data. Test restore in a separate environment, reconciling DB/files/jobs and deletion records. |
| REL-01 | QA; whole team fixes defects                   | End-to-end and public-site regression tests, VI/EN, permissions, devices, network loss and failed jobs. | Core packages complete. No remaining defects that block workflows, expose data or lose work.                                                       |
| REL-02 | QA + Backend + AI/Integrations                 | Test load, concurrency, limits, alerts and provider failures; rehearse deployment/rollback.             | RUN-02, Q18. Meet agreed load and response times; provide migration and recovery evidence.                                                         |
| REL-03 | QA coordinates; whole team supports            | UAT with representative teachers/TAs/students, user guidance, triage and defect closure.                | REL-01/02. The client accepts the entire core; record extensions separately.                                                                       |
| REL-04 | Backend coordinates; whole team covers release | Versioned release, real data/content, login switch, post-deployment checks and pilot support.           | REL-03 and release authorization. Backups, a rollback version, on-call owners, stop thresholds and a completed checklist are available.            |

## 6 Technical decisions and when they are needed

Work need not wait for answers to all 18 questions. The team can prepare contracts, synthetic data, UI and independent trials; dependent work remains unresolved until there is an answer or an explicitly accepted assumption.

| Question | Values to record                                                                                                               | Work blocked until resolved                                                                                                                                                                                                              |
| -------- | ------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q01      | Account provisioning, login, sessions and access after course completion.                                                      | FND-02.                                                                                                                                                                                                                                  |
| Q02      | Action/resource/cohort permission matrix, multiple roles and exceptions.                                                       | FND-03; CORE-04 permissions.                                                                                                                                                                                                             |
| Q03      | Fields, identifiers, relationships and roster-import rules.                                                                    | CORE-01; import if selected.                                                                                                                                                                                                             |
| Q04      | Required assignment bundles, submission states and access revocation; main-class review gate confirmed on 11 October.          | CORE-03/SCH-02/03: retain consultation submission checks; exempt the first main lesson and require completed previous-lesson review for each later one. No bypass is granted; assignment mapping and operational exceptions remain open. |
| Q05      | Slots, time zones, limits and the rescheduling/cancellation/no-show lifecycle.                                                 | SCH-01/03.                                                                                                                                                                                                                               |
| Q06      | Assignment/file formats, limits, versions and resubmission.                                                                    | CORE-02/03; PDF upload does not imply OCR.                                                                                                                                                                                               |
| Q07      | Question formats, answer keys, replay, timers and dictionary.                                                                  | LRN-01; automatic marking requires complete rules.                                                                                                                                                                                       |
| Q08      | Mind-map mode, draft saving, conflicts and paste restriction options.                                                          | LRN-03; settle the parts affecting CORE-03 early.                                                                                                                                                                                        |
| Q09      | Recording/AI limits, outputs and expected quality.                                                                             | Finalizing AI-01/02/03 contracts, states, limits and the evaluation approach; verify quality thresholds before acceptance.                                                                                                               |
| Q10      | Vocabulary structure, duplicate meanings, review attempts and the two-week reminder trigger.                                   | LRN-02, AI-04.                                                                                                                                                                                                                           |
| Q11      | Email events, recipients, templates/languages, timing and retries.                                                             | INT-02; AI-04 review reminders.                                                                                                                                                                                                          |
| Q12      | Zoom waiting-room/passcode/sign-in policy, concurrent sessions and handling already released links after changes/cancellation. | Operational policy/SCH-02 revocation; does not block INT-01 manual entry. Default/individual links and editor roles are confirmed.                                                                                                       |
| Q13      | Participant matching, thresholds and precedence of manual corrections.                                                         | INT-03; does not block building manual attendance tools.                                                                                                                                                                                 |
| Q14      | Grading scale, grade corrections and publication timing; reports if selected.                                                  | CORE-04 basic feedback; advanced reports belong to the extension backlog.                                                                                                                                                                |
| Q15      | Consent, data permissions, retention/deletion periods and service limits.                                                      | FND-04/RUN-02 design; blocks real student data until requirements are met.                                                                                                                                                               |
| Q16      | Content languages, fallback, time zones and supported devices.                                                                 | FND-05 completion, workspaces and the test matrix.                                                                                                                                                                                       |
| Q17      | Selected extension modules, data and state transitions.                                                                        | Extension backlog only; does not hold up the entire core.                                                                                                                                                                                |
| Q18      | Load, storage, response times, data-loss tolerance and recovery.                                                               | P0-02 infrastructure selection and REL-02 acceptance.                                                                                                                                                                                    |

Frontend/Backend/AI propose solutions for open values; QA turns answers into test cases. The team decides frameworks and code organization within the agreed functional/infrastructure constraints; the client confirms behavior and usage limits.

## 7 Sprint cadence and preliminary estimates

**Scheduling scenario:** one full-time person per workstream; coordination and architecture are shared responsibilities; the client provides an academic contact for samples and feedback. This is an estimating assumption, not confirmed staffing. A sprint lasts two weeks, with approximately eight working person-days per person after meetings, coordination and interruptions. These eight days include the estimated implementation, reviews, testing and defect fixes.

| Workstream      | Initial effort range | Largest sources of variation                                                                              |
| --------------- | -------------------- | --------------------------------------------------------------------------------------------------------- |
| Frontend        | 65–85 person-days    | Mind maps, assignment formats, devices/recording and recoverable states.                                  |
| Backend         | 70–90 person-days    | Permissions, versioning, concurrency, scheduling, data and recovery requirements.                         |
| AI/Integrations | 55–75 person-days    | Audio-aware Speaking quality, Zoom capabilities, dictionary and provider testing.                         |
| QA              | 50–70 person-days    | Permission/device matrix, AI evaluation data, automation and defect-fix cycles.                           |
| Total           | 240–320 person-days  | Includes trials, implementation, testing, reviews and ordinary defect fixes; excludes extension features. |

Under these assumptions, the planning range is **18–24 weeks**. The reference schedule is 20 weeks; variability is included in the range, not added as a separate contingency commitment. Waiting for client input, purchasing/provisioning accounts, domain setup and major changes after decisions are settled must update the schedule. Do not divide total person-days by four and treat the result as a delivery date: Frontend/Backend and the AI branch have different dependencies. Re-estimate after step 0 and after the first persisted workflow in step 2.

| Reference sprint | Frontend                                                                                         | Backend                                                              | AI/Integrations                                         | QA and demo checkpoint                                                                                                            |
| ---------------- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------- | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| 1                | Baseline, UX flows, microphone/mind-map trials.                                                  | Permissions, data, architecture and contracts.                       | Zoom/email and AI-chain trials.                         | Sample data, core criteria; step 0 risk review.                                                                                   |
| 2–3              | Portal, login and cohort screens.                                                                | CI/staging, auth/RBAC, files/workers.                                | Adapters, AI contracts and evaluation samples.          | Unauthorized access, sessions and environments; demo correctly scoped login/cohort access.                                        |
| 4                | Assignment authoring, student task lists, saving/submission.                                     | Versions, submissions and feedback.                                  | TTS/STT and audio assessment on workers.                | Submission/version regression; demo a persisted workflow.                                                                         |
| 5                | Scheduling/booking, 1:1 completion confirmation and main-class joining; begin Reading/Listening. | Booking, 1:1 eligibility, completion states and notification events. | Zoom/email/attendance; continue AI.                     | Concurrency, cancellation/rescheduling and missing prerequisites; demo link grants and main-class access under the agreed policy. |
| 6                | Complete Reading/Listening, notebooks and Writing.                                               | Notebooks, autosave/conflicts and Writing support.                   | Speaking feedback and improved examples.                | Lookup/private saving, sample assignments and network loss.                                                                       |
| 7                | Complete Writing/mind maps and Speaking.                                                         | AI results, correction permissions and history.                      | Speaking evaluation dataset and AI vocabulary practice. | Four skills, invalid audio and different devices.                                                                                 |
| 8                | Complete Speaking examples, vocabulary review and dashboards.                                    | Review reminders, operations and retention/recovery.                 | Vocabulary quality, retries and limits.                 | Full-core demo using real services on staging; mocked responses do not replace integration.                                       |
| 9                | Regression/accessibility fixes.                                                                  | Performance, concurrency defects and deployment.                     | Service failures and AI quality/latency.                | E2E, load and restore; prepare UAT.                                                                                               |
| 10               | UAT and release support.                                                                         | Migrations, data and release/rollback.                               | Monitor Zoom/email/AI.                                  | UAT, pilot cohort and post-release checks.                                                                                        |

If staffing assumptions, inputs, trial findings or scope change, re-estimate; the forecast may exceed 18–24 weeks. Do not remove AI or mind maps to preserve the original range. Additional staff shorten only work that can run in parallel, and handoff costs must be included.

## 8 First five working days

| Day | Work the team should complete                                                                                         | Verifiable output                                                                                    |
| --- | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| 1   | Assign workstream owners; review scope together; separate core from choices; gather Q01/02/04/06/09/12/15/18 answers. | Owned P0 backlog, blocking-question list, current-state baseline and requested sample-material list. |
| 2   | Backend/Frontend agree sample data and APIs; AI prepares trial accounts/audio; QA writes the first acceptance cases.  | Draft ERD, permission matrix, cohort/submission contracts and synthetic dataset.                     |
| 3   | Trial Zoom/email alongside recording and AI; Frontend trials workspace interactions; QA records failures/limits.      | Actual trial evidence or specific blockers; no request to put secrets in documents.                  |
| 4   | Select backend/worker/file-storage direction and AI strategy; adjust states/APIs from trial findings.                 | Architecture decisions, initial measurements, updated test cases and risks.                          |
| 5   | Demo findings; break down foundation tickets; agree next week's sequence and validation continuing in week 2.         | Ready backlog for each workstream, decisions not yet safe to finalize and updated estimates.         |

The first five days do not require all of step 0 to be complete. Where service accounts or academic samples are unavailable, continue independent work using synthetic data; leave the relevant trials blocked rather than marking them passed.

## 9 Definition of done and handoff

A feature package is complete when its code is reviewed, it runs on staging with server-persisted data through the API contract, it includes loading/empty/error/success states and VI/EN, and appropriate tests pass. Synthetic or anonymized data may be used for testing; mocked responses do not replace evidence of service integration. UI changes follow design-taste-frontend when design direction is needed and impeccable for dashboard/workspace review; record confirmed design decisions in DESIGN.md. Review changed screens on desktop/mobile and with keyboard input.

Keep `pnpm check` as a handoff requirement. When implementing the backend and learning flows, add meaningful tests for resource permissions, booking transactions, versioning/repeated submissions, background jobs and core E2E flows. Add test commands to CI only after those commands actually exist. Passing TypeScript and build checks does not establish successful integration.

### Mapping requirements to work

Work-package IDs and requirement IDs are separate namespaces. QA links each test case to both; acceptance of NFRs with proposed numerical targets must use the values that have been agreed.

| Specification requirement IDs | Responsible work packages                                                              |
| ----------------------------- | -------------------------------------------------------------------------------------- |
| WEB-01, LOC-01                | P0-05, FND-05, REL-01, REL-04.                                                         |
| ACC-01, ACC-02                | FND-02/03, RUN-02, REL-01.                                                             |
| CRS-01                        | CORE-01.                                                                               |
| ASN-01, ASN-02                | CORE-02/03/04.                                                                         |
| BKG-01–04, CLS-01/02          | SCH-01/02/03, INT-01/02, CORE-04.                                                      |
| ATT-01, ATT-02                | INT-03; automation depends on feasibility; manual attendance is the accepted fallback. |
| NTF-01, NTF-02                | INT-02, AI-04, RUN-01.                                                                 |
| RDL-01, RDL-02                | LRN-01/02.                                                                             |
| WRT-01, WRT-03                | LRN-03; settle the mind-map format under Q08.                                          |
| SPK-01–04                     | P0-04, AI-01/02/03, CORE-04.                                                           |
| VOC-01–03                     | LRN-02, AI-04, INT-02.                                                                 |
| OPS-01                        | CORE-04, RUN-01.                                                                       |
| NFR-01–08                     | FND-03/04/05, CORE-03, P0-04/05, RUN-02, REL-01/02.                                    |
| ASN-03, WRT-02                | Future/optional backlog in section 10; not conditions for completing the core.         |

### Required test scenarios

Required scenarios before UAT:

1. An administrator creates the cohort, enrolls students and assigns staff; a teacher creates topics/publishes assignments within the assigned cohort. Enrolled students can see them; outsiders are denied through UI/API/files.
2. Test both booking before submission and completing all submissions before booking. Until all prerequisites are met, the 1:1 link is absent from API/email; when eligible, access is granted once without waiting for AI processing.
3. Concurrent bookings, rescheduling/cancellation and repeated delivery events do not exceed slot capacity, send stale emails or grant incorrect access; verify handling of links already sent.
4. Reading/Listening save highlights, notes and answers; Writing saves essays and mind maps; vocabulary from all four skills is saved under the correct topic.
5. Speaking reads the teacher's exact question, records and transcribes the answer, returns all four criteria and both improved examples; teacher corrections retain history.
6. Vocabulary practice supports all four formats, records reviews and reminds at the correct interval; completed reviews or schedule changes invalidate obsolete reminders.
7. Clicking a link does not automatically mark attendance; unverified participation has a clear state; manual attendance corrections are retained under the agreed rules.
8. Network loss, worker restarts, AI/email/Zoom failures and page reloads do not cause false success, loss of acknowledged work or duplicate jobs.
9. Switching VI/EN preserves drafts; dates, time zones and daylight saving, where relevant to the target market, display and trigger reminders correctly.
10. Deletion/retention and DB/file recovery follow Q15/18; restoring does not automatically replay completed emails or jobs.
11. An assigned teacher confirms 1:1 completion; TA completion permission requires a separate decision; students see the correct preparation status and join the correct main-class Zoom session. The first main lesson is exempt; later lessons without valid completed review must be denied even through direct join API calls; canceled/no-show sessions and corrections retain appropriate history.

Before release, provide teacher/TA guidance, operational configuration, API/migration versions, test reports, accepted limitations and incident procedures. Data exposure, lost work, incorrect session access or blocked core workflows prevent release; remaining minor defects have agreed owners and resolution dates.

## 10 Extensions and change management

Once explicitly selected, each extension becomes an epic with its own data, permissions and acceptance criteria: admissions; question banks/tests; reports/certificates; analytics; tuition; parent access; shared files; discussions/announcements; surveys/support/incidents. Do not include these groups in the core schedule by default.

Future course copying must copy structure/assignments as drafts and require date review; do not copy students, submissions, attendance or old meeting links. Implement paste restriction only when explicitly selected, with necessary exceptions.

For a requirement change, record the change, related Q or requirement IDs, impact on data/API/UI/tests, effort and affected milestones. Scope changes need confirmation before they become commitments; the team continues independent work. Track progress through features with acceptance evidence, not the percentage of screens built.
