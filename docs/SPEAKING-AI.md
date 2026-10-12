# Speaking AI — Google Gemini and OpenAI

On 12 October 2026, the user selected Google Gemini for Speaking. The provider
adapter supports generated question audio, audio transcription and assessment
of the actual recording through the existing private work queue. The ignored
`.local/portal/gemini.env` selects Gemini and has a separate key field. The older
OpenAI file is preserved; its key is never sent to Google. The user has entered
the Gemini key privately. Real model-access, speech, transcription and structured
assessment requests succeeded on 12 October; see the verification evidence below.
The local API on port 4003 is running with Gemini. Successful synthetic-audio
checks do not establish educational accuracy on real learner speech.

The earlier OpenAI trial remains historical evidence: its private key passed a
read-only model-access check, but actual speech generation and transcription
both returned HTTP 429 `credit_balance_exhausted` / `insufficient_quota`.
No AI audio, transcript or assessment was produced. The requests were not retried.

Changing providers does not extend the one-day trial authorized on 11 October.
The fixed cutoff remains `PORTAL_AI_EXPIRES_AT=2026-10-12T12:15:41.633Z`:
**20:15:41 on 12 October 2026, Asia/Singapore (UTC+8)**. The trial began at
20:15:41 on 11 October. A longer pilot budget is still open. This change does
not add funds, change billing or establish a monetary spending cap. Automated
tests inject provider responses and do not represent delivered AI output.

## Enable a private test environment

1. Create a Gemini API key for the intended Google API project with access to
   the configured audio models. Review that project's quota and billing controls.
   Google Drive OAuth credentials are separate and cannot replace this API key.
2. Put the key in `PORTAL_GEMINI_API_KEY` in the ignored
   `.local/portal/gemini.env`, with `PORTAL_AI_PROVIDER=gemini`. Keep the key out
   of chat, screenshots, source files, logs and `VITE_` variables.
3. New installations should begin with `PORTAL_AI_ENABLED=false`. This machine's
   private Gemini file retains `true` for the already authorized trial and now
   has the user-supplied key. Enable only when ready for a real
   staging request within the authorized trial window. Keep the current
   `PORTAL_AI_EXPIRES_AT` cutoff unchanged; an expired trial needs a new explicit
   authorization before extension. Enabling a flag does not establish model
   access, available quota or output quality.
4. Start the API with
   `pnpm server:local` (all private integration files), `pnpm server:ai`, or
   `node --env-file-if-exists=.local/portal/speaking.env --env-file-if-exists=.local/portal/gemini.env --experimental-strip-types server/index.ts`.
   `gemini.env` loads last so it can override shared settings in `speaking.env`.
   Explicit process environment takes precedence over these files. Restart after
   changing configuration. The ordinary server does not automatically load them.
5. In a dedicated test database, use an authorized student account and an original
   teacher-authored Speaking assignment. Listen to the AI-generated question,
   record a response, and explicitly request transcription and feedback. Check
   all four criteria against a human review before enabling actual learner use.

Use separate environment files and credentials for QA and live data. Do not
silently load the live key into the QA process. No production deployment, model
quality evaluation, operational acceptance or official IELTS scoring calibration
is implied by local unit tests.

| Shared setting                | Default / behavior                               |
| ----------------------------- | ------------------------------------------------ |
| `PORTAL_AI_PROVIDER`          | `openai` for compatibility; set `gemini` locally |
| `PORTAL_AI_ENABLED`           | `false`                                          |
| `PORTAL_AI_EXPIRES_AT`        | unset; UTC ISO cutoff when supplied              |
| `PORTAL_AI_DAILY_JOBS`        | 20 per student per rolling 24 hours              |
| `PORTAL_AI_DAILY_GLOBAL_JOBS` | 100 total per rolling 24 hours                   |

