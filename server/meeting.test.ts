import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import type { Account, Classroom, Lesson, Role } from '../shared/portal.ts'
import { getAccount, openDatabase, type Database } from './db.ts'
import { getPortalState, getPublicCourses, runAction } from './domain.ts'
import { get, put } from './domain-store.ts'
import { HttpError } from './errors.ts'

const classUrl = 'https://us02web.zoom.us/j/123456789?pwd=class-private'
const overrideUrl = 'https://zoom.us/my/private-room?pwd=lesson-private'
const replacementUrl = 'https://zoom.us/j/987654321?pwd=replacement-private'
const errorCode = (code: string) => (error: unknown) =>
  error instanceof HttpError && error.code === code
const status = (expected: number) => (error: unknown) =>
  error instanceof HttpError && error.status === expected
const action = (db: Database, actor: Account, type: string, payload: Record<string, unknown>) =>
  runAction(db, actor, { type, payload })

function account(db: Database, key: string, role: Role): Account {
  db.prepare(
    'INSERT INTO users(id,name,email,role,active,version,created_at,password_hash) VALUES(?,?,?,?,1,1,?,?)',
  ).run(key, key, `${key}@example.test`, role, new Date().toISOString(), 'unused-test-password')
  return getAccount(db, key)!
}

function setup(path = ':memory:') {
  const db = openDatabase(path)
  const admin = account(db, 'admin', 'admin')
  const teacher = account(db, 'teacher', 'teacher')
  const assistant = account(db, 'assistant', 'assistant')
  const student = account(db, 'student', 'student')
  const otherTeacher = account(db, 'other-teacher', 'teacher')
  const otherAssistant = account(db, 'other-assistant', 'assistant')
  const otherStudent = account(db, 'other-student', 'student')
  const room = (title: string, teacherId: string, assistantId: string, studentId: string) =>
    action(db, admin, 'class.save', {
      title,
      level: 'B1',
      description: '',
      teacherIds: [teacherId],
      assistantIds: [assistantId],
      studentIds: [studentId],
      active: true,
      listed: true,
      expectedVersion: 0,
    }).state.classes.find((item) => item.title === title)!
  const class1 = room('Class one', teacher.id, assistant.id, student.id)
  const class2 = room('Class two', otherTeacher.id, otherAssistant.id, otherStudent.id)
  return {
    db,
    admin,
    teacher,
    assistant,
    student,
    otherTeacher,
    otherAssistant,
    otherStudent,
    class1,
    class2,
  }
}

function lesson(
  db: Database,
  teacher: Account,
  room: Classroom,
  settings: Record<string, unknown> = {},
  days = 1,
): Lesson {
  const result = action(db, teacher, 'lesson.save', {
    expectedVersion: 0,
    classId: room.id,
    title: 'Live lesson',
    startsAt: new Date(Date.now() + days * 86400000).toISOString(),
    endsAt: new Date(Date.now() + days * 86400000 + 3600000).toISOString(),
    kind: 'class',
    hostId: teacher.id,
    capacity: settings.kind === 'consultation' ? 1 : 5,
    cancelled: false,
    ...settings,
  })
  return result.state.lessons.find((item) => item.id === result.result!.id)!
}

function classMeeting(
  db: Database,
  actor: Account,
  room: Classroom,
  meetingUrl: string,
  expectedVersion = 0,
) {
  return action(db, actor, 'class.meeting.save', { classId: room.id, expectedVersion, meetingUrl })
}

function lessonMeeting(
  db: Database,
  actor: Account,
  item: Lesson,
  meetingSource: Lesson['meetingSource'],
  meetingUrl?: string,
) {
  return action(db, actor, 'lesson.meeting.save', {
    id: item.id,
    expectedVersion: item.version,
    meetingSource,
    ...(meetingUrl === undefined ? {} : { meetingUrl }),
  }).state.lessons.find((value) => value.id === item.id)!
}

function joinLesson(db: Database, actor: Account, item: Lesson) {
  return action(db, actor, 'lesson.join', { id: item.id }).result!.url
}

