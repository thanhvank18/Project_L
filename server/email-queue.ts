import { createHash, randomUUID } from 'node:crypto'
import type {
  Account,
  Assignment,
  Booking,
  Classroom,
  Lesson,
  Submission,
} from '../shared/portal.ts'
import { listAccounts, transaction, type Database } from './db.ts'
import { all, get, put } from './domain-store.ts'
import {
  emailConfigurationReady,
  validEmailAddress,
  type EmailConfiguration,
} from './email-config.ts'
import {
  createResendTransport,
  EmailDeliveryError,
  type EmailMessage,
  type EmailTransport,
} from './email-transport.ts'

export type EmailKind =
  | 'booking.confirmed'
  | 'booking.cancelled'
  | 'lesson.changed'
  | 'lesson.reminder'
  | 'assignment.reminder'
export type EmailStatus = 'scheduled' | 'pending' | 'failed' | 'sent' | 'cancelled'
export interface EmailJob {
  id: string
  kind: EmailKind
  recipientId: string
  classId: string
  entityId: string
  fingerprint: string
  status: EmailStatus
  scheduledAt: string
  expiresAt: string
  attempts: number
  nextAttemptAt: string | null
  firstAttemptAt: string | null
  claimToken: string | null
  leaseUntil: string | null
  message: EmailMessage | null
  providerMessageId: string | null
  errorCode: string | null
  retryable: boolean
  createdAt: string
  updatedAt: string
}

interface EmailCursor {
  id: 'current'
  initializedAt: string
  bookings: Record<string, Booking['status']>
  lessons: Record<string, string>
}
interface EmailData {
  users: Account[]
  classes: Classroom[]
  assignments: Assignment[]
  lessons: Lesson[]
  bookings: Booking[]
  submissions: Submission[]
}
interface Context {
  recipient: Account
  room: Classroom
  lesson?: Lesson
  assignment?: Assignment
}
const HOUR = 3_600_000
const MAX_ATTEMPTS = 3
const RETRY_WINDOW = 23 * HOUR // Resend keeps idempotency keys for 24 hours.
const stamp = (now: string): number => {
  const result = Date.parse(now)
  if (!Number.isFinite(result)) throw new Error('Email worker needs an ISO timestamp.')
  return result
}
const futureDate = (value: string, now: string): boolean =>
  Boolean(value) && Number.isFinite(Date.parse(value)) && Date.parse(value) > stamp(now)
const digest = (value: unknown): string =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex')
const lessonFingerprint = (lesson: Lesson): string =>
  digest([
    lesson.id,
    lesson.classId,
    lesson.title,
    lesson.startsAt,
    lesson.endsAt,
    lesson.hostId,
    lesson.kind,
    lesson.cancelled,
  ])
const assignmentFingerprint = (task: Assignment): string =>
  digest([task.id, task.classId, task.version, task.dueAt, task.published])
const bookingFingerprint = (booking: Booking, lesson: Lesson): string =>
  digest([booking.id, booking.status, lessonFingerprint(lesson)])
const reminderFingerprint = (data: EmailData, lesson: Lesson, studentId: string): string =>
  lesson.kind === 'class'
    ? lessonFingerprint(lesson)
    : digest([
        lessonFingerprint(lesson),
        data.bookings.find(
          (item) =>
            item.lessonId === lesson.id && item.studentId === studentId && item.status === 'booked',
        )?.id,
      ])
const dataFrom = (db: Database): EmailData => ({
  users: listAccounts(db),
  classes: all(db, 'class'),
  assignments: all(db, 'assignment'),
  lessons: all(db, 'lesson'),
  bookings: all(db, 'booking'),
  submissions: all(db, 'submission'),
})
const atomic = <T>(db: Database, work: () => T): T =>
  db.isTransaction ? work() : transaction(db, work)
