import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import type { Account, Classroom, EnrollmentRequest, Role } from '../shared/portal.ts'
import { getAccount, openDatabase, type Database } from './db.ts'
import { getPortalState, getPublicCourses, runAction } from './domain.ts'
import { get, put } from './domain-store.ts'
import { HttpError } from './errors.ts'

const status = (expected: number) => (error: unknown) =>
  error instanceof HttpError && error.status === expected
const errorCode = (expected: string) => (error: unknown) =>
  error instanceof HttpError && error.code === expected
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
  const other = account(db, 'other-student', 'student')
  const classroom = action(db, admin, 'class.save', {
    expectedVersion: 0,
    title: 'Open language class',
    level: 'B1',
    description: 'Public description',
    teacherIds: [teacher.id],
    assistantIds: [assistant.id],
    studentIds: [],
    active: true,
    listed: true,
    enrollmentOpen: true,
  }).state.classes[0]!
  return { db, admin, teacher, assistant, student, other, classroom }
}

function request(db: Database, student: Account, classroom: Classroom): EnrollmentRequest {
  const result = action(db, student, 'enrollment.request', { classId: classroom.id })
  return result.state.enrollmentRequests.find((item) => item.id === result.result!.id)!
}

function review(
  db: Database,
  admin: Account,
  item: EnrollmentRequest,
  decision: 'approved' | 'rejected' = 'approved',
  note = '',
) {
  return action(db, admin, 'enrollment.review', {
    id: item.id,
    expectedVersion: item.version,
    decision,
    note,
  })
}

test('open classes expose only public metadata and enrollment approval is the only access grant', () => {
  const { db, admin, teacher, assistant, student, other, classroom } = setup()
  try {
    const lesson = action(db, teacher, 'lesson.save', {
      classId: classroom.id,
      title: 'Private class session',
      kind: 'class',
      expectedVersion: 0,
      startsAt: new Date(Date.now() + 86400000).toISOString(),
      endsAt: new Date(Date.now() + 90000000).toISOString(),
      hostId: teacher.id,
      capacity: 20,
      cancelled: false,
      meetingUrl: 'https://zoom.us/j/123456789?pwd=private',
    }).state.lessons[0]!
    action(db, teacher, 'material.save', {
      classId: classroom.id,
      title: 'Private material',
      content: 'Members only',
      attachmentIds: [],
      published: true,
      expectedVersion: 0,
    })
    const before = getPortalState(db, student)
    assert.equal(before.openClasses.length, 1)
    assert.deepEqual(Object.keys(before.openClasses[0]!).sort(), [
      'description',
      'enrollmentOpen',
      'id',
      'level',
      'title',
    ])
    assert.equal(before.classes.length, 0)
    const pending = request(db, student, classroom)
    const state = getPortalState(db, student)
    assert.equal(state.classes.length, 0)
    assert.equal(state.classMeetings.length, 0)
    assert.equal(state.materials.length, 0)
    assert.equal(state.lessons.length, 0)
    assert.throws(() => action(db, student, 'lesson.join', { id: lesson.id }), status(404))
    assert.throws(() => action(db, student, 'booking.create', { lessonId: lesson.id }), status(404))
    assert.equal(getPortalState(db, other).enrollmentRequests.length, 0)
    assert.equal(getPortalState(db, teacher).enrollmentRequests.length, 0)
    assert.equal(getPortalState(db, assistant).enrollmentRequests.length, 0)
    assert.equal(getPortalState(db, admin).enrollmentRequests.length, 1)
    review(db, admin, pending)
    const approved = getPortalState(db, student)
    assert.equal(approved.classes[0]!.version, classroom.version + 1)
    assert.deepEqual(approved.classes[0]!.studentIds, [student.id])
    assert.equal(approved.materials[0]!.title, 'Private material')
    assert.equal(approved.lessons[0]!.id, lesson.id)
    assert.equal(approved.enrollmentRequests[0]!.status, 'approved')
    assert.equal(approved.notifications.length, 1)
    assert.ok(!JSON.stringify(getPublicCourses(db)).includes('studentIds'))
    assert.ok(!JSON.stringify(approved).includes('pwd=private'))
    assert.equal(
      action(db, student, 'lesson.join', { id: lesson.id }).result!.url,
      'https://zoom.us/j/123456789?pwd=private',
    )
  } finally {
    db.close()
  }
})