test('admin, assigned teacher and assistant can change only scoped Zoom settings without exposing private URLs', () => {
  const { db, admin, teacher, assistant, student, class1 } = setup()
  try {
    let item = lesson(db, teacher, class1)
    assert.equal(item.meetingSource, 'class')
    assert.equal(item.hasMeeting, false)
    for (const [index, actor] of [admin, teacher, assistant].entries()) {
      const saved = classMeeting(db, actor, class1, classUrl, index)
      assert.equal(
        saved.state.classMeetings.find((value) => value.classId === class1.id)!.version,
        index + 1,
      )
      assert.ok(!JSON.stringify(saved).includes('class-private'))
      item = lessonMeeting(db, actor, item, 'lesson', overrideUrl)
      assert.equal(joinLesson(db, student, item), overrideUrl)
      item = lessonMeeting(db, actor, item, 'class')
      assert.equal(joinLesson(db, student, item), classUrl)
    }
    for (const actor of [admin, teacher, assistant, student]) {
      const state = getPortalState(db, actor)
      assert.equal(state.lessons.find((value) => value.id === item.id)!.hasMeeting, true)
      assert.ok(!JSON.stringify(state).includes('zoom.us'))
      assert.ok(!JSON.stringify(state).includes('meetingUrl'))
    }
    assert.ok(!JSON.stringify(getPublicCourses(db)).includes('Meeting'))
    assert.ok(!JSON.stringify(getPublicCourses(db)).includes('zoom.us'))
    assert.equal(getPortalState(db, assistant).audit.length, 0)
    assert.ok(
      getPortalState(db, admin).audit.some((entry) => entry.action === 'lesson.meeting.save'),
    )
  } finally {
    db.close()
  }
})

test('students, cross-class staff, removed membership and inactive accounts cannot modify Zoom settings', () => {
  const {
    db,
    admin,
    teacher,
    assistant,
    student,
    otherTeacher,
    otherAssistant,
    otherStudent,
    class1,
    class2,
  } = setup()
  try {
    const item = lesson(db, teacher, class1)
    for (const actor of [student, otherStudent, otherTeacher, otherAssistant]) {
      const expected = actor.role === 'student' ? 403 : 404
      assert.throws(() => classMeeting(db, actor, class1, classUrl), status(expected))
      assert.throws(() => lessonMeeting(db, actor, item, 'lesson', overrideUrl), status(expected))
    }
    assert.deepEqual(
      getPortalState(db, otherAssistant).classMeetings.map((value) => value.classId),
      [class2.id],
    )
    action(db, admin, 'class.save', {
      ...class1,
      assistantIds: [],
      expectedVersion: class1.version,
    })
    assert.throws(() => classMeeting(db, assistant, class1, classUrl), status(404))
    assert.throws(() => lessonMeeting(db, assistant, item, 'none'), status(404))
    db.prepare('UPDATE users SET active=0 WHERE id=?').run(teacher.id)
    assert.throws(() => classMeeting(db, teacher, class1, classUrl), status(401))
    assert.throws(() => lessonMeeting(db, teacher, item, 'none'), status(401))
    db.prepare('UPDATE users SET active=1,role=? WHERE id=?').run('student', teacher.id)
    assert.throws(() => classMeeting(db, teacher, class1, classUrl), status(403))
  } finally {
    db.close()
  }
})

test('inactive classes block assigned staff and students while admin retains class-management access', () => {
  const { db, admin, teacher, assistant, student, class1 } = setup()
  try {
    const item = lesson(db, teacher, class1)
    action(db, admin, 'class.save', { ...class1, active: false, expectedVersion: class1.version })
    for (const actor of [teacher, assistant]) {
      assert.throws(() => classMeeting(db, actor, class1, classUrl), status(404))
      assert.throws(() => lessonMeeting(db, actor, item, 'lesson', overrideUrl), status(404))
    }
    assert.throws(() => joinLesson(db, student, item), status(404))
    classMeeting(db, admin, class1, classUrl)
    assert.equal(getPortalState(db, admin).classMeetings[0]!.hasMeeting, true)
  } finally {
    db.close()
  }
})

test('assistant meeting access cannot widen into scheduling, grading or hidden academic mutation', () => {
  const { db, teacher, assistant, class1 } = setup()
  try {
    const item = lesson(db, teacher, class1)
    const before = getPortalState(db, assistant)
    assert.throws(
      () => action(db, assistant, 'lesson.save', { ...item, expectedVersion: item.version }),
      status(403),
    )
    assert.throws(
      () =>
        action(db, assistant, 'submission.review', {
          id: 'unknown',
          expectedVersion: 1,
          score: 9,
          feedback: 'x',
        }),
      status(403),
    )
    assert.throws(
      () => action(db, assistant, 'assignment.save', { classId: class1.id }),
      status(403),
    )
    assert.throws(
      () =>
        action(db, assistant, 'class.meeting.save', {
          classId: class1.id,
          expectedVersion: 0,
          meetingUrl: classUrl,
          teacherIds: [assistant.id],
        }),
      status(400),
    )
    for (const extra of [
      { title: 'Hijacked title' },
      { cancelled: true },
      { classId: 'other' },
      { capacity: 999 },
    ]) {
      assert.throws(
        () =>
          action(db, assistant, 'lesson.meeting.save', {
            id: item.id,
            expectedVersion: item.version,
            meetingSource: 'lesson',
            meetingUrl: overrideUrl,
            ...extra,
          }),
        status(400),
      )
    }
    assert.deepEqual(getPortalState(db, assistant).lessons, before.lessons)
    assert.deepEqual(getPortalState(db, assistant).classMeetings, before.classMeetings)
    const updated = lessonMeeting(db, assistant, item, 'lesson', overrideUrl)
    assert.deepEqual(
      {
        ...updated,
        meetingSource: item.meetingSource,
        hasMeeting: item.hasMeeting,
        version: item.version,
      },
      item,
    )
  } finally {
    db.close()
  }
})

