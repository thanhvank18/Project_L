import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import type {
  Account,
  Booking,
  Classroom,
  ConsultationOutcome,
  Lesson,
  Role,
} from '../shared/portal.ts'
import { getAccount, openDatabase, type Database } from './db.ts'
import { getPortalState, runAction } from './domain.ts'
import { all, get, put } from './domain-store.ts'
import { HttpError } from './errors.ts'

const action = (db: Database, actor: Account, type: string, payload: Record<string, unknown>) =>
  runAction(db, actor, { type, payload })
const status = (value: number) => (error: unknown) =>
  error instanceof HttpError && error.status === value
const code = (value: string) => (error: unknown) =>
  error instanceof HttpError && error.code === value
function account(db: Database, key: string, role: Role) {
  db.prepare(
    'INSERT INTO users(id,name,email,role,active,version,created_at,password_hash) VALUES(?,?,?,?,1,1,?,?)',
  ).run(key, key, `${key}@example.test`, role, new Date().toISOString(), 'unused-test-password')
  return getAccount(db, key)!
}
function setup(path = ':memory:') {
  const db = openDatabase(path)
  const admin = account(db, 'admin', 'admin')
  const teacher = account(db, 'teacher', 'teacher')
  const colleague = account(db, 'colleague', 'teacher')
  const outsider = account(db, 'outsider', 'teacher')
  const assistant = account(db, 'assistant', 'assistant')
  const student = account(db, 'student', 'student')
  const otherStudent = account(db, 'other-student', 'student')
  const room = action(db, admin, 'class.save', {
    title: 'Review class',
    level: 'B1',
    description: '',
    teacherIds: [teacher.id, colleague.id],
    assistantIds: [assistant.id],
    studentIds: [student.id, otherStudent.id],
    active: true,
    listed: false,
    expectedVersion: 0,
  }).state.classes[0]!
  const saved = action(db, teacher, 'lesson.save', {
    title: '1:1 review',
    classId: room.id,
    kind: 'consultation',
    hostId: teacher.id,
    capacity: 1,
    cancelled: false,
    startsAt: new Date(Date.now() + 86400000).toISOString(),
    endsAt: new Date(Date.now() + 90000000).toISOString(),
    expectedVersion: 0,
  })
  const lesson = saved.state.lessons[0]!
  const booked = action(db, student, 'booking.create', {
    lessonId: lesson.id,
    expectedVersion: lesson.version,
  }).state.bookings[0]!
  const start = () => {
    const current = get<Lesson>(db, 'lesson', lesson.id)!
    put(db, 'lesson', {
      ...current,
      startsAt: new Date(Date.now() - 1800000).toISOString(),
      endsAt: new Date(Date.now() + 1800000).toISOString(),
    })
  }
  const save = (actor = teacher, overrides: Record<string, unknown> = {}) =>
    action(db, actor, 'consultation.outcome.save', {
      bookingId: booked.id,
      expectedVersion: 0,
      expectedLessonVersion: lesson.version,
      expectedBookingVersion: booked.version,
      status: 'completed',
      feedback: 'Private feedback for this learner',
      ...overrides,
    })
  return {
    db,
    admin,
    teacher,
    colleague,
    outsider,
    assistant,
    student,
    otherStudent,
    room,
    lesson,
    booked,
    start,
    save,
  }
}

test('only the current host teacher confirms a started consultation and scopes private feedback', () => {
  const f = setup()
  try {
    assert.throws(() => f.save(), code('consultation_not_started'))
    f.start()
    for (const actor of [f.admin, f.student, f.assistant, f.otherStudent])
      assert.throws(() => f.save(actor), status(403))
    assert.throws(() => f.save(f.colleague), code('host_required'))
    assert.throws(() => f.save(f.outsider), status(404))
    const outcome = f.save().state.consultationOutcomes[0]!
    assert.equal(outcome.teacherId, f.teacher.id)
    assert.equal(outcome.studentId, f.student.id)
    assert.equal(outcome.version, 1)
    assert.equal(
      getPortalState(f.db, f.student).consultationOutcomes[0]?.feedback,
      'Private feedback for this learner',
    )
    assert.equal(getPortalState(f.db, f.admin).consultationOutcomes.length, 1)
    assert.equal(getPortalState(f.db, f.colleague).consultationOutcomes.length, 1)
    assert.deepEqual(getPortalState(f.db, f.otherStudent).consultationOutcomes, [])
    assert.deepEqual(getPortalState(f.db, f.assistant).consultationOutcomes, [])
    assert.ok(!JSON.stringify(getPortalState(f.db, f.assistant)).includes('Private feedback'))
    assert.equal(getPortalState(f.db, f.student).notifications.length, 1)
    assert.equal(get<Booking>(f.db, 'booking', f.booked.id)?.status, 'booked')
    assert.equal(getPortalState(f.db, f.teacher).submissions.length, 0)
  } finally {
    f.db.close()
  }
})