const currentContext = (data: EmailData, job: EmailJob, now: string): Context | undefined => {
  if (stamp(job.expiresAt) <= stamp(now)) return
  const recipient = data.users.find(
    (user) => user.id === job.recipientId && user.active && user.role === 'student',
  )
  const room = data.classes.find(
    (item) => item.id === job.classId && item.active && item.studentIds.includes(job.recipientId),
  )
  if (!recipient || !validEmailAddress(recipient.email) || !room) return
  if (job.kind === 'assignment.reminder') {
    const assignment = data.assignments.find((item) => item.id === job.entityId)
    if (
      !assignment ||
      assignment.classId !== room.id ||
      !assignment.published ||
      (assignment as Assignment & { archived?: boolean }).archived ||
      assignmentFingerprint(assignment) !== job.fingerprint ||
      !futureDate(assignment.dueAt, now) ||
      data.submissions.some(
        (item) =>
          item.assignmentId === assignment.id &&
          item.studentId === recipient.id &&
          item.assignmentVersion === assignment.version,
      )
    )
      return
    return { recipient, room, assignment }
  }
  const booking = job.kind.startsWith('booking.')
    ? data.bookings.find((item) => item.id === job.entityId)
    : undefined
  const lesson = data.lessons.find((item) => item.id === (booking?.lessonId ?? job.entityId))
  if (!lesson || lesson.classId !== room.id) return
  if (booking) {
    if (
      booking.studentId !== recipient.id ||
      lesson.kind !== 'consultation' ||
      bookingFingerprint(booking, lesson) !== job.fingerprint ||
      booking.status !== (job.kind === 'booking.confirmed' ? 'booked' : 'cancelled')
    )
      return
  } else if (
    job.kind.startsWith('booking.') ||
    (job.kind === 'lesson.reminder'
      ? reminderFingerprint(data, lesson, recipient.id)
      : lessonFingerprint(lesson)) !== job.fingerprint
  )
    return
  if (job.kind !== 'booking.cancelled' && !(job.kind === 'lesson.changed' && lesson.cancelled)) {
    const host = data.users.find(
      (user) => user.id === lesson.hostId && user.active && user.role === 'teacher',
    )
    if (lesson.cancelled || !host || !room.teacherIds.includes(host.id)) return
  }
  if (
    lesson.kind === 'consultation' &&
    !booking &&
    !data.bookings.some(
      (item) =>
        item.lessonId === lesson.id && item.studentId === recipient.id && item.status === 'booked',
    )
  )
    return
  return { recipient, room, lesson }
}

