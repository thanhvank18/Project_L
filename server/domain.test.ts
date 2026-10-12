import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import type { Account, Assignment, Classroom, Role } from '../shared/portal.ts'
import { getAccount, openDatabase, type Database } from './db.ts'
import { getFile, getPortalState, getPublicCourses, runAction, uploadFile } from './domain.ts'
import { HttpError } from './errors.ts'

function account(db: Database, key: string, role: Role): Account {
  db.prepare(
    'INSERT INTO users(id,name,email,role,active,version,created_at,password_hash) VALUES(?,?,?,?,1,1,?,?)',
  ).run(key, key, `${key}@example.test`, role, new Date().toISOString(), 'unused-test-password')
  return getAccount(db, key)!
}
const status = (expected: number) => (error: unknown) =>
  error instanceof HttpError && error.status === expected
const action = (db: Database, actor: Account, type: string, payload: Record<string, unknown>) =>
  runAction(db, actor, { type, payload })
function setup(path = ':memory:') {
  const db = openDatabase(path)
  const admin = account(db, 'admin', 'admin')
  const teacher1 = account(db, 'teacher1', 'teacher')
  const teacher2 = account(db, 'teacher2', 'teacher')
  const student1 = account(db, 'student1', 'student')
  const student2 = account(db, 'student2', 'student')
  const assistant = account(db, 'assistant', 'assistant')
  const room = (title: string, teacherIds: string[], studentIds: string[]) =>
    action(db, admin, 'class.save', {
      title,
      level: 'B1',
      description: '',
      teacherIds,
      assistantIds: [assistant.id],
      studentIds,
      active: true,
      listed: false,
      expectedVersion: 0,
    }).state.classes.find((item) => item.title === title)!
  const class1 = room('Class one', [teacher1.id], [student1.id, student2.id])
  const class2 = room('Class two', [teacher2.id], [student2.id])
  return { db, admin, teacher1, teacher2, student1, student2, assistant, class1, class2 }
}
function task(db: Database, teacher: Account, room: Classroom): Assignment {
  const result = action(db, teacher, 'assignment.save', {
    classId: room.id,
    title: { vi: 'Bài học', en: 'Assignment' },
    instructions: { vi: 'Trả lời', en: 'Respond' },
    skill: 'speaking',
    dueAt: '',
    published: true,
    required: true,
    attachmentIds: [],
    expectedVersion: 0,
  })
  return result.state.assignments.find((item) => item.id === result.result!.id)!
}
function draft(
  db: Database,
  student: Account,
  assignment: Assignment,
  answer = 'My original answer',
  expectedVersion = 0,
  attachmentIds: string[] = [],
) {
  return action(db, student, 'draft.save', {
    assignmentId: assignment.id,
    assignmentVersion: assignment.version,
    expectedVersion,
    answer,
    notes: 'PRIVATE STUDENT NOTES',
    attachmentIds,
  }).state.drafts.find((item) => item.assignmentId === assignment.id)!
}
function submission(
  db: Database,
  student: Account,
  assignment: Assignment,
  requestId = 'request-one',
  draftVersion = 1,
  expectedRevision = 0,
) {
  const result = action(db, student, 'submission.create', {
    assignmentId: assignment.id,
    assignmentVersion: assignment.version,
    draftVersion,
    expectedRevision,
    requestId,
  })
  return result.state.submissions.find((item) => item.id === result.result!.id)!
}

test('empty database has no seeded academic records or public courses', () => {
  const db = openDatabase(':memory:')
  try {
    const admin = account(db, 'admin', 'admin')
    const state = getPortalState(db, admin)
    assert.equal(state.classes.length, 0)
    assert.equal(state.assignments.length, 0)
    assert.deepEqual(getPublicCourses(db), [])
  } finally {
    db.close()
  }
})

