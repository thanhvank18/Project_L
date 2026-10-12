import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import type { Account, Assignment, Role, Skill, StudyWorkspace } from '../shared/portal.ts'
import { studyLimits } from '../shared/study.ts'
import { getAccount, openDatabase, type Database } from './db.ts'
import { getPortalState, runAction } from './domain.ts'
import { get, put } from './domain-store.ts'
import { HttpError } from './errors.ts'

function account(db: Database, id: string, role: Role): Account {
  db.prepare(
    'INSERT INTO users(id,name,email,role,active,version,created_at,password_hash) VALUES(?,?,?,?,1,1,?,?)',
  ).run(id, id, `${id}@example.test`, role, new Date().toISOString(), 'unused-test-password')
  return getAccount(db, id)!
}
const action = (db: Database, actor: Account, type: string, payload: Record<string, unknown>) =>
  runAction(db, actor, { type, payload })
const status = (expected: number) => (error: unknown) =>
  error instanceof HttpError && error.status === expected
const annotation = {
  id: 'note-1',
  locale: 'en',
  start: 0,
  end: 4,
  quote: 'Read',
  note: 'PRIVATE ANNOTATION',
}
const emptyMap = { nodes: [], strokes: [] }
const map = {
  nodes: [
    { id: 'root', parentId: null, text: 'PRIVATE MAP ROOT' },
    { id: 'branch', parentId: 'root', text: 'One idea' },
  ],
  strokes: [
    {
      id: 'stroke-1',
      points: [
        { x: 0, y: 0 },
        { x: 0.3, y: 1 },
        { x: 1, y: 0.5 },
      ],
    },
  ],
}
function setup(path = ':memory:') {
  const db = openDatabase(path)
  const admin = account(db, 'admin', 'admin')
  const teacher = account(db, 'teacher', 'teacher')
  const assistant = account(db, 'assistant', 'assistant')
  const student = account(db, 'student', 'student')
  const other = account(db, 'other', 'student')
  const outsider = account(db, 'outsider', 'student')
  const room = action(db, admin, 'class.save', {
    title: 'Study class',
    level: '',
    description: '',
    teacherIds: [teacher.id],
    assistantIds: [assistant.id],
    studentIds: [student.id, other.id],
    active: true,
    listed: false,
    expectedVersion: 0,
  }).state.classes[0]!
  const task = (skill: Skill, published = true) =>
    action(db, teacher, 'assignment.save', {
      classId: room.id,
      title: { vi: 'Bài học', en: 'Assignment' },
      instructions: { vi: 'Đọc về học tập.', en: 'Read 🌍 about learning. Listen again.' },
      skill,
      dueAt: '',
      published,
      required: false,
      attachmentIds: [],
      expectedVersion: 0,
    }).state.assignments.at(-1)!
  const reading = task('reading')
  return { db, admin, teacher, assistant, student, other, outsider, room, reading, task }
}
function save(
  db: Database,
  actor: Account,
  assignment: Assignment,
  overrides: Record<string, unknown> = {},
): StudyWorkspace {
  const result = action(db, actor, 'study.save', {
    assignmentId: assignment.id,
    assignmentVersion: assignment.version,
    expectedVersion: 0,
    annotations: [annotation],
    mindMap: map,
    ...overrides,
  })
  return result.state.studyWorkspaces.find((workspace) => workspace.id === result.result!.id)!
}

function withQuestions(
  db: Database,
  teacher: Account,
  assignment: Assignment,
  questionIds = ['first', 'second'],
): Assignment {
  return action(db, teacher, 'assignment.save', {
    ...assignment,
    expectedVersion: assignment.version,
    reading: {
      startNumber: 1,
      groups: [
        {
          id: 'group',
          title: { vi: 'Câu hỏi', en: 'Questions' },
          instructions: { vi: '', en: '' },
          questions: questionIds.map((id) => ({
            id,
            kind: 'short',
            prompt: { vi: 'Viết một từ.', en: 'Write one word.' },
            maxWords: 1,
          })),
        },
      ],
    },
  }).state.assignments.find((item) => item.id === assignment.id)!
}