/** Runs inside the caller's transaction when present, otherwise commits queue/cursor together. */
export function reconcileEmailQueue(
  db: Database,
  config: EmailConfiguration,
  now = new Date().toISOString(),
): void {
  stamp(now)
  atomic(db, () => {
    const data = dataFrom(db)
    const previous = get<EmailCursor>(db, 'emailCursor', 'current')
    const cursor: EmailCursor = {
      id: 'current',
      initializedAt: previous?.initializedAt ?? now,
      bookings: Object.fromEntries(data.bookings.map((item) => [item.id, item.status])),
      lessons: Object.fromEntries(data.lessons.map((item) => [item.id, lessonFingerprint(item)])),
    }
    const queue = (
      kind: EmailKind,
      recipientId: string,
      room: Classroom,
      entityId: string,
      fingerprint: string,
      scheduledAt: string,
      expiresAt: string,
    ) => {
      const id = digest([kind, recipientId, entityId, fingerprint])
      const existing = get<EmailJob>(db, 'emailJob', id)
      // Unattempted future reminders may regain eligibility or adopt new lead-time settings.
      // An attempted payload is never reset or silently resent with a new identity.
      if (
        existing &&
        (!kind.endsWith('.reminder') ||
          existing.attempts > 0 ||
          !['scheduled', 'cancelled'].includes(existing.status))
      )
        return
      const job: EmailJob = {
        id,
        kind,
        recipientId,
        classId: room.id,
        entityId,
        fingerprint,
        status: 'scheduled',
        scheduledAt,
        expiresAt,
        attempts: 0,
        nextAttemptAt: scheduledAt,
        firstAttemptAt: null,
        claimToken: null,
        leaseUntil: null,
        message: null,
        providerMessageId: null,
        errorCode: null,
        retryable: true,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      }
      if (currentContext(data, job, now)) {
        if (
          existing?.status === 'scheduled' &&
          existing.scheduledAt === scheduledAt &&
          existing.expiresAt === expiresAt
        )
          return
        put(db, 'emailJob', job)
      }
    }
    for (const room of data.classes.filter((item) => item.active)) {
      for (const task of data.assignments.filter(
        (item) => item.classId === room.id && item.published && futureDate(item.dueAt, now),
      )) {
        for (const studentId of room.studentIds)
          queue(
            'assignment.reminder',
            studentId,
            room,
            task.id,
            assignmentFingerprint(task),
            new Date(stamp(task.dueAt) - config.assignmentLeadHours * HOUR).toISOString(),
            task.dueAt,
          )
      }
      for (const lesson of data.lessons.filter(
        (item) => item.classId === room.id && stamp(item.startsAt) > stamp(now),
      )) {
        const fingerprint = lessonFingerprint(lesson)
        const recipients =
          lesson.kind === 'class'
            ? room.studentIds
            : data.bookings
                .filter((item) => item.lessonId === lesson.id && item.status === 'booked')
                .map((item) => item.studentId)
        for (const studentId of recipients) {
          if (!lesson.cancelled)
            queue(
              'lesson.reminder',
              studentId,
              room,
              lesson.id,
              reminderFingerprint(data, lesson, studentId),
              new Date(stamp(lesson.startsAt) - config.lessonLeadHours * HOUR).toISOString(),
              lesson.startsAt,
            )
          if (previous?.lessons[lesson.id] && previous.lessons[lesson.id] !== fingerprint)
            queue(
              'lesson.changed',
              studentId,
              room,
              lesson.id,
              fingerprint,
              now,
              new Date(Math.min(stamp(lesson.startsAt), stamp(now) + 24 * HOUR)).toISOString(),
            )
        }
      }
    }
    if (previous)
      for (const booking of data.bookings) {
        if (previous.bookings[booking.id] === booking.status) continue
        // Unknown old records restored from a backup must not create retrospective notices.
        if (
          !previous.bookings[booking.id] &&
          stamp(booking.createdAt) < stamp(previous.initializedAt)
        )
          continue
        const lesson = data.lessons.find(
          (item) => item.id === booking.lessonId && stamp(item.startsAt) > stamp(now),
        )
        const room = data.classes.find((item) => item.id === lesson?.classId)
        if (lesson && room)
          queue(
            booking.status === 'booked' ? 'booking.confirmed' : 'booking.cancelled',
            booking.studentId,
            room,
            booking.id,
            bookingFingerprint(booking, lesson),
            now,
            new Date(Math.min(stamp(lesson.startsAt), stamp(now) + 24 * HOUR)).toISOString(),
          )
      }
    for (const job of all<EmailJob>(db, 'emailJob')) {
      if (job.status === 'sent' || job.status === 'cancelled') continue
      // A request already in flight cannot be unsent. Preserve its acceptance result.
      if (job.status === 'pending' && job.leaseUntil && stamp(job.leaseUntil) > stamp(now)) continue
      if (
        !currentContext(data, job, now) ||
        (job.message &&
          data.users.find((user) => user.id === job.recipientId)?.email !== job.message.to)
      ) {
        put(db, 'emailJob', {
          ...job,
          status: 'cancelled',
          errorCode: 'no_longer_eligible',
          retryable: false,
          nextAttemptAt: null,
          claimToken: null,
          leaseUntil: null,
          updatedAt: now,
        })
      }
    }
    put(db, 'emailCursor', cursor)
  })
}

