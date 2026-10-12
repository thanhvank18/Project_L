import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import type { Account, Assignment, Role, VocabularyRating, Word } from '../shared/portal.ts'
import { initialVocabularyPractice, nextVocabularyReview } from '../shared/vocabulary.ts'
import { getAccount, openDatabase, type Database } from './db.ts'
import { getPortalState, runAction } from './domain.ts'
import { HttpError } from './errors.ts'
import { put } from './domain-store.ts'

function account(db: Database, id: string, role: Role): Account {
  db.prepare(
    'INSERT INTO users(id,name,email,role,active,version,created_at,password_hash) VALUES(?,?,?,?,1,1,?,?)',
  ).run(id, id, `${id}@example.test`, role, new Date().toISOString(), 'unused-test-password')
  return getAccount(db, id)!
}

function setup(path = ':memory:') {
  const db = openDatabase(path)
  return {
    db,
    student: account(db, 'student', 'student'),
    other: account(db, 'other', 'student'),
    teacher: account(db, 'teacher', 'teacher'),
    assistant: account(db, 'assistant', 'assistant'),
    admin: account(db, 'admin', 'admin'),
  }
}

const action = (db: Database, actor: Account, type: string, payload: Record<string, unknown>) =>
  runAction(db, actor, { type, payload })
const status = (expected: number) => (error: unknown) =>
  error instanceof HttpError && error.status === expected
const wordInput = {
  word: 'persevere',
  meaning: 'continue despite difficulty',
  example: 'We persevered with our studies.',
  topic: 'Learning',
}

function save(db: Database, actor: Account, overrides: Record<string, unknown> = {}): Word {
  const result = action(db, actor, 'word.save', { ...wordInput, expectedVersion: 0, ...overrides })
  return result.state.words.find((word) => word.id === result.result!.id)!
}

function review(db: Database, actor: Account, word: Word, rating: VocabularyRating): Word {
  const result = action(db, actor, 'word.review', {
    id: word.id,
    expectedVersion: word.version,
    rating,
  })
  return result.state.words.find((item) => item.id === word.id)!
}

function sourceAssignment(fixture: ReturnType<typeof setup>): Assignment {
  const { db, admin, teacher, student } = fixture
  const room = action(db, admin, 'class.save', {
    title: 'Vocabulary source class',
    level: '',
    description: '',
    teacherIds: [teacher.id],
    assistantIds: [],
    studentIds: [student.id],
    active: true,
    expectedVersion: 0,
  }).state.classes[0]!
  return action(db, teacher, 'assignment.save', {
    classId: room.id,
    title: { vi: 'Nguồn từ vựng', en: 'Vocabulary source' },
    instructions: { vi: 'Tiếp tục học.', en: 'PRIVATE SOURCE CONTEXT: persevere with learning.' },
    skill: 'reading',
    dueAt: '',
    published: true,
    required: false,
    attachmentIds: [],
    expectedVersion: 0,
  }).state.assignments[0]!
}

test('new vocabulary deduplicates normalized word and meaning within the student notebook', () => {
  const { db, student, other } = setup()
  try {
    const first = save(db, student)
    assert.throws(
      () => save(db, student, { word: ' PERSEVERE ', meaning: ' CONTINUE DESPITE DIFFICULTY ' }),
      status(409),
    )
    assert.deepEqual(getPortalState(db, student).words, [first])
    assert.equal(save(db, student, { meaning: 'kiên trì' }).meaning, 'kiên trì')
    assert.equal(save(db, other).word, first.word)
    assert.equal(getPortalState(db, student).words.length, 2)
  } finally {
    db.close()
  }
})

