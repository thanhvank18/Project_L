import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import type {
  Account,
  Assignment,
  Draft,
  ActionResult,
  LiveState,
  ReadingDefinition,
  ReadingResponse,
  Role,
  Skill,
} from '../shared/portal.ts'
import { readingLimits } from '../shared/reading.ts'
import { getAccount, openDatabase, type Database } from './db.ts'
import { getFile, getPortalState, runAction, uploadFile } from './domain.ts'
import { put } from './domain-store.ts'
import { HttpError } from './errors.ts'
import { tokenHash } from './auth.ts'
import { createServer } from './http.ts'

const text = (value: string) => ({ vi: value, en: value })
const definition = (): ReadingDefinition => ({
  startNumber: 14,
  groups: [
    {
      id: 'group-one',
      title: text('Reading questions'),
      instructions: text(''),
      questions: [
        {
          id: 'paragraph',
          kind: 'single',
          prompt: text('Which paragraph?'),
          options: ['A', 'B', 'C'].map((id) => ({ id, label: text(`Paragraph ${id}`) })),
        },
        {
          id: 'two',
          kind: 'multiple',
          prompt: text('Choose two facts.'),
          selectCount: 2,
          options: ['A', 'B', 'C', 'D'].map((id) => ({ id, label: text(`Fact ${id}`) })),
        },
        { id: 'summary', kind: 'short', prompt: text('Write one word.'), maxWords: 1 },
      ],
    },
  ],
})
const answers: ReadingResponse = { paragraph: 'B', two: ['A', 'C'], summary: 'learning' }
const status = (expected: number) => (error: unknown) =>
  error instanceof HttpError && error.status === expected
const action = (db: Database, actor: Account, type: string, payload: Record<string, unknown>) =>
  runAction(db, actor, { type, payload })
function account(db: Database, id: string, role: Role): Account {
  db.prepare(
    'INSERT INTO users(id,name,email,role,active,version,created_at,password_hash) VALUES(?,?,?,?,1,1,?,?)',
  ).run(id, id, `${id}@example.test`, role, new Date().toISOString(), 'unused-test-password')
  return getAccount(db, id)!
}
function setup(path = ':memory:', skill: Skill = 'reading') {
  const db = openDatabase(path)
  const admin = account(db, 'admin', 'admin')
  const teacher = account(db, 'teacher', 'teacher')
  const assistant = account(db, 'assistant', 'assistant')
  const student = account(db, 'student', 'student')
  const other = account(db, 'other', 'student')
  const outsider = account(db, 'outsider', 'student')
  const room = action(db, admin, 'class.save', {
    title: 'Isolated Reading test',
    level: '',
    description: '',
    teacherIds: [teacher.id],
    assistantIds: [assistant.id],
    studentIds: [student.id, other.id],
    active: true,
    listed: false,
    expectedVersion: 0,
  }).state.classes[0]!
  const create = (overrides: Record<string, unknown> = {}, actor = teacher) => {
    const result = action(db, actor, 'assignment.save', {
      classId: room.id,
      title: text('Reading'),
      instructions: text('Read this original passage.'),
      skill,
      dueAt: '',
      published: true,
      required: true,
      attachmentIds: [],
      expectedVersion: 0,
      reading: definition(),
      ...overrides,
    })
    return result.state.assignments.find((item) => item.id === result.result!.id)!
  }
  const task = create()
  return { db, admin, teacher, assistant, student, other, outsider, room, task, create }
}
function draft(
  db: Database,
  student: Account,
  task: Assignment,
  overrides: Record<string, unknown> = {},
): Draft {
  const result = action(db, student, 'draft.save', {
    assignmentId: task.id,
    assignmentVersion: task.version,
    expectedVersion: 0,
    answer: '',
    notes: 'PRIVATE READING NOTES',
    attachmentIds: [],
    readingAnswers: answers,
    ...overrides,
  })
  return result.state.drafts.find((item) => item.assignmentId === task.id)!
}
function submit(
  db: Database,
  student: Account,
  task: Assignment,
  version = 1,
  revision = 0,
  requestId = 'submit-reading',
) {
  const result = action(db, student, 'submission.create', {
    assignmentId: task.id,
    assignmentVersion: task.version,
    draftVersion: version,
    expectedRevision: revision,
    requestId,
  })
  return result.state.submissions.find((item) => item.id === result.result!.id)!
}

