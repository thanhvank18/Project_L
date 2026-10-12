import assert from 'node:assert/strict'
import test from 'node:test'
import { createManagementState } from '../src/features/management/data.ts'
import {
  createManagementStore,
  isManagementState,
  managementStorageKey,
  visibleCourseIds,
  visibleLearners,
} from '../src/features/management/model.ts'

function storage() {
  const values = new Map<string, string>()
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value)
    },
  }
}

test('management sample data is valid and relationally consistent', () => {
  assert.equal(isManagementState(createManagementState()), true)
})

test('duplicate email addresses are rejected without changing the saved roster', () => {
  const store = createManagementStore(storage(), 'demo')
  const before = store.getSnapshot().state
  assert.equal(
    store.commit((state) => ({
      ...state,
      learners: state.learners.map((v, index) =>
        index === 1 ? { ...v, email: state.learners[0]!.email.toUpperCase() } : v,
      ),
    })),
    false,
  )
  assert.equal(
    store.commit((state) => ({
      ...state,
      users: state.users.map((v, index) =>
        index === 1 ? { ...v, email: state.users[0]!.email.toUpperCase() } : v,
      ),
    })),
    false,
  )
  assert.deepEqual(store.getSnapshot().state, before)
})

test('role visibility only exposes own learner or assigned class', () => {
  const state = createManagementState()
  assert.deepEqual(
    visibleLearners(state, 'student').map((v) => v.id),
    ['learner-01'],
  )
  assert.equal(visibleLearners(state, 'teacher').length, 4)
  assert.equal(visibleLearners(state, 'assistant').length, 4)
  assert.equal(visibleLearners(state, 'admin').length, 6)
  assert.deepEqual(visibleCourseIds(state, 'teacher'), ['ielts-foundation'])
})

test('preview storage is isolated by account and role scope', () => {
  const db = storage()
  const first = createManagementStore(db, 'account-01:teacher')
  assert.equal(
    first.commit((state) => ({
      ...state,
      courses: state.courses.map((course) => ({ ...course, title: 'Changed sample title' })),
    })),
    true,
  )
  assert.equal(
    createManagementStore(db, 'account-01:teacher').getSnapshot().state.courses[0]?.title,
    'Changed sample title',
  )
  assert.equal(
    createManagementStore(db, 'account-02:teacher').getSnapshot().state.courses[0]?.title,
    'IELTS Foundation',
  )
  assert.equal(
    createManagementStore(db, 'account-01:student').getSnapshot().state.courses[0]?.title,
    'IELTS Foundation',
  )
})

test('malformed, oversized and invalid stored records recover with an explicit error', () => {
  for (const raw of ['{bad', 'x'.repeat(750_001), JSON.stringify({ version: 1 })]) {
    const model = createManagementStore({ getItem: () => raw, setItem: () => {} }, 'demo')
    assert.equal(model.getSnapshot().storageError, true)
    assert.equal(model.getSnapshot().state.learners.length, 6)
  }
})

test('storage failure preserves previous state and reset also reports failure', () => {
  const store = createManagementStore(
    {
      getItem: () => null,
      setItem: () => {
        throw new Error('quota')
      },
    },
    'demo',
  )
  const before = store.getSnapshot().state
  assert.equal(
    store.commit((state) => ({
      ...state,
      courses: state.courses.map((v) => ({ ...v, title: 'Valid update' })),
    })),
    false,
  )
  assert.deepEqual(store.getSnapshot().state, before)
  assert.equal(store.reset(), false)
  assert.equal(store.getSnapshot().storageError, true)
})

test('invalid scores, missing relations and duplicate IDs cannot be persisted', () => {
  const store = createManagementStore(storage(), 'demo')
  for (const score of [-1, 10, Number.NaN]) {
    assert.equal(
      store.commit((state) => ({ ...state, grades: state.grades.map((v) => ({ ...v, score })) })),
      false,
    )
  }
  assert.equal(
    store.commit((state) => ({ ...state, courses: [] })),
    false,
  )
  assert.equal(
    store.commit((state) => ({ ...state, learners: [...state.learners, state.learners[0]!] })),
    false,
  )
  assert.equal(
    store.commit((state) => ({
      ...state,
      materials: [{ ...state.materials[0]!, content: 'a'.repeat(20_001) }],
    })),
    false,
  )
})

test('valid grading and attendance edits survive reload', () => {
  const db = storage()
  const store = createManagementStore(db, 'demo')
  assert.equal(
    store.commit((state) => ({
      ...state,
      grades: state.grades.map((v) =>
        v.id === 'grade-01' ? { ...v, score: 6.5, feedback: 'Sample feedback', reviewed: true } : v,
      ),
      attendance: state.attendance.map((v) =>
        v.id === 'attendance-01' ? { ...v, status: 'present' } : v,
      ),
    })),
    true,
  )
  const reloaded = createManagementStore(db, 'demo').getSnapshot().state
  assert.equal(reloaded.grades[0]?.score, 6.5)
  assert.equal(reloaded.attendance[0]?.status, 'present')
})

test('invalid scope cannot read or write another store', () => {
  assert.equal(managementStorageKey(''), null)
  assert.equal(managementStorageKey('x'.repeat(201)), null)
  let calls = 0
  const store = createManagementStore(
    {
      getItem: () => {
        calls++
        return null
      },
      setItem: () => {
        calls++
      },
    },
    '',
  )
  assert.equal(store.reset(), false)
  assert.equal(calls, 0)
})
