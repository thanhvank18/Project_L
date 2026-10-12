# Reading verification — 11 October 2026

## Follow-up: Reading and notebook refinement

This increment follows the local 0.0.1 archive. The running source and frontend
build were updated; the previously exported release ZIP was not replaced.

- Review flags now persist privately with study notes, separately for each
  student and assignment version. Older callers omitting the additive field
  preserve existing flags. Invalid question IDs, stale versions and revoked
  access are rejected; flags never enter submissions or staff state.
- Next-incomplete and next-flagged navigation wraps through the current question
  set. Review controls and numbered navigation have 44px minimum touch heights.
- Adding a passage note creates or reuses the selected range and focuses its
  editor. Highlighting the same range does not create duplicate annotations.
  H/N/T shortcuts require passage focus; tool panels focus their inputs when
  explicitly opened. Splitter handling now releases interrupted pointer capture.
- The visit stopwatch uses monotonic time, pauses when the document is hidden,
  retains fractional seconds and preserves manual pause. It remains visit-only.
- Dictionary lookup supports Enter, cancellation and stale-result rejection.
  Replacing an entered meaning or clearing an unsaved word uses inline
  confirmation; choosing a definition preserves a learner's own example/topic.
- Accepting a newer assignment version now makes the draft dirty even when
  compatible answers are unchanged, allowing that acceptance to be saved.

Validation: **94 portal tests**, **159 server tests**, and `pnpm check` passed.
The scoped Impeccable scan returned no findings. New behavior tests cover private
flag persistence/access/version boundaries, review navigation, timer visibility
and pause, and dictionary cancellation/response bounds. Existing tests continue
to cover teacher grading and assistant redaction.

Edge browser checks used the isolated QA database at ports 4174/4004. They
confirmed a review flag survives reload, navigation focuses the matching
question, new-version acknowledgement enables saving and survives reopening,
passage-note creation focuses the correct textarea, and notes/flags report
server-confirmed saves. Notebook clear confirmation could be cancelled; a
manually entered word and meaning then saved with its assignment source. The
real external dictionary request was unavailable on this connection; the
retry/manual-entry state was verified, not successful provider delivery or live
definition replacement.

The desktop and 390px mobile layouts were inspected in VI/EN. No horizontal
document overflow or console errors appeared in the final sampled page. English
content and the EN pressed state were confirmed after the language transition.
Images: `.impeccable/review/reading-improvements/desktop.png`, `mobile.png`, and
`mobile-tools.png`. Physical multi-touch, screen-reader use, PDF annotation and
AI vocabulary generation were not established by this pass. No OpenAI call was
made. The academic database, provider settings and trial environment were not
modified by the QA exercises.

## Initial structured Reading increment

This increment adds structured Reading practice to the existing application.
The interaction reference was inspected in Edge at
https://e-learning.youpass.vn/practice/reading/13495. Reference exam content was
not imported. Browser checks used an original fictional passage and accounts in
the isolated QA database, never the live academic database.

## Automated checks

- `pnpm check`: type checking, ESLint, formatting and production build.
- `pnpm test:portal`: 65 passed.
- `pnpm test:server`: 103 passed, including nine structured Reading cases.
- Impeccable detector: no findings on the sampled Reading implementation and
  stylesheets. An undefined authoring divider token found during source review
  was corrected to the existing `--mis-line` token.

## Observed browser behavior

- Single-choice, bounded multiple-choice and short responses were entered.
  Selecting the required number of multiple-choice options disabled additional
  unchecked options. Six answer slots reported complete.
- Saved answers and a private passage highlight survived a reload. A private
  annotation was saved separately from the submission.
- Reading submission confirmation saved revision 1. Its answer summary retained
  the question groups and selected labels. The teacher could read that revision,
  return a score and written feedback, and see the confirmed saved result.
- Vietnamese/English switching, timer pause, larger text, soft background and
  keyboard adjustment of the passage divider worked.
- Width checks at 1366, 390 and 1912 pixels found no horizontal document overflow.
  Reading panes split on desktop and stacked on mobile.
- The teacher authoring save was subsequently confirmed through Edge: keyboard
  Enter saved the edited QA assignment, and the server returned version 2. The
  earlier unsaved-form/native-dialog blocker is resolved for this save check.

## Four-skill extension verification

The subsequent extension passed `pnpm check`, **80 portal tests** and **117 server
tests**. The earlier Reading totals above are retained as historical evidence.
No real OpenAI request was made: the provider remains disabled without a key.

An isolated QA student completed all four numbered Listening answer slots,
saved a draft, confirmed submission revision 1, played the private test audio,
and explicitly saved vocabulary with its assignment source. The audio was a
clearly labelled five-second test tone, not a simulated teaching recording.

Writing browser checks confirmed that paste was blocked only in the restricted
answer field; private-note paste and typed essay input worked. The essay and
structured mind-map root survived save and reopening. Both mind-map modes were
reachable in the centre column. Original image material preview and preview
closing worked. The PDF container exposed its browser-dependent viewer and
download fallback; this does not certify PDF rendering in every browser.

The first desktop pass found long prompt text compressed into its minimum grid
height, overlapping attachments. Max-content prompt rows fixed the cause.
Confirmation measured a 453px passage with 453px scroll height and attachments
beginning 24px after its end, with no horizontal document overflow.

Speaking showed the question → recording → feedback sequence in VI and EN,
an honest unavailable state, disabled provider actions and an available manual
recorder. The page reported no console errors. Automated cases cover private
jobs, cancellation, current-role/version checks, strict audio/result validation,
restart recovery and late session changes. Actual microphone recording, pen
input, live transcription/TTS and model-quality evaluation remain unverified in
this pass. Four expandable criterion panels were source-reviewed, not populated
with fabricated live results.

Valid viewport captures replaced the earlier full-page images with blank tails:

- `.impeccable/review/four-skill-listening-desktop.png` — 1366 × 900 viewport.
- `.impeccable/review/four-skill-listening-mobile.png` — 390 × 844 viewport.
- `.impeccable/review/four-skill-writing-desktop.png` — 1366 × 900 viewport.
- `.impeccable/review/four-skill-writing-mobile.png` — 390 × 844 viewport.
- `.impeccable/review/four-skill-speaking-mobile.png` — 390 × 844 viewport.
- `.impeccable/review/four-skill-speaking-user-1912.png` — 1912 × 1034 viewport.

Browser scrollbars reduce image content width; these are viewport captures,
not claims that all vertically scrolling content is visible at once. A fresh
independent Impeccable reviewer returned **ship** for the scoped Operate
extension, with no material fixes. This verdict excludes real provider,
microphone and pen acceptance. The documenter preserved the incumbent design
records and reported their older layout/automatic-Zoom prose as existing drift.

## Scope boundaries

Teachers still grade submitted revisions on the existing 0–9 scale. This change
does not introduce answer keys, automatic marking or IELTS band conversion. The
timer and review flags are local to the current visit, not an enforced exam
deadline. Dictionary lookup remains dependent on its external service; this
increment does not establish successful external delivery. No production
deployment or provider acceptance is implied.