test('Listening questions enforce complete responses, current access and immutable version snapshots', () => {
  const { db, teacher, assistant, student, outsider, room, task, create } = setup(
    ':memory:',
    'listening',
  )
  try {
    assert.equal(task.skill, 'listening')
    assert.deepEqual(task.reading, definition())
    for (const actor of [assistant, student]) assert.throws(() => create({}, actor), status(403))
    for (const skill of ['writing', 'speaking']) assert.throws(() => create({ skill }), status(400))
    const audioBytes = Buffer.from('ID3\x04\x00\x00\x00\x00\x00\x00Original listening material')
    const audio = uploadFile(
      db,
      teacher,
      { classId: room.id, purpose: 'material', name: 'listening.mp3', mime: 'audio/mpeg' },
      audioBytes,
    )
    const withAudio = action(db, teacher, 'assignment.save', {
      ...task,
      attachmentIds: [audio.id],
      expectedVersion: task.version,
    }).state.assignments.find((item) => item.id === task.id)!
    draft(db, student, withAudio, {
      answer: 'Supplementary notes do not bypass required answers.',
      readingAnswers: { paragraph: 'A', two: ['B'] },
    })
    assert.throws(() => submit(db, student, withAudio), status(400))
    assert.throws(
      () =>
        draft(db, student, withAudio, {
          expectedVersion: 1,
          readingAnswers: { ...answers, summary: 'two words' },
        }),
      status(400),
    )
    for (const actor of [assistant, teacher])
      assert.throws(() => draft(db, actor, withAudio), status(403))
    assert.throws(() => draft(db, outsider, withAudio), status(404))
    const complete = draft(db, student, withAudio, { expectedVersion: 1 })
    const original = submit(db, student, withAudio, complete.version)
    assert.deepEqual(original.reading, definition())
    assert.deepEqual(original.readingAnswers, answers)
    assert.deepEqual(original.promptAttachmentIds, [audio.id])
    assert.equal(getPortalState(db, assistant).submissions[0]!.readingAnswers, undefined)
    assert.equal(getPortalState(db, teacher).drafts.length, 0)
    const changed = definition()
    changed.groups[0]!.questions[0]!.prompt = text('A new listening question')
    const next = action(db, teacher, 'assignment.save', {
      ...withAudio,
      instructions: text('New audio instructions'),
      reading: changed,
      attachmentIds: [],
      expectedVersion: withAudio.version,
    }).state.assignments.find((item) => item.id === withAudio.id)!
    assert.throws(
      () => draft(db, student, withAudio, { expectedVersion: complete.version }),
      status(409),
    )
    assert.throws(
      () => submit(db, student, next, complete.version, 1, 'stale-listening'),
      status(409),
    )
    const reset = draft(db, student, next, {
      expectedVersion: complete.version,
      readingAnswers: undefined,
    })
    assert.deepEqual(reset.readingAnswers, {})
    assert.deepEqual(reset.reading, changed)
    assert.deepEqual(getPortalState(db, student).submissions[0], original)
    assert.deepEqual(getFile(db, student, audio.id).bytes, audioBytes)
    put(db, 'class', { ...room, studentIds: [] })
    assert.throws(() => draft(db, student, next, { expectedVersion: reset.version }), status(404))
    assert.throws(() => getFile(db, student, audio.id), status(404))
  } finally {
    db.close()
  }
})