test('private reading/listening annotations and both map modes persist; Writing maps are independent of submissions', () => {
  const { db, student, other, admin, teacher, assistant, reading, task } = setup()
  try {
    const first = save(db, student, reading, {
      annotations: [
        annotation,
        { id: 'overlap', locale: 'en', start: 0, end: 7, quote: 'Read 🌍', note: '' },
        { id: 'unicode', locale: 'en', start: 5, end: 7, quote: '🌍', note: '' },
        { id: 'vietnamese', locale: 'vi', start: 0, end: 3, quote: 'Đọc', note: 'Ghi chú' },
      ],
    })
    assert.equal(first.studentId, student.id)
    assert.equal(first.assignmentVersion, 1)
    assert.deepEqual(first.mindMap, map)
    assert.equal(first.annotations.length, 4)
    const listening = task('listening')
    assert.equal(save(db, student, listening).annotations[0]!.quote, 'Read')
    const writing = task('writing')
    assert.deepEqual(save(db, student, writing, { annotations: [] }).mindMap, map)
    for (const actor of [other, admin, teacher, assistant]) {
      assert.deepEqual(getPortalState(db, actor).studyWorkspaces, [])
      assert.ok(!JSON.stringify(getPortalState(db, actor)).includes('PRIVATE ANNOTATION'))
      assert.ok(!JSON.stringify(getPortalState(db, actor)).includes('PRIVATE MAP ROOT'))
    }
    action(db, student, 'draft.save', {
      assignmentId: reading.id,
      assignmentVersion: 1,
      expectedVersion: 0,
      answer: 'My submitted answer',
      notes: '',
      attachmentIds: [],
    })
    const submitted = action(db, student, 'submission.create', {
      assignmentId: reading.id,
      assignmentVersion: 1,
      draftVersion: 1,
      expectedRevision: 0,
      requestId: 'study-submission',
    }).state.submissions[0]!
    assert.equal(submitted.answer, 'My submitted answer')
    assert.ok(!JSON.stringify(submitted).includes('PRIVATE'))
    assert.ok(!JSON.stringify(getPortalState(db, teacher)).includes('PRIVATE'))
  } finally {
    db.close()
  }
})

test('workspace identity is server-derived and optimistic conflicts preserve saved content', () => {
  const { db, student, other, reading } = setup()
  try {
    const mine = save(db, student, reading)
    const theirs = save(db, other, reading, {
      id: mine.id,
      studentId: student.id,
      annotations: [],
      mindMap: emptyMap,
    })
    assert.notEqual(mine.id, theirs.id)
    assert.equal(theirs.studentId, other.id)
    assert.deepEqual(getPortalState(db, student).studyWorkspaces, [mine])
    assert.throws(() => save(db, student, reading), status(409))
    assert.throws(() => save(db, student, reading, { expectedVersion: 50 }), status(409))
    assert.deepEqual(getPortalState(db, student).studyWorkspaces, [mine])
    const cleared = save(db, student, reading, {
      expectedVersion: mine.version,
      annotations: [],
      mindMap: emptyMap,
    })
    assert.equal(cleared.version, mine.version + 1)
    assert.equal(cleared.id, mine.id)
    assert.deepEqual(cleared.annotations, [])
    assert.deepEqual(cleared.mindMap, emptyMap)
  } finally {
    db.close()
  }
})

test('current published assignment version gates edits while earlier private versions remain readable', () => {
  const { db, student, teacher, reading } = setup()
  try {
    const earlier = save(db, student, reading)
    const revised = action(db, teacher, 'assignment.save', {
      ...reading,
      expectedVersion: reading.version,
      instructions: { vi: 'Đề bài mới', en: 'New prompt.' },
    }).state.assignments[0]!
    assert.throws(
      () => save(db, student, reading, { expectedVersion: earlier.version }),
      status(409),
    )
    const current = save(db, student, revised, { annotations: [] })
    assert.notEqual(current.id, earlier.id)
    assert.equal(current.version, 1)
    assert.deepEqual(getPortalState(db, student).studyWorkspaces, [earlier, current])
    put(db, 'assignment', { ...revised, published: false })
    assert.deepEqual(getPortalState(db, student).studyWorkspaces, [])
    assert.throws(
      () => save(db, student, revised, { expectedVersion: current.version }),
      status(404),
    )
    assert.deepEqual(get<StudyWorkspace>(db, 'studyWorkspace', earlier.id), earlier)
  } finally {
    db.close()
  }
})

