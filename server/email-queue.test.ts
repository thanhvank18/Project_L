import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import type { Assignment, Booking, Classroom, Lesson, Submission } from '../shared/portal.ts'
import { getAccount, openDatabase, type Database } from './db.ts'
import { runAction } from './domain.ts'
import { all, get, put, registerBeforeCommit, transaction } from './domain-store.ts'
import { emailConfigurationFromEnvironment, type EmailConfiguration } from './email-config.ts'
import {
  emailQueueSummary,
  processEmailQueue,
  reconcileEmailQueue,
  retryEmailJob,
  type EmailJob,
} from './email-queue.ts'
import { EmailDeliveryError, type EmailTransport } from './email-transport.ts'
import { startEmailRuntime } from './email-runtime.ts'

const NOW = '2026-10-11T09:00:00.000Z'
const at = (minutes: number) => new Date(Date.parse(NOW) + minutes * 60_000).toISOString()
const enabled = (locale: 'vi' | 'en' = 'vi'): EmailConfiguration =>
  emailConfigurationFromEnvironment({
    PORTAL_EMAIL_ENABLED: 'true',
    PORTAL_EMAIL_PROVIDER: 'resend',
    PORTAL_EMAIL_API_KEY: 'test-key-not-a-credential',
    PORTAL_EMAIL_FROM: 'teaching@example.org',
    PORTAL_EMAIL_PORTAL_ORIGIN: 'https://learning.example.org',
    PORTAL_EMAIL_LOCALE: locale,
  })
const disabled = () => emailConfigurationFromEnvironment({})
const jobs = (db: Database) => all<EmailJob>(db, 'emailJob')
function setup(path = ':memory:') {
  const db = openDatabase(path)
  for (const [id, role] of [
    ['student', 'student'],
    ['other', 'student'],
    ['teacher', 'teacher'],
  ] as const)
    db.prepare(
      'INSERT INTO users(id,name,email,role,active,version,created_at,password_hash) VALUES(?,?,?,?,1,1,?,?)',
    ).run(id, id, `${id}@example.org`, role, NOW, 'not-a-password')
  put<Classroom>(db, 'class', {
    id: 'class',
    title: 'Private class',
    level: 'A1',
    description: '',
    teacherIds: ['teacher'],
    assistantIds: [],
    studentIds: ['student'],
    active: true,
    listed: false,
    enrollmentOpen: false,
    version: 1,
  })
  return db
}
function lesson(db: Database, kind: Lesson['kind'] = 'consultation'): Lesson {
  const item: Lesson = {
    id: 'lesson',
    classId: 'class',
    title: 'Private https://zoom.us/j/secret',
    startsAt: at(30),
    endsAt: at(60),
    kind,
    hostId: 'teacher',
    capacity: 1,
    reservedCount: 0,
    cancelled: false,
    meetingSource: 'none',
    hasMeeting: false,
    version: 1,
  }
  put(db, 'lesson', item)
  return item
}
function assignment(db: Database): Assignment {
  const item: Assignment = {
    id: 'task',
    classId: 'class',
    title: { vi: 'Bài học riêng', en: 'Private lesson' },
    instructions: { vi: 'Không gửi nội dung này', en: 'Do not email these instructions' },
    skill: 'writing',
    dueAt: at(180),
    published: true,
    required: true,
    attachmentIds: [],
    version: 1,
    createdAt: NOW,
    updatedAt: NOW,
  }
  put(db, 'assignment', item)
  return item
}
function booking(db: Database, status: Booking['status'] = 'booked'): Booking {
  const item: Booking = {
    id: 'booking',
    lessonId: 'lesson',
    studentId: 'student',
    status,
    version: 1,
    createdAt: NOW,
  }
  put(db, 'booking', item)
  return item
}
const accepted = (sent: Array<{ text: string; to: string; key: string }> = []): EmailTransport => ({
  async send(message, key) {
    sent.push({ text: message.text, to: message.to, key })
    return { id: 'provider-message' }
  },
})

