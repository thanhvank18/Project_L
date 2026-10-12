import type {
  Account,
  Booking,
  Classroom,
  ConsultationOutcome,
  Lesson,
  MainReviewPreparation,
} from '../shared/portal.ts'
import {
  accounts,
  all,
  authenticated,
  classroom,
  enumValue,
  fail,
  get,
  id,
  integer,
  now,
  put,
  role,
  str,
  visibleClass,
  type Database,
  type Payload,
} from './domain-store.ts'

const outcomeKind = 'consultationOutcome'

function mainSequence(lessons: Lesson[], classId: string): Lesson[] {
  return lessons
    .filter((lesson) => lesson.classId === classId && lesson.kind === 'class' && !lesson.cancelled)
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt) || a.id.localeCompare(b.id))
}

/** Always resolve against the current schedule, not a client-selected previous lesson. */
type ReviewLesson = Pick<
  Lesson,
  'id' | 'classId' | 'kind' | 'cancelled' | 'startsAt' | 'endsAt' | 'reviewForLessonId'
>
function reviewRelationship(lessons: Lesson[], consultation: ReviewLesson) {
  const sequence = mainSequence(lessons, consultation.classId)
  const targetIndex = sequence.findIndex((lesson) => lesson.id === consultation.reviewForLessonId)
  const target = sequence[targetIndex]
  const previous = sequence[targetIndex - 1]
  if (
    consultation.kind !== 'consultation' ||
    consultation.cancelled ||
    !target ||
    !previous ||
    Date.parse(consultation.startsAt) < Date.parse(previous.endsAt) ||
    Date.parse(consultation.endsAt) > Date.parse(target.startsAt)
  )
    return undefined
  return { target, previous }
}

/** Legacy unlinked consultations remain available, but can never unlock a main lesson. */
export function assertReviewRelationship(db: Database, consultation: ReviewLesson): void {
  if (
    consultation.reviewForLessonId &&
    !reviewRelationship(all<Lesson>(db, 'lesson'), consultation)
  )
    fail(
      409,
      'review_schedule_changed',
      'A linked review must be in the same class, after the previous main lesson and before the selected next main lesson. The first main lesson needs no review.',
    )
}

type ReviewContext = {
  lessons: Lesson[]
  bookings: Booking[]
  outcomes: ConsultationOutcome[]
  activeTeachers: Set<string>
}
function reviewContext(db: Database): ReviewContext {
  return {
    lessons: all<Lesson>(db, 'lesson'),
    bookings: all<Booking>(db, 'booking'),
    outcomes: all<ConsultationOutcome>(db, outcomeKind),
    activeTeachers: new Set(
      accounts(db)
        .filter((user) => user.active && user.role === 'teacher')
        .map((user) => user.id),
    ),
  }
}

function reviewPreparation(
  context: ReviewContext,
  room: Classroom,
  lesson: Pick<Lesson, 'id' | 'classId'>,
  studentId: string,
): MainReviewPreparation {
  const sequence = mainSequence(context.lessons, room.id)
  const previous = sequence[sequence.findIndex((item) => item.id === lesson.id) - 1]
  const base: MainReviewPreparation = {
    lessonId: lesson.id,
    classId: room.id,
    studentId,
    previousLessonId: previous?.id,
    status: previous ? 'required' : 'exempt',
  }
  if (!previous) return base
  const candidates = context.lessons.filter(
    (item) =>
      item.reviewForLessonId === lesson.id &&
      item.classId === room.id &&
      item.capacity === 1 &&
      room.teacherIds.includes(item.hostId) &&
      context.activeTeachers.has(item.hostId) &&
      reviewRelationship(context.lessons, item)?.previous.id === previous.id,
  )
  const statuses: MainReviewPreparation[] = []
  for (const consultation of candidates) {
    const booking = context.bookings.find(
      (item) =>
        item.lessonId === consultation.id &&
        item.studentId === studentId &&
        item.status === 'booked',
    )
    if (!booking) continue
    const outcome = context.outcomes.find((item) => item.bookingId === booking.id)
    if (
      outcome &&
      (outcome.lessonId !== consultation.id ||
        outcome.studentId !== studentId ||
        outcome.classId !== room.id ||
        outcome.teacherId !== consultation.hostId ||
        outcome.reviewForLessonId !== lesson.id ||
        outcome.reviewedLessonId !== previous.id)
    )
      continue
    statuses.push({
      ...base,
      consultationId: consultation.id,
      bookingId: booking.id,
      status:
        outcome?.status ??
        (Date.parse(consultation.startsAt) <= Date.now() ? 'awaiting_confirmation' : 'booked'),
    })
  }
  // A replacement booking is more actionable than an earlier no-show; any valid completion wins.
  const priority = ['completed', 'booked', 'awaiting_confirmation', 'no_show']
  return statuses.sort((a, b) => priority.indexOf(a.status) - priority.indexOf(b.status))[0] ?? base
}