test('version-checked corrections preserve outcome history, audit and original confirmation time', () => {
  const f = setup()
  try {
    f.start()
    const first = f.save().state.consultationOutcomes[0]!
    assert.throws(() => f.save(), code('conflict'))
    const corrected = f.save(f.teacher, {
      expectedVersion: 1,
      status: 'no_show',
      feedback: 'Correction: learner did not attend',
    }).state.consultationOutcomes[0]!
    assert.equal(corrected.status, 'no_show')
    assert.equal(corrected.version, 2)
    assert.equal(corrected.completedAt, first.completedAt)
    assert.equal(all<ConsultationOutcome>(f.db, 'consultationOutcomeRevision').length, 2)
    assert.equal(
      all<ConsultationOutcome>(f.db, 'consultationOutcomeRevision')[0]?.feedback,
      first.feedback,
    )
    assert.equal(
      getPortalState(f.db, f.admin).audit.filter(
        (entry) => entry.action === 'consultation.outcome.save',
      ).length,
      2,
    )
    assert.equal(getPortalState(f.db, f.student).consultationOutcomes.length, 1)
    assert.ok(
      !JSON.stringify(getPortalState(f.db, f.student).consultationOutcomes).includes(
        first.feedback,
      ),
    )
    assert.throws(
      () => f.save(f.teacher, { expectedVersion: 2, score: 8 }),
      code('invalid_payload'),
    )
    assert.throws(
      () => f.save(f.teacher, { expectedVersion: 2, status: 'approved' }),
      code('invalid_payload'),
    )
    assert.equal(get<ConsultationOutcome>(f.db, 'consultationOutcome', f.booked.id)?.version, 2)
  } finally {
    f.db.close()
  }
})

test('current membership, account state and schedule/booking versions are rechecked on confirmation', () => {
  for (const change of [
    'teacher-removed',
    'student-removed',
    'inactive-student',
    'inactive-teacher',
    'cancelled',
    'booking-cancelled',
    'main-class',
    'lesson-version',
    'booking-version',
  ]) {
    const f = setup()
    try {
      f.start()
      if (change === 'teacher-removed')
        put(f.db, 'class', { ...f.room, teacherIds: [f.colleague.id] })
      if (change === 'student-removed')
        put(f.db, 'class', { ...f.room, studentIds: [f.otherStudent.id] })
      if (change === 'inactive-student')
        f.db.prepare('UPDATE users SET active=0 WHERE id=?').run(f.student.id)
      if (change === 'inactive-teacher')
        f.db.prepare('UPDATE users SET active=0 WHERE id=?').run(f.teacher.id)
      const lesson = get<Lesson>(f.db, 'lesson', f.lesson.id)!
      if (change === 'cancelled') put(f.db, 'lesson', { ...lesson, cancelled: true })
      if (change === 'main-class') put(f.db, 'lesson', { ...lesson, kind: 'class' })
      if (change === 'lesson-version') put(f.db, 'lesson', { ...lesson, version: 2 })
      if (change === 'booking-cancelled') put(f.db, 'booking', { ...f.booked, status: 'cancelled' })
      if (change === 'booking-version') put(f.db, 'booking', { ...f.booked, version: 2 })
      assert.throws(
        () => f.save(),
        (error: unknown) => error instanceof HttpError && [401, 404, 409].includes(error.status),
        change,
      )
      assert.equal(all(f.db, 'consultationOutcome').length, 0)
    } finally {
      f.db.close()
    }
  }
})

test('finalized consultation cannot be cancelled or reassigned but title and Zoom remain editable', () => {
  const f = setup()
  try {
    f.start()
    f.save()
    assert.throws(
      () =>
        action(f.db, f.student, 'booking.cancel', {
          id: f.booked.id,
          expectedVersion: f.booked.version,
        }),
      code('consultation_finalized'),
    )
    const savedLesson = get<Lesson>(f.db, 'lesson', f.lesson.id)!
    for (const change of [
      { cancelled: true },
      { hostId: f.colleague.id },
      { startsAt: new Date(Date.now() - 1900000).toISOString() },
      { endsAt: new Date(Date.now() + 1900000).toISOString() },
      { kind: 'class' },
      { kind: 'class', capacity: 2 },
    ]) {
      assert.throws(
        () =>
          action(f.db, f.admin, 'lesson.save', {
            ...savedLesson,
            expectedVersion: savedLesson.version,
            ...change,
          }),
        code('consultation_finalized'),
      )
    }
    const renamed = action(f.db, f.teacher, 'lesson.save', {
      ...savedLesson,
      title: 'Reviewed speaking goals',
      expectedVersion: savedLesson.version,
    }).state.lessons[0]!
    action(f.db, f.assistant, 'lesson.meeting.save', {
      id: renamed.id,
      expectedVersion: renamed.version,
      meetingSource: 'lesson',
      meetingUrl: 'https://zoom.us/j/123456789',
    })
    assert.equal(getPortalState(f.db, f.student).consultationOutcomes.length, 1)
  } finally {
    f.db.close()
  }
})

test('outcomes persist across database restart and withdrawn students lose access', () => {
  const directory = mkdtempSync(join(tmpdir(), 'project-l-outcomes-'))
  const path = join(directory, 'portal.sqlite')
  const f = setup(path)
  f.start()
  f.save()
  f.db.close()
  const db = openDatabase(path)
  try {
    assert.equal(getPortalState(db, f.student).consultationOutcomes[0]?.status, 'completed')
    const room = get<Classroom>(db, 'class', f.room.id)!
    put(db, 'class', { ...room, studentIds: [] })
    assert.deepEqual(getPortalState(db, f.student).consultationOutcomes, [])
    assert.equal(getPortalState(db, f.admin).consultationOutcomes.length, 1)
  } finally {
    db.close()
    rmSync(directory, { recursive: true, force: true })
  }
})