test('two teachers and two students receive only permitted classes, users and records', () => {
  const { db, admin, teacher1, teacher2, student1, student2, assistant, class1, class2 } = setup()
  try {
    const a = task(db, teacher1, class1)
    const b = task(db, teacher2, class2)
    draft(db, student1, a)
    draft(db, student2, b)
    submission(db, student1, a)
    submission(db, student2, b)
    const studentState = getPortalState(db, student1)
    assert.deepEqual(
      studentState.classes.map((item) => item.id),
      [class1.id],
    )
    assert.deepEqual(
      studentState.users.map((item) => item.id).sort(),
      [student1.id, teacher1.id].sort(),
    )
    assert.equal(studentState.submissions.length, 1)
    assert.equal(getPortalState(db, teacher1).submissions.length, 1)
    assert.equal(getPortalState(db, teacher2).submissions.length, 1)
    assert.equal(getPortalState(db, teacher1).drafts.length, 0)
    assert.equal(getPortalState(db, admin).drafts.length, 0)
    assert.equal(getPortalState(db, admin).submissions.length, 2)
    assert.equal(getPortalState(db, assistant).submissions[0]!.answer, '')
    assert.equal(getPortalState(db, assistant).submissions[0]!.review, null)
    assert.throws(() => draft(db, student1, b), status(404))
    assert.throws(
      () => action(db, teacher1, 'assignment.save', { ...b, expectedVersion: b.version }),
      status(404),
    )
    assert.throws(
      () => action(db, assistant, 'assignment.save', { ...a, expectedVersion: a.version }),
      status(403),
    )
    assert.equal(studentState.audit.length, 0)
    assert.ok(getPortalState(db, admin).audit.length > 0)
  } finally {
    db.close()
  }
})

test('submission snapshots, idempotency and exact immutable reviews preserve all revisions and private notes', () => {
  const { db, admin, teacher1, teacher2, student1, class1 } = setup()
  try {
    const assignment = task(db, teacher1, class1)
    draft(db, student1, assignment)
    const first = submission(db, student1, assignment)
    assert.equal(submission(db, student1, assignment).id, first.id)
    assert.equal(getPortalState(db, teacher1).notifications.length, 1)
    assert.throws(() => submission(db, student1, assignment, 'request-one', 1, 1), status(409))
    assert.throws(
      () =>
        action(db, admin, 'submission.review', {
          id: first.id,
          expectedVersion: 1,
          score: 7,
          feedback: 'Good',
        }),
      status(403),
    )
    assert.throws(
      () =>
        action(db, teacher2, 'submission.review', {
          id: first.id,
          expectedVersion: 1,
          score: 7,
          feedback: 'Good',
        }),
      status(404),
    )
    action(db, teacher1, 'submission.review', {
      id: first.id,
      expectedVersion: 1,
      score: 7.5,
      feedback: 'First review',
    })
    assert.throws(
      () =>
        action(db, teacher1, 'submission.review', {
          id: first.id,
          expectedVersion: 2,
          score: 9,
          feedback: 'Overwrite',
        }),
      status(409),
    )
    draft(db, student1, assignment, 'Second answer', 1)
    assert.equal(getPortalState(db, teacher1).submissions[0]!.answer, 'My original answer')
    const second = submission(db, student1, assignment, 'request-two', 2, 1)
    assert.equal(second.revision, 2)
    assert.equal(second.review, null)
    const state = getPortalState(db, student1)
    assert.equal(state.submissions.length, 2)
    assert.equal(state.submissions[0]!.review!.feedback, 'First review')
    assert.ok(!JSON.stringify(getPortalState(db, teacher1)).includes('PRIVATE STUDENT NOTES'))
    assert.ok(!JSON.stringify(getPortalState(db, admin)).includes('PRIVATE STUDENT NOTES'))
    const updated = action(db, teacher1, 'assignment.save', {
      ...assignment,
      expectedVersion: 1,
      instructions: { vi: 'Mới', en: 'New instructions' },
    }).state.assignments[0]!
    assert.equal(updated.version, 2)
    assert.equal(getPortalState(db, student1).submissions[0]!.instructions.en, 'Respond')
    assert.throws(() => draft(db, student1, assignment, 'Old instructions', 2), status(409))
    assert.throws(() => submission(db, student1, updated, 'stale-draft', 2, 2), status(409))
  } finally {
    db.close()
  }
})

