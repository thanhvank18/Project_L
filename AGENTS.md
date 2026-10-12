# Project_L

## Scope

Project_L is an independent language-learning application: React + Vite +
TypeScript strict, Tailwind CSS and pnpm, with a TypeScript API on Node.js 24 and
SQLite. Read PRODUCT.md before implementation and docs/ARCHITECTURE-DECISIONS.md
for the local persistence choice. The current routes are the Elite Pathway
reference landing, public course catalog, native `/login` and authenticated
`/learn`. Same-origin `/api/v1` proxies to the Project_L API at
`http://127.0.0.1:4003` by default. The trial at ports 3001/4002 and its database
remain separate reference resources. Do not import its accounts, fixtures,
transport or school campus management into this application.

Prioritize the client brief and subsequent confirmations; use the bilingual
role specifications in docs/ELITE-TECHNICAL-SPEC._.md and implementation plans in
docs/IMPLEMENTATION-PLAN._.md for scope and acceptance. The complete core still
includes four-skill workflows, Speaking AI, vocabulary AI practice, Zoom and
transactional email/reminders. In-app notices and manual Zoom links work;
AI and email delivery remain required. On 11 October 2026 the user authorized a
one-day Speaking AI trial. The private key passed read-only model access checks;
configuration is enabled until `2026-10-12T12:15:41.633Z` (20:15:41 Singapore
UTC+8), with runtime expiry checks. Real speech-generation and transcription
requests both returned HTTP 429 `credit_balance_exhausted` / `insufficient_quota`.
No audio, transcript or assessment was generated. Do not describe enabled
configuration as successful provider acceptance; provider credits and output
quality validation remain outstanding. Do not extend this fixed window or
change billing without user authorization. A longer pilot spending cap remains
open. Email has no configured delivery service. On 10 October 2026 the
user confirmed manual Zoom links, entered once for a class or per session by
admin, assigned teacher or assigned assistant. Automatic meeting creation is an
optional future integration, not a core acceptance requirement; pasting an
existing link requires no Zoom API credentials.
Do not imply that this local implementation or a partial integration completes
full acceptance. No production deployment has been performed. Actual curriculum,
audience, providers, hosting and operational requirements remain open.

## Live data and permissions

The application starts with empty academic data. First-admin bootstrap generates
private credentials for the user-selected `admin@gmail.com`, writing only to
ignored `.local/portal/admin-access.txt`. SQLite data and attachment bytes live in
`.local/portal/portal.sqlite`. Do not write generated passwords, access tokens or
provider secrets into source, documentation, screenshots or version control.
No public role-preview link or browser-selected role may grant live access.
Legacy demo modules are reference/regression code, not a fallback for API errors.

Authentication supports admin, teacher, assistant and student accounts. Every
request must enforce current account status, class membership and role on the
server. Admin manages actual accounts, passwords, classes and enrollment, plus
academic content and operations. Teacher edits assigned-class content,
attendance and schedules and is the only role that returns submission grades.
Assistant may edit only Zoom-link settings in assigned classes; academic content,
schedules, attendance and reviews remain read-only. Assistants receive preparation
metadata without student answer text, submission files or private feedback.
Students receive their own enrolled
classes, published content, work, attendance, reservations and results. Drafts,
private notes, vocabulary and notification read state are account-specific.

Assignments have bilingual titles/instructions, one of four skills, a deadline,
publication and preparation requirement flags. Students save server drafts and
submit text and/or authorized files; Speaking recording and audio playback are
available with appropriate browser support. Reviews attach to the exact
submitted revision with a 0–9 score and written feedback. Preserve submitted
assignment/content snapshots, earlier revisions and their feedback; private notes
never enter submissions. Recheck versions and current access when saving open
editors or submitting work. Preserve typed input on conflicts and errors.

Class records, attendance, syllabus, materials, assignments, submissions,
reviews, lessons, reservations, notifications and audit entries persist on the
server. Resource commands validate permissions, content and versions in
transactions; the browser must not submit a replacement database snapshot.
Report save success only after the API confirms it. Keep loading, retry and
empty states real, with no fabricated initial content or synthetic fallback.

Provide a visible student entry for booking a 1:1 review before the main class,
including a consultation-only schedule view. Published consultation slots have
an assigned teacher and capacity one; new/edited consultations must enforce that
capacity, current access, conflicts and cancellation rules on the server.
Consultations can be booked before work is complete. Joining one requires an
active reservation and submission of the current version of every published
required assignment in that class. Check capacity, conflicts and access on the
server. On 11 October 2026 the user confirmed a mandatory review gate: the first
noncancelled main lesson in a class is exempt; each subsequent main lesson
requires that student's completed 1:1 review of the preceding main lesson,
confirmed by the currently assigned host teacher. Link the consultation through
`reviewForLessonId` to the upcoming main lesson in the same class, scheduled no
earlier than the previous main lesson's end and no later than the target's start.
A bare booking, `no_show`, unrelated/unlinked review or outdated relationship
never unlocks a main lesson. Recheck the current sequence, versions, membership
and host on the server. This policy does not add a separate homework-submission
gate to main lessons. Manual HTTPS Zoom links are private and returned only
after authorized join checks, never in public or general state responses.
Support a reusable class default, an explicit per-session link or no link.
Consultations start unconfigured and must explicitly select the class default
or a private session link. Changing the class default affects sessions selecting
that source, never sessions with their own link. Enforce the current assigned
staff role and expected versions for each link mutation; preserve typed links
on conflicts. Meeting-link editing does not grant schedule or academic editing.
Automatic meeting creation and attendance-provider identity mapping are separate
from manual link support; attendance automation remains subject to validation.