function renderMessage(job: EmailJob, context: Context, config: EmailConfiguration): EmailMessage {
  const vi = config.locale === 'vi'
  const date = context.assignment?.dueAt ?? context.lesson!.startsAt
  const when = new Intl.DateTimeFormat(vi ? 'vi-VN' : 'en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: config.timeZone,
  }).format(new Date(date))
  const subjects: Record<EmailKind, [string, string]> = {
    'booking.confirmed': ['Đã xác nhận lịch tư vấn 1:1', 'Your 1:1 review is booked'],
    'booking.cancelled': ['Đã hủy lịch tư vấn 1:1', 'Your 1:1 review was cancelled'],
    'lesson.changed': [
      context.lesson?.cancelled ? 'Buổi học đã được hủy' : 'Lịch học đã thay đổi',
      context.lesson?.cancelled ? 'A lesson was cancelled' : 'Your lesson schedule changed',
    ],
    'lesson.reminder': ['Nhắc lịch học sắp tới', 'Your upcoming lesson'],
    'assignment.reminder': ['Nhắc hạn nộp bài', 'Your assignment deadline'],
  }
  const subject = subjects[job.kind][vi ? 0 : 1]
  const url = `${config.portalOrigin}/learn#${job.kind === 'assignment.reminder' ? 'assignments' : 'schedule'}`
  // Deliberately omit arbitrary titles, names and all private link/answer content.
  const body = vi
    ? `${subject}.\n\nThời gian: ${when} (${config.timeZone}).\nMở cổng học tập để xem chi tiết, yêu cầu chuẩn bị và điều kiện tham gia hiện tại:\n${url}\n\nEmail không chứa đường dẫn Zoom. Lịch và quyền truy cập có thể thay đổi; thông tin trong cổng học tập là thông tin hiện tại.`
    : `${subject}.\n\nTime: ${when} (${config.timeZone}).\nOpen the learning portal for details, preparation requirements and current joining eligibility:\n${url}\n\nThis email contains no Zoom link. Schedules and access may change; the portal shows the current information.`
  return { from: config.from, to: context.recipient.email, subject, text: body }
}

function claimJob(
  db: Database,
  config: EmailConfiguration,
  id: string,
  now: string,
): EmailJob | undefined {
  return atomic(db, () => {
    const job = get<EmailJob>(db, 'emailJob', id)
    if (
      !job ||
      job.status === 'sent' ||
      job.status === 'cancelled' ||
      (job.status === 'failed' && !job.retryable) ||
      (job.status === 'pending' && job.leaseUntil && stamp(job.leaseUntil) > stamp(now)) ||
      (job.nextAttemptAt && stamp(job.nextAttemptAt) > stamp(now))
    )
      return
    const context = currentContext(dataFrom(db), job, now)
    if (!context || (job.message && context.recipient.email !== job.message.to)) {
      put(db, 'emailJob', {
        ...job,
        status: 'cancelled',
        retryable: false,
        nextAttemptAt: null,
        errorCode: 'no_longer_eligible',
        updatedAt: now,
      })
      return
    }
    if (
      job.attempts >= MAX_ATTEMPTS ||
      (job.firstAttemptAt && stamp(now) - stamp(job.firstAttemptAt) >= RETRY_WINDOW)
    ) {
      put(db, 'emailJob', {
        ...job,
        status: 'failed',
        retryable: false,
        nextAttemptAt: null,
        errorCode: 'manual_reconciliation_required',
        claimToken: null,
        leaseUntil: null,
        updatedAt: now,
      })
      return
    }
    const claimed: EmailJob = {
      ...job,
      status: 'pending',
      attempts: job.attempts + 1,
      message: job.message ?? renderMessage(job, context, config),
      firstAttemptAt: job.firstAttemptAt ?? now,
      claimToken: randomUUID(),
      leaseUntil: new Date(stamp(now) + 60_000).toISOString(),
      nextAttemptAt: null,
      updatedAt: now,
    }
    put(db, 'emailJob', claimed)
    return claimed
  })
}