test('duplicate requests, forged ownership and non-admin approval are rejected atomically', () => {
  const { db, admin, teacher, assistant, student, other, classroom } = setup()
  try {
    for (const actor of [admin, teacher, assistant])
      assert.throws(() => request(db, actor, classroom), status(403))
    assert.throws(
      () =>
        action(db, student, 'enrollment.request', { classId: classroom.id, studentId: other.id }),
      status(400),
    )
    const pending = request(db, student, classroom)
    assert.throws(() => request(db, student, classroom), errorCode('enrollment_pending'))
    for (const actor of [student, other, teacher, assistant])
      assert.throws(() => review(db, actor, pending), status(403))
    assert.throws(
      () => action(db, other, 'enrollment.cancel', { id: pending.id, expectedVersion: 1 }),
      status(404),
    )
    assert.throws(() => review(db, admin, pending, 'approved', 'x'.repeat(2001)), status(400))
    assert.equal(getPortalState(db, admin).enrollmentRequests.length, 1)
    assert.equal(getPortalState(db, admin).classes[0]!.studentIds.length, 0)
    assert.equal(getPortalState(db, admin).notifications.length, 1)
  } finally {
    db.close()
  }
})

test('cancelled and rejected requests retain history, allow a new request and reject stale reviews', () => {
  const { db, admin, student, classroom } = setup()
  try {
    const first = request(db, student, classroom)
    action(db, student, 'enrollment.cancel', { id: first.id, expectedVersion: first.version })
    assert.throws(() => review(db, admin, first), errorCode('conflict'))
    assert.throws(
      () => review(db, admin, { ...first, version: 2 }),
      errorCode('enrollment_resolved'),
    )
    const second = request(db, student, classroom)
    assert.notEqual(second.id, first.id)
    review(db, admin, second, 'rejected', 'Please choose the next intake.')
    assert.throws(
      () =>
        action(db, student, 'enrollment.cancel', {
          id: second.id,
          expectedVersion: second.version,
        }),
      errorCode('conflict'),
    )
    const third = request(db, student, classroom)
    review(db, admin, third)
    assert.throws(() => review(db, admin, third), errorCode('conflict'))
    assert.throws(() => request(db, student, classroom), errorCode('already_enrolled'))
    const requests = getPortalState(db, student).enrollmentRequests
    assert.deepEqual(
      requests.map((item) => item.status),
      ['cancelled', 'rejected', 'approved'],
    )
    assert.equal(requests[1]!.note, 'Please choose the next intake.')
    assert.equal(requests[2]!.reviewedBy, admin.id)
    assert.equal(getPortalState(db, admin).classes[0]!.studentIds.length, 1)
  } finally {
    db.close()
  }
})

test('class closure and current student status are rechecked during approval; rejection remains possible', () => {
  const { db, admin, student, classroom } = setup()
  try {
    const pending = request(db, student, classroom)
    let current = classroom
    for (const change of [{ enrollmentOpen: false }, { listed: false }, { active: false }]) {
      current = action(db, admin, 'class.save', {
        ...current,
        active: true,
        listed: true,
        enrollmentOpen: true,
        ...change,
        expectedVersion: current.version,
      }).state.classes[0]!
      assert.throws(() => review(db, admin, pending), errorCode('enrollment_closed'))
      assert.throws(() => request(db, student, current), errorCode('enrollment_closed'))
      assert.equal(getPortalState(db, student).openClasses.length, 0)
      assert.equal(getPortalState(db, student).enrollmentRequests[0]!.classTitle, classroom.title)
      assert.equal(getPortalState(db, admin).classes[0]!.studentIds.length, 0)
    }
    current = action(db, admin, 'class.save', {
      ...current,
      active: true,
      listed: true,
      enrollmentOpen: true,
      expectedVersion: current.version,
    }).state.classes[0]!
    for (const change of ['active=0', "active=1,role='teacher'"]) {
      db.exec(`UPDATE users SET ${change} WHERE id='student'`)
      assert.throws(() => review(db, admin, pending), errorCode('student_unavailable'))
      assert.equal(getPortalState(db, admin).classes[0]!.studentIds.length, 0)
    }
    action(db, admin, 'class.save', {
      ...current,
      enrollmentOpen: false,
      expectedVersion: current.version,
    })
    review(db, admin, pending, 'rejected', 'Class closed')
    assert.equal(getPortalState(db, admin).enrollmentRequests[0]!.status, 'rejected')
  } finally {
    db.close()
  }
})