test('assignment vocabulary sources are server snapshots preserved by ordinary edits and private across roles', () => {
  const fixture = setup()
  const { db, student, teacher, assistant, admin, other } = fixture
  try {
    const assignment = sourceAssignment(fixture)
    const word = save(db, student, {
      sourceAssignmentId: assignment.id,
      sourceAssignmentVersion: assignment.version,
      sourceContext: 'PRIVATE SOURCE CONTEXT',
      source: { title: { vi: 'Forged title', en: 'Forged title' }, studentId: other.id },
    })
    assert.deepEqual(word.source, {
      assignmentId: assignment.id,
      assignmentVersion: 1,
      classId: assignment.classId,
      skill: 'reading',
      title: assignment.title,
      context: 'PRIVATE SOURCE CONTEXT',
    })
    action(db, teacher, 'assignment.save', {
      ...assignment,
      expectedVersion: 1,
      title: { vi: 'Tên mới', en: 'New title' },
    })
    const edited = save(db, student, {
      ...wordInput,
      id: word.id,
      expectedVersion: word.version,
      example: 'Updated example.',
    })
    assert.deepEqual(edited.source, word.source)
    for (const actor of [other, teacher, assistant, admin])
      assert.deepEqual(getPortalState(db, actor).words, [])
    db.prepare('UPDATE users SET role=? WHERE id=?').run('teacher', student.id)
    assert.equal(getPortalState(db, student).words[0]!.source, undefined)
  } finally {
    db.close()
  }
})

test('vocabulary source creation checks current assignment access, version and exact context', () => {
  const fixture = setup()
  const { db, student, other, teacher } = fixture
  try {
    const assignment = sourceAssignment(fixture)
    const source = {
      sourceAssignmentId: assignment.id,
      sourceAssignmentVersion: 1,
      sourceContext: '',
    }
    assert.throws(() => save(db, other, source), status(404))
    assert.throws(() => save(db, teacher, source), status(403))
    assert.throws(() => save(db, student, { ...source, sourceAssignmentVersion: 2 }), status(409))
    assert.throws(
      () => save(db, student, { ...source, sourceContext: 'invented private source text' }),
      status(400),
    )
    assert.throws(
      () => save(db, student, { ...source, sourceContext: 'x'.repeat(2001) }),
      status(400),
    )
    assert.throws(() => save(db, student, { sourceContext: 'orphaned source field' }), status(400))
    assert.equal(getPortalState(db, student).words.length, 0)
    const word = save(db, student, source)
    assert.equal(word.source!.context, '')
    put(db, 'assignment', { ...assignment, published: false })
    assert.throws(() => save(db, student, { ...source, word: 'new word' }), status(404))
  } finally {
    db.close()
  }
})

test('self-rating intervals have exact durations, bounded boxes and immutable input', () => {
  const at = '2026-10-10T12:00:00.000Z'
  const day = 86_400_000
  const initial = initialVocabularyPractice()
  let current = initial
  for (const [index, interval] of [1, 3, 7, 14, 30, 30].entries()) {
    current = nextVocabularyReview(current, 'good', at)
    assert.equal(current.box, Math.min(5, index + 1))
    assert.equal(current.reviewCount, index + 1)
    assert.equal(Date.parse(current.dueAt!) - Date.parse(at), interval * day)
    assert.equal(current.lastReviewedAt, at)
    assert.equal(current.lastRating, 'good')
  }
  const hard = nextVocabularyReview(current, 'hard', at)
  assert.equal(hard.box, 4)
  assert.equal(Date.parse(hard.dueAt!) - Date.parse(at), day)
  const again = nextVocabularyReview(hard, 'again', at)
  assert.equal(again.box, 0)
  assert.equal(Date.parse(again.dueAt!) - Date.parse(at), 600_000)
  assert.equal(nextVocabularyReview(initial, 'hard', at).box, 0)
  assert.equal(nextVocabularyReview(initial, 'easy', at).box, 2)
  assert.equal(nextVocabularyReview(initial, 'easy', at).dueAt, '2026-10-13T12:00:00.000Z')
  assert.equal(nextVocabularyReview({ ...initial, box: 4 }, 'easy', at).box, 5)
  assert.equal(nextVocabularyReview({ ...initial, box: 5 }, 'easy', at).box, 5)
  assert.deepEqual(initial, initialVocabularyPractice())
  assert.throws(() => nextVocabularyReview(initial, 'good', 'not-a-date'), RangeError)
  assert.throws(() => nextVocabularyReview(initial, 'invalid' as VocabularyRating, at), RangeError)
})