test('Writing paste restriction defaults off, is versioned by authorized staff and snapshots each submission', () => {
  const { db, admin, teacher, assistant, student, create } = setup()
  try {
    const legacy = create({ skill: 'writing', reading: null })
    assert.equal(legacy.pasteRestricted, false)
    assert.throws(
      () => create({ skill: 'writing', reading: null, pasteRestricted: 'true' }),
      status(400),
    )
    const restrict = (actor: Account, task: Assignment, patch: Record<string, unknown> = {}) => {
      const result = action(db, actor, 'assignment.save', {
        ...task,
        expectedVersion: task.version,
        pasteRestricted: true,
        ...patch,
      })
      return result.state.assignments.find((item) => item.id === task.id)!
    }
    for (const actor of [assistant, student])
      assert.throws(() => restrict(actor, legacy), status(403))
    const restricted = restrict(teacher, legacy)
    assert.equal(restricted.pasteRestricted, true)
    assert.throws(() => restrict(admin, legacy), status(409))
    const preserved = restrict(admin, restricted, {
      pasteRestricted: undefined,
      title: text('Updated title'),
    })
    assert.equal(preserved.pasteRestricted, true)
    draft(db, student, preserved, {
      readingAnswers: undefined,
      answer: 'An original essay.',
      pasteRestricted: false,
    })
    const first = submit(db, student, preserved)
    assert.equal(first.pasteRestricted, true)
    const unrestricted = restrict(teacher, preserved, { pasteRestricted: false })
    assert.equal(unrestricted.pasteRestricted, false)
    assert.throws(
      () => draft(db, student, preserved, { expectedVersion: 1, readingAnswers: undefined }),
      status(409),
    )
    draft(db, student, unrestricted, {
      expectedVersion: 1,
      readingAnswers: undefined,
      answer: 'Updated essay.',
    })
    const second = submit(db, student, unrestricted, 2, 1, 'writing-unrestricted')
    assert.equal(second.pasteRestricted, false)
    assert.deepEqual(
      getPortalState(db, student).submissions.find((item) => item.id === first.id),
      first,
    )
    const listening = restrict(teacher, unrestricted, { skill: 'listening', reading: definition() })
    assert.equal(listening.pasteRestricted, undefined)
    const writingAgain = restrict(teacher, listening, {
      skill: 'writing',
      reading: null,
      pasteRestricted: undefined,
    })
    assert.equal(writingAgain.pasteRestricted, false)
    for (const skill of ['reading', 'listening', 'speaking'])
      assert.equal(
        create({ skill, reading: null, pasteRestricted: true }).pasteRestricted,
        undefined,
      )
  } finally {
    db.close()
  }
})

test('Reading definitions are bounded, canonical, current-role authorized and versioned', () => {
  const { db, admin, teacher, assistant, student, task, create } = setup()
  try {
    assert.deepEqual(task.reading, definition())
    const unsafe = { ...definition(), answerKey: { summary: 'secret' } }
    unsafe.groups[0]!.questions[0] = { ...unsafe.groups[0]!.questions[0]!, answerKey: 'B' } as never
    const projected = create({ reading: unsafe })
    assert.ok(!JSON.stringify(projected).includes('answerKey'))
    for (const actor of [assistant, student]) assert.throws(() => create({}, actor), status(403))
    const cases: unknown[] = [
      null,
      [],
      {},
      { ...definition(), startNumber: 0 },
      { ...definition(), startNumber: 1.5 },
      { ...definition(), groups: [] },
    ]
    for (const value of cases.filter((value) => value !== null))
      assert.throws(() => create({ reading: value }), status(400))
    const changeQuestion = (patch: Record<string, unknown>) => {
      const value = definition()
      Object.assign(value.groups[0]!.questions[0]!, patch)
      return value
    }
    for (const value of [
      changeQuestion({ id: '__proto__' }),
      changeQuestion({ kind: 'unknown' }),
      changeQuestion({ options: [] }),
      changeQuestion({ options: [{ id: 'A', label: text('A') }] }),
      changeQuestion({
        options: [
          { id: 'A', label: text('A') },
          { id: 'A', label: text('Duplicate') },
        ],
      }),
      changeQuestion({ kind: 'multiple', selectCount: 4 }),
      changeQuestion({ kind: 'short', maxWords: 0 }),
      changeQuestion({ prompt: { vi: '', en: 'Question' } }),
    ])
      assert.throws(() => create({ reading: value }), status(400))
    const duplicate = definition()
    duplicate.groups.push({ ...duplicate.groups[0]!, id: 'second-group' })
    assert.throws(() => create({ reading: duplicate }), status(400))
    const maximum = definition()
    maximum.groups[0]!.questions = Array.from({ length: 40 }, (_, index) => ({
      id: `short-${index}`,
      kind: 'short',
      prompt: text('One word'),
      maxWords: 1,
    }))
    assert.equal(create({ reading: maximum }).reading!.groups[0]!.questions.length, 40)
    maximum.groups[0]!.questions[0] = {
      id: 'multiple',
      kind: 'multiple',
      prompt: text('Choose two'),
      options: [
        { id: 'A', label: text('A') },
        { id: 'B', label: text('B') },
      ],
      selectCount: 2,
    }
    assert.throws(() => create({ reading: maximum }), status(400))
    const oversized = definition()
    oversized.groups[0]!.questions = Array.from({ length: 40 }, (_, index) => ({
      id: `long-${index}`,
      kind: 'short',
      prompt: text('🌍'.repeat(readingLimits.prompt / 2)),
      maxWords: 1,
    }))
    assert.throws(() => create({ reading: oversized }), status(400))
    const updated = action(db, teacher, 'assignment.save', {
      ...task,
      reading: undefined,
      title: text('Changed title'),
      expectedVersion: task.version,
    }).state.assignments.find((item) => item.id === task.id)!
    assert.deepEqual(updated.reading, task.reading)
    assert.throws(
      () =>
        action(db, admin, 'assignment.save', {
          ...updated,
          skill: 'writing',
          reading: undefined,
          expectedVersion: updated.version,
        }),
      status(400),
    )
    assert.throws(
      () => action(db, teacher, 'assignment.save', { ...task, expectedVersion: task.version }),
      status(409),
    )
    const removed = action(db, teacher, 'assignment.save', {
      ...updated,
      reading: null,
      skill: 'writing',
      expectedVersion: updated.version,
    }).state.assignments.find((item) => item.id === task.id)!
    assert.equal(removed.reading, undefined)
  } finally {
    db.close()
  }
})

