import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import type { Account, Assignment, Classroom, Role } from '../shared/portal.ts'
import { speakingCriteria, type SpeakingAssessment } from '../shared/speaking.ts'
import { tokenHash } from './auth.ts'
import { openDatabase, getAccount, type Database } from './db.ts'
import { all, get, put } from './domain-store.ts'
import { getPortalState, runAction, uploadFile } from './domain.ts'
import { createFileService } from './file-service.ts'
import { HttpError } from './errors.ts'
import { createServer } from './http.ts'
import { createSpeakingService } from './speaking-service.ts'
import {
  speakingConfigurationFromEnvironment,
  speakingConfigurationSummary,
} from './speaking-config.ts'
import {
  createOpenAISpeakingProvider,
  validateSpeakingAssessment,
  type SpeakingProvider,
} from './speaking-provider.ts'
import { inspectSpeakingWav } from './speaking-audio.ts'

const config = () =>
  speakingConfigurationFromEnvironment({
    PORTAL_AI_ENABLED: 'true',
    PORTAL_AI_API_KEY: 'test-only-key-never-sent',
  })
const geminiConfig = () =>
  speakingConfigurationFromEnvironment({
    PORTAL_AI_PROVIDER: 'gemini',
    PORTAL_AI_ENABLED: 'true',
    PORTAL_GEMINI_API_KEY: 'gemini-test-only-key-never-sent',
  })
const status = (expected: number) => (error: unknown) =>
  error instanceof HttpError && error.status === expected
function account(db: Database, id: string, role: Role): Account {
  db.prepare(
    'INSERT INTO users(id,name,email,role,active,version,created_at,password_hash) VALUES(?,?,?,?,1,1,?,?)',
  ).run(id, id, `${id}@example.test`, role, new Date().toISOString(), 'unused-test-only')
  return getAccount(db, id)!
}
function wav(seconds = 4, silent = false) {
  const bytes = Buffer.alloc(44 + seconds * 32000)
  bytes.write('RIFF', 0)
  bytes.writeUInt32LE(bytes.length - 8, 4)
  bytes.write('WAVE', 8)
  bytes.write('fmt ', 12)
  bytes.writeUInt32LE(16, 16)
  bytes.writeUInt16LE(1, 20)
  bytes.writeUInt16LE(1, 22)
  bytes.writeUInt32LE(16000, 24)
  bytes.writeUInt32LE(32000, 28)
  bytes.writeUInt16LE(2, 32)
  bytes.writeUInt16LE(16, 34)
  bytes.write('data', 36)
  bytes.writeUInt32LE(bytes.length - 44, 40)
  if (!silent)
    for (let index = 44; index < bytes.length; index += 2)
      bytes.writeInt16LE(Math.round(Math.sin(index / 17) * 2000), index)
  return bytes
}
const transcript =
  'This is an original fictional test answer about how I spend a quiet afternoon reading books and walking with my friends in our neighbourhood.'
const assessment = (): SpeakingAssessment => ({
  audioEvaluated: true,
  advisory: true,
  overall: 6,
  summary: 'Isolated test feedback, not a provider response.',
  limitations: ['One practice answer.'],
  criteria: Object.fromEntries(
    speakingCriteria.map((key) => [
      key,
      {
        score: 6,
        feedback: 'Test feedback.',
        evidence: ['A test observation.'],
        improvements: ['Practise one example.'],
      },
    ]),
  ) as SpeakingAssessment['criteria'],
})
function provider(overrides: Partial<SpeakingProvider> = {}): SpeakingProvider {
  return {
    speak: async () => Buffer.from('ID3test-audio'),
    transcribe: async () => transcript,
    assess: async () => assessment(),
    ...overrides,
  }
}
function setup(path = ':memory:') {
  const db = openDatabase(path)
  const admin = account(db, 'admin', 'admin'),
    teacher = account(db, 'teacher', 'teacher'),
    assistant = account(db, 'assistant', 'assistant'),
    student = account(db, 'student', 'student'),
    other = account(db, 'other', 'student')
  const room = runAction(db, admin, {
    type: 'class.save',
    payload: {
      title: 'Speaking tests',
      level: '',
      description: '',
      active: true,
      listed: false,
      teacherIds: [teacher.id],
      assistantIds: [assistant.id],
      studentIds: [student.id, other.id],
      expectedVersion: 0,
    },
  }).state.classes[0]!
  const task = runAction(db, teacher, {
    type: 'assignment.save',
    payload: {
      classId: room.id,
      title: { vi: 'Bài nói', en: 'Speaking' },
      instructions: { vi: 'Hãy kể về một buổi chiều.', en: 'Describe an afternoon.' },
      skill: 'speaking',
      dueAt: '',
      published: true,
      required: false,
      attachmentIds: [],
      expectedVersion: 0,
    },
  }).state.assignments[0]!
  const audio = uploadFile(
    db,
    student,
    { classId: room.id, purpose: 'submission', name: 'response.wav', mime: 'audio/wav' },
    wav(),
  )
  const input = (changes: Record<string, unknown> = {}) => ({
    assignmentId: task.id,
    assignmentVersion: task.version,
    kind: 'assessment',
    locale: 'en',
    fileId: audio.id,
    requestId: randomUUID(),
    ...changes,
  })
  return { db, admin, teacher, assistant, student, other, room, task, audio, input }
}