| Gemini setting                   | Default                       |
| -------------------------------- | ----------------------------- |
| `PORTAL_GEMINI_API_KEY`          | empty; no OpenAI key fallback |
| `PORTAL_GEMINI_SPEECH_MODEL`     | `gemini-3.8-flash-tts`        |
| `PORTAL_GEMINI_TRANSCRIBE_MODEL` | `gemini-3.8-flash`            |
| `PORTAL_GEMINI_ASSESSMENT_MODEL` | `gemini-3.8-flash`            |
| `PORTAL_GEMINI_VOICE`            | `Kore`                        |

The retained OpenAI adapter uses `PORTAL_AI_API_KEY`,
`PORTAL_AI_SPEECH_MODEL=gpt-4o-mini-tts`,
`PORTAL_AI_TRANSCRIBE_MODEL=gpt-transcribe`,
`PORTAL_AI_ASSESSMENT_MODEL=gpt-audio-1.5` and `PORTAL_AI_VOICE=coral` only when
`PORTAL_AI_PROVIDER=openai`. Existing OpenAI settings do not configure Gemini.

Job counts limit requests, not monetary spend. One assessment may make one
transcription request and one audio assessment request. One question makes one
speech request. The runtime processes one job at a time. Each provider request
has a 120-second timeout and no automatic retry. Configure actual provider
spending controls separately. Model access and pricing depend on the API project.

The server checks the expiry when admitting a job and around provider work,
including before subsequent stages and persistence. After the cutoff, new AI
work is blocked without waiting for a process restart. A request already sent
to the selected provider before the cutoff may still be processed or billed;
application expiry cannot revoke the API key or guarantee cancellation of a
remote request. Revoke the temporary key in the provider account when finished.
Ordinary recording, submission and already accessible private history remain
separate from new AI processing.

## Real provider verification

On 12 October 2026, the configured Google API project returned HTTP 200 for both
model-access checks (`gemini-3.8-flash-tts` and `gemini-3.8-flash`). A subsequent
isolated provider check completed at `2026-10-12T01:49:12.838Z`:

- Speech generation returned 649,314 bytes of validated `audio/wav`.
- Transcription returned 219 characters from the newly generated audio.
- Audio assessment returned Vietnamese feedback that passed the server's
  structured validation for all four criteria, with advisory status retained.

The input was original test text and new synthetic speech, not existing student
recordings. Sanitized evidence is stored locally in
`.local/portal-qa/gemini-real/result.json`; credentials and test artifacts remain
outside version control. These were real Google requests, separate from injected
responses in automated regression tests. They verify the provider path at that
time, not future quota availability, complete portal acceptance or calibrated
IELTS scoring. Teacher review against real learner recordings remains required.
The existing trial cutoff was not extended.

## Data and access

- Students explicitly request AI. A question request sends only the saved
  teacher instruction text for the exact assignment version and selected
  language. It does not extract a question from an uploaded image or PDF.
- An assessment sends the student's selected saved audio, teacher question and
  transcript to the selected provider. It does not send the student's name, email, private
  notes, notebook, mind map or other assignments.
- AI accepts validated mono 16 kHz, 16-bit PCM WAV from 3 to 240 seconds, maximum
  8 MiB. The server parses the actual RIFF/PCM data and rechecks ownership, class
  access and metadata; MIME or browser duration alone is insufficient.
  The browser checks container duration before decoding compressed files, then
  converts the complete clip without truncation. Unknown duration is rejected
  after a bounded metadata read; selecting another supported file is the recovery.
- Near-digital silence stops locally. Fewer than 20 transcribed words produces
  `needs_review` without a score. Otherwise the assessment model receives the
  actual audio, including for pronunciation. Each criterion may remain unscored
  when the recording cannot support it.
- The four criteria are fluency/coherence, lexical resource, grammatical
  range/accuracy and pronunciation. The overall practice estimate is computed
  from all four valid scores, rounded to the nearest half point. It remains null
  when any score is unavailable. This formative feedback never writes or changes
  a teacher's official submission review.