test('save and reads recheck current student role, status, enrollment and class visibility', () => {
  const { db, student, outsider, admin, teacher, assistant, reading, room } = setup()
  try {
    const saved = save(db, student, reading)
    for (const actor of [admin, teacher, assistant])
      assert.throws(() => save(db, actor, reading), status(403))
    assert.throws(() => save(db, outsider, reading), status(404))
    db.prepare('UPDATE users SET role=? WHERE id=?').run('teacher', student.id)
    put(db, 'class', { ...room, teacherIds: [...room.teacherIds, student.id] })
    assert.deepEqual(getPortalState(db, student).studyWorkspaces, [])
    assert.throws(() => save(db, student, reading, { expectedVersion: saved.version }), status(403))
    db.prepare('UPDATE users SET role=?,active=0 WHERE id=?').run('student', student.id)
    assert.throws(() => save(db, student, reading), status(401))
    db.prepare('UPDATE users SET active=1 WHERE id=?').run(student.id)
    put(db, 'class', { ...room, studentIds: [] })
    assert.deepEqual(getPortalState(db, student).studyWorkspaces, [])
    assert.throws(() => save(db, student, reading, { expectedVersion: saved.version }), status(404))
    put(db, 'class', { ...room, active: false })
    assert.deepEqual(getPortalState(db, student).studyWorkspaces, [])
    assert.throws(() => save(db, student, reading, { expectedVersion: saved.version }), status(404))
  } finally {
    db.close()
  }
})

test('annotations reject mismatched text, invalid locale/range, duplicate IDs and unsupported skills', () => {
  const { db, student, reading, task } = setup()
  try {
    const invalidAnnotations = [
      null,
      {},
      [{ ...annotation, locale: 'fr' }],
      [{ ...annotation, quote: 'Wrong' }],
      [{ ...annotation, start: -1 }],
      [{ ...annotation, end: 999 }],
      [{ ...annotation, start: 4, end: 4 }],
      [{ ...annotation, start: 0.5 }],
      [{ ...annotation, start: 6, end: 7, quote: '\udf0d' }],
      [annotation, annotation],
      [{ ...annotation, note: 'n'.repeat(studyLimits.annotationNote + 1) }],
      [{ ...annotation, id: '../unsafe' }],
      Array.from({ length: studyLimits.annotations + 1 }, (_, index) => ({
        ...annotation,
        id: `a-${index}`,
      })),
    ]
    for (const annotations of invalidAnnotations)
      assert.throws(() => save(db, student, reading, { annotations }), status(400))
    assert.throws(() => save(db, student, task('writing')), status(400))
    assert.throws(() => save(db, student, task('speaking'), { annotations: [] }), status(400))
    assert.deepEqual(getPortalState(db, student).studyWorkspaces, [])
  } finally {
    db.close()
  }
})

test('mind-map validation rejects missing parents, duplicate roots/IDs and cycles without partial saves', () => {
  const { db, student, reading } = setup()
  try {
    const node = { id: 'one', parentId: null, text: 'Idea' }
    const invalidNodes = [
      [node, node],
      [{ ...node, parentId: 'missing' }],
      [node, { ...node, id: 'two' }],
      [node, { id: 'self', parentId: 'self', text: 'Cycle' }],
      [node, { id: 'a', parentId: 'b', text: 'A' }, { id: 'b', parentId: 'a', text: 'B' }],
      [node, { id: 'missing-parent', parentId: 'absent', text: 'Missing' }],
      [{ ...node, text: ' ' }],
      [{ ...node, text: 'x'.repeat(studyLimits.nodeText + 1) }],
      Array.from({ length: studyLimits.nodes + 1 }, (_, index) => ({
        ...node,
        id: `node-${index}`,
        parentId: index ? 'node-0' : null,
      })),
    ]
    for (const nodes of invalidNodes)
      assert.throws(
        () => save(db, student, reading, { mindMap: { nodes, strokes: [] } }),
        status(400),
      )
    assert.deepEqual(getPortalState(db, student).studyWorkspaces, [])
  } finally {
    db.close()
  }
})

test('combined UTF-8 payload is bounded even when individual annotations are within limits', () => {
  const { db, student, reading } = setup()
  try {
    const prompt = '文'.repeat(studyLimits.annotationQuote)
    const largePrompt = { ...reading, instructions: { vi: prompt, en: prompt } }
    put(db, 'assignment', largePrompt)
    const annotations = Array.from({ length: studyLimits.annotations }, (_, index) => ({
      id: `annotation-${index}`,
      locale: 'en',
      start: 0,
      end: prompt.length,
      quote: prompt,
      note: '文'.repeat(studyLimits.annotationNote),
    }))
    assert.throws(
      () => save(db, student, largePrompt, { annotations, mindMap: emptyMap }),
      status(400),
    )
    assert.deepEqual(getPortalState(db, student).studyWorkspaces, [])
  } finally {
    db.close()
  }
})

