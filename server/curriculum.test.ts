import assert from 'node:assert/strict'
import test from 'node:test'
import type { Account, Assignment, Classroom, Role } from '../shared/portal.ts'
import { openDatabase, getAccount } from './db.ts'
import { all, get, put, registerBeforeCommit, type Database } from './domain-store.ts'
import { getFile, getPortalState, getPublicCourses } from './domain.ts'
import {
  getStarterTeacherGuide,
  importStarterCurriculum,
  starterCurriculumStatus,
} from './curriculum.ts'
import { HttpError } from './errors.ts'
import { readingDefinition, readingResponse } from './reading.ts'
import { starterUnits } from './starter-curriculum-content.ts'

function account(db: Database, key: string, role: Role): Account {
  db.prepare(
    'INSERT INTO users(id,name,email,role,active,version,created_at,password_hash) VALUES(?,?,?,?,1,1,?,?)',
  ).run(key, key, `${key}@example.test`, role, new Date().toISOString(), 'unused-test-hash')
  return getAccount(db, key)!
}
const status = (expected: number) => (error: unknown) =>
  error instanceof HttpError && error.status === expected
function setup() {
  const db = openDatabase(':memory:')
  const admin = account(db, 'admin', 'admin')
  const teacher = account(db, 'teacher', 'teacher')
  const outsider = account(db, 'outsider', 'teacher')
  const assistant = account(db, 'assistant', 'assistant')
  const student = account(db, 'student', 'student')
  return { db, admin, teacher, outsider, assistant, student }
}

test('starter import is admin-only and rechecks current account status and role', () => {
  const { db, admin, teacher, assistant, student } = setup()
  try {
    assert.equal(starterCurriculumStatus(db, admin).imported, null)
    assert.equal(all(db, 'class').length, 0)
    for (const actor of [teacher, assistant, student]) {
      assert.throws(() => starterCurriculumStatus(db, actor), status(403))
      assert.throws(() => importStarterCurriculum(db, actor), status(403))
    }
    db.prepare('UPDATE users SET role = ? WHERE id = ?').run('student', admin.id)
    assert.throws(() => importStarterCurriculum(db, admin), status(403))
    db.prepare('UPDATE users SET role = ?, active = 0 WHERE id = ?').run('admin', admin.id)
    assert.throws(() => importStarterCurriculum(db, admin), status(401))
    assert.equal(all(db, 'class').length, 0)
  } finally {
    db.close()
  }
})

test('explicit import creates only a private empty-membership class and original draft learning materials', () => {
  const { db, admin } = setup()
  try {
    const usersBefore = db.prepare('SELECT count(*) AS count FROM users').get()!.count
    const result = importStarterCurriculum(db, admin)
    assert.equal(result.created, true)
    const state = getPortalState(db, admin)
    const room = state.classes[0]!
    assert.equal(room.id, result.classId)
    assert.equal(room.listed, false)
    assert.equal(room.enrollmentOpen, false)
    assert.deepEqual([room.teacherIds, room.assistantIds, room.studentIds], [[], [], []])
    assert.deepEqual(getPublicCourses(db), [])
    assert.equal(state.assignments.length, 12)
    assert.equal(state.units.length, 3)
    assert.equal(state.materials.length, 3)
    assert.equal(state.files.length, 3)
    assert.equal(
      state.assignments.every((task) => !task.published && !task.dueAt && task.version === 1),
      true,
    )
    assert.equal(
      state.materials.every((material) => !material.published),
      true,
    )
    for (const skill of ['reading', 'listening', 'writing', 'speaking'])
      assert.equal(state.assignments.filter((task) => task.skill === skill).length, 3)
    assert.equal(
      state.lessons.length +
        state.bookings.length +
        state.submissions.length +
        state.attendance.length +
        state.notifications.length,
      0,
    )
    assert.equal(db.prepare('SELECT count(*) AS count FROM users').get()!.count, usersBefore)
    assert.equal(starterCurriculumStatus(db, admin).imported?.classId, result.classId)
  } finally {
    db.close()
  }
})

test('repeated import is idempotent and preserves edited course content and unrelated records', () => {
  const { db, admin } = setup()
  try {
    put(db, 'material', {
      id: 'existing-material',
      classId: 'unrelated',
      title: 'Keep my material',
      version: 5,
    })
    const first = importStarterCurriculum(db, admin)
    const original = all<Assignment>(db, 'assignment')[0]!
    put(db, 'assignment', {
      ...original,
      title: { vi: 'Giáo viên đã sửa', en: 'Teacher revised' },
      version: 2,
    })
    const rowCount = db.prepare('SELECT count(*) AS count FROM records').get()!.count
    const second = importStarterCurriculum(db, admin)
    assert.equal(second.created, false)
    assert.equal(first.classId, second.classId)
    assert.equal(db.prepare('SELECT count(*) AS count FROM records').get()!.count, rowCount)
    assert.equal(get<Assignment>(db, 'assignment', original.id)!.title.en, 'Teacher revised')
    assert.equal(get<Assignment>(db, 'assignment', original.id)!.version, 2)
    assert.deepEqual(get(db, 'material', 'existing-material'), {
      id: 'existing-material',
      classId: 'unrelated',
      title: 'Keep my material',
      version: 5,
    })
    assert.equal(db.prepare('SELECT count(*) AS count FROM file_blobs').get()!.count, 3)
  } finally {
    db.close()
  }
})

