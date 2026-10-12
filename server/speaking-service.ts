import type { Account, Assignment, AuditEntry, FileRecord } from '../shared/portal.ts'
import type { SpeakingHistory, SpeakingJob } from '../shared/speaking.ts'
import { speakingLimits } from '../shared/speaking.ts'
import { getAccount, transaction, type Database } from './db.ts'
import {
  all,
  authenticated,
  classroom,
  get,
  id,
  now,
  put,
  str,
  integer,
  enumValue,
} from './domain-store.ts'
import { HttpError } from './errors.ts'
import { createFileService, type FileService } from './file-service.ts'
import {
  speakingConfigurationFromEnvironment,
  speakingConfigurationSummary,
  type SpeakingConfiguration,
} from './speaking-config.ts'
import { inspectSpeakingWav } from './speaking-audio.ts'
import { createGeminiSpeakingProvider } from './speaking-gemini.ts'
import {
  createOpenAISpeakingProvider,
  speakingRubricVersion,
  validateSpeakingAssessment,
  type SpeakingProvider,
} from './speaking-provider.ts'

interface StoredJob extends SpeakingJob {
  studentId: string
  accountVersion: number
  classId: string
  requestId: string
}
const KIND = 'speakingJob'
const activeStatuses = new Set(['queued', 'synthesizing', 'transcribing', 'assessing'])
const wire = (job: StoredJob): SpeakingJob => {
  const { studentId, accountVersion, classId, requestId, ...result } = job
  void studentId
  void accountVersion
  void classId
  void requestId
  return result
}
function access(db: Database, suppliedActor: Account, assignmentId: string, version?: number) {
  const actor = authenticated(db, suppliedActor)
  if (actor.role !== 'student')
    throw new HttpError(
      403,
      'speaking_private',
      'Speaking practice belongs to the student account.',
    )
  const assignment = get<Assignment>(db, 'assignment', assignmentId)
  if (!assignment || assignment.skill !== 'speaking' || !assignment.published)
    throw new HttpError(404, 'speaking_unavailable', 'The Speaking assignment is unavailable.')
  classroom(db, actor, assignment.classId)
  if (version !== undefined && assignment.version !== version)
    throw new HttpError(
      409,
      'speaking_version_changed',
      'The assignment changed. Review the current question before requesting AI.',
    )
  return { actor, assignment }
}
function ownFile(db: Database, actor: Account, assignment: Assignment, fileId: string): FileRecord {
  const file = get<FileRecord>(db, 'file', fileId)
  if (
    !file ||
    file.ownerId !== actor.id ||
    file.classId !== assignment.classId ||
    file.purpose !== 'submission'
  )
    throw new HttpError(
      404,
      'speaking_file_unavailable',
      'Choose your own saved recording from this class.',
    )
  if (file.mime !== 'audio/wav' && file.mime !== 'audio/x-wav')
    throw new HttpError(
      422,
      'speaking_audio_format',
      'Prepare a PCM WAV recording before requesting AI.',
    )
  return file
}
function audit(db: Database, job: StoredJob, action: string) {
  put<AuditEntry>(db, 'audit', {
    id: id(),
    actorId: job.studentId,
    action,
    targetId: job.id,
    createdAt: now(),
  })
}