test('partial Reading drafts validate answer shapes, options, word counts and ownership', () => {
  const { db, teacher, assistant, student, other, outsider, task } = setup()
  try {
    const partial = draft(db, student, task, {
      readingAnswers: { paragraph: '', two: ['A'], summary: '  learning  ' },
    })
    assert.deepEqual(partial.readingAnswers, { two: ['A'], summary: 'learning' })
    assert.deepEqual(partial.reading, definition())
    assert.throws(() => submit(db, student, task), status(400))
    for (const readingAnswers of [
      null,
      [],
      { unknown: 'B' },
      { paragraph: ['A'] },
      { paragraph: 'Z' },
      { two: 'A' },
      { two: ['A', 'A'] },
      { two: ['A', 'B', 'C'] },
      { two: ['A', 'Z'] },
      { summary: ['word'] },
      { summary: 'two words' },
      { summary: 'x'.repeat(readingLimits.response + 1) },
    ]) {
      assert.throws(
        () => draft(db, student, task, { expectedVersion: 1, readingAnswers }),
        status(400),
      )
      assert.deepEqual(
        getPortalState(db, student).drafts[0]!.readingAnswers,
        partial.readingAnswers,
      )
    }
    const preserved = draft(db, student, task, { expectedVersion: 1, readingAnswers: undefined })
    assert.deepEqual(preserved.readingAnswers, partial.readingAnswers)
    const complete = draft(db, student, task, {
      expectedVersion: 2,
      readingAnswers: { ...answers, summary: 'well-being' },
    })
    assert.equal(complete.version, 3)
    assert.throws(() => draft(db, student, task, { expectedVersion: 2 }), status(409))
    for (const actor of [teacher, assistant])
      assert.throws(() => draft(db, actor, task), status(403))
    assert.throws(() => draft(db, outsider, task), status(404))
    const theirs = draft(db, other, task, {
      studentId: student.id,
      id: complete.id,
      readingAnswers: { paragraph: 'A' },
    })
    assert.notEqual(theirs.id, complete.id)
    assert.equal(theirs.studentId, other.id)
    assert.deepEqual(getPortalState(db, student).drafts[0]!.readingAnswers, complete.readingAnswers)
    const submitted = submit(db, student, task, 3)
    assert.equal(submitted.answer, '')
    assert.deepEqual(submitted.readingAnswers, complete.readingAnswers)
    assert.equal(submitted.review, null)
  } finally {
    db.close()
  }
})

test('Reading submissions require complete structured responses even when text or files exist', () => {
  const { db, student, task } = setup()
  try {
    draft(db, student, task, {
      answer: 'Free text cannot bypass the questions.',
      readingAnswers: { paragraph: 'A', two: ['A'], summary: 'word' },
    })
    assert.throws(
      () => submit(db, student, task),
      (error) => error instanceof HttpError && error.code === 'incomplete_reading',
    )
    assert.equal(getPortalState(db, student).submissions.length, 0)
    const complete = draft(db, student, task, { expectedVersion: 1 })
    const first = submit(db, student, task, complete.version)
    assert.equal(submit(db, student, task, complete.version).id, first.id)
    assert.throws(
      () => submit(db, student, task, complete.version, 0, 'different-request'),
      status(409),
    )
    assert.equal(getPortalState(db, student).submissions.length, 1)
    assert.ok(!JSON.stringify(first).includes('PRIVATE READING NOTES'))
  } finally {
    db.close()
  }
})