- Results, transcripts, question audio and history are private to the initiating
  student. Teachers and admins retain their separate submitted-work workflow;
  this increment does not share AI practice results with staff. Assistants have
  no access to recordings, transcripts or feedback through these endpoints.
- Every read, create, cancel and audio request rechecks the current active
  student account, membership and published Speaking assignment. The worker
  repeats checks after remote operations and before persistence. A changed
  assignment version or account version stops work. Previous completed versions
  remain readable while the current assignment and class remain accessible.

SQLite stores jobs under the dedicated `speakingJob` record kind and generated
question audio in `speaking_audio`. They are excluded from general portal state.
The submission file service supplies audio bytes from SQLite or configured
Google Drive, without bypassing its current authorization or integrity checks.
History shows the latest 100 jobs for an assignment; older records are retained.
There is no automatic retention deletion or production retention policy yet.

## Durable state and recovery

Jobs move from `queued` to `synthesizing`, or `transcribing` then `assessing`.
Terminal states are `completed`, `needs_review`, `failed` and `cancelled`.
Question/audio and assessment completion are committed with their snapshots.
History retains assignment version, prompt, file reference, provider, requested
model identifiers, rubric version and timestamps. Generated question audio keeps
its format: Gemini WAV or OpenAI MP3. Switching providers preserves earlier
history and does not relabel it as work by the new provider. Model aliases are recorded as
configured identifiers, not a claim of immutable provider model weights.

Idempotency identifiers and reuse of equivalent active/completed requests avoid
duplicate spending. One active request is allowed per student. Cancellation is
version checked; late provider results are discarded. Cancelling cannot recover
cost already incurred by a provider. A stopped/restarted process marks in-flight
work as interrupted and does not automatically transmit it again. Queued work
can proceed only with matching provider/configuration and current authorization. An
explicit new request is required after a failure.

Provider response bodies, secrets and learner content are never logged. Only
fixed error codes reach the client; provider output is untrusted, bounded and
validated before rendering. Raw model text cannot execute tools or change
academic data.

## API

All endpoints require the portal bearer session and same-origin protections.

| Method | Route                                     | Result                                      |
| ------ | ----------------------------------------- | ------------------------------------------- |
| GET    | `/api/v1/portal/speaking/assignments/:id` | Sanitized configuration and own job history |
| POST   | `/api/v1/portal/speaking/jobs`            | Persisted queued job (202), or reused job   |
| GET    | `/api/v1/portal/speaking/jobs/:id`        | Own job progress/result                     |
| POST   | `/api/v1/portal/speaking/jobs/:id/cancel` | Version-checked cancellation                |
| GET    | `/api/v1/portal/speaking/jobs/:id/audio`  | Private completed question WAV or MP3       |

Create takes `assignmentId`, `assignmentVersion`, `kind` (`question` or
`assessment`), `locale` (`en` or `vi`), `requestId` and, for assessment, `fileId`.
Cancel takes `expectedVersion`. Client audio uses the authenticated route to
obtain a temporary local blob URL, never a public provider URL.

## Sources checked during implementation

- [Gemini models](https://ai.google.dev/gemini-api/docs/models)
- [Gemini speech generation](https://ai.google.dev/gemini-api/docs/generate-content/speech-generation)
- [Gemini audio understanding](https://ai.google.dev/gemini-api/docs/generate-content/audio)
- [OpenAI speech generation](https://developers.openai.com/api/docs/guides/text-to-speech)
- [OpenAI file transcription](https://developers.openai.com/api/docs/guides/speech-to-text)
- [OpenAI audio in Chat Completions](https://developers.openai.com/api/docs/guides/audio-chat-completions)
- [IELTS Speaking public band descriptors](https://ielts.org/cdn/ielts-guides/ielts-speaking-band-descriptors.pdf)

The rubric prompt summarizes the four published categories for practice. It does
not reproduce the full descriptor document or certify exam equivalence.