test('email stays disabled without configuration and validates an explicit enable', () => {
  assert.equal(disabled().enabled, false)
  assert.throws(
    () => emailConfigurationFromEnvironment({ PORTAL_EMAIL_ENABLED: 'yes' }),
    /true or false/,
  )
  assert.throws(() => emailConfigurationFromEnvironment({ PORTAL_EMAIL_ENABLED: 'true' }), /HTTPS/)
  assert.throws(
    () => emailConfigurationFromEnvironment({ PORTAL_EMAIL_FROM: 'Centre <hello@example.org>' }),
    /bare/,
  )
  assert.throws(
    () =>
      emailConfigurationFromEnvironment({
        PORTAL_EMAIL_PORTAL_ORIGIN: 'https://user:secret@example.org',
      }),
    /origin only/,
  )
  assert.throws(
    () => emailConfigurationFromEnvironment({ PORTAL_EMAIL_TIME_ZONE: 'not-a-zone' }),
    /time zone/,
  )
  assert.throws(
    () => emailConfigurationFromEnvironment({ PORTAL_EMAIL_LESSON_LEAD_HOURS: '0' }),
    /1 to 168/,
  )
  assert.equal(enabled().provider, 'resend')
})

test('runtime accepts assignments without deadlines and unrelated live saves; timed assignments still queue', async () => {
  const db = setup()
  const runtime = startEmailRuntime(db, disabled())
  try {
    const teacher = getAccount(db, 'teacher')!
    const student = getAccount(db, 'student')!
    const payload = {
      classId: 'class',
      title: { vi: 'Bài tự học', en: 'Self study' },
      instructions: { vi: 'Trả lời', en: 'Respond' },
      skill: 'writing',
      dueAt: '',
      published: true,
      required: true,
      attachmentIds: [],
      expectedVersion: 0,
    }
    const created = runAction(db, teacher, { type: 'assignment.save', payload })
    const task = created.state.assignments.find((item) => item.id === created.result!.id)!
    assert.equal(task.dueAt, '')
    assert.equal(jobs(db).length, 0)
    const draft = runAction(db, student, {
      type: 'draft.save',
      payload: {
        assignmentId: task.id,
        assignmentVersion: task.version,
        expectedVersion: 0,
        answer: 'My answer',
        notes: '',
        attachmentIds: [],
      },
    })
    assert.equal(draft.state.drafts[0]!.answer, 'My answer')
    const timed = runAction(db, teacher, {
      type: 'assignment.save',
      payload: {
        ...payload,
        dueAt: new Date(Date.now() + 3_600_000).toISOString(),
      },
    })
    assert.equal(jobs(db).length, 1)
    assert.equal(jobs(db)[0]!.entityId, timed.result!.id)
    runAction(db, teacher, {
      type: 'assignment.save',
      payload: {
        ...timed.state.assignments.find((item) => item.id === timed.result!.id)!,
        dueAt: '',
        expectedVersion: 1,
      },
    })
    assert.equal(jobs(db)[0]!.status, 'cancelled')
  } finally {
    await runtime.stop()
    db.close()
  }
})

test('initial reconciliation schedules future work without historical booking notices; disabled worker never sends', async () => {
  const db = setup()
  try {
    lesson(db)
    booking(db)
    assignment(db)
    reconcileEmailQueue(db, disabled(), NOW)
    const sent: Array<{ text: string; to: string; key: string }> = []
    await processEmailQueue(db, disabled(), accepted(sent), NOW)
    reconcileEmailQueue(db, disabled(), NOW)
    assert.equal(sent.length, 0)
    assert.deepEqual(
      jobs(db)
        .map((job) => job.kind)
        .sort(),
      ['assignment.reminder', 'lesson.reminder'],
    )
    assert.equal(emailQueueSummary(db, disabled()).delivery, 'disabled')
    assert.equal(emailQueueSummary(db, disabled()).counts.sent, 0)
    assert.doesNotMatch(
      JSON.stringify(emailQueueSummary(db, disabled())),
      /student@example|zoom|apiKey/,
    )
  } finally {
    db.close()
  }
})

test('jobs persist across a SQLite reopen and retain stable deduplication IDs', () => {
  const path = join(tmpdir(), `portal-email-${randomUUID()}.sqlite`)
  let db = setup(path)
  try {
    assignment(db)
    reconcileEmailQueue(db, disabled(), NOW)
    const original = jobs(db)[0]!.id
    db.close()
    db = openDatabase(path)
    reconcileEmailQueue(db, disabled(), at(1))
    assert.equal(jobs(db).length, 1)
    assert.equal(jobs(db)[0]!.id, original)
  } finally {
    db.close()
    for (const suffix of ['', '-wal', '-shm']) {
      rmSync(`${path}${suffix}`, { force: true })
    }
  }
})