test('assignment revisions preserve submitted Reading snapshots and do not silently migrate draft answers', () => {
  const { db, teacher, student, task } = setup()
  try {
    draft(db, student, task)
    const first = submit(db, student, task)
    const changed = definition()
    changed.groups[0]!.questions[0]!.prompt = text('Different question with the same id')
    const updated = action(db, teacher, 'assignment.save', {
      ...task,
      reading: changed,
      instructions: text('New passage'),
      expectedVersion: task.version,
    }).state.assignments.find((item) => item.id === task.id)!
    assert.deepEqual(getPortalState(db, student).drafts[0]!.reading, definition())
    assert.deepEqual(getPortalState(db, student).drafts[0]!.readingAnswers, answers)
    assert.throws(() => draft(db, student, task, { expectedVersion: 1 }), status(409))
    assert.throws(() => submit(db, student, updated, 1, 1, 'stale-draft'), status(409))
    const reset = draft(db, student, updated, { expectedVersion: 1, readingAnswers: undefined })
    assert.deepEqual(reset.readingAnswers, {})
    assert.deepEqual(reset.reading, changed)
    assert.throws(() => submit(db, student, updated, reset.version, 1, 'empty-new'), status(400))
    const replacement = draft(db, student, updated, {
      expectedVersion: reset.version,
      readingAnswers: { ...answers, paragraph: 'C' },
    })
    const second = submit(db, student, updated, replacement.version, 1, 'second-reading')
    assert.equal(second.revision, 2)
    assert.deepEqual(second.reading, changed)
    assert.deepEqual(getPortalState(db, student).submissions[0], first)
    const reviewed = action(db, teacher, 'submission.review', {
      id: first.id,
      expectedVersion: first.version,
      score: 7.5,
      feedback: 'Reviewed the original answers.',
    }).state.submissions.find((item) => item.id === first.id)!
    assert.deepEqual(reviewed.reading, definition())
    assert.deepEqual(reviewed.readingAnswers, answers)
    assert.equal(reviewed.review!.score, 7.5)
    assert.throws(
      () =>
        action(db, teacher, 'submission.review', {
          id: first.id,
          expectedVersion: reviewed.version,
          score: 9,
          feedback: 'Overwrite',
        }),
      status(409),
    )
  } finally {
    db.close()
  }
})

test('assistant responses and role changes never disclose private drafts or structured answers', () => {
  const { db, admin, teacher, assistant, student, other, room, task } = setup()
  try {
    draft(db, student, task)
    const submitted = submit(db, student, task)
    for (const actor of [admin, teacher, assistant, other])
      assert.equal(getPortalState(db, actor).drafts.length, 0)
    const metadata = getPortalState(db, assistant).submissions[0]!
    assert.equal(metadata.answer, '')
    assert.equal(metadata.readingAnswers, undefined)
    assert.deepEqual(metadata.attachmentIds, [])
    assert.equal(metadata.review, null)
    assert.deepEqual(metadata.reading, definition())
    assert.deepEqual(getPortalState(db, teacher).submissions[0]!.readingAnswers, answers)
    assert.deepEqual(getPortalState(db, other).submissions, [])
    for (const role of ['assistant', 'teacher'] as const) {
      db.prepare('UPDATE users SET role=? WHERE id=?').run(role, student.id)
      put(db, 'class', {
        ...room,
        assistantIds: [...room.assistantIds, student.id],
        teacherIds: [...room.teacherIds, student.id],
      })
      assert.deepEqual(getPortalState(db, student).drafts, [])
      assert.throws(() => draft(db, student, task, { expectedVersion: 1 }), status(403))
      if (role === 'assistant')
        assert.equal(getPortalState(db, student).submissions[0]!.readingAnswers, undefined)
    }
    assert.throws(
      () =>
        action(db, admin, 'submission.review', {
          id: submitted.id,
          expectedVersion: submitted.version,
          score: 8,
          feedback: 'Not a teacher',
        }),
      status(403),
    )
    db.prepare('UPDATE users SET active=0 WHERE id=?').run(student.id)
    assert.throws(() => getPortalState(db, student), status(401))
  } finally {
    db.close()
  }
})