test('class links are inherited dynamically, overrides remain private and explicit no-link never falls back', () => {
  const { db, admin, teacher, assistant, student, class1 } = setup()
  try {
    let inherited = lesson(db, teacher, class1)
    let override = lesson(
      db,
      teacher,
      class1,
      { meetingSource: 'lesson', meetingUrl: overrideUrl },
      2,
    )
    const disabled = lesson(db, teacher, class1, { meetingSource: 'none' }, 3)
    const consultation = lesson(db, teacher, class1, { kind: 'consultation' }, 4)
    assert.equal(consultation.meetingSource, 'none')
    assert.throws(() => joinLesson(db, student, inherited), errorCode('meeting_unconfigured'))
    classMeeting(db, assistant, class1, classUrl)
    assert.equal(joinLesson(db, student, inherited), classUrl)
    assert.throws(() => joinLesson(db, student, override), errorCode('review_required'))
    assert.equal(joinLesson(db, teacher, override), overrideUrl)
    assert.throws(() => joinLesson(db, teacher, disabled), errorCode('meeting_unconfigured'))
    classMeeting(db, teacher, class1, replacementUrl, 1)
    assert.equal(joinLesson(db, student, inherited), replacementUrl)
    assert.equal(joinLesson(db, teacher, override), overrideUrl)
    action(db, admin, 'class.save', {
      ...class1,
      title: 'Renamed class',
      expectedVersion: class1.version,
    })
    assert.equal(joinLesson(db, student, inherited), replacementUrl)
    override = lessonMeeting(db, assistant, override, 'lesson')
    assert.equal(joinLesson(db, teacher, override), overrideUrl)
    classMeeting(db, assistant, class1, '', 2)
    assert.throws(() => joinLesson(db, student, inherited), errorCode('meeting_unconfigured'))
    assert.equal(joinLesson(db, teacher, override), overrideUrl)
    inherited = lessonMeeting(db, teacher, inherited, 'lesson', classUrl)
    inherited = lessonMeeting(db, assistant, inherited, 'none')
    classMeeting(db, admin, class1, replacementUrl, 3)
    assert.throws(() => joinLesson(db, student, inherited), errorCode('meeting_unconfigured'))
    inherited = lessonMeeting(db, assistant, inherited, 'class')
    assert.equal(joinLesson(db, student, inherited), replacementUrl)
  } finally {
    db.close()
  }
})

test('version checks and strict HTTPS Zoom validation apply to updates, clears and unchanged private overrides', () => {
  const { db, teacher, assistant, class1 } = setup()
  try {
    const item = lesson(db, teacher, class1)
    classMeeting(db, teacher, class1, classUrl)
    assert.throws(() => classMeeting(db, assistant, class1, '', 0), errorCode('conflict'))
    const updated = lessonMeeting(db, assistant, item, 'lesson', overrideUrl)
    assert.throws(() => lessonMeeting(db, teacher, item, 'none'), errorCode('conflict'))
    assert.throws(
      () => action(db, teacher, 'lesson.save', { ...item, expectedVersion: item.version }),
      errorCode('conflict'),
    )
    for (const invalid of [
      'http://zoom.us/j/123',
      'https://zoom.us.evil.test/j/123',
      'https://evil.test/j/123',
      'https://zoom.us:444/j/123',
      'https://name:pass@zoom.us/j/123',
      'https://zoom.us/download',
      'not a url',
    ]) {
      assert.throws(
        () => classMeeting(db, assistant, class1, invalid, 1),
        errorCode('invalid_meeting_url'),
      )
      assert.throws(
        () => lessonMeeting(db, assistant, updated, 'lesson', invalid),
        errorCode('invalid_meeting_url'),
      )
    }
    assert.throws(
      () => lessonMeeting(db, assistant, updated, 'lesson', ''),
      errorCode('invalid_meeting_url'),
    )
    assert.throws(
      () => lessonMeeting(db, assistant, updated, 'class', overrideUrl),
      errorCode('invalid_payload'),
    )
    assert.throws(
      () =>
        action(db, assistant, 'lesson.meeting.save', {
          id: updated.id,
          expectedVersion: updated.version,
        }),
      status(400),
    )
    const fresh = lesson(db, teacher, class1, {}, 2)
    assert.throws(
      () => lessonMeeting(db, assistant, fresh, 'lesson'),
      errorCode('invalid_meeting_url'),
    )
    assert.equal(getPortalState(db, teacher).classMeetings[0]!.version, 1)
    assert.equal(getPortalState(db, teacher).lessons[0]!.version, updated.version)
  } finally {
    db.close()
  }
})