test('Speaking configuration is disabled by default and exposes no key', () => {
  assert.equal(
    speakingConfigurationSummary(speakingConfigurationFromEnvironment({})).reason,
    'disabled',
  )
  assert.equal(
    speakingConfigurationSummary(
      speakingConfigurationFromEnvironment({ PORTAL_AI_ENABLED: 'true' }),
    ).reason,
    'missing_key',
  )
  assert.equal(speakingConfigurationSummary(config()).enabled, true)
  assert.equal(
    JSON.stringify(speakingConfigurationSummary(config())).includes('test-only-key'),
    false,
  )
  assert.throws(() => speakingConfigurationFromEnvironment({ PORTAL_AI_DAILY_JOBS: '10000' }))
})
test('Gemini configuration isolates its key and models from retained OpenAI settings', () => {
  const c = geminiConfig()
  assert.equal(config().provider, 'openai')
  assert.equal(c.provider, 'gemini')
  assert.equal(c.speechModel, 'gemini-3.8-flash-tts')
  assert.equal(c.transcriptionModel, 'gemini-3.8-flash')
  assert.equal(c.assessmentModel, 'gemini-3.8-flash')
  assert.equal(c.voice, 'Kore')
  const mixed = speakingConfigurationFromEnvironment({
    PORTAL_AI_PROVIDER: 'gemini',
    PORTAL_AI_ENABLED: 'true',
    PORTAL_AI_API_KEY: 'old-openai-test-key',
    PORTAL_AI_SPEECH_MODEL: 'old-openai-tts',
    PORTAL_AI_TRANSCRIBE_MODEL: 'old-openai-transcribe',
    PORTAL_AI_ASSESSMENT_MODEL: 'old-openai-assessment',
    PORTAL_AI_VOICE: 'coral',
  })
  assert.equal(mixed.apiKey, '', 'An OpenAI secret must never be sent to Google')
  assert.equal(speakingConfigurationSummary(mixed).reason, 'missing_key')
  assert.equal(mixed.speechModel, c.speechModel)
  assert.equal(mixed.transcriptionModel, c.transcriptionModel)
  assert.equal(mixed.assessmentModel, c.assessmentModel)
  assert.equal(mixed.voice, c.voice)
  const selected = speakingConfigurationFromEnvironment({
    PORTAL_AI_PROVIDER: 'gemini',
    PORTAL_GEMINI_API_KEY: '  selected-gemini-test-key  ',
    PORTAL_GEMINI_SPEECH_MODEL: 'custom-speech-model',
    PORTAL_GEMINI_TRANSCRIBE_MODEL: 'custom-transcribe-model',
    PORTAL_GEMINI_ASSESSMENT_MODEL: 'custom-assessment-model',
    PORTAL_GEMINI_VOICE: 'Puck',
  })
  assert.equal(selected.apiKey, 'selected-gemini-test-key')
  assert.equal(selected.speechModel, 'custom-speech-model')
  assert.equal(selected.transcriptionModel, 'custom-transcribe-model')
  assert.equal(selected.assessmentModel, 'custom-assessment-model')
  assert.equal(selected.voice, 'Puck')
  assert.throws(
    () => speakingConfigurationFromEnvironment({ PORTAL_AI_PROVIDER: 'unknown-provider' }),
    /PORTAL_AI_PROVIDER/,
  )
})
test('Gemini uses the same expiry and daily limits while public status never contains secrets', () => {
  const expiresAt = '2026-10-12T12:15:41.633Z'
  const c = speakingConfigurationFromEnvironment({
    PORTAL_AI_PROVIDER: 'gemini',
    PORTAL_AI_ENABLED: 'true',
    PORTAL_AI_API_KEY: 'retained-openai-secret-sentinel',
    PORTAL_GEMINI_API_KEY: 'private-gemini-secret-sentinel',
    PORTAL_AI_EXPIRES_AT: expiresAt,
    PORTAL_AI_DAILY_JOBS: '3',
    PORTAL_AI_DAILY_GLOBAL_JOBS: '7',
  })
  const deadline = Date.parse(expiresAt)
  assert.equal(c.dailyJobs, 3)
  assert.equal(c.dailyGlobalJobs, 7)
  assert.equal(speakingConfigurationSummary(c, deadline - 1).enabled, true)
  assert.equal(speakingConfigurationSummary(c, deadline).reason, 'expired')
  assert.equal(speakingConfigurationSummary({ ...c, enabled: false }).enabled, false)
  const s = setup()
  try {
    const service = createSpeakingService(s.db, undefined, c, provider(), () => deadline - 1)
    const status = service.configuration()
    const history = service.history(s.student, s.task.id)
    assert.equal(status.provider, 'gemini')
    assert.equal(status.keyConfigured, true)
    assert.equal(history.configuration.provider, 'gemini')
    const serialized = JSON.stringify({ status, history })
    assert.equal(serialized.includes('private-gemini-secret-sentinel'), false)
    assert.equal(serialized.includes('retained-openai-secret-sentinel'), false)
    assert.equal(serialized.includes('apiKey'), false)
  } finally {
    s.db.close()
  }
})
test('AI expiry requires a valid UTC timestamp and runtime summaries close at the exact deadline', () => {
  const expiresAt = '2026-10-12T09:30:00.000Z'
  const deadline = Date.parse(expiresAt)
  const c = speakingConfigurationFromEnvironment({
    PORTAL_AI_ENABLED: 'true',
    PORTAL_AI_API_KEY: 'test-only-key-never-sent',
    PORTAL_AI_EXPIRES_AT: '2026-10-12T09:30:00Z',
  })
  assert.equal(c.expiresAt, expiresAt)
  assert.equal(speakingConfigurationSummary(c, deadline - 1).enabled, true)
  assert.equal(speakingConfigurationSummary(c, deadline).enabled, false)
  assert.equal(speakingConfigurationSummary(c, deadline).reason, 'expired')
  assert.equal(speakingConfigurationSummary(c, deadline + 1).expiresAt, expiresAt)
  assert.equal(JSON.stringify(speakingConfigurationSummary(c, deadline)).includes(c.apiKey), false)
  assert.equal(speakingConfigurationSummary(config(), deadline).enabled, true)
  for (const invalid of [
    'tomorrow',
    '2026-10-12',
    '2026-10-12T09:30:00',
    '2026-02-30T09:30:00.000Z',
    '2026-10-12T25:30:00.000Z',
  ])
    assert.throws(
      () => speakingConfigurationFromEnvironment({ PORTAL_AI_EXPIRES_AT: invalid }),
      /Invalid PORTAL_AI_EXPIRES_AT/,
    )
  assert.equal(
    speakingConfigurationSummary({ ...config(), expiresAt: 'invalid' }, deadline).enabled,
    false,
  )
})
test('expired queued question and assessment jobs never call a provider, including after restart', async () => {
  for (const kind of ['question', 'assessment'] as const) {
    const directory = mkdtempSync(join(tmpdir(), 'project-l-speaking-expiry-'))
    const path = join(directory, 'portal.sqlite')
    try {
      const s = setup(path)
      let time = Date.now()
      const deadline = time + 1000
      const c = { ...config(), expiresAt: new Date(deadline).toISOString() }
      let calls = 0
      const p = provider({
        speak: async () => {
          calls++
          return Buffer.from('ID3question')
        },
        transcribe: async () => {
          calls++
          return transcript
        },
        assess: async () => {
          calls++
          return assessment()
        },
      })
      const service = createSpeakingService(s.db, undefined, c, p, () => time)
      const job = service.create(s.student, s.input({ kind }))
      assert.equal(service.configuration().enabled, true)
      s.db.close()
      time = deadline
      const reopened = openDatabase(path)
      try {
        const runtime = createSpeakingService(reopened, undefined, c, p, () => time)
        assert.equal(runtime.configuration().reason, 'expired')
        assert.equal(runtime.history(s.student, s.task.id).configuration.reason, 'expired')
        await runtime.processNext()
        assert.equal(runtime.read(s.student, job.id).errorCode, 'speaking_expired')
        assert.equal(runtime.read(s.student, job.id).status, 'failed')
        assert.throws(
          () => runtime.create(s.student, s.input({ kind })),
          (error: unknown) =>
            error instanceof HttpError && error.code === 'speaking_expired' && error.status === 503,
        )
        assert.equal(calls, 0)
      } finally {
        reopened.close()
      }
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  }
})
test('expiry during file download or a paid stage prevents later stages and discards late results', async () => {
  for (const phase of ['download', 'transcribe', 'assess', 'speak'] as const) {
    const s = setup()
    let time = Date.now()
    const deadline = time + 1000
    const c = { ...config(), expiresAt: new Date(deadline).toISOString() }
    const calls: string[] = []
    const files = createFileService(s.db)
    const service = createSpeakingService(
      s.db,
      {
        ...files,
        async download(...args) {
          const result = await files.download(...args)
          if (phase === 'download') time = deadline
          return result
        },
      },
      c,
      provider({
        speak: async () => {
          calls.push('speak')
          time = deadline
          return Buffer.from('ID3question')
        },
        transcribe: async () => {
          calls.push('transcribe')
          if (phase === 'transcribe') time = deadline
          return transcript
        },
        assess: async () => {
          calls.push('assess')
          if (phase === 'assess') time = deadline
          return assessment()
        },
      }),
      () => time,
    )
    try {
      const job = service.create(
        s.student,
        s.input({ kind: phase === 'speak' ? 'question' : 'assessment' }),
      )
      await service.processNext()
      const result = service.read(s.student, job.id)
      assert.equal(result.status, 'failed')
      assert.equal(result.errorCode, 'speaking_expired')
      assert.equal(result.assessment, undefined)
      assert.equal(result.hasAudio, false)
      assert.deepEqual(
        calls,
        phase === 'download'
          ? []
          : phase === 'transcribe'
            ? ['transcribe']
            : phase === 'assess'
              ? ['transcribe', 'assess']
              : ['speak'],
      )
    } finally {
      s.db.close()
    }
  }
})
test('expiry retains completed history and cached audio without starting new paid work', async () => {
  const s = setup()
  let time = Date.now()
  const deadline = time + 1000
  let calls = 0
  const service = createSpeakingService(
    s.db,
    undefined,
    { ...config(), expiresAt: new Date(deadline).toISOString() },
    provider({
      speak: async () => {
        calls++
        return Buffer.from('ID3cached')
      },
    }),
    () => time,
  )
  try {
    const input = s.input({ kind: 'question' })
    const job = service.create(s.student, input)
    await service.processNext()
    time = deadline
    assert.equal(service.create(s.student, input).id, job.id)
    assert.equal(service.create(s.student, s.input({ kind: 'question' })).id, job.id)
    assert.equal(service.audio(s.student, job.id).toString(), 'ID3cached')
    assert.equal(service.history(s.student, s.task.id).jobs[0]?.status, 'completed')
    assert.throws(
      () => service.create(s.student, s.input()),
      (error: unknown) => error instanceof HttpError && error.code === 'speaking_expired',
    )
    assert.equal(calls, 1)
  } finally {
    s.db.close()
  }
})
test('WAV parser checks actual PCM, byte sizes, duration and silence', () => {
  assert.deepEqual(inspectSpeakingWav(wav()), { durationSeconds: 4, silent: false })
  assert.equal(inspectSpeakingWav(wav(3, true)).silent, true)
  assert.throws(() => inspectSpeakingWav(wav(2)), status(422))
  assert.throws(() => inspectSpeakingWav(wav(241)), status(422))
  const invalid = wav()
  invalid.writeUInt32LE(48000, 24)
  assert.throws(() => inspectSpeakingWav(invalid), status(422))
  assert.throws(() => inspectSpeakingWav(wav().subarray(0, 80)), status(422))
})
test('private jobs enforce role, owner, class, publication, version and disabled configuration', () => {
  const s = setup(),
    service = createSpeakingService(s.db, undefined, config(), provider())
  for (const actor of [s.admin, s.teacher, s.assistant])
    assert.throws(() => service.create(actor, s.input()), status(403))
  assert.throws(() => service.create(s.other, s.input()), status(404))
  assert.throws(() => service.create(s.student, s.input({ assignmentVersion: 99 })), status(409))
  assert.throws(
    () =>
      createSpeakingService(
        s.db,
        undefined,
        speakingConfigurationFromEnvironment({}),
        provider(),
      ).create(s.student, s.input()),
    status(503),
  )
  put(s.db, 'class', { ...s.room, studentIds: [s.other.id] })
  assert.throws(() => service.create(s.student, s.input()), status(404))
  put(s.db, 'class', s.room)
  put(s.db, 'assignment', { ...s.task, published: false })
  assert.throws(() => service.create(s.student, s.input()), status(404))
  s.db.close()
})
test('idempotency and bounded queue prevent accidental duplicate provider spending', async () => {
  const s = setup(),
    c = { ...config(), dailyJobs: 1 },
    service = createSpeakingService(s.db, undefined, c, provider())
  const input = s.input(),
    job = service.create(s.student, input)
  assert.equal(service.create(s.student, input).id, job.id)
  assert.equal(service.create(s.student, s.input()).id, job.id)
  assert.throws(() => service.create(s.student, { ...input, locale: 'vi' }), status(409))
  assert.throws(
    () => service.create(s.student, s.input({ kind: 'question', fileId: undefined })),
    status(429),
  )
  await service.processNext()
  assert.equal(service.read(s.student, job.id).status, 'completed')
  assert.equal(service.create(s.student, s.input()).id, job.id)
  s.db.close()
})
test('assessment persists exact prompt/file, all four criteria, transcript; does not modify grades or disclose staff state', async () => {
  const s = setup(),
    service = createSpeakingService(s.db, undefined, config(), provider())
  const job = service.create(s.student, s.input())
  await service.processNext()
  const result = service.read(s.student, job.id)
  assert.equal(result.status, 'completed')
  assert.equal(result.prompt, s.task.instructions.en)
  assert.equal(result.transcript, transcript)
  assert.equal(result.fileId, s.audio.id)
  assert.equal(result.assessment!.criteria.pronunciation.score, 6)
  assert.equal(result.durationSeconds, 4)
  assert.equal(all(s.db, 'submission').length, 0)
  for (const actor of [s.teacher, s.admin, s.assistant, s.other])
    assert.throws(() => service.read(actor, job.id), status(404))
  assert.equal(
    JSON.stringify(getPortalState(s.db, s.assistant)).includes('fictional test answer'),
    false,
  )
  put(s.db, 'assignment', {
    ...s.task,
    version: 2,
    instructions: { vi: 'New', en: 'New question' },
  })
  assert.equal(service.read(s.student, job.id).prompt, 'Describe an afternoon.')
  s.db.close()
})
test('silence and insufficient speech create no fabricated scores and make no assessment request', async () => {
  const s = setup()
  let calls = 0
  const p = provider({
    transcribe: async () => {
      calls++
      return 'Only two words'
    },
    assess: async () => {
      throw new Error('Must not assess')
    },
  })
  const service = createSpeakingService(s.db, undefined, config(), p)
  const silent = uploadFile(
    s.db,
    s.student,
    { classId: s.room.id, purpose: 'submission', name: 'silent.wav', mime: 'audio/wav' },
    wav(4, true),
  )
  const first = service.create(s.student, s.input({ fileId: silent.id }))
  await service.processNext()
  assert.equal(service.read(s.student, first.id).errorCode, 'speaking_silence')
  assert.equal(calls, 0)
  const second = service.create(s.student, s.input())
  await service.processNext()
  const result = service.read(s.student, second.id)
  assert.equal(result.status, 'needs_review')
  assert.equal(result.errorCode, 'speaking_insufficient_speech')
  assert.equal(result.assessment, undefined)
  assert.equal(calls, 1)
  s.db.close()
})
test('provider quota exhaustion remains a safe actionable job error without fabricating a result', async () => {
  const s = setup()
  const service = createSpeakingService(
    s.db,
    undefined,
    config(),
    provider({
      transcribe: async () => {
        throw new HttpError(503, 'speaking_quota_exhausted', 'Provider quota exhausted.')
      },
      assess: async () => {
        throw new Error('Must not assess after quota exhaustion')
      },
    }),
  )
  try {
    const job = service.create(s.student, s.input())
    await service.processNext()
    const result = service.read(s.student, job.id)
    assert.equal(result.status, 'failed')
    assert.equal(result.errorCode, 'speaking_quota_exhausted')
    assert.equal(result.transcript, undefined)
    assert.equal(result.assessment, undefined)
    assert.equal(JSON.stringify(result).includes('Provider quota exhausted.'), false)
  } finally {
    s.db.close()
  }
})
test('question voice is private, cached per version and locale, and bound to exact teacher text', async () => {
  const s = setup()
  let spoken = ''
  const service = createSpeakingService(
    s.db,
    undefined,
    config(),
    provider({
      speak: async (prompt) => {
        spoken = prompt
        return Buffer.from('ID3question')
      },
    }),
  )
  const job = service.create(
    s.student,
    s.input({ kind: 'question', fileId: undefined, locale: 'vi' }),
  )
  await service.processNext()
  assert.equal(spoken, s.task.instructions.vi)
  assert.equal(service.read(s.student, job.id).hasAudio, true)
  assert.equal(service.audio(s.student, job.id).toString(), 'ID3question')
  assert.throws(() => service.audio(s.other, job.id), status(404))
  assert.equal(
    service.create(s.student, s.input({ kind: 'question', fileId: undefined, locale: 'vi' })).id,
    job.id,
  )
  put(s.db, 'class', { ...s.room, active: false })
  assert.throws(() => service.audio(s.student, job.id), status(404))
  s.db.close()
})
test('switching provider starts distinct work while retaining old results and request idempotency', async () => {
  for (const kind of ['question', 'assessment'] as const) {
    const s = setup()
    try {
      const original = createSpeakingService(s.db, undefined, config(), provider())
      const input = s.input({ kind })
      const oldJob = original.create(s.student, input)
      await original.processNext()
      let calls = 0
      const c = geminiConfig()
      const runtime = createSpeakingService(
        s.db,
        undefined,
        c,
        provider({
          speechMime: 'audio/wav',
          speak: async () => {
            calls++
            return wav()
          },
          transcribe: async () => {
            calls++
            return transcript
          },
        }),
      )
      assert.equal(runtime.create(s.student, input).id, oldJob.id)
      assert.equal(runtime.read(s.student, oldJob.id).provider, 'openai')
      const next = runtime.create(s.student, s.input({ kind }))
      assert.notEqual(next.id, oldJob.id)
      assert.equal(next.provider, 'gemini')
      assert.deepEqual(next.models, {
        speech: c.speechModel,
        transcription: c.transcriptionModel,
        assessment: c.assessmentModel,
      })
      assert.equal(next.voice, c.voice)
      await runtime.processNext()
      assert.equal(runtime.read(s.student, next.id).status, 'completed')
      assert.equal(runtime.create(s.student, s.input({ kind })).id, next.id)
      assert.equal(calls, 1)
      assert.equal(runtime.history(s.student, s.task.id).jobs.length, 2)
      if (kind === 'question') {
        assert.equal(runtime.read(s.student, next.id).audioMime, 'audio/wav')
        assert.deepEqual(runtime.audio(s.student, next.id), wav())
        assert.equal(runtime.audio(s.student, oldJob.id).toString(), 'ID3test-audio')
      } else {
        assert.equal(runtime.read(s.student, oldJob.id).transcript, transcript)
        assert.deepEqual(runtime.read(s.student, oldJob.id).assessment, assessment())
      }
    } finally {
      s.db.close()
    }
  }
})
test('queued jobs from another provider fail before any outbound call after restarting', async () => {
  for (const kind of ['question', 'assessment'] as const) {
    const directory = mkdtempSync(join(tmpdir(), 'project-l-speaking-provider-'))
    const path = join(directory, 'portal.sqlite')
    try {
      const s = setup(path)
      const original = createSpeakingService(s.db, undefined, config(), provider())
      const oldJob = original.create(s.student, s.input({ kind }))
      s.db.close()
      const db = openDatabase(path)
      let calls = 0
      try {
        const runtime = createSpeakingService(
          db,
          undefined,
          // Matching model strings must not disguise a provider change.
          { ...config(), provider: 'gemini', apiKey: 'isolated-gemini-test-key' },
          provider({
            speak: async () => {
              calls++
              return wav()
            },
            transcribe: async () => {
              calls++
              return transcript
            },
            assess: async () => {
              calls++
              return assessment()
            },
          }),
        )
        await runtime.processNext()
        assert.equal(calls, 0)
        const result = runtime.read(s.student, oldJob.id)
        assert.equal(result.status, 'failed')
        assert.equal(result.errorCode, 'speaking_configuration_changed')
        assert.equal(result.provider, 'openai')
        assert.equal(result.hasAudio, false)
        assert.equal(result.transcript, undefined)
        assert.equal(result.assessment, undefined)
      } finally {
        db.close()
      }
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  }
})
test('changed Gemini model or question voice cannot reuse an earlier completed result', async () => {
  for (const change of ['model', 'voice'] as const) {
    const s = setup()
    try {
      const c = geminiConfig()
      const original = createSpeakingService(s.db, undefined, c, provider())
      const oldJob = original.create(s.student, s.input({ kind: 'question' }))
      await original.processNext()
      const changed = {
        ...c,
        ...(change === 'voice' ? { voice: 'Puck' } : { speechModel: 'custom-new-tts' }),
      }
      const runtime = createSpeakingService(s.db, undefined, changed, provider())
      const next = runtime.create(s.student, s.input({ kind: 'question' }))
      assert.notEqual(next.id, oldJob.id)
      assert.equal(next.voice, changed.voice)
      assert.equal(next.models.speech, changed.speechModel)
      await runtime.processNext()
      assert.equal(runtime.create(s.student, s.input({ kind: 'question' })).id, next.id)
      assert.equal(runtime.read(s.student, oldJob.id).status, 'completed')
    } finally {
      s.db.close()
    }
  }
})
test('stale consent for another provider cannot create or reuse a Speaking request', async () => {
  const s = setup()
  try {
    const oldInput = s.input({ kind: 'question', provider: 'openai' })
    const original = createSpeakingService(s.db, undefined, config(), provider())
    const oldJob = original.create(s.student, oldInput)
    await original.processNext()
    const runtime = createSpeakingService(s.db, undefined, geminiConfig(), provider())
    for (const input of [oldInput, s.input({ kind: 'question', provider: 'openai' })])
      assert.throws(
        () => runtime.create(s.student, input),
        (error: unknown) =>
          error instanceof HttpError &&
          error.status === 409 &&
          error.code === 'speaking_configuration_changed',
      )
    assert.equal(runtime.history(s.student, s.task.id).jobs.length, 1)
    assert.equal(runtime.read(s.student, oldJob.id).provider, 'openai')
    assert.equal(
      runtime.create(s.student, s.input({ kind: 'question', provider: 'gemini' })).provider,
      'gemini',
    )
  } finally {
    s.db.close()
  }
})
test('changing provider does not reset the student daily job limit', async () => {
  const s = setup()
  try {
    const original = createSpeakingService(
      s.db,
      undefined,
      { ...config(), dailyJobs: 1 },
      provider(),
    )
    const oldJob = original.create(s.student, s.input({ kind: 'question' }))
    await original.processNext()
    const runtime = createSpeakingService(
      s.db,
      undefined,
      { ...geminiConfig(), dailyJobs: 1 },
      provider(),
    )
    assert.throws(
      () => runtime.create(s.student, s.input({ kind: 'question', provider: 'gemini' })),
      (error: unknown) =>
        error instanceof HttpError && error.status === 429 && error.code === 'speaking_daily_limit',
    )
    assert.equal(runtime.history(s.student, s.task.id).jobs.length, 1)
    assert.equal(runtime.audio(s.student, oldJob.id).toString(), 'ID3test-audio')
  } finally {
    s.db.close()
  }
})
test('cancel or access/version change during provider call discards the late result', async () => {
  for (const change of ['cancel', 'version', 'membership', 'account'] as const) {
    const s = setup()
    let release!: (value: string) => void
    const pending = new Promise<string>((resolve) => {
      release = resolve
    })
    const service = createSpeakingService(
      s.db,
      undefined,
      config(),
      provider({ transcribe: async () => pending }),
    )
    const job = service.create(s.student, s.input()),
      work = service.processNext()
    await new Promise((resolve) => setImmediate(resolve))
    if (change === 'cancel')
      service.cancel(s.student, job.id, service.read(s.student, job.id).version)
    if (change === 'version') put<Assignment>(s.db, 'assignment', { ...s.task, version: 2 })
    if (change === 'membership') put<Classroom>(s.db, 'class', { ...s.room, studentIds: [] })
    if (change === 'account')
      s.db.prepare('UPDATE users SET active=0,version=version+1 WHERE id=?').run(s.student.id)
    release(transcript)
    await work
    const stored = get<Record<string, unknown>>(s.db, 'speakingJob', job.id)!
    assert.equal(stored.status, change === 'cancel' ? 'cancelled' : 'failed')
    assert.equal(stored.transcript, undefined)
    assert.equal(stored.assessment, undefined)
    s.db.close()
  }
})
test('persistence survives reopening; interrupted in-flight requests never automatically retry', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'project-l-speaking-')),
    path = join(directory, 'portal.sqlite')
  try {
    const s = setup(path),
      service = createSpeakingService(s.db, undefined, config(), provider())
    const job = service.create(s.student, s.input())
    await service.processNext()
    const queued = service.create(s.student, s.input({ kind: 'question', fileId: undefined }))
    put(s.db, 'speakingJob', {
      ...get<Record<string, unknown>>(s.db, 'speakingJob', queued.id)!,
      id: queued.id,
      status: 'synthesizing',
    })
    s.db.close()
    const reopened = openDatabase(path)
    let calls = 0
    const runtime = createSpeakingService(
      reopened,
      undefined,
      config(),
      provider({
        speak: async () => {
          calls++
          return Buffer.from('ID3')
        },
      }),
    )
    runtime.start()
    await runtime.stop()
    assert.equal(runtime.read(s.student, job.id).transcript, transcript)
    assert.equal(runtime.read(s.student, queued.id).errorCode, 'speaking_interrupted')
    assert.equal(calls, 0)
    reopened.close()
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
test('strict result validation rejects malformed, unsupported scores and fabricated audio claims', () => {
  assert.equal(validateSpeakingAssessment({ ...assessment(), overall: 9 }).overall, 6)
  assert.throws(
    () => validateSpeakingAssessment({ ...assessment(), audioEvaluated: false }),
    status(502),
  )
  const invalid = assessment()
  invalid.criteria.pronunciation.score = 10
  assert.throws(() => validateSpeakingAssessment(invalid), status(502))
  const partial = assessment()
  partial.criteria.pronunciation.score = null
  assert.equal(validateSpeakingAssessment(partial).overall, null)
  partial.limitations = []
  assert.throws(() => validateSpeakingAssessment(partial), status(502))
})
test('OpenAI adapter uses bounded requests, sends audio for pronunciation, validates JSON and sanitizes errors', async () => {
  const requests: { url: string; body: unknown }[] = []
  const mock: typeof fetch = async (input, init) => {
    const url = String(input)
    requests.push({ url, body: init?.body })
    assert.equal(init?.redirect, 'error')
    if (url.endsWith('/audio/speech'))
      return new Response(Buffer.from('ID3question'), { status: 200 })
    if (url.endsWith('/audio/transcriptions')) return Response.json({ text: transcript })
    return Response.json({
      choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(assessment()) } }],
    })
  }
  const p = createOpenAISpeakingProvider(config(), mock),
    signal = new AbortController().signal
  await p.speak('A teacher question', signal)
  await p.transcribe(wav(), signal)
  const result = await p.assess(
    { audio: wav(), prompt: 'A teacher question', transcript, locale: 'vi', durationSeconds: 4 },
    signal,
  )
  assert.equal(result.overall, 6)
  const request = JSON.parse(requests[2]!.body as string)
  assert.equal(request.store, false)
  assert.deepEqual(request.modalities, ['text'])
  assert.equal(request.messages[1].content[1].input_audio.format, 'wav')
  assert.equal(
    Buffer.from(request.messages[1].content[1].input_audio.data, 'base64').equals(wav()),
    true,
  )
  const broken = createOpenAISpeakingProvider(
    config(),
    async () => new Response('provider secret details', { status: 400 }),
  )
  await assert.rejects(
    broken.speak('Question', signal),
    (error: unknown) => error instanceof HttpError && !error.message.includes('secret'),
  )
})
test('OpenAI quota failures are distinct from transient throttling and never expose provider error details', async () => {
  const signal = new AbortController().signal
  const invoke = [
    (p: SpeakingProvider) => p.speak('A teacher question', signal),
    (p: SpeakingProvider) => p.transcribe(wav(), signal),
    (p: SpeakingProvider) =>
      p.assess(
        {
          audio: wav(),
          prompt: 'A teacher question',
          transcript,
          locale: 'vi',
          durationSeconds: 4,
        },
        signal,
      ),
  ]
  for (const [body, code, expectedStatus] of [
    [
      { error: { code: 'insufficient_quota', type: 'insufficient_quota' } },
      'speaking_quota_exhausted',
      503,
    ],
    [{ error: { code: 'credit_balance_exhausted' } }, 'speaking_quota_exhausted', 503],
    [{ error: { type: 'insufficient_quota' } }, 'speaking_quota_exhausted', 503],
    [{ error: { code: 'rate_limit_exceeded' } }, 'speaking_provider_busy', 502],
    [{ error: { code: 'unknown_error' } }, 'speaking_provider_busy', 502],
  ] as const) {
    for (const call of invoke) {
      let requests = 0
      const mock: typeof fetch = async () => {
        requests++
        return Response.json(
          { error: { ...body.error, message: 'PRIVATE_PROVIDER_DETAIL_SENTINEL' } },
          { status: 429 },
        )
      }
      const p = createOpenAISpeakingProvider(config(), mock)
      await assert.rejects(call(p), (error: unknown) => {
        assert.ok(error instanceof HttpError)
        assert.equal(error.code, code)
        assert.equal(error.status, expectedStatus)
        assert.equal(error.message.includes('PRIVATE_PROVIDER_DETAIL_SENTINEL'), false)
        assert.equal(JSON.stringify(error).includes('PRIVATE_PROVIDER_DETAIL_SENTINEL'), false)
        assert.equal(error.message.includes('test-only-key'), false)
        return true
      })
      assert.equal(requests, 1, 'Quota failures must not automatically retry paid requests')
    }
  }
  const malformed = createOpenAISpeakingProvider(
    config(),
    async () => new Response('PRIVATE_PROVIDER_DETAIL_SENTINEL', { status: 429 }),
  )
  await assert.rejects(
    malformed.speak('Question', signal),
    (error: unknown) =>
      error instanceof HttpError &&
      error.code === 'speaking_provider_busy' &&
      error.status === 502 &&
      !error.message.includes('PRIVATE_PROVIDER_DETAIL_SENTINEL'),
  )
  let cancelled = false
  const oversized = createOpenAISpeakingProvider(
    config(),
    async () =>
      new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('x'.repeat(16_385)))
          },
          cancel() {
            cancelled = true
          },
        }),
        { status: 429 },
      ),
  )
  await assert.rejects(
    oversized.speak('Question', signal),
    (error: unknown) =>
      error instanceof HttpError && error.code === 'speaking_provider_busy' && error.status === 502,
  )
  assert.equal(cancelled, true, 'Oversized error streams are cancelled at the error-body limit')
})