test('submitted prompt material remains readable through own history under current class access', () => {
  const { db, teacher, assistant, student, other, outsider, room, task } = setup()
  try {
    const bytes = Buffer.from('%PDF-1.7\nOriginal passage')
    const file = uploadFile(
      db,
      teacher,
      { classId: room.id, purpose: 'material', name: 'passage.pdf', mime: 'application/pdf' },
      bytes,
    )
    const withFile = action(db, teacher, 'assignment.save', {
      ...task,
      attachmentIds: [file.id],
      expectedVersion: task.version,
    }).state.assignments.find((item) => item.id === task.id)!
    draft(db, student, withFile)
    const first = submit(db, student, withFile)
    assert.deepEqual(first.promptAttachmentIds, [file.id])
    action(db, teacher, 'assignment.save', {
      ...withFile,
      attachmentIds: [],
      published: false,
      expectedVersion: withFile.version,
    })
    assert.deepEqual(getFile(db, student, file.id).bytes, bytes)
    assert.deepEqual(getFile(db, assistant, file.id).bytes, bytes)
    for (const actor of [other, outsider])
      assert.throws(() => getFile(db, actor, file.id), status(404))
    assert.ok(getPortalState(db, student).files.some((item) => item.id === file.id))
    put(db, 'class', { ...room, studentIds: [other.id] })
    assert.throws(() => getFile(db, student, file.id), status(404))
    put(db, 'class', { ...room, active: false })
    assert.throws(() => getFile(db, student, file.id), status(404))
    assert.throws(() => getFile(db, assistant, file.id), status(404))
  } finally {
    db.close()
  }
})

test('legacy free-response assignments keep their behavior and reject injected Reading responses', () => {
  const { db, student, create } = setup()
  try {
    const legacy = create({ reading: undefined })
    assert.equal(legacy.reading, undefined)
    for (const readingAnswers of [answers, null, [], 'value'])
      assert.throws(() => draft(db, student, legacy, { readingAnswers }), status(400))
    const empty = draft(db, student, legacy, { readingAnswers: undefined })
    assert.equal(empty.readingAnswers, undefined)
    assert.throws(() => submit(db, student, legacy), status(400))
    draft(db, student, legacy, {
      expectedVersion: empty.version,
      answer: 'A normal answer',
      readingAnswers: {},
    })
    const submitted = submit(db, student, legacy, 2)
    assert.equal(submitted.reading, undefined)
    assert.equal(submitted.readingAnswers, undefined)
    assert.equal(submitted.answer, 'A normal answer')
    assert.deepEqual(submitted.promptAttachmentIds, [])
  } finally {
    db.close()
  }
})

test('Reading definitions, private drafts and submitted snapshots survive database reopen', () => {
  const directory = mkdtempSync(join(tmpdir(), 'project-l-reading-'))
  const path = join(directory, 'isolated.sqlite')
  const fixture = setup(path)
  try {
    const saved = draft(fixture.db, fixture.student, fixture.task)
    const submitted = submit(fixture.db, fixture.student, fixture.task)
    fixture.db.close()
    const db = openDatabase(path)
    try {
      const state = getPortalState(db, fixture.student)
      assert.deepEqual(state.assignments[0]!.reading, definition())
      assert.deepEqual(state.drafts[0], saved)
      assert.deepEqual(state.submissions[0], submitted)
    } finally {
      db.close()
    }
  } finally {
    if (fixture.db.isOpen) fixture.db.close()
    rmSync(directory, { recursive: true, force: true })
  }
})