test('inherited consultation links still require current booking, current preparation and an active host', () => {
  const { db, teacher, assistant, student, otherStudent, class1 } = setup()
  try {
    classMeeting(db, assistant, class1, classUrl)
    const item = lesson(db, teacher, class1, { kind: 'consultation', meetingSource: 'class' })
    const saved = action(db, teacher, 'assignment.save', {
      classId: class1.id,
      title: { vi: 'Chuẩn bị', en: 'Preparation' },
      instructions: { vi: 'Viết', en: 'Write' },
      skill: 'writing',
      dueAt: '',
      published: true,
      required: true,
      attachmentIds: [],
      expectedVersion: 0,
    })
    const task = saved.state.assignments[0]!
    assert.throws(() => joinLesson(db, student, item), errorCode('booking_required'))
    assert.throws(() => joinLesson(db, otherStudent, item), status(404))
    action(db, student, 'booking.create', { lessonId: item.id })
    assert.throws(() => joinLesson(db, student, item), errorCode('preparation_required'))
    action(db, student, 'draft.save', {
      assignmentId: task.id,
      assignmentVersion: task.version,
      expectedVersion: 0,
      answer: 'Private answer text',
      notes: 'Private note',
      attachmentIds: [],
    })
    action(db, student, 'submission.create', {
      assignmentId: task.id,
      assignmentVersion: task.version,
      draftVersion: 1,
      expectedRevision: 0,
      requestId: 'meeting-preparation',
    })
    assert.equal(joinLesson(db, student, item), classUrl)
    assert.equal(getPortalState(db, assistant).submissions[0]!.answer, '')
    assert.deepEqual(getPortalState(db, assistant).submissions[0]!.attachmentIds, [])
    assert.equal(getPortalState(db, assistant).submissions[0]!.review, null)
    assert.equal(getPortalState(db, assistant).drafts.length, 0)
    action(db, teacher, 'assignment.save', { ...task, expectedVersion: task.version })
    assert.throws(() => joinLesson(db, student, item), errorCode('preparation_required'))
    db.prepare('UPDATE users SET active=0 WHERE id=?').run(teacher.id)
    assert.throws(() => joinLesson(db, student, item), errorCode('host_unavailable'))
  } finally {
    db.close()
  }
})

test('one-to-one review slots allow one student, reject larger capacities and free a cancelled reservation', () => {
  const { db, admin, teacher, assistant, student, otherStudent, class1 } = setup()
  try {
    action(db, admin, 'class.save', {
      ...class1,
      studentIds: [student.id, otherStudent.id],
      expectedVersion: class1.version,
    })
    classMeeting(db, assistant, class1, classUrl)
    assert.throws(
      () => lesson(db, teacher, class1, { kind: 'consultation', capacity: 2 }),
      errorCode('invalid_capacity'),
    )
    const item = lesson(db, teacher, class1, {
      kind: 'consultation',
      meetingSource: 'class',
      reservedCount: 999,
    })
    assert.equal(item.capacity, 1)
    assert.equal(item.reservedCount, 0)
    assert.equal(
      Object.hasOwn(get<Record<string, unknown>>(db, 'lesson', item.id)!, 'reservedCount'),
      false,
    )
    const result = action(db, student, 'booking.create', {
      lessonId: item.id,
      expectedVersion: item.version,
    })
    const booking = result.state.bookings[0]!
    const otherState = getPortalState(db, otherStudent)
    assert.equal(otherState.lessons.find((value) => value.id === item.id)!.reservedCount, 1)
    assert.equal(otherState.bookings.length, 0)
    assert.ok(!JSON.stringify(otherState).includes(booking.id))
    assert.throws(
      () =>
        action(db, otherStudent, 'booking.create', {
          lessonId: item.id,
          expectedVersion: item.version,
        }),
      errorCode('full'),
    )
    assert.throws(
      () =>
        action(db, teacher, 'lesson.save', { ...item, capacity: 2, expectedVersion: item.version }),
      errorCode('invalid_capacity'),
    )
    action(db, student, 'booking.cancel', { id: booking.id, expectedVersion: booking.version })
    assert.equal(
      getPortalState(db, otherStudent).lessons.find((value) => value.id === item.id)!.reservedCount,
      0,
    )
    action(db, otherStudent, 'booking.create', { lessonId: item.id, expectedVersion: item.version })
    assert.throws(() => joinLesson(db, student, item), errorCode('booking_required'))
    assert.equal(joinLesson(db, otherStudent, item), classUrl)
    assert.equal(
      getPortalState(db, teacher).bookings.filter((value) => value.status === 'booked').length,
      1,
    )
  } finally {
    db.close()
  }
})

