import assert from 'node:assert/strict'
import test, { type TestContext } from 'node:test'
import type { Account, Booking, Classroom, Lesson, Role } from '../shared/portal.ts'
import { getAccount, openDatabase, type Database } from './db.ts'
import { getPortalState, runAction } from './domain.ts'
import { all, get, put } from './domain-store.ts'
import { HttpError } from './errors.ts'

const start = Date.UTC(2030, 0, 1)
const day = 86400000
const at = (days: number) => new Date(start + days * day).toISOString()
const code = (expected: string) => (error: unknown) =>
  error instanceof HttpError && error.code === expected
const action = (db: Database, actor: Account, type: string, payload: Record<string, unknown>) =>
  runAction(db, actor, { type, payload })
function account(db: Database, id: string, role: Role): Account {
  db.prepare(
    'INSERT INTO users(id,name,email,role,active,version,created_at,password_hash) VALUES(?,?,?,?,1,1,?,?)',
  ).run(id, id, `${id}@example.test`, role, at(0), 'unused-test-password')
  return getAccount(db, id)!
}
function setup(t: TestContext) {
  t.mock.timers.enable({ apis: ['Date'], now: start })
  const db = openDatabase(':memory:')
  t.after(() => db.close())
  const admin = account(db, 'admin', 'admin')
  const teacher = account(db, 'teacher', 'teacher')
  const reviewer = account(db, 'reviewer', 'teacher')
  const assistant = account(db, 'assistant', 'assistant')
  const student = account(db, 'student', 'student')
  const other = account(db, 'other', 'student')
  const outsider = account(db, 'outsider', 'student')
  const makeRoom = (title: string) =>
    action(db, admin, 'class.save', {
      title,
      level: 'B1',
      description: '',
      teacherIds: [teacher.id, reviewer.id],
      assistantIds: [assistant.id],
      studentIds: [student.id, other.id],
      active: true,
      listed: false,
      expectedVersion: 0,
    }).state.classes.find((room) => room.title === title)!
  const room = makeRoom('Current class')
  const foreignRoom = makeRoom('Separate class')
  const createLesson = (days: number, overrides: Record<string, unknown> = {}) => {
    const result = action(db, teacher, 'lesson.save', {
      classId: room.id,
      title: `Lesson ${days}`,
      startsAt: at(days),
      endsAt: at(days + 0.04),
      kind: 'class',
      capacity: 20,
      hostId: teacher.id,
      cancelled: false,
      expectedVersion: 0,
      meetingSource: 'lesson',
      meetingUrl: 'https://zoom.us/j/123456789?pwd=private-review-gate',
      ...overrides,
    })
    return result.state.lessons.find((lesson) => lesson.id === result.result!.id)!
  }
  const first = createLesson(1)
  const next = createLesson(3)
  const third = createLesson(5)
  const consultation = createLesson(2, {
    kind: 'consultation',
    hostId: reviewer.id,
    capacity: 1,
    reviewForLessonId: next.id,
  })
  const book = (actor = student, lesson = consultation) => {
    const result = action(db, actor, 'booking.create', {
      lessonId: lesson.id,
      expectedVersion: lesson.version,
    })
    return result.state.bookings.find((booking) => booking.id === result.result!.id)!
  }
  const snapshot = (lessonId = consultation.id) => {
    const current = get<Lesson>(db, 'lesson', lessonId)!
    const target = current.reviewForLessonId
      ? get<Lesson>(db, 'lesson', current.reviewForLessonId)
      : undefined
    const sequence = all<Lesson>(db, 'lesson')
      .filter(
        (item) => item.classId === current.classId && item.kind === 'class' && !item.cancelled,
      )
      .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt) || a.id.localeCompare(b.id))
    const previous = sequence[sequence.findIndex((item) => item.id === target?.id) - 1]
    return {
      expectedReviewForLessonId: target?.id ?? '',
      expectedReviewForLessonVersion: target?.version ?? 0,
      expectedReviewedLessonId: previous?.id ?? '',
      expectedReviewedLessonVersion: previous?.version ?? 0,
    }
  }
  const confirm = (
    booking: Booking,
    status = 'completed',
    expectedVersion = 0,
    actor = reviewer,
    overrides: Record<string, unknown> = {},
  ) =>
    action(db, actor, 'consultation.outcome.save', {
      bookingId: booking.id,
      status,
      feedback: 'PRIVATE learner review feedback',
      expectedVersion,
      expectedLessonVersion: get<Lesson>(db, 'lesson', booking.lessonId)!.version,
      expectedBookingVersion: booking.version,
      ...snapshot(booking.lessonId),
      ...overrides,
    })
  const join = (lesson = next, actor = student) =>
    action(db, actor, 'lesson.join', { id: lesson.id })
  const preparation = (lesson = next, actor = student) =>
    getPortalState(db, actor).mainReviewPreparation!.find(
      (item) => item.lessonId === lesson.id && item.studentId === student.id,
    )
  const edit = (lesson: Lesson, overrides: Record<string, unknown>) =>
    action(db, teacher, 'lesson.save', {
      ...get<Lesson>(db, 'lesson', lesson.id),
      expectedVersion: get<Lesson>(db, 'lesson', lesson.id)!.version,
      ...overrides,
    })
  return {
    db,
    admin,
    teacher,
    reviewer,
    assistant,
    student,
    other,
    outsider,
    room,
    foreignRoom,
    first,
    next,
    third,
    consultation,
    createLesson,
    book,
    confirm,
    snapshot,
    join,
    preparation,
    edit,
  }
}