test('teacher keys and transcripts are separate from learner state and require current assigned teacher access', () => {
  const { db, admin, teacher, outsider, assistant, student } = setup()
  try {
    const { classId } = importStarterCurriculum(db, admin)
    const room = get<Classroom>(db, 'class', classId)!
    put(db, 'class', {
      ...room,
      teacherIds: [teacher.id],
      assistantIds: [assistant.id],
      studentIds: [student.id],
    })
    const guide = getStarterTeacherGuide(db, teacher, classId)
    assert.match(guide.markdown, /Listening transcript/)
    assert.equal(guide.units.length, 3)
    assert.match(guide.notice.en, /teacher review/i)
    assert.match(guide.notice.vi, /giáo viên/)
    assert.deepEqual(guide.units[0]!.readingAnswers, starterUnits[0]!.readingAnswers)
    assert.equal(guide.units[0]!.listeningTranscript, starterUnits[0]!.transcript)
    assert.equal(
      guide.units.every((unit) => !Object.hasOwn(unit, 'assignmentIds')),
      true,
    )
    // Download retains useful record references; the structured reading surface omits them.
    const assignmentId = all<Assignment>(db, 'assignment')[0]!.id
    assert.equal(guide.markdown.includes(assignmentId), true)
    assert.equal(JSON.stringify(guide.units).includes(assignmentId), false)
    assert.match(getStarterTeacherGuide(db, admin, classId).markdown, /9:20/)
    assert.throws(() => getStarterTeacherGuide(db, outsider, classId), status(404))
    for (const actor of [assistant, student])
      assert.throws(() => getStarterTeacherGuide(db, actor, classId), status(403))
    for (const task of all<Assignment>(db, 'assignment'))
      put(db, 'assignment', { ...task, published: true })
    const state = getPortalState(db, student)
    assert.equal(state.assignments.length, 12)
    assert.equal(JSON.stringify(state).includes(starterUnits[0]!.transcript), false)
    assert.equal(JSON.stringify(state).includes('readingAnswers'), false)
    assert.equal(JSON.stringify(state).includes('curriculumTeacherGuide'), false)
    put(db, 'class', { ...room, teacherIds: [] })
    assert.throws(() => getStarterTeacherGuide(db, teacher, classId), status(404))
  } finally {
    db.close()
  }
})

test('draft audio uses real local PCM speech bytes and normal publication and membership access checks', () => {
  const { db, admin, student } = setup()
  try {
    const { classId } = importStarterCurriculum(db, admin)
    const room = get<Classroom>(db, 'class', classId)!
    put(db, 'class', { ...room, studentIds: [student.id] })
    const listening = all<Assignment>(db, 'assignment').filter((task) => task.skill === 'listening')
    for (const task of listening) {
      const key = task.attachmentIds[0]!
      const { bytes, record } = getFile(db, admin, key)
      assert.equal(record.mime, 'audio/wav')
      assert.equal(bytes.subarray(0, 4).toString(), 'RIFF')
      assert.equal(bytes.subarray(8, 12).toString(), 'WAVE')
      assert.equal(bytes.length > 1_000_000 && bytes.length < 8 * 1024 * 1024, true)
      assert.throws(() => getFile(db, student, key), status(404))
      put(db, 'assignment', { ...task, published: true })
      assert.equal(getFile(db, student, key).bytes.equals(bytes), true)
      put(db, 'assignment', { ...task, published: false })
      assert.throws(() => getFile(db, student, key), status(404))
    }
    assert.equal(getPortalState(db, student).files.length, 0)
  } finally {
    db.close()
  }
})

test('all original reading/listening question sets and teacher responses pass production validation', () => {
  for (const unit of starterUnits) {
    assert.equal(unit.passage.split(/\s+/u).length >= 240, true)
    assert.equal(unit.transcript.split(/\s+/u).length >= 150, true)
    for (const skill of ['reading', 'listening'] as const) {
      const definition = readingDefinition(unit[skill])
      const answers = unit[`${skill}Answers`]
      assert.deepEqual(readingResponse(answers, definition, true), answers)
      assert.equal(definition.groups.flatMap((group) => group.questions).length, 5)
      assert.equal(JSON.stringify(definition).includes('Answers'), false)
    }
  }
})

test('failure before commit rolls back every draft, import marker and audio blob', () => {
  const { db, admin } = setup()
  const unregister = registerBeforeCommit(db, () => {
    throw new Error('simulated commit failure')
  })
  try {
    assert.throws(() => importStarterCurriculum(db, admin), /simulated commit failure/)
    assert.equal(db.prepare('SELECT count(*) AS count FROM records').get()!.count, 0)
    assert.equal(db.prepare('SELECT count(*) AS count FROM file_blobs').get()!.count, 0)
    assert.equal(starterCurriculumStatus(db, admin).imported, null)
  } finally {
    unregister()
    db.close()
  }
})