test('HTTP routes require bearer auth, protect private histories/audio and honor current versions', async () => {
  const s = setup(),
    files = createFileService(s.db),
    service = createSpeakingService(s.db, files, config(), provider())
  const server = createServer(s.db, files, undefined, service)
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  assert.ok(address && typeof address !== 'string')
  const base = `http://127.0.0.1:${address.port}/api/v1/portal/speaking`
  const token = 'test-speaking-'.padEnd(43, 'a')
  s.db
    .prepare('INSERT INTO sessions(token_hash,user_id,created_at,expires_at) VALUES(?,?,?,?)')
    .run(tokenHash(token), s.student.id, Date.now(), Date.now() + 100000)
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
  try {
    assert.equal((await fetch(`${base}/assignments/${s.task.id}`)).status, 401)
    const response = await fetch(`${base}/jobs`, {
      method: 'POST',
      headers,
      body: JSON.stringify(s.input({ kind: 'question', fileId: undefined })),
    })
    assert.equal(response.status, 202)
    const job = (await response.json()) as { id: string }
    await service.processNext()
    const history = (await fetch(`${base}/assignments/${s.task.id}`, { headers }).then((r) =>
      r.json(),
    )) as { jobs: unknown[] }
    assert.equal(history.jobs.length, 1)
    const audio = await fetch(`${base}/jobs/${job.id}/audio`, { headers })
    assert.equal(audio.status, 200)
    assert.equal(audio.headers.get('content-type'), 'audio/mpeg')
    assert.equal((await fetch(`${base}/jobs/${job.id}`, { headers })).status, 200)
    assert.equal(
      (
        await fetch(`${base}/jobs/${job.id}/cancel`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ expectedVersion: 1 }),
        })
      ).status,
      409,
    )
    s.db.prepare("UPDATE users SET role='assistant' WHERE id=?").run(s.student.id)
    assert.equal((await fetch(`${base}/jobs/${job.id}`, { headers })).status, 403)
  } finally {
    await service.stop()
    await new Promise<void>((resolve) => server.close(() => resolve()))
    s.db.close()
  }
})
test('HTTP audio preserves legacy MPEG and serves Gemini WAV with its persisted MIME', async () => {
  const s = setup()
  const files = createFileService(s.db)
  const original = createSpeakingService(s.db, files, config(), provider())
  const oldJob = original.create(s.student, s.input({ kind: 'question' }))
  await original.processNext()
  const stored = get<Record<string, unknown>>(s.db, 'speakingJob', oldJob.id)!
  delete stored.audioMime
  delete stored.voice
  put(s.db, 'speakingJob', { ...stored, id: oldJob.id })
  const runtime = createSpeakingService(
    s.db,
    files,
    geminiConfig(),
    provider({ speechMime: 'audio/wav', speak: async () => wav() }),
  )
  const job = runtime.create(s.student, s.input({ kind: 'question' }))
  await runtime.processNext()
  const server = createServer(s.db, files, undefined, runtime)
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  assert.ok(address && typeof address !== 'string')
  const base = `http://127.0.0.1:${address.port}/api/v1/portal/speaking`
  const token = 'test-gemini-audio-'.padEnd(43, 'a')
  const otherToken = 'test-other-gemini-audio-'.padEnd(43, 'b')
  for (const [value, userId] of [
    [token, s.student.id],
    [otherToken, s.other.id],
  ])
    s.db
      .prepare('INSERT INTO sessions(token_hash,user_id,created_at,expires_at) VALUES(?,?,?,?)')
      .run(tokenHash(value!), userId!, Date.now(), Date.now() + 100000)
  const headers = { Authorization: `Bearer ${token}` }
  try {
    for (const [id, mime, expected] of [
      [oldJob.id, 'audio/mpeg', Buffer.from('ID3test-audio')],
      [job.id, 'audio/wav', wav()],
    ] as const) {
      const url = `${base}/jobs/${id}/audio`
      const response = await fetch(url, { headers })
      assert.equal(response.status, 200)
      assert.equal(response.headers.get('content-type'), mime)
      assert.deepEqual(Buffer.from(await response.arrayBuffer()), expected)
      assert.equal((await fetch(url)).status, 401)
      assert.equal(
        (await fetch(url, { headers: { Authorization: `Bearer ${otherToken}` } })).status,
        404,
      )
    }
    const history = await fetch(`${base}/assignments/${s.task.id}`, { headers }).then((r) =>
      r.json(),
    )
    assert.equal(JSON.stringify(history).includes('gemini-test-only-key-never-sent'), false)
  } finally {
    await runtime.stop()
    await new Promise<void>((resolve) => server.close(() => resolve()))
    s.db.close()
  }
})