test('approval reconciles prior manual enrollment and class version conflicts without duplicate membership', () => {
  const { db, admin, student, other, classroom } = setup()
  try {
    const pending = request(db, student, classroom)
    const otherPending = request(db, other, classroom)
    const manuallyEnrolled = action(db, admin, 'class.save', {
      ...classroom,
      studentIds: [student.id],
      expectedVersion: classroom.version,
    }).state.classes[0]!
    review(db, admin, pending)
    assert.equal(getPortalState(db, admin).classes[0]!.version, manuallyEnrolled.version)
    review(db, admin, otherPending)
    const final = getPortalState(db, admin).classes[0]!
    assert.equal(final.version, manuallyEnrolled.version + 1)
    assert.deepEqual(final.studentIds, [student.id, other.id])
    assert.throws(
      () =>
        action(db, admin, 'class.save', {
          ...manuallyEnrolled,
          title: 'Stale write',
          expectedVersion: manuallyEnrolled.version,
        }),
      errorCode('conflict'),
    )
    assert.deepEqual(getPortalState(db, admin).classes[0]!.studentIds, [student.id, other.id])
  } finally {
    db.close()
  }
})

test('legacy enrollment defaults closed and existing flags survive ordinary class edits', () => {
  const { db, admin, student, classroom } = setup()
  try {
    const noFlag = { ...classroom } as Omit<Classroom, 'enrollmentOpen'> & {
      enrollmentOpen?: boolean
    }
    delete noFlag.enrollmentOpen
    put(db, 'class', noFlag)
    assert.equal(getPortalState(db, admin).classes[0]!.enrollmentOpen, false)
    assert.equal(getPublicCourses(db)[0]!.enrollmentOpen, false)
    assert.equal(getPortalState(db, student).openClasses.length, 0)
    let updated = action(db, admin, 'class.save', {
      ...noFlag,
      title: 'Updated',
      expectedVersion: classroom.version,
    }).state.classes[0]!
    assert.equal(updated.enrollmentOpen, false)
    updated = action(db, admin, 'class.save', {
      ...updated,
      enrollmentOpen: true,
      expectedVersion: updated.version,
    }).state.classes[0]!
    const saved = action(db, admin, 'class.save', {
      ...updated,
      enrollmentOpen: undefined,
      expectedVersion: updated.version,
    }).state.classes[0]!
    assert.equal(saved.enrollmentOpen, true)
  } finally {
    db.close()
  }
})

test('requests, approval membership and notices persist independently of subsequent public class changes', () => {
  const directory = mkdtempSync(join(tmpdir(), 'project-l-enrollment-'))
  const path = join(directory, 'portal.sqlite')
  const fixture = setup(path)
  let db = fixture.db
  try {
    const pending = request(db, fixture.student, fixture.classroom)
    db.close()
    db = openDatabase(path)
    assert.equal(getPortalState(db, fixture.admin).enrollmentRequests[0]!.id, pending.id)
    review(db, fixture.admin, pending)
    const classroom = get<Classroom>(db, 'class', fixture.classroom.id)!
    action(db, fixture.admin, 'class.save', {
      ...classroom,
      title: 'New course title',
      listed: false,
      enrollmentOpen: false,
      expectedVersion: classroom.version,
    })
    db.close()
    db = openDatabase(path)
    const state = getPortalState(db, fixture.student)
    assert.equal(state.classes[0]!.title, 'New course title')
    assert.equal(state.enrollmentRequests[0]!.classTitle, fixture.classroom.title)
    assert.equal(state.enrollmentRequests[0]!.status, 'approved')
    assert.equal(state.notifications.length, 1)
    assert.equal(state.openClasses.length, 0)
  } finally {
    db.close()
    rmSync(directory, { recursive: true, force: true })
  }
})