test('new words ignore client schedules and legacy words normalize without mutating storage', () => {
  const { db, student } = setup()
  try {
    const forgedPractice = {
      box: 5,
      reviewCount: 1000,
      dueAt: '2099-01-01T00:00:00.000Z',
      lastReviewedAt: '2098-01-01T00:00:00.000Z',
      lastRating: 'easy',
    }
    const created = save(db, student, { practice: forgedPractice })
    assert.deepEqual(created.practice, initialVocabularyPractice())
    const legacy = JSON.stringify({ id: 'legacy', ...wordInput, ownerId: student.id, version: 7 })
    db.prepare('INSERT INTO records(kind,id,body,version) VALUES(?,?,?,?)').run(
      'word',
      'legacy',
      legacy,
      7,
    )
    const state = getPortalState(db, student)
    const normalized = state.words.find((word) => word.id === 'legacy')!
    assert.deepEqual(normalized.practice, initialVocabularyPractice())
    assert.equal(normalized.version, 7)
    assert.equal(
      db.prepare('SELECT body FROM records WHERE kind = ? AND id = ?').get('word', 'legacy')!.body,
      legacy,
    )
    const reviewed = review(db, student, normalized, 'good')
    assert.equal(reviewed.version, 8)
    assert.equal(reviewed.practice.reviewCount, 1)
  } finally {
    db.close()
  }
})

test('review uses current server time and ignores forged schedules or vocabulary replacements', () => {
  const { db, student } = setup()
  try {
    const word = save(db, student)
    const before = Date.now()
    const result = action(db, student, 'word.review', {
      id: word.id,
      expectedVersion: word.version,
      rating: 'again',
      word: 'replace someone’s answer',
      practice: { box: 5, reviewCount: 1000, dueAt: '2099-01-01T00:00:00.000Z' },
      nowISO: '2099-01-01T00:00:00.000Z',
    })
    const after = Date.now()
    const updated = result.state.words[0]!
    const reviewedAt = Date.parse(updated.practice.lastReviewedAt!)
    assert.ok(reviewedAt >= before && reviewedAt <= after)
    assert.equal(Date.parse(updated.practice.dueAt!) - reviewedAt, 600_000)
    assert.equal(updated.practice.reviewCount, 1)
    assert.equal(updated.practice.box, 0)
    assert.equal(updated.version, 2)
    assert.equal(updated.word, word.word)
    assert.equal(updated.meaning, word.meaning)
  } finally {
    db.close()
  }
})

test('reviews require ownership, student role and the currently active account', () => {
  const { db, student, other, teacher, assistant, admin } = setup()
  try {
    const word = save(db, student)
    assert.throws(() => review(db, other, word, 'good'), status(404))
    for (const staff of [teacher, assistant, admin]) {
      assert.throws(() => review(db, staff, word, 'good'), status(403))
      const own = save(db, staff)
      assert.throws(() => review(db, staff, own, 'good'), status(403))
    }
    db.prepare('UPDATE users SET role = ? WHERE id = ?').run('teacher', student.id)
    assert.throws(() => review(db, student, word, 'good'), status(403))
    db.prepare('UPDATE users SET role = ?, active = 0 WHERE id = ?').run('student', student.id)
    assert.throws(() => review(db, student, word, 'good'), status(401))
    db.prepare('UPDATE users SET active = 1 WHERE id = ?').run(student.id)
    assert.equal(review(db, student, word, 'good').practice.reviewCount, 1)
  } finally {
    db.close()
  }
})