test('first active main is exempt; subsequent main blocks without a confirmed linked review and never returns Zoom', (t) => {
  const f = setup(t)
  action(f.db, f.teacher, 'assignment.save', {
    classId: f.room.id,
    title: { vi: 'Bài tập', en: 'Task' },
    instructions: { vi: 'Làm bài', en: 'Prepare' },
    skill: 'writing',
    dueAt: '',
    published: true,
    required: true,
    attachmentIds: [],
    expectedVersion: 0,
  })
  assert.equal(f.preparation(f.first)?.status, 'exempt')
  assert.match(String(f.join(f.first).result?.url), /private-review-gate/)
  assert.equal(f.preparation()?.status, 'required')
  assert.throws(
    () => f.join(),
    (error: unknown) =>
      error instanceof HttpError &&
      error.status === 403 &&
      error.code === 'review_required' &&
      !error.message.includes('private-review-gate'),
  )
  for (const actor of [f.admin, f.teacher, f.assistant])
    assert.ok(f.join(f.next, actor).result?.url)
  const booking = f.book()
  assert.equal(f.preparation()?.status, 'booked')
  assert.throws(() => f.join(), code('review_required'))
  t.mock.timers.setTime(start + 2.05 * day)
  assert.equal(f.preparation()?.status, 'awaiting_confirmation')
  assert.throws(() => f.join(f.consultation), code('preparation_required'))
  f.confirm(booking)
  // Main-class homework remains separate from the new review gate.
  assert.ok(f.join().result?.url)
})

test('only assigned host confirmation unlocks that learner and target; no-show and later correction are enforced', (t) => {
  const f = setup(t)
  const booking = f.book()
  assert.throws(() => f.confirm(booking), code('consultation_not_started'))
  t.mock.timers.setTime(start + 2.05 * day)
  assert.throws(() => f.confirm(booking, 'completed', 0, f.teacher), code('host_required'))
  assert.throws(() => f.confirm(booking, 'completed', 0, f.assistant), code('forbidden'))
  f.confirm(booking, 'no_show')
  assert.equal(f.preparation()?.status, 'no_show')
  assert.throws(() => f.join(), code('review_required'))
  assert.ok(f.join(f.first).result?.url)
  f.confirm(booking, 'completed', 1)
  assert.equal(f.preparation()?.status, 'completed')
  assert.ok(f.join().result?.url)
  assert.throws(() => f.join(f.third), code('review_required'))
  assert.throws(() => f.join(f.next, f.other), code('review_required'))
  assert.throws(() => f.join(f.next, f.outsider), code('not_found'))
  assert.throws(() => f.confirm(booking, 'no_show', 1), code('conflict'))
  f.confirm(booking, 'no_show', 2)
  assert.throws(() => f.join(), code('review_required'))
})