test('booking changes create confirmations/cancellations once and invalidate obsolete reminders', async () => {
  const db = setup()
  try {
    lesson(db)
    reconcileEmailQueue(db, disabled(), NOW)
    const reservation = booking(db)
    reconcileEmailQueue(db, disabled(), NOW)
    reconcileEmailQueue(db, disabled(), NOW)
    assert.equal(jobs(db).filter((job) => job.kind === 'booking.confirmed').length, 1)
    put(db, 'booking', { ...reservation, status: 'cancelled', version: 2 })
    reconcileEmailQueue(db, disabled(), at(1))
    assert.equal(jobs(db).find((job) => job.kind === 'booking.confirmed')?.status, 'cancelled')
    assert.equal(jobs(db).find((job) => job.kind === 'lesson.reminder')?.status, 'cancelled')
    const sent: Array<{ text: string; to: string; key: string }> = []
    await processEmailQueue(db, enabled(), accepted(sent), at(1))
    assert.equal(sent.length, 1)
    assert.match(sent[0]!.text, /Đã hủy/)
    assert.equal(jobs(db).find((job) => job.kind === 'booking.cancelled')?.status, 'sent')
    assert.doesNotMatch(sent[0]!.text, /zoom\.us|secret|Không gửi/)
  } finally {
    db.close()
  }
})

test('lesson reschedule and cancellation replace stale reminders; link-only changes do not announce', () => {
  const db = setup()
  try {
    const original = lesson(db, 'class')
    reconcileEmailQueue(db, disabled(), NOW)
    put(db, 'lesson', { ...original, meetingSource: 'class', hasMeeting: true, version: 2 })
    reconcileEmailQueue(db, disabled(), at(1))
    assert.equal(jobs(db).filter((job) => job.kind === 'lesson.changed').length, 0)
    const changed = { ...original, startsAt: at(120), endsAt: at(150), version: 3 }
    put(db, 'lesson', changed)
    reconcileEmailQueue(db, disabled(), at(2))
    assert.equal(
      jobs(db).filter((job) => job.kind === 'lesson.reminder' && job.status === 'cancelled').length,
      1,
    )
    assert.equal(
      jobs(db).filter((job) => job.kind === 'lesson.changed' && job.status === 'scheduled').length,
      1,
    )
    put(db, 'lesson', { ...changed, cancelled: true, version: 4 })
    reconcileEmailQueue(db, disabled(), at(3))
    assert.equal(
      jobs(db).filter((job) => job.kind === 'lesson.reminder' && job.status !== 'cancelled').length,
      0,
    )
    assert.equal(
      jobs(db).filter((job) => job.kind === 'lesson.changed' && job.status === 'scheduled').length,
      1,
    )
  } finally {
    db.close()
  }
})

test('dispatch rechecks active account, current role, class membership, host and current assignment submission', async () => {
  for (const revoke of [
    'account',
    'role',
    'membership',
    'class',
    'host',
    'submitted',
    'unpublished',
  ] as const) {
    const db = setup()
    try {
      const room = get<Classroom>(db, 'class', 'class')!
      const task = assignment(db)
      if (revoke === 'host') {
        lesson(db, 'class')
        db.prepare("DELETE FROM records WHERE kind='assignment'").run()
      }
      reconcileEmailQueue(db, disabled(), NOW)
      if (revoke === 'account') db.prepare("UPDATE users SET active=0 WHERE id='student'").run()
      if (revoke === 'role')
        db.prepare("UPDATE users SET role='assistant' WHERE id='student'").run()
      if (revoke === 'membership') put(db, 'class', { ...room, studentIds: [] })
      if (revoke === 'class') put(db, 'class', { ...room, active: false })
      if (revoke === 'host') db.prepare("UPDATE users SET active=0 WHERE id='teacher'").run()
      if (revoke === 'unpublished') put(db, 'assignment', { ...task, published: false, version: 2 })
      if (revoke === 'submitted')
        put<Submission>(db, 'submission', {
          id: 'submission',
          assignmentId: task.id,
          classId: task.classId,
          studentId: 'student',
          revision: 1,
          assignmentVersion: task.version,
          title: task.title,
          instructions: task.instructions,
          skill: task.skill,
          answer: 'private',
          attachmentIds: [],
          submittedAt: NOW,
          review: null,
          version: 1,
        })
      const sent: Array<{ text: string; to: string; key: string }> = []
      await processEmailQueue(db, enabled(), accepted(sent), NOW)
      assert.equal(sent.length, 0, revoke)
      assert.ok(
        jobs(db).every((job) => job.status === 'cancelled'),
        revoke,
      )
    } finally {
      db.close()
    }
  }
})