test('optimistic updates and current membership checks reject stale editors without losing saved work', () => {
  const { db, admin, teacher1, student1, class1 } = setup()
  try {
    const assignment = task(db, teacher1, class1)
    draft(db, student1, assignment)
    assert.throws(() => draft(db, student1, assignment, 'stale', 0), status(409))
    assert.equal(getPortalState(db, student1).drafts[0]!.answer, 'My original answer')
    assert.throws(
      () => action(db, admin, 'class.save', { ...class1, expectedVersion: 0 }),
      status(409),
    )
    assert.throws(
      () =>
        action(db, admin, 'class.save', {
          ...class1,
          expectedVersion: 1,
          teacherIds: [student1.id],
        }),
      status(400),
    )
    action(db, admin, 'class.save', {
      ...class1,
      expectedVersion: 1,
      teacherIds: [],
      studentIds: [],
    })
    assert.throws(
      () => action(db, teacher1, 'assignment.save', { ...assignment, expectedVersion: 1 }),
      status(404),
    )
    assert.throws(() => draft(db, student1, assignment, 'removed student', 1), status(404))
    assert.equal(getPortalState(db, student1).drafts.length, 0)
    db.prepare('UPDATE users SET active=0 WHERE id=?').run(student1.id)
    assert.throws(() => getPortalState(db, student1), status(401))
  } finally {
    db.close()
  }
})

test('vocabulary and recipient notification state stay private, and public courses disclose no roster', () => {
  const { db, admin, teacher1, teacher2, student1, student2, class1 } = setup()
  try {
    const word = action(db, student1, 'word.save', {
      expectedVersion: 0,
      word: 'practice',
      meaning: 'luyện tập',
      example: '',
      topic: '',
    }).state.words[0]!
    assert.equal(getPortalState(db, admin).words.length, 0)
    assert.equal(getPortalState(db, student2).words.length, 0)
    assert.throws(
      () => action(db, student2, 'word.delete', { id: word.id, expectedVersion: 1 }),
      status(404),
    )
    assert.throws(
      () =>
        action(db, teacher2, 'notification.create', {
          classId: class1.id,
          recipientIds: [student1.id],
          title: 'Private',
          body: 'Hi',
        }),
      status(404),
    )
    action(db, teacher1, 'notification.create', {
      classId: class1.id,
      recipientIds: [student1.id, student2.id],
      title: 'Reminder',
      body: 'Practice',
    })
    const own = getPortalState(db, student1).notifications[0]!
    assert.throws(() => action(db, student2, 'notification.read', { id: own.id }), status(404))
    action(db, student1, 'notification.read', { id: own.id })
    assert.equal(getPortalState(db, student1).notifications[0]!.read, true)
    assert.equal(getPortalState(db, student2).notifications[0]!.read, false)
    action(db, admin, 'class.save', { ...class1, expectedVersion: 1, listed: true })
    const catalog = getPublicCourses(db)
    assert.equal(catalog.length, 1)
    assert.deepEqual(Object.keys(catalog[0]!).sort(), [
      'description',
      'enrollmentOpen',
      'id',
      'level',
      'title',
    ])
  } finally {
    db.close()
  }
})