test('review mapping rejects foreign class, first lesson, out-of-window dates and stale consultation edits', (t) => {
  const f = setup(t)
  const foreign = f.createLesson(6, { classId: f.foreignRoom.id })
  for (const changes of [
    { reviewForLessonId: foreign.id },
    { reviewForLessonId: f.first.id },
    { reviewForLessonId: 'missing-main' },
    { startsAt: at(0.5), endsAt: at(0.54) },
    { startsAt: at(3.05), endsAt: at(3.09) },
  ])
    assert.throws(() => f.edit(f.consultation, changes), code('review_schedule_changed'))
  assert.throws(() => f.edit(f.next, { reviewForLessonId: f.third.id }), code('invalid_payload'))
  assert.throws(() => f.edit(f.consultation, { expectedVersion: 99 }), code('conflict'))
  assert.equal(get<Lesson>(f.db, 'lesson', f.consultation.id)?.version, 1)
})

test('legacy unlinked review can be completed but cannot satisfy the explicit main review gate', (t) => {
  const f = setup(t)
  f.edit(f.consultation, { reviewForLessonId: '' })
  const consultation = get<Lesson>(f.db, 'lesson', f.consultation.id)!
  const booking = f.book(f.student, consultation)
  t.mock.timers.setTime(start + 2.05 * day)
  f.confirm(booking)
  assert.equal(f.preparation()?.status, 'required')
  assert.throws(() => f.join(), code('review_required'))
  assert.throws(
    () => f.edit(consultation, { reviewForLessonId: f.next.id }),
    code('consultation_finalized'),
  )
})

test('target rescheduling invalidates review availability and confirmation instead of using a stale schedule', (t) => {
  const f = setup(t)
  const booking = f.book()
  f.edit(f.next, { startsAt: at(1.5), endsAt: at(1.54) })
  assert.equal(f.preparation()?.status, 'required')
  assert.throws(() => f.join(), code('review_required'))
  assert.throws(() => f.join(f.consultation), code('review_schedule_changed'))
  assert.throws(() => f.book(f.other), code('review_schedule_changed'))
  t.mock.timers.setTime(start + 2.05 * day)
  assert.throws(() => f.confirm(booking), code('review_schedule_changed'))
  // Historical display edits remain possible without changing the review relationship.
  f.edit(f.consultation, { title: 'Review awaiting a new main schedule' })
  assert.equal(
    get<Lesson>(f.db, 'lesson', f.consultation.id)?.title,
    'Review awaiting a new main schedule',
  )
})

test('an active reservation prevents silently clearing or changing its review target', (t) => {
  const f = setup(t)
  f.book()
  assert.throws(() => f.edit(f.consultation, { reviewForLessonId: '' }), code('bookings_exist'))
  assert.equal(get<Lesson>(f.db, 'lesson', f.consultation.id)?.reviewForLessonId, f.next.id)
})

test('confirmation rejects stale previous identity and target versions; explicit acknowledgement preserves feedback', (t) => {
  const f = setup(t)
  const booking = f.book()
  t.mock.timers.setTime(start + 2.05 * day)
  const original = f.snapshot()
  const feedback = 'Feedback typed while viewing the original lesson sequence'
  f.edit(f.next, { title: 'Revised target lesson' })
  assert.throws(
    () => f.confirm(booking, 'completed', 0, f.reviewer, { ...original, feedback }),
    code('review_schedule_changed'),
  )
  assert.equal(all(f.db, 'consultationOutcome').length, 0)
  const updatedTarget = f.snapshot()
  const newPrevious = f.createLesson(1.5)
  assert.throws(
    () => f.confirm(booking, 'completed', 0, f.reviewer, { ...updatedTarget, feedback }),
    code('review_schedule_changed'),
  )
  const updatedPrevious = f.snapshot()
  f.edit(newPrevious, { title: 'Revised previous lesson' })
  assert.throws(
    () => f.confirm(booking, 'completed', 0, f.reviewer, { ...updatedPrevious, feedback }),
    code('review_schedule_changed'),
  )
  const saved = f.confirm(booking, 'completed', 0, f.reviewer, { feedback }).state
    .consultationOutcomes[0]!
  assert.equal(saved.reviewedLessonId, newPrevious.id)
  assert.equal(saved.reviewForLessonId, f.next.id)
  assert.equal(saved.feedback, feedback)
  assert.ok(f.join().result?.url)
})