export function mainReviewPreparation(
  db: Database,
  suppliedActor: Account,
): MainReviewPreparation[] {
  const actor = authenticated(db, suppliedActor)
  const context = reviewContext(db)
  const activeStudents = new Set(
    accounts(db)
      .filter((user) => user.active && user.role === 'student')
      .map((user) => user.id),
  )
  return all<Classroom>(db, 'class')
    .filter((room) => room.active && visibleClass(actor, room))
    .flatMap((room) => {
      const students = room.studentIds.filter(
        (studentId) =>
          activeStudents.has(studentId) && (actor.role !== 'student' || studentId === actor.id),
      )
      return mainSequence(context.lessons, room.id).flatMap((lesson) =>
        students.map((studentId) => reviewPreparation(context, room, lesson, studentId)),
      )
    })
}

export function assertMainReviewCompleted(
  db: Database,
  actor: Account,
  lesson: Pick<Lesson, 'id' | 'classId' | 'kind'>,
): void {
  if (actor.role !== 'student' || lesson.kind !== 'class') return
  const room = classroom(db, actor, lesson.classId)
  const status = reviewPreparation(reviewContext(db), room, lesson, actor.id).status
  if (status !== 'exempt' && status !== 'completed')
    fail(
      403,
      'review_required',
      'Complete the linked 1:1 review of the previous main lesson and obtain its assigned teacher’s confirmation before joining this main lesson.',
    )
}

export function consultationOutcomes(db: Database, suppliedActor: Account): ConsultationOutcome[] {
  const actor = authenticated(db, suppliedActor)
  if (actor.role === 'assistant') return []
  return all<ConsultationOutcome>(db, outcomeKind).filter((outcome) => {
    const room = get<Classroom>(db, 'class', outcome.classId)
    return (
      room &&
      visibleClass(actor, room) &&
      (actor.role !== 'student' || outcome.studentId === actor.id)
    )
  })
}