test('cancellation rechecks current class access even when a removed student remembers the booking ID', () => {
  const { db, admin, teacher, student, class1 } = setup()
  try {
    const item = lesson(db, teacher, class1, { kind: 'consultation' })
    const booking = action(db, student, 'booking.create', { lessonId: item.id }).state.bookings[0]!
    let room = action(db, admin, 'class.save', {
      ...class1,
      studentIds: [],
      expectedVersion: class1.version,
    }).state.classes[0]!
    assert.equal(getPortalState(db, student).bookings.length, 0)
    assert.throws(
      () =>
        action(db, student, 'booking.cancel', { id: booking.id, expectedVersion: booking.version }),
      status(404),
    )
    assert.equal(getPortalState(db, admin).bookings[0]!.status, 'booked')
    assert.equal(getPortalState(db, admin).bookings[0]!.version, booking.version)
    room = action(db, admin, 'class.save', {
      ...room,
      studentIds: [student.id],
      active: false,
      expectedVersion: room.version,
    }).state.classes[0]!
    assert.throws(
      () =>
        action(db, student, 'booking.cancel', { id: booking.id, expectedVersion: booking.version }),
      status(404),
    )
    action(db, admin, 'class.save', { ...room, active: true, expectedVersion: room.version })
    db.prepare('UPDATE users SET active=0 WHERE id=?').run(teacher.id)
    const cancelled = action(db, student, 'booking.cancel', {
      id: booking.id,
      expectedVersion: booking.version,
    }).state.bookings[0]!
    assert.equal(cancelled.status, 'cancelled')
    assert.equal(cancelled.version, booking.version + 1)
  } finally {
    db.close()
  }
})

test('persisted class links survive restart and legacy lessons retain overrides or safe class inheritance', () => {
  const directory = mkdtempSync(join(tmpdir(), 'project-l-meetings-'))
  const path = join(directory, 'portal.sqlite')
  const fixture = setup(path)
  let db = fixture.db
  try {
    const { teacher, assistant, student, class1 } = fixture
    classMeeting(db, assistant, class1, classUrl)
    const legacyOverride = lesson(db, teacher, class1, { meetingUrl: overrideUrl })
    const legacyEmpty = lesson(db, teacher, class1, {}, 2)
    const legacyConsultation = lesson(db, teacher, class1, { kind: 'consultation' }, 3)
    for (const item of [legacyOverride, legacyEmpty, legacyConsultation]) {
      const stored = get<
        Omit<Lesson, 'meetingSource' | 'reservedCount'> & {
          meetingSource?: Lesson['meetingSource']
          meetingUrl: string
        }
      >(db, 'lesson', item.id)!
      delete stored.meetingSource
      put(db, 'lesson', stored)
    }
    db.close()
    db = openDatabase(path)
    const state = getPortalState(db, student)
    assert.equal(state.classMeetings[0]!.version, 1)
    assert.deepEqual(
      state.lessons.map((item) => item.meetingSource),
      ['lesson', 'class', 'none'],
    )
    assert.equal(joinLesson(db, student, legacyOverride), overrideUrl)
    assert.throws(() => joinLesson(db, student, legacyEmpty), errorCode('review_required'))
    assert.equal(joinLesson(db, teacher, legacyEmpty), classUrl)
    const modified = action(db, teacher, 'lesson.save', {
      ...legacyOverride,
      meetingSource: undefined,
      title: 'Updated legacy schedule',
      expectedVersion: legacyOverride.version,
    }).state.lessons.find((item) => item.id === legacyOverride.id)!
    assert.equal(modified.meetingSource, 'lesson')
    assert.equal(joinLesson(db, student, modified), overrideUrl)
    assert.ok(!JSON.stringify(getPortalState(db, assistant)).includes('zoom.us'))
  } finally {
    db.close()
    rmSync(directory, { recursive: true, force: true })
  }
})