test('completed outcome snapshots its previous lesson; inserting a new predecessor cannot reuse the old review', (t) => {
  const f = setup(t)
  const booking = f.book()
  t.mock.timers.setTime(start + 2.05 * day)
  const saved = f.confirm(booking)
  const outcome = saved.state.consultationOutcomes[0]!
  assert.equal(outcome.reviewForLessonId, f.next.id)
  assert.equal(outcome.reviewedLessonId, f.first.id)
  assert.ok(f.join().result?.url)
  const predecessor = f.createLesson(1.5)
  assert.equal(f.preparation()?.previousLessonId, predecessor.id)
  assert.equal(f.preparation()?.status, 'required')
  assert.throws(() => f.join(), code('review_required'))
  assert.throws(() => f.confirm(booking, 'completed', 1), code('review_schedule_changed'))
  assert.throws(
    () => f.edit(f.consultation, { reviewForLessonId: f.third.id }),
    code('consultation_finalized'),
  )
})

test('completed review is rechecked after target time changes, host access changes and reservation cancellation', (t) => {
  const f = setup(t)
  const booking = f.book()
  t.mock.timers.setTime(start + 2.05 * day)
  f.confirm(booking)
  f.edit(f.next, { startsAt: at(1.5), endsAt: at(1.54) })
  assert.throws(() => f.join(), code('review_required'))
  f.edit(f.next, { startsAt: f.next.startsAt, endsAt: f.next.endsAt })
  assert.ok(f.join().result?.url)
  put(f.db, 'class', { ...f.room, teacherIds: [f.teacher.id] })
  assert.throws(() => f.join(), code('review_required'))
  put(f.db, 'class', f.room)
  f.db.prepare('UPDATE users SET active=0 WHERE id=?').run(f.reviewer.id)
  assert.throws(() => f.join(), code('review_required'))
  f.db.prepare('UPDATE users SET active=1 WHERE id=?').run(f.reviewer.id)
  put(f.db, 'booking', { ...booking, status: 'cancelled', version: 2 })
  assert.throws(() => f.join(), code('review_required'))
})

test('cancelled main is excluded from sequence and revoked membership removes all gate metadata/access', (t) => {
  const f = setup(t)
  f.edit(f.first, { cancelled: true })
  assert.equal(f.preparation()?.status, 'exempt')
  assert.ok(f.join().result?.url)
  assert.throws(() => f.join(f.first), code('unavailable'))
  assert.equal(
    getPortalState(f.db, f.student).mainReviewPreparation!.some(
      (item) => item.lessonId === f.first.id,
    ),
    false,
  )
  put<Classroom>(f.db, 'class', { ...f.room, studentIds: [f.other.id] })
  assert.throws(() => f.join(), code('not_found'))
  assert.equal(
    getPortalState(f.db, f.student).mainReviewPreparation!.some(
      (item) => item.classId === f.room.id,
    ),
    false,
  )
  f.db.prepare('UPDATE users SET active=0 WHERE id=?').run(f.student.id)
  assert.throws(() => f.join(), code('session_invalid'))
})

test('student gate state is personal; assistant receives only preparation metadata with no feedback or meeting URLs', (t) => {
  const f = setup(t)
  const booking = f.book()
  t.mock.timers.setTime(start + 2.05 * day)
  f.confirm(booking)
  const studentState = getPortalState(f.db, f.student)
  assert.ok(studentState.mainReviewPreparation!.every((item) => item.studentId === f.student.id))
  assert.deepEqual(getPortalState(f.db, f.outsider).mainReviewPreparation, [])
  const staffState = getPortalState(f.db, f.assistant)
  assert.equal(
    staffState.mainReviewPreparation!.find(
      (item) => item.studentId === f.student.id && item.lessonId === f.next.id,
    )?.status,
    'completed',
  )
  assert.deepEqual(staffState.consultationOutcomes, [])
  assert.ok(!JSON.stringify(staffState).includes('PRIVATE learner'))
  assert.ok(!JSON.stringify(staffState).includes('private-review-gate'))
})