/** One bounded batch. Disabled configuration never constructs a transport or dispatches. */
export async function processEmailQueue(
  db: Database,
  config: EmailConfiguration,
  transport?: EmailTransport,
  now?: string,
): Promise<void> {
  if (!config.enabled) return
  if (!emailConfigurationReady(config))
    throw new Error('Enabled email configuration is incomplete.')
  const sender = transport ?? createResendTransport(config)
  const clock = () => now ?? new Date().toISOString()
  reconcileEmailQueue(db, config, clock())
  const ids = all<EmailJob>(db, 'emailJob')
    .filter(
      (item) =>
        item.status === 'scheduled' ||
        item.status === 'pending' ||
        (item.status === 'failed' && item.retryable),
    )
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
    .map((item) => item.id)
  let processed = 0
  for (const id of ids) {
    const job = claimJob(db, config, id, clock())
    if (!job) continue
    try {
      const result = await sender.send(job.message!, `portal-email-${job.id}`)
      if (!result.id || !/^[\w-]{1,150}$/.test(result.id))
        throw new EmailDeliveryError('provider_result_uncertain', true)
      atomic(db, () => {
        const current = get<EmailJob>(db, 'emailJob', id)
        if (current?.status === 'pending' && current.claimToken === job.claimToken)
          put(db, 'emailJob', {
            ...current,
            status: 'sent',
            providerMessageId: result.id,
            errorCode: null,
            retryable: false,
            leaseUntil: null,
            claimToken: null,
            updatedAt: clock(),
          })
      })
    } catch (error) {
      atomic(db, () => {
        const current = get<EmailJob>(db, 'emailJob', id)
        if (current?.status !== 'pending' || current.claimToken !== job.claimToken) return
        const failedAt = clock()
        const retryable = error instanceof EmailDeliveryError ? error.retryable : true
        const retryAt = stamp(failedAt) + (job.attempts === 1 ? 5 : 15) * 60_000
        const canRetry =
          retryable &&
          job.attempts < MAX_ATTEMPTS &&
          retryAt < stamp(job.expiresAt) &&
          retryAt - stamp(job.firstAttemptAt!) < RETRY_WINDOW
        put(db, 'emailJob', {
          ...current,
          status: 'failed',
          errorCode: error instanceof EmailDeliveryError ? error.code : 'provider_unavailable',
          retryable: canRetry,
          nextAttemptAt: canRetry ? new Date(retryAt).toISOString() : null,
          leaseUntil: null,
          claimToken: null,
          updatedAt: failedAt,
        })
      })
    }
    processed += 1
    if (processed >= 25) break
  }
}

export function retryEmailJob(db: Database, id: string, now = new Date().toISOString()): void {
  atomic(db, () => {
    const job = get<EmailJob>(db, 'emailJob', id)
    if (
      !job ||
      job.status !== 'failed' ||
      !job.retryable ||
      job.attempts >= MAX_ATTEMPTS ||
      (job.firstAttemptAt && stamp(now) - stamp(job.firstAttemptAt) >= RETRY_WINDOW) ||
      !currentContext(dataFrom(db), job, now)
    )
      throw new Error(
        'This email job is not eligible for retry; inspect its outcome before any new message.',
      )
    put(db, 'emailJob', { ...job, nextAttemptAt: now, updatedAt: now })
  })
}

export function emailQueueSummary(db: Database, config: EmailConfiguration) {
  const counts: Record<EmailStatus, number> = {
    scheduled: 0,
    pending: 0,
    failed: 0,
    sent: 0,
    cancelled: 0,
  }
  let nextDueAt: string | null = null
  for (const job of all<EmailJob>(db, 'emailJob')) {
    counts[job.status] += 1
    if (
      (job.status === 'scheduled' || (job.status === 'failed' && job.retryable)) &&
      job.nextAttemptAt &&
      (!nextDueAt || job.nextAttemptAt < nextDueAt)
    )
      nextDueAt = job.nextAttemptAt
  }
  const configured = emailConfigurationReady(config)
  return {
    enabled: config.enabled,
    provider: config.provider,
    configured,
    initialized: Boolean(get<EmailCursor>(db, 'emailCursor', 'current')),
    delivery: !config.enabled
      ? ('disabled' as const)
      : configured
        ? ('ready' as const)
        : ('unconfigured' as const),
    counts,
    nextDueAt,
  }
}