test('file bytes and attachments enforce private drafts, publication, assignment scope and valid media', () => {
  const { db, admin, teacher1, teacher2, student1, student2, assistant, class1 } = setup()
  try {
    const assignment = task(db, teacher1, class1)
    const pdf = Buffer.from('%PDF-1.7\nTest document')
    const file = uploadFile(
      db,
      student1,
      { classId: class1.id, purpose: 'submission', name: 'work.pdf', mime: 'application/pdf' },
      pdf,
    )
    assert.deepEqual(getFile(db, student1, file.id).bytes, pdf)
    for (const actor of [teacher1, teacher2, admin, student2, assistant])
      assert.throws(() => getFile(db, actor, file.id), status(404))
    assert.throws(
      () => draft(db, student2, assignment, 'Trying another draft', 0, [file.id]),
      status(403),
    )
    draft(db, student1, assignment, '', 0, [file.id])
    submission(db, student1, assignment)
    assert.deepEqual(getFile(db, teacher1, file.id).bytes, pdf)
    assert.deepEqual(getFile(db, admin, file.id).bytes, pdf)
    assert.throws(() => getFile(db, assistant, file.id), status(404))
    assert.throws(() => getFile(db, student2, file.id), status(404))
    const material = uploadFile(
      db,
      teacher1,
      { classId: class1.id, purpose: 'material', name: 'resource.pdf', mime: 'application/pdf' },
      pdf,
    )
    assert.throws(() => getFile(db, student1, material.id), status(404))
    action(db, teacher1, 'material.save', {
      expectedVersion: 0,
      classId: class1.id,
      title: 'Resource',
      content: '',
      published: true,
      attachmentIds: [material.id],
    })
    assert.deepEqual(getFile(db, student1, material.id).bytes, pdf)
    assert.throws(
      () =>
        uploadFile(
          db,
          student1,
          {
            classId: class1.id,
            purpose: 'material',
            name: 'forbidden.pdf',
            mime: 'application/pdf',
          },
          pdf,
        ),
      status(403),
    )
    assert.throws(
      () =>
        uploadFile(
          db,
          student1,
          { classId: class1.id, purpose: 'submission', name: '../x.pdf', mime: 'application/pdf' },
          pdf,
        ),
      status(400),
    )
    assert.throws(
      () =>
        uploadFile(
          db,
          student1,
          { classId: class1.id, purpose: 'submission', name: 'spoof.pdf', mime: 'application/pdf' },
          Buffer.from('<html>spoof</html>'),
        ),
      status(400),
    )
    assert.throws(
      () =>
        uploadFile(
          db,
          student1,
          { classId: class1.id, purpose: 'submission', name: 'large.pdf', mime: 'application/pdf' },
          Buffer.alloc(8 * 1024 * 1024 + 1),
        ),
      status(400),
    )
  } finally {
    db.close()
  }
})

test('booking capacity, ownership, schedule conflicts and server-side homework gates protect private Zoom links', () => {
  const { db, admin, teacher1, student1, student2, class1 } = setup()
  try {
    const assignment = task(db, teacher1, class1)
    const startsAt = new Date(Date.now() + 86400000).toISOString()
    const endsAt = new Date(Date.now() + 90000000).toISOString()
    const create = {
      expectedVersion: 0,
      classId: class1.id,
      title: 'Consultation',
      startsAt,
      endsAt,
      hostId: teacher1.id,
      kind: 'consultation',
      capacity: 1,
      cancelled: false,
      meetingUrl: 'https://zoom.us/j/123456789?pwd=private',
    }
    const result = action(db, teacher1, 'lesson.save', create)
    const lesson = result.state.lessons[0]!
    assert.equal(lesson.hasMeeting, true)
    assert.ok(!JSON.stringify(getPortalState(db, admin)).includes('pwd=private'))
    assert.throws(
      () =>
        action(db, teacher1, 'lesson.save', {
          ...create,
          meetingUrl: 'https://zoom.us.evil.test/j/123',
        }),
      status(400),
    )
    assert.throws(() => action(db, teacher1, 'lesson.save', create), status(409))
    const booking = action(db, student1, 'booking.create', { lessonId: lesson.id }).state
      .bookings[0]!
    assert.throws(
      () => action(db, student2, 'booking.create', { lessonId: lesson.id }),
      status(409),
    )
    assert.throws(
      () => action(db, student2, 'booking.cancel', { id: booking.id, expectedVersion: 1 }),
      status(404),
    )
    assert.throws(() => action(db, student2, 'lesson.join', { id: lesson.id }), status(403))
    assert.throws(() => action(db, student1, 'lesson.join', { id: lesson.id }), status(403))
    draft(db, student1, assignment)
    submission(db, student1, assignment)
    assert.equal(
      action(db, student1, 'lesson.join', { id: lesson.id }).result!.url,
      create.meetingUrl,
    )
    action(db, student1, 'booking.cancel', { id: booking.id, expectedVersion: 1 })
    action(db, student2, 'booking.create', { lessonId: lesson.id })
    assert.throws(() => action(db, student1, 'lesson.join', { id: lesson.id }), status(403))
  } finally {
    db.close()
  }
})