test('an edited assignment gets one reminder for its current version and obsolete jobs are cancelled', () => {
  const db = setup()
  try {
    const task = assignment(db)
    reconcileEmailQueue(db, disabled(), NOW)
    put(db, 'assignment', { ...task, dueAt: at(120), version: 2 })
    reconcileEmailQueue(db, disabled(), at(1))
    assert.equal(jobs(db).length, 2)
    assert.equal(jobs(db).filter((job) => job.status === 'scheduled').length, 1)
    assert.equal(jobs(db).filter((job) => job.status === 'cancelled').length, 1)
  } finally {
    db.close()
  }
})

test('future unattempted reminders recover membership and adopt lead-time settings without duplicate jobs', () => {
  const db = setup()
  try {
    const room = get<Classroom>(db, 'class', 'class')!
    assignment(db)
    reconcileEmailQueue(db, { ...disabled(), assignmentLeadHours: 1 }, NOW)
    assert.equal(jobs(db)[0]!.scheduledAt, at(120))
    put(db, 'class', { ...room, studentIds: [] })
    reconcileEmailQueue(db, disabled(), at(1))
    assert.equal(jobs(db)[0]!.status, 'cancelled')
    put(db, 'class', room)
    reconcileEmailQueue(db, { ...disabled(), assignmentLeadHours: 2 }, at(2))
    assert.equal(jobs(db).length, 1)
    assert.equal(jobs(db)[0]!.status, 'scheduled')
    assert.equal(jobs(db)[0]!.scheduledAt, at(60))
  } finally {
    db.close()
  }
})

test('a new reservation after cancellation gets its own future lesson reminder', () => {
  const db = setup()
  try {
    lesson(db)
    const first = booking(db)
    reconcileEmailQueue(db, disabled(), NOW)
    put(db, 'booking', { ...first, status: 'cancelled' })
    reconcileEmailQueue(db, disabled(), at(1))
    put(db, 'booking', { ...first, id: 'second-booking', createdAt: at(2) })
    reconcileEmailQueue(db, disabled(), at(2))
    assert.equal(
      jobs(db).filter((job) => job.kind === 'lesson.reminder' && job.status === 'scheduled').length,
      1,
    )
    assert.equal(
      jobs(db).filter((job) => job.kind === 'lesson.reminder' && job.status === 'cancelled').length,
      1,
    )
  } finally {
    db.close()
  }
})

test('transient failures retry with the same frozen payload/idempotency key and never claim early success', async () => {
  const db = setup()
  try {
    assignment(db)
    const calls: Array<{ text: string; to: string; key: string }> = []
    const transport: EmailTransport = {
      async send(message, key) {
        calls.push({ text: message.text, to: message.to, key })
        if (calls.length === 1) throw new EmailDeliveryError('provider_unavailable', true)
        return { id: 'accepted' }
      },
    }
    await processEmailQueue(db, enabled('en'), transport, NOW)
    assert.equal(jobs(db)[0]!.status, 'failed')
    assert.equal(emailQueueSummary(db, enabled()).counts.sent, 0)
    await processEmailQueue(db, enabled('vi'), transport, at(4))
    assert.equal(calls.length, 1)
    await processEmailQueue(db, enabled('vi'), transport, at(5))
    assert.equal(calls.length, 2)
    assert.deepEqual(calls[0], calls[1])
    assert.match(calls[0]!.text, /assignment deadline/)
    assert.equal(jobs(db)[0]!.status, 'sent')
    await processEmailQueue(db, enabled(), transport, at(6))
    assert.equal(calls.length, 2)
  } finally {
    db.close()
  }
})

test('email address changes cancel a frozen retry; account email is otherwise read at dispatch', async () => {
  const db = setup()
  try {
    assignment(db)
    reconcileEmailQueue(db, disabled(), NOW)
    db.prepare("UPDATE users SET email='new@example.org' WHERE id='student'").run()
    const recipients: string[] = []
    const transport: EmailTransport = {
      async send(message) {
        recipients.push(message.to)
        throw new EmailDeliveryError('provider_unavailable', true)
      },
    }
    await processEmailQueue(db, enabled(), transport, NOW)
    assert.deepEqual(recipients, ['new@example.org'])
    db.prepare("UPDATE users SET email='changed@example.org' WHERE id='student'").run()
    await processEmailQueue(db, enabled(), transport, at(5))
    assert.equal(recipients.length, 1)
    assert.equal(jobs(db)[0]!.status, 'cancelled')
  } finally {
    db.close()
  }
})