test('invalid reviews and repeated stale clicks make no writes or audit entries', () => {
  const { db, student, admin } = setup()
  try {
    const word = save(db, student)
    const payload = { id: word.id, expectedVersion: word.version, rating: 'good' }
    for (const invalid of [
      { rating: '' },
      { rating: 'excellent' },
      { rating: null },
      { rating: 1 },
      { expectedVersion: undefined },
      { expectedVersion: '1' },
      { expectedVersion: 1.5 },
      { expectedVersion: 0 },
      { id: '' },
    ]) {
      assert.throws(
        () => action(db, student, 'word.review', { ...payload, ...invalid }),
        status(400),
      )
    }
    assert.throws(
      () => action(db, student, 'word.review', { ...payload, id: 'missing' }),
      status(404),
    )
    assert.deepEqual(getPortalState(db, student).words[0], word)
    assert.equal(getPortalState(db, admin).audit.length, 1)
    const first = review(db, student, word, 'good')
    assert.throws(() => review(db, student, word, 'easy'), status(409))
    assert.deepEqual(getPortalState(db, student).words[0], first)
    assert.equal(getPortalState(db, admin).audit.length, 2)
    assert.equal(getPortalState(db, admin).audit[1]!.action, 'word.review')
  } finally {
    db.close()
  }
})

test('word or meaning edits reset practice; example and topic edits preserve it', () => {
  const { db, student } = setup()
  try {
    const word = review(db, student, save(db, student), 'easy')
    const edited = save(db, student, {
      ...word,
      expectedVersion: word.version,
      example: 'Persevere with learning English.',
      topic: 'Practice',
      practice: initialVocabularyPractice(),
    })
    assert.deepEqual(edited.practice, word.practice)
    assert.equal(edited.version, word.version + 1)
    assert.throws(
      () => save(db, student, { ...word, expectedVersion: word.version, meaning: 'stale edit' }),
      status(409),
    )
    const changedWord = save(db, student, {
      ...edited,
      word: 'perseverance',
      expectedVersion: edited.version,
    })
    assert.deepEqual(changedWord.practice, initialVocabularyPractice())
    const reviewed = review(db, student, changedWord, 'good')
    const changedMeaning = save(db, student, {
      ...reviewed,
      meaning: 'continued effort',
      expectedVersion: reviewed.version,
    })
    assert.deepEqual(changedMeaning.practice, initialVocabularyPractice())
    assert.equal(changedMeaning.version, reviewed.version + 1)
  } finally {
    db.close()
  }
})

test('review state survives database reopen, stays private and is removed with its word', () => {
  const directory = mkdtempSync(join(tmpdir(), 'project-l-vocabulary-'))
  const path = join(directory, 'vocabulary.sqlite')
  const initial = setup(path)
  let db = initial.db
  try {
    const reviewed = review(db, initial.student, save(db, initial.student), 'hard')
    const other = save(db, initial.other, { word: 'other-private-word' })
    db.close()
    db = openDatabase(path)
    assert.deepEqual(getPortalState(db, initial.student).words, [reviewed])
    assert.deepEqual(getPortalState(db, initial.other).words, [other])
    for (const staff of [initial.teacher, initial.assistant, initial.admin])
      assert.deepEqual(getPortalState(db, staff).words, [])
    assert.ok(!JSON.stringify(getPortalState(db, initial.admin)).includes(reviewed.meaning))
    assert.throws(
      () => action(db, initial.other, 'word.delete', { id: reviewed.id, expectedVersion: 2 }),
      status(404),
    )
    assert.throws(
      () => action(db, initial.student, 'word.delete', { id: reviewed.id, expectedVersion: 1 }),
      status(409),
    )
    action(db, initial.student, 'word.delete', { id: reviewed.id, expectedVersion: 2 })
    assert.deepEqual(getPortalState(db, initial.student).words, [])
    assert.equal(
      db.prepare('SELECT body FROM records WHERE kind = ? AND id = ?').get('word', reviewed.id),
      undefined,
    )
    assert.throws(() => review(db, initial.student, reviewed, 'good'), status(404))
  } finally {
    db.close()
    rmSync(directory, { recursive: true, force: true })
  }
})