/** Called within the resource-command transaction; clients cannot choose outcome identity or authorship. */
export function saveConsultationOutcome(db: Database, suppliedActor: Account, p: Payload): string {
  const actor = authenticated(db, suppliedActor)
  role(actor, ['teacher'])
  const allowed = [
    'bookingId',
    'expectedVersion',
    'expectedLessonVersion',
    'expectedBookingVersion',
    'expectedReviewForLessonId',
    'expectedReviewForLessonVersion',
    'expectedReviewedLessonId',
    'expectedReviewedLessonVersion',
    'status',
    'feedback',
  ]
  if (Object.keys(p).some((key) => !allowed.includes(key)))
    fail(400, 'invalid_payload', 'This outcome contains unsupported fields.')
  const bookingId = str(p, 'bookingId', 150)
  const booking = get<Booking>(db, 'booking', bookingId)
  if (!booking) fail(404, 'not_found', 'The reservation is unavailable.')
  const lesson = get<Lesson>(db, 'lesson', booking!.lessonId)
  if (!lesson) fail(404, 'not_found', 'The consultation is unavailable.')
  const room = classroom(db, actor, lesson!.classId, true)
  if (lesson!.hostId !== actor.id)
    fail(403, 'host_required', 'Only the assigned host teacher can confirm this consultation.')
  if (lesson!.kind !== 'consultation' || lesson!.cancelled || booking!.status !== 'booked')
    fail(
      409,
      'consultation_unavailable',
      'Confirm only an active reservation for a consultation that has not been cancelled.',
    )
  if (Date.parse(lesson!.startsAt) > Date.now())
    fail(409, 'consultation_not_started', 'The consultation has not started yet.')
  assertReviewRelationship(db, lesson!)
  const relationship = lesson!.reviewForLessonId
    ? reviewRelationship(all<Lesson>(db, 'lesson'), lesson!)
    : undefined
  if (
    relationship &&
    (p.expectedReviewForLessonId !== relationship.target.id ||
      p.expectedReviewForLessonVersion !== relationship.target.version ||
      p.expectedReviewedLessonId !== relationship.previous.id ||
      p.expectedReviewedLessonVersion !== relationship.previous.version)
  )
    fail(
      409,
      'review_schedule_changed',
      'The main lesson or previous lesson changed. Check the current review relationship before confirming; your feedback has not been saved.',
    )
  if (
    !room.studentIds.includes(booking!.studentId) ||
    !accounts(db).some(
      (user) => user.id === booking!.studentId && user.role === 'student' && user.active,
    )
  )
    fail(409, 'student_unavailable', 'The student is no longer active in this class.')
  const previous = get<ConsultationOutcome>(db, outcomeKind, bookingId)
  if (
    previous &&
    (previous.reviewForLessonId !== relationship?.target.id ||
      previous.reviewedLessonId !== relationship?.previous.id)
  )
    fail(
      409,
      'review_schedule_changed',
      'The main lesson sequence changed after confirmation. This review cannot be reused for a different lesson.',
    )
  const expected = integer(p, 'expectedVersion')
  if (
    (previous?.version ?? 0) !== expected ||
    integer(p, 'expectedLessonVersion', 1) !== lesson!.version ||
    integer(p, 'expectedBookingVersion', 1) !== booking!.version
  )
    fail(
      409,
      'conflict',
      'The consultation, reservation or outcome changed. Refresh and check the current record before saving.',
    )
  const timestamp = now()
  const outcome: ConsultationOutcome = {
    id: bookingId,
    bookingId,
    lessonId: lesson!.id,
    studentId: booking!.studentId,
    classId: room.id,
    status: enumValue(p, 'status', ['completed', 'no_show']),
    feedback: str(p, 'feedback', 5000, true).trim(),
    teacherId: actor.id,
    completedAt: previous?.completedAt ?? timestamp,
    updatedAt: timestamp,
    version: expected + 1,
    reviewForLessonId: relationship?.target.id,
    reviewedLessonId: relationship?.previous.id,
  }
  put(db, outcomeKind, outcome)
  // Retain every correction for audit without exposing historical feedback through general state.
  put(db, 'consultationOutcomeRevision', { ...outcome, id: `${bookingId}:${outcome.version}` })
  put(db, 'notification', {
    id: id(),
    recipientId: outcome.studentId,
    title: '1:1 review outcome / Kết quả buổi review 1:1',
    body: `${lesson!.title} · ${outcome.status === 'completed' ? 'Completed / Đã hoàn thành' : 'Did not attend / Không tham dự'}`,
    createdAt: timestamp,
    read: false,
  })
  return bookingId
}

export function assertBookingNotFinalized(db: Database, bookingId: string): void {
  if (get<ConsultationOutcome>(db, outcomeKind, bookingId))
    fail(
      409,
      'consultation_finalized',
      'This reservation has a confirmed outcome and cannot be cancelled.',
    )
}

type OutcomeLesson = Pick<
  Lesson,
  | 'id'
  | 'classId'
  | 'startsAt'
  | 'endsAt'
  | 'kind'
  | 'hostId'
  | 'capacity'
  | 'cancelled'
  | 'reviewForLessonId'
>
export function assertFinalizedLessonUnchanged(
  db: Database,
  previous: OutcomeLesson | undefined,
  next: OutcomeLesson,
): void {
  if (
    !previous ||
    !all<ConsultationOutcome>(db, outcomeKind).some((outcome) => outcome.lessonId === previous.id)
  )
    return
  const fields = [
    'classId',
    'startsAt',
    'endsAt',
    'kind',
    'hostId',
    'capacity',
    'cancelled',
    'reviewForLessonId',
  ] as const
  if (fields.some((key) => previous[key] !== next[key]))
    fail(
      409,
      'consultation_finalized',
      'A consultation with a confirmed outcome cannot be rescheduled, cancelled or reassigned. Correct its outcome instead.',
    )
}