test('HTTP Reading workflow serializes private roles correctly and preserves question and prompt-file snapshots', async () => {
  const { db, admin, teacher, assistant, student, other, room, task } = setup()
  const token = (actor: Account) => `reading-${actor.id}`.padEnd(43, 'x')
  for (const actor of [admin, teacher, assistant, student, other])
    db.prepare(
      'INSERT INTO sessions(token_hash,user_id,created_at,expires_at) VALUES(?,?,?,?)',
    ).run(tokenHash(token(actor)), actor.id, Date.now(), Date.now() + 60000)
  const bytes = Buffer.from('%PDF-1.7\nHTTP Reading prompt')
  const file = uploadFile(
    db,
    teacher,
    { classId: room.id, purpose: 'material', name: 'reading.pdf', mime: 'application/pdf' },
    bytes,
  )
  const withFile = action(db, teacher, 'assignment.save', {
    ...task,
    attachmentIds: [file.id],
    expectedVersion: task.version,
  }).state.assignments.find((item) => item.id === task.id)!
  const server = createServer(db)
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  assert.ok(address && typeof address === 'object')
  const base = `http://127.0.0.1:${address.port}/api/v1/portal`
  const command = async (
    actor: Account,
    type: string,
    payload: Record<string, unknown>,
    expected = 200,
  ) => {
    const response = await fetch(`${base}/actions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token(actor)}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, payload }),
    })
    assert.equal(response.status, expected)
    return (await response.json()) as ActionResult
  }
  const state = async (actor: Account) => {
    const response = await fetch(`${base}/state`, {
      headers: { Authorization: `Bearer ${token(actor)}` },
    })
    assert.equal(response.status, 200)
    return (await response.json()) as LiveState
  }
  try {
    assert.equal((await fetch(`${base}/state`)).status, 401)
    await command(student, 'draft.save', {
      assignmentId: withFile.id,
      assignmentVersion: withFile.version,
      expectedVersion: 0,
      answer: '',
      notes: 'PRIVATE HTTP NOTES',
      attachmentIds: [],
      readingAnswers: answers,
    })
    const response = await command(student, 'submission.create', {
      assignmentId: withFile.id,
      assignmentVersion: withFile.version,
      draftVersion: 1,
      expectedRevision: 0,
      requestId: 'http-reading-submit',
    })
    const submission = response.state.submissions[0]!
    assert.deepEqual(submission.readingAnswers, answers)
    assert.deepEqual(submission.promptAttachmentIds, [file.id])
    for (const actor of [admin, teacher, assistant, other]) {
      const view = await state(actor)
      assert.deepEqual(view.drafts, [])
      assert.ok(!JSON.stringify(view).includes('PRIVATE HTTP NOTES'))
    }
    const metadata = (await state(assistant)).submissions[0]!
    assert.equal(Object.hasOwn(metadata, 'readingAnswers'), false)
    assert.equal(metadata.answer, '')
    assert.deepEqual(metadata.attachmentIds, [])
    assert.deepEqual((await state(other)).submissions, [])
    const revised = definition()
    revised.groups[0]!.questions[0]!.prompt = text('A revised question')
    await command(teacher, 'assignment.save', {
      ...withFile,
      reading: revised,
      instructions: text('Revised passage'),
      attachmentIds: [],
      expectedVersion: withFile.version,
    })
    const history = (await state(student)).submissions[0]!
    assert.deepEqual(history.reading, definition())
    assert.deepEqual(history.readingAnswers, answers)
    assert.equal(history.instructions.en, 'Read this original passage.')
    const download = await fetch(`${base}/files/${file.id}`, {
      headers: { Authorization: `Bearer ${token(student)}` },
    })
    assert.equal(download.status, 200)
    assert.deepEqual(Buffer.from(await download.arrayBuffer()), bytes)
    assert.equal(
      (
        await fetch(`${base}/files/${file.id}`, {
          headers: { Authorization: `Bearer ${token(other)}` },
        })
      ).status,
      404,
    )
    await command(
      admin,
      'submission.review',
      { id: submission.id, expectedVersion: 1, score: 8, feedback: 'Not allowed' },
      403,
    )
    await command(teacher, 'submission.review', {
      id: submission.id,
      expectedVersion: 1,
      score: 8,
      feedback: 'Manual Reading review',
    })
    assert.equal((await state(student)).submissions[0]!.review!.score, 8)
    db.prepare('UPDATE users SET role=? WHERE id=?').run('assistant', student.id)
    put(db, 'class', { ...room, assistantIds: [...room.assistantIds, student.id] })
    const changedRole = await state(student)
    assert.deepEqual(changedRole.drafts, [])
    assert.equal(Object.hasOwn(changedRole.submissions[0]!, 'readingAnswers'), false)
    assert.equal(changedRole.submissions[0]!.review, null)
    await command(
      student,
      'draft.save',
      {
        assignmentId: task.id,
        assignmentVersion: 3,
        expectedVersion: 1,
        answer: '',
        notes: '',
        attachmentIds: [],
        readingAnswers: answers,
      },
      403,
    )
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()))
    db.close()
  }
})