Only active classes explicitly marked `listed` appear in the public catalog.
New classes default to private with enrollment closed. Return only public
ID/title/level/description and the `enrollmentOpen` flag; never memberships,
learner records, assignments or meeting links. Listing does not enroll students.

On 10 October 2026 the user confirmed student enrollment requests with required
admin approval. Students may request an active, listed class accepting enrollment
and see only their own requests. States are pending, approved, rejected and
cancelled; students may cancel pending requests and reapply after rejection or
cancellation. Only admin reviews requests; record outcomes, optional notes and
expected versions. Approval and actual membership creation must be atomic and recheck
current eligibility. Pending requests never grant academic data or Zoom access.
Teacher/assistant roles cannot approve enrollment. Direct admin enrollment stays
available. Avoid duplicate pending requests and duplicate memberships.

Requested simulated data and functional QA belong in an explicitly labeled,
isolated QA environment/database. Never seed the live database with fixtures or
present simulated integration results as delivered AI/email/provider behavior.

On 11 October 2026 the user authorized original teaching content. The explicit
admin-only, idempotent starter import creates a private class with three units,
twelve draft four-skill assignments, original offline synthetic Listening audio
and a separate guide for admin/assigned teachers. This is authored curriculum,
not permission to fabricate learners, enrollments, dates, submissions, grades or
completed reviews. Teachers must review and publish the material deliberately.

The centre selected its Gmail My Drive. Administrator Settings provides Google
OAuth connection, folder browsing/selection and explicit storage activation.
Google OAuth client credentials and real connection/upload verification remain
outstanding. Keep tokens and client secrets server-side; require current admin
access and version checks. Existing local files and private file access rules
remain intact. No mock provider result establishes real Drive acceptance.

## Design workflow

- Use design-taste-frontend to establish direction when a landing page, portfolio,
  or redesign brief exists. State the design read before writing UI code.
- Use impeccable for interface review and refinement. Follow its context command
  and relevant references. For product UI and dashboards, use impeccable's
  Operate guidance rather than forcing a landing-page aesthetic.
- Decide the visual direction from the confirmed brief and real assets. Do not
  invent brand colors, testimonials, customer names, pricing, or product claims.
- Record a confirmed design system in DESIGN.md when actual design begins.
  The latest selected `/login` and `/learn` direction inherits the Elite landing's
  brown-gold palette, superseding the earlier MIS-ILSMS blue-and-white treatment.
  Preserve the role-based workspace structure, compact Be Vietnam Pro task text,
  and the Elite landing/catalog's own display typography. The login role panel
  has been removed at the user's request; keep sign-in focused on credentials.
  Final commercial identity remains open.
- The comp-first/code-first preference is undecided. Follow the skill's question
  flow before saving a default. Do not treat silence as a saved preference.

## Implementation conventions

- Use TypeScript with strict checking and the `@/` alias for imports within src.
- Use Node.js 24+ and pnpm; preserve pnpm-lock.yaml. Run `pnpm check` before handoff.
- Keep pages, reusable components, styles, API integration and server domain
  responsibilities distinct. Shared wire types live in `shared/portal.ts`.
- Check installed dependencies before importing libraries. Use one component
  foundation and one icon family consistently.
- Centralize design tokens once a visual system is established.
- Use semantic HTML, accessible labels, keyboard navigation, visible focus,
  adequate contrast, responsive layouts and reduced-motion support.
- Implement loading, empty, error and success states where applicable.
- Keep credentials out of frontend code and version control. Only expose public
  client configuration. Maintain a safe .env.example for actual variables.
- Preserve existing content and behavior in refinements unless requested to
  change them. Avoid dependencies or unrelated backend features without a need.
- Keep the independent trial environment and its local files intact.

## Verification and handoff

- Run configured type check, lint and production build after substantive
  implementation. Report checks that could not run.
- Run `pnpm test:portal` for portal behavior and existing frontend regression
  coverage. Run `pnpm test:server` for live authentication, authorization,
  persistence, submissions/reviews, files, booking and preparation behavior.
  Legacy demo-model tests do not prove live server access control.
- Review changed UI at desktop and mobile sizes and exercise key interactions,
  including the relevant role boundaries and failure cases. Follow impeccable's
  bounded review workflow and detector instructions.
- Add meaningful behavior tests when justified by complexity; avoid tests that
  only duplicate implementation or assert incidental markup.
- Keep README.md accurate with setup, development and validation commands.
- Keep project settings local. Do not change global Codex settings for this project.