test('worker leases stop concurrent dispatch and stale leases recover with bounded retries', async () => {
  const db = setup()
  try {
    assignment(db)
    let release!: () => void
    let calls = 0
    const transport: EmailTransport = {
      async send() {
        calls += 1
        await new Promise<void>((resolve) => {
          release = resolve
        })
        return { id: 'accepted' }
      },
    }
    const first = processEmailQueue(db, enabled(), transport, NOW)
    await processEmailQueue(db, enabled(), accepted(), NOW)
    assert.equal(jobs(db)[0]!.status, 'pending')
    assert.equal(calls, 1)
    release()
    await first
    assert.equal(jobs(db)[0]!.status, 'sent')
    const job = jobs(db)[0]!
    put(db, 'emailJob', {
      ...job,
      status: 'pending',
      attempts: 1,
      leaseUntil: at(1),
      claimToken: 'old',
      providerMessageId: null,
    })
    const sent: Array<{ text: string; to: string; key: string }> = []
    await processEmailQueue(db, enabled(), accepted(sent), at(2))
    assert.equal(sent.length, 1)
    assert.equal(jobs(db)[0]!.attempts, 2)
    assert.equal(sent[0]!.key, `portal-email-${job.id}`)
  } finally {
    db.close()
  }
})

test('retry is bounded; permanent failures and exhausted attempts require operator reconciliation', async () => {
  for (const permanent of [false, true]) {
    const db = setup()
    try {
      assignment(db)
      let calls = 0
      const transport: EmailTransport = {
        async send() {
          calls += 1
          throw new EmailDeliveryError('provider_rejected', !permanent)
        },
      }
      await processEmailQueue(db, enabled(), transport, NOW)
      if (!permanent) {
        retryEmailJob(db, jobs(db)[0]!.id, at(1))
        await processEmailQueue(db, enabled(), transport, at(1))
        await processEmailQueue(db, enabled(), transport, at(16))
      }
      await processEmailQueue(db, enabled(), transport, at(60))
      assert.equal(calls, permanent ? 1 : 3)
      assert.equal(jobs(db)[0]!.retryable, false)
      assert.throws(() => retryEmailJob(db, jobs(db)[0]!.id, at(61)), /not eligible/)
    } finally {
      db.close()
    }
  }
})

test('old uncertain attempts are not resent after the provider idempotency window', async () => {
  const db = setup()
  try {
    const task = assignment(db)
    put(db, 'assignment', { ...task, dueAt: at(2000) })
    reconcileEmailQueue(db, disabled(), NOW)
    const job = jobs(db)[0]!
    put(db, 'emailJob', {
      ...job,
      status: 'pending',
      attempts: 1,
      firstAttemptAt: NOW,
      leaseUntil: at(1),
      nextAttemptAt: null,
    })
    const sent: Array<{ text: string; to: string; key: string }> = []
    await processEmailQueue(db, enabled(), accepted(sent), at(1381))
    assert.equal(sent.length, 0)
    assert.equal(jobs(db)[0]!.errorCode, 'manual_reconciliation_required')
  } finally {
    db.close()
  }
})

test('before-COMMIT hook persists events atomically and an outbox failure rolls back the action', () => {
  const db = setup()
  try {
    lesson(db)
    reconcileEmailQueue(db, disabled(), NOW)
    let remove = registerBeforeCommit(db, () => reconcileEmailQueue(db, disabled(), NOW))
    transaction(db, () => booking(db))
    assert.equal(jobs(db).filter((job) => job.kind === 'booking.confirmed').length, 1)
    remove()
    remove = registerBeforeCommit(db, () => {
      reconcileEmailQueue(db, disabled(), NOW)
      throw new Error('outbox unavailable')
    })
    assert.throws(
      () =>
        transaction(db, () =>
          put(db, 'booking', { ...get<Booking>(db, 'booking', 'booking')!, status: 'cancelled' }),
        ),
      /outbox unavailable/,
    )
    assert.equal(get<Booking>(db, 'booking', 'booking')!.status, 'booked')
    assert.equal(jobs(db).filter((job) => job.kind === 'booking.cancelled').length, 0)
    remove()
  } finally {
    db.close()
  }
})