test('freehand drawing rejects invalid coordinates, duplicates and bounded counts; storage survives reopen', () => {
  const directory = mkdtempSync(join(tmpdir(), 'project-l-study-'))
  const path = join(directory, 'study.sqlite')
  const fixture = setup(path)
  let db = fixture.db
  const { student, reading } = fixture
  try {
    const point = { x: 0.5, y: 0.5 }
    const stroke = { id: 'stroke', points: [point] }
    const invalidStrokes = [
      [stroke, stroke],
      [{ ...stroke, points: [] }],
      [{ ...stroke, points: [{ x: -1, y: 0 }] }],
      [{ ...stroke, points: [{ x: 0, y: 1.1 }] }],
      [{ ...stroke, points: [{ x: NaN, y: 0 }] }],
      [{ ...stroke, points: [{ x: Infinity, y: 0 }] }],
      [{ ...stroke, points: [{ x: '0.5', y: 0 }] }],
      [{ ...stroke, points: Array.from({ length: studyLimits.pointsPerStroke + 1 }, () => point) }],
      Array.from({ length: studyLimits.strokes + 1 }, (_, index) => ({
        ...stroke,
        id: `stroke-${index}`,
      })),
      Array.from(
        { length: studyLimits.totalPoints / studyLimits.pointsPerStroke + 1 },
        (_, index) => ({
          id: `stroke-${index}`,
          points: Array.from({ length: studyLimits.pointsPerStroke }, () => point),
        }),
      ),
    ]
    for (const strokes of invalidStrokes)
      assert.throws(
        () => save(db, student, reading, { mindMap: { nodes: [], strokes } }),
        status(400),
      )
    const saved = save(db, student, reading)
    db.close()
    db = openDatabase(path)
    assert.deepEqual(getPortalState(db, student).studyWorkspaces, [saved])
  } finally {
    db.close()
    rmSync(directory, { recursive: true, force: true })
  }
})

test('Reading review markers persist across reopen, old-client note saves preserve them and explicit empty lists clear them', () => {
  const directory = mkdtempSync(join(tmpdir(), 'project-l-study-review-'))
  const path = join(directory, 'study.sqlite')
  const fixture = setup(path)
  let db = fixture.db
  const { student, teacher } = fixture
  try {
    const assignment = withQuestions(db, teacher, fixture.reading)
    const saved = save(db, student, assignment, {
      readingReview: { flaggedQuestionIds: ['second'] },
    })
    assert.deepEqual(saved.readingReview, { flaggedQuestionIds: ['second'] })
    db.close()
    db = openDatabase(path)
    assert.deepEqual(getPortalState(db, student).studyWorkspaces, [saved])
    const noteEdit = save(db, student, assignment, {
      expectedVersion: saved.version,
      annotations: [{ ...annotation, note: 'A revised private note' }],
    })
    assert.deepEqual(noteEdit.readingReview, saved.readingReview)
    const cleared = save(db, student, assignment, {
      expectedVersion: noteEdit.version,
      readingReview: { flaggedQuestionIds: [] },
    })
    assert.deepEqual(cleared.readingReview, { flaggedQuestionIds: [] })
    assert.equal(cleared.version, noteEdit.version + 1)
  } finally {
    db.close()
    rmSync(directory, { recursive: true, force: true })
  }
})

test('review markers are private to each student for Reading and Listening and never enter submitted work', () => {
  const { db, student, other, admin, teacher, assistant, reading, task } = setup()
  try {
    for (const assignment of [reading, task('listening')]) {
      const structured = withQuestions(db, teacher, assignment)
      const mine = save(db, student, structured, {
        readingReview: { flaggedQuestionIds: ['first'] },
      })
      const theirs = save(db, other, structured, {
        id: mine.id,
        studentId: student.id,
        readingReview: { flaggedQuestionIds: ['second'] },
      })
      assert.notEqual(mine.id, theirs.id)
      for (const actor of [admin, teacher, assistant])
        assert.deepEqual(getPortalState(db, actor).studyWorkspaces, [])
      assert.ok(
        getPortalState(db, other).studyWorkspaces.every((item) => item.studentId === other.id),
      )
      assert.ok(
        getPortalState(db, student).studyWorkspaces.every((item) => item.studentId === student.id),
      )
      action(db, student, 'draft.save', {
        assignmentId: structured.id,
        assignmentVersion: structured.version,
        expectedVersion: 0,
        answer: '',
        notes: '',
        attachmentIds: [],
        readingAnswers: { first: 'One', second: 'Two' },
      })
      const submitted = action(db, student, 'submission.create', {
        assignmentId: structured.id,
        assignmentVersion: structured.version,
        draftVersion: 1,
        expectedRevision: 0,
        requestId: `review-markers-${structured.id}`,
      }).state.submissions.find((item) => item.assignmentId === structured.id)!
      assert.ok(!JSON.stringify(submitted).includes('readingReview'))
      assert.ok(!JSON.stringify(getPortalState(db, teacher)).includes('flaggedQuestionIds'))
    }
  } finally {
    db.close()
  }
})