test('database restart preserves submissions, reviews, notifications, file bytes and reservations', () => {
  const directory = mkdtempSync(join(tmpdir(), 'project-l-domain-'))
  const path = join(directory, 'portal.sqlite')
  const fixture = setup(path)
  let db = fixture.db
  try {
    const assignment = task(db, fixture.teacher1, fixture.class1)
    const file = uploadFile(
      db,
      fixture.student1,
      {
        classId: fixture.class1.id,
        purpose: 'submission',
        name: 'speech.webm',
        mime: 'audio/webm',
      },
      Buffer.from([26, 69, 223, 163, 0, 0]),
    )
    draft(db, fixture.student1, assignment, '', 0, [file.id])
    const work = submission(db, fixture.student1, assignment)
    action(db, fixture.teacher1, 'submission.review', {
      id: work.id,
      expectedVersion: 1,
      score: 6,
      feedback: 'Persisted feedback',
    })
    const lesson = action(db, fixture.teacher1, 'lesson.save', {
      expectedVersion: 0,
      classId: fixture.class1.id,
      title: 'Review',
      startsAt: new Date(Date.now() + 86400000).toISOString(),
      endsAt: new Date(Date.now() + 90000000).toISOString(),
      kind: 'consultation',
      hostId: fixture.teacher1.id,
      capacity: 1,
      cancelled: false,
      meetingUrl: '',
    }).state.lessons[0]!
    action(db, fixture.student1, 'booking.create', { lessonId: lesson.id })
    db.close()
    db = openDatabase(path)
    const state = getPortalState(db, fixture.student1)
    assert.equal(state.submissions[0]!.review!.feedback, 'Persisted feedback')
    assert.equal(state.bookings[0]!.lessonId, lesson.id)
    assert.equal(state.notifications.length, 1)
    assert.equal(getFile(db, fixture.teacher1, file.id).bytes.length, 6)
    assert.equal(submission(db, fixture.student1, assignment).id, work.id)
    assert.equal(getPortalState(db, fixture.student1).submissions.length, 1)
  } finally {
    db.close()
    rmSync(directory, { recursive: true, force: true })
  }
})

test('booking and joining recheck the active host role and current class assignment', () => {
  const { db, admin, teacher1, student1, student2, class1 } = setup()
  try {
    const lesson = action(db, teacher1, 'lesson.save', {
      expectedVersion: 0,
      classId: class1.id,
      title: 'Consultation',
      startsAt: new Date(Date.now() + 86400000).toISOString(),
      endsAt: new Date(Date.now() + 90000000).toISOString(),
      kind: 'consultation',
      hostId: teacher1.id,
      capacity: 1,
      cancelled: false,
      meetingUrl: 'https://zoom.us/j/123456789',
    }).state.lessons[0]!
    action(db, student1, 'booking.create', { lessonId: lesson.id })
    assert.equal(
      action(db, student1, 'lesson.join', { id: lesson.id }).result!.url,
      'https://zoom.us/j/123456789',
    )
    for (const change of ['active=0', "active=1,role='student'", "active=1,role='teacher'"]) {
      db.exec(`UPDATE users SET ${change} WHERE id='teacher1'`)
      if (change === "active=1,role='teacher'")
        action(db, admin, 'class.save', { ...class1, expectedVersion: 1, teacherIds: [] })
      assert.throws(
        () => action(db, student2, 'booking.create', { lessonId: lesson.id }),
        (error) => error instanceof HttpError && error.code === 'host_unavailable',
      )
      assert.throws(
        () => action(db, student1, 'lesson.join', { id: lesson.id }),
        (error) => error instanceof HttpError && error.code === 'host_unavailable',
      )
    }
    assert.equal(getPortalState(db, student2).bookings.length, 0)
  } finally {
    db.close()
  }
})