/** Durable private jobs. Only the runtime worker performs outbound provider calls. */
export function createSpeakingService(
  db: Database,
  files: FileService = createFileService(db),
  config: SpeakingConfiguration = speakingConfigurationFromEnvironment(),
  provider: SpeakingProvider = config.provider === 'gemini'
    ? createGeminiSpeakingProvider(config)
    : createOpenAISpeakingProvider(config),
  clock: () => number = Date.now,
) {
  let running: Promise<void> | undefined
  let timer: ReturnType<typeof setInterval> | undefined
  let stopped = false
  let controller: AbortController | undefined
  let processingId: string | undefined
  const jobs = () => all<StoredJob>(db, KIND)
  const configurationSummary = () => speakingConfigurationSummary(config, clock())
  const sameConfiguration = (job: StoredJob) =>
    job.provider === config.provider &&
    job.models.speech === config.speechModel &&
    job.models.transcription === config.transcriptionModel &&
    job.models.assessment === config.assessmentModel &&
    (job.voice ?? 'coral') === config.voice
  const requireAI = () => {
    const summary = configurationSummary()
    if (summary.enabled) return
    if (summary.reason === 'expired')
      throw new HttpError(
        503,
        'speaking_expired',
        'The Speaking AI trial has ended. Your recording remains available for teacher review.',
      )
    throw new HttpError(
      503,
      'speaking_unconfigured',
      'Speaking AI is not configured. Your recording remains available for teacher review.',
    )
  }
  const requireJob = (actor: Account, key: string) => {
    const job = get<StoredJob>(db, KIND, key)
    if (!job || job.studentId !== actor.id)
      throw new HttpError(404, 'speaking_unavailable', 'The Speaking request is unavailable.')
    access(db, actor, job.assignmentId)
    return job
  }
  const persist = (job: StoredJob, updates: Partial<StoredJob>): StoredJob => {
    const next = { ...job, ...updates, updatedAt: now(), version: job.version + 1 }
    put(db, KIND, next)
    return next
  }
  const currentProcessing = (key: string) => {
    const job = get<StoredJob>(db, KIND, key)
    if (!job || !activeStatuses.has(job.status) || controller?.signal.aborted)
      throw new HttpError(409, 'speaking_cancelled', 'The request was stopped.')
    const actor = getAccount(db, job.studentId)
    if (!actor || actor.version !== job.accountVersion)
      throw new HttpError(
        403,
        'speaking_access_changed',
        'Account access changed while processing.',
      )
    const result = access(db, actor, job.assignmentId, job.assignmentVersion)
    if (job.fileId) ownFile(db, result.actor, result.assignment, job.fileId)
    requireAI()
    if (!sameConfiguration(job))
      throw new HttpError(
        409,
        'speaking_configuration_changed',
        'The AI configuration changed. Start a new request.',
      )
    return { job, ...result }
  }
  const processNext = async () => {
    const candidate = jobs().find((job) => job.status === 'queued')
    if (!candidate) return
    controller = new AbortController()
    processingId = candidate.id
    try {
      const initial = currentProcessing(candidate.id)
      let job = initial.job
      const actor = initial.actor
      if (job.kind === 'question') {
        job = persist(job, { status: 'synthesizing' })
        requireAI()
        const audio = await provider.speak(job.prompt, controller.signal)
        transaction(db, () => {
          const { job: latest } = currentProcessing(job.id)
          if (!Buffer.isBuffer(audio) || !audio.length || audio.length > speakingLimits.maxBytes)
            throw new HttpError(
              502,
              'speaking_invalid_result',
              'The generated question audio is invalid.',
            )
          db.prepare('INSERT INTO speaking_audio(id,bytes) VALUES(?,?)').run(job.id, audio)
          persist(latest, {
            status: 'completed',
            hasAudio: true,
            audioMime: provider.speechMime ?? 'audio/mpeg',
          })
          audit(db, latest, 'speaking.question.completed')
        })
        return
      }
      job = persist(job, { status: 'transcribing' })
      const { bytes } = await files.download(
        actor,
        job.fileId!,
        () => currentProcessing(job.id).actor,
      )
      const inspection = inspectSpeakingWav(bytes)
      job = persist(currentProcessing(job.id).job, { durationSeconds: inspection.durationSeconds })
      if (inspection.silent) {
        persist(job, { status: 'needs_review', errorCode: 'speaking_silence' })
        return
      }
      requireAI()
      const transcript = await provider.transcribe(bytes, controller.signal)
      if (typeof transcript !== 'string' || transcript.length > speakingLimits.transcriptCharacters)
        throw new HttpError(502, 'speaking_invalid_result', 'The transcript could not be verified.')
      job = persist(currentProcessing(job.id).job, { transcript })
      if (transcript.trim().split(/\s+/u).filter(Boolean).length < 20) {
        persist(job, { status: 'needs_review', errorCode: 'speaking_insufficient_speech' })
        return
      }
      job = persist(job, { status: 'assessing' })
      requireAI()
      const assessment = validateSpeakingAssessment(
        await provider.assess(
          {
            audio: bytes,
            prompt: job.prompt,
            transcript,
            locale: job.locale,
            durationSeconds: inspection.durationSeconds,
          },
          controller.signal,
        ),
      )
      transaction(db, () => {
        const { job: latest } = currentProcessing(job.id)
        persist(latest, {
          assessment,
          status: assessment.overall === null ? 'needs_review' : 'completed',
        })
        audit(db, latest, 'speaking.assessment.completed')
      })
    } catch (error) {
      const latest = get<StoredJob>(db, KIND, candidate.id)
      if (latest && activeStatuses.has(latest.status)) {
        const allowedCodes = new Set([
          'speaking_unconfigured',
          'speaking_expired',
          'speaking_cancelled',
          'speaking_version_changed',
          'speaking_access_changed',
          'speaking_audio_format',
          'speaking_audio_duration',
          'speaking_invalid_result',
          'speaking_provider_busy',
          'speaking_quota_exhausted',
          'speaking_provider_error',
          'speaking_provider_auth',
          'speaking_unavailable',
          'speaking_file_unavailable',
          'speaking_configuration_changed',
        ])
        const code = stopped
          ? 'speaking_interrupted'
          : error instanceof HttpError && allowedCodes.has(error.code)
            ? error.code
            : 'speaking_provider_error'
        persist(latest, { status: 'failed', errorCode: code })
        audit(db, latest, 'speaking.failed')
      }
    } finally {
      controller = undefined
      processingId = undefined
    }
  }
  const tick = () => {
    if (stopped || running) return
    running = processNext()
      .catch(() => {
        // Never log provider responses, recordings, prompts or credentials.
        console.error('speaking_worker_failed')
      })
      .finally(() => {
        running = undefined
      })
  }
  return {
    configuration() {
      return { ...configurationSummary(), keyConfigured: Boolean(config.apiKey) }
    },
    history(actor: Account, assignmentId: string): SpeakingHistory {
      access(db, actor, assignmentId)
      return {
        configuration: configurationSummary(),
        jobs: jobs()
          .filter((job) => job.studentId === actor.id && job.assignmentId === assignmentId)
          .slice(-100)
          .reverse()
          .map(wire),
      }
    },
    create(suppliedActor: Account, input: Record<string, unknown>): SpeakingJob {
      return transaction(db, () => {
        const assignmentId = str(input, 'assignmentId', 150)
        const assignmentVersion = integer(input, 'assignmentVersion', 1)
        const { actor, assignment } = access(db, suppliedActor, assignmentId, assignmentVersion)
        if (input.provider !== undefined && input.provider !== config.provider)
          throw new HttpError(
            409,
            'speaking_configuration_changed',
            'The AI provider changed. Reload and confirm the new provider before requesting AI.',
          )
        const kind = enumValue(input, 'kind', ['question', 'assessment'])
        const locale = enumValue(input, 'locale', ['vi', 'en'])
        const requestId = str(input, 'requestId', 100)
        if (!/^[a-zA-Z0-9_-]{16,100}$/.test(requestId))
          throw new HttpError(400, 'speaking_request_id', 'Use a unique request identifier.')
        const fileId = kind === 'assessment' ? str(input, 'fileId', 150) : undefined
        if (fileId) ownFile(db, actor, assignment, fileId)
        const previous = jobs().find(
          (job) => job.studentId === actor.id && job.requestId === requestId,
        )
        if (previous) {
          if (
            previous.assignmentId !== assignmentId ||
            previous.assignmentVersion !== assignmentVersion ||
            previous.kind !== kind ||
            previous.locale !== locale ||
            previous.fileId !== fileId
          )
            throw new HttpError(
              409,
              'speaking_request_conflict',
              'This request identifier was already used for different work.',
            )
          return wire(previous)
        }
        const reusable = jobs().find(
          (job) =>
            job.studentId === actor.id &&
            job.assignmentId === assignmentId &&
            job.assignmentVersion === assignmentVersion &&
            job.kind === kind &&
            job.locale === locale &&
            job.fileId === fileId &&
            sameConfiguration(job) &&
            (activeStatuses.has(job.status) ||
              job.status === 'completed' ||
              job.status === 'needs_review'),
        )
        if (reusable) return wire(reusable)
        requireAI()
        const prompt = assignment.instructions[locale].trim()
        if (!prompt || prompt.length > speakingLimits.promptCharacters)
          throw new HttpError(
            422,
            'speaking_prompt_length',
            'The teacher question must contain 1–4000 characters for Speaking AI.',
          )
        const recent = jobs().filter(
          (job) => Date.parse(job.createdAt) >= clock() - 24 * 60 * 60 * 1000,
        )
        if (
          recent.length >= config.dailyGlobalJobs ||
          recent.filter((job) => job.studentId === actor.id).length >= config.dailyJobs
        )
          throw new HttpError(
            429,
            'speaking_daily_limit',
            'The daily Speaking AI limit has been reached. Try again later.',
          )
        if (jobs().some((job) => job.studentId === actor.id && activeStatuses.has(job.status)))
          throw new HttpError(
            409,
            'speaking_in_progress',
            'Wait for your current Speaking request or cancel it first.',
          )
        const job: StoredJob = {
          id: id(),
          studentId: actor.id,
          accountVersion: actor.version,
          classId: assignment.classId,
          assignmentId,
          assignmentVersion,
          kind,
          locale,
          requestId,
          fileId,
          title: assignment.title,
          prompt,
          status: 'queued',
          hasAudio: false,
          provider: config.provider,
          voice: config.voice,
          models: {
            speech: config.speechModel,
            transcription: config.transcriptionModel,
            assessment: config.assessmentModel,
          },
          rubricVersion: speakingRubricVersion,
          createdAt: now(),
          updatedAt: now(),
          version: 1,
        }
        put(db, KIND, job)
        audit(db, job, 'speaking.queued')
        return wire(job)
      })
    },
    read(actor: Account, key: string): SpeakingJob {
      return wire(requireJob(actor, key))
    },
    cancel(actor: Account, key: string, expectedVersion: number): SpeakingJob {
      return transaction(db, () => {
        const job = requireJob(actor, key)
        if (job.version !== expectedVersion)
          throw new HttpError(409, 'conflict', 'The request changed. Refresh before cancelling.')
        if (!activeStatuses.has(job.status)) return wire(job)
        const next = persist(job, { status: 'cancelled', errorCode: 'speaking_cancelled' })
        if (processingId === key) controller?.abort()
        audit(db, job, 'speaking.cancelled')
        return wire(next)
      })
    },
    audio(actor: Account, key: string): Buffer {
      const job = requireJob(actor, key)
      if (job.kind !== 'question' || job.status !== 'completed' || !job.hasAudio)
        throw new HttpError(404, 'speaking_audio_unavailable', 'Question audio is not available.')
      const row = db.prepare('SELECT bytes FROM speaking_audio WHERE id = ?').get(key)
      if (!row)
        throw new HttpError(404, 'speaking_audio_unavailable', 'Question audio is not available.')
      return Buffer.from(row.bytes as Uint8Array)
    },
    async processNext() {
      if (running) return running
      running = processNext().finally(() => {
        running = undefined
      })
      return running
    },
    start() {
      if (timer) return
      stopped = false
      for (const job of jobs()) {
        if (activeStatuses.has(job.status) && job.status !== 'queued')
          persist(job, { status: 'failed', errorCode: 'speaking_interrupted' })
      }
      timer = setInterval(tick, 1000)
      timer.unref()
      tick()
    },
    async stop() {
      stopped = true
      if (timer) clearInterval(timer)
      timer = undefined
      controller?.abort()
      await running
    },
  }
}
export type SpeakingService = ReturnType<typeof createSpeakingService>