test('review markers reject malformed, duplicate, unknown and excessive IDs without overwriting notes', () => {
  const { db, student, teacher, reading, task } = setup()
  try {
    const ids = Array.from({ length: 40 }, (_, index) => `question-${index}`)
    const structured = withQuestions(db, teacher, reading, ids)
    const saved = save(db, student, structured, { readingReview: { flaggedQuestionIds: ids } })
    assert.equal(saved.readingReview!.flaggedQuestionIds.length, 40)
    for (const readingReview of [
      null,
      [],
      {},
      { flaggedQuestionIds: null },
      { flaggedQuestionIds: 'question-0' },
      { flaggedQuestionIds: [null] },
      { flaggedQuestionIds: [1] },
      { flaggedQuestionIds: [''] },
      { flaggedQuestionIds: ['missing'] },
      { flaggedQuestionIds: ['question-0', 'question-0'] },
      { flaggedQuestionIds: [...ids, 'question-40'] },
    ])
      assert.throws(
        () => save(db, student, structured, { expectedVersion: saved.version, readingReview }),
        status(400),
      )
    assert.deepEqual(getPortalState(db, student).studyWorkspaces, [saved])
    for (const unstructured of [
      task('reading'),
      task('listening'),
      task('writing'),
      task('speaking'),
    ])
      assert.throws(
        () =>
          save(db, student, unstructured, {
            annotations: [],
            readingReview: { flaggedQuestionIds: [] },
          }),
        status(400),
      )
    assert.deepEqual(getPortalState(db, student).studyWorkspaces, [saved])
  } finally {
    db.close()
  }
})

test('review flags stay attached to their exact assignment version and concurrent changes conflict', () => {
  const { db, student, teacher, reading } = setup()
  try {
    const structured = withQuestions(db, teacher, reading)
    const original = save(db, student, structured, {
      readingReview: { flaggedQuestionIds: ['first'] },
    })
    assert.throws(
      () => save(db, student, structured, { readingReview: { flaggedQuestionIds: ['second'] } }),
      status(409),
    )
    const changed = withQuestions(db, teacher, structured, ['third'])
    assert.throws(
      () =>
        save(db, student, structured, {
          expectedVersion: original.version,
          readingReview: { flaggedQuestionIds: [] },
        }),
      status(409),
    )
    assert.throws(
      () => save(db, student, changed, { readingReview: { flaggedQuestionIds: ['first'] } }),
      status(400),
    )
    const current = save(db, student, changed)
    assert.equal(current.readingReview, undefined)
    assert.notEqual(current.id, original.id)
    assert.deepEqual(get<StudyWorkspace>(db, 'studyWorkspace', original.id), original)
    assert.deepEqual(getPortalState(db, student).studyWorkspaces, [original, current])
  } finally {
    db.close()
  }
})

test('review flag saves recheck current role, membership, publication and account status', () => {
  const { db, student, outsider, admin, teacher, assistant, reading, room } = setup()
  try {
    const structured = withQuestions(db, teacher, reading)
    const flags = { readingReview: { flaggedQuestionIds: ['first'] } }
    for (const actor of [admin, teacher, assistant])
      assert.throws(() => save(db, actor, structured, flags), status(403))
    assert.throws(() => save(db, outsider, structured, flags), status(404))
    const saved = save(db, student, structured, flags)
    db.prepare('UPDATE users SET active=0 WHERE id=?').run(student.id)
    assert.throws(
      () => save(db, student, structured, { ...flags, expectedVersion: saved.version }),
      status(401),
    )
    db.prepare('UPDATE users SET active=1 WHERE id=?').run(student.id)
    put(db, 'class', { ...room, studentIds: [] })
    assert.throws(
      () => save(db, student, structured, { ...flags, expectedVersion: saved.version }),
      status(404),
    )
    assert.deepEqual(getPortalState(db, student).studyWorkspaces, [])
    put(db, 'class', room)
    put(db, 'assignment', { ...structured, published: false })
    assert.throws(
      () => save(db, student, structured, { ...flags, expectedVersion: saved.version }),
      status(404),
    )
    assert.deepEqual(getPortalState(db, student).studyWorkspaces, [])
    assert.deepEqual(get<StudyWorkspace>(db, 'studyWorkspace', saved.id), saved)
  } finally {
    db.close()
  }
})
