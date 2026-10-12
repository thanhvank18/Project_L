import assert from 'node:assert/strict'
import test from 'node:test'
import { createManagementState } from '../src/features/management/data.ts'
import {
  createManagementStore,
  isManagementState,
  managementStorageKey,
  parseManagementState,
} from '../src/features/management/model.ts'
import {
  reviewSubmission,
  submitTask,
  visibleSubmissions,
} from '../src/features/management/workflow.ts'
import type { ManagementState } from '../src/features/management/types.ts'

const firstTime = '2026-10-12T09:00:00.000Z'
const laterTime = '2026-10-12T10:00:00.000Z'
function submit(state = createManagementState(), answer = 'My first answer', revision = 0) {
  const next = submitTask(state, {
    role: 'student',
    taskId: 'writing-01',
    answer,
    expectedRevision: revision,
    now: firstTime,
  })
  assert.ok(next)
  return next
}
function review(state: ManagementState) {
  const submission = state.submissions[0]!
  const next = reviewSubmission(state, {
    role: 'teacher',
    submissionId: submission.id,
    expectedRevision: submission.revision,
    score: 6.5,
    feedback: 'Explain your example more clearly.',
    now: laterTime,
  })
  assert.ok(next)
  return next
}
function memoryStorage() {
  const values = new Map<string, string>()
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value)
    },
  }
}

test('a student submission is the exact answer reviewed and returned by a teacher', () => {
  const state = review(submit())
  assert.equal(isManagementState(state), true)
  const submission = visibleSubmissions(state, 'student')[0]!
  assert.equal(submission.answer, 'My first answer')
  assert.equal(submission.status, 'returned')
  assert.equal(submission.review?.revision, 1)
  assert.equal(submission.review?.score, 6.5)
  assert.equal(
    state.grades[0]?.score,
    null,
    'Seeded historical grades are not fabricated from submissions',
  )
})

test('resubmission archives the prior answer and review without carrying its score forward', () => {
  const first = review(submit())
  const second = submit(first, 'Revised answer with an example', 1)
  const submission = second.submissions[0]!
  assert.equal(submission.revision, 2)
  assert.equal(submission.status, 'submitted')
  assert.equal(submission.review, null)
  assert.equal(submission.history[0]?.answer, 'My first answer')
  assert.equal(submission.history[0]?.review?.score, 6.5)
  assert.equal(isManagementState(second), true)
  assert.equal(
    reviewSubmission(second, {
      role: 'teacher',
      submissionId: submission.id,
      expectedRevision: 1,
      score: 7,
      feedback: 'This stale review must not be applied.',
      now: laterTime,
    }),
    null,
  )
  assert.equal(
    submitTask(second, {
      role: 'student',
      taskId: submission.taskId,
      expectedRevision: 1,
      answer: 'An old tab cannot replace the new answer',
      now: laterTime,
    }),
    null,
  )
})

test('all four skills accept text preview submissions, but only published enrolled tasks', () => {
  let state = createManagementState()
  for (const task of state.tasks) {
    const next = submitTask(state, {
      role: 'student',
      taskId: task.id,
      answer: `Text preview for ${task.skill}`,
      expectedRevision: 0,
      now: firstTime,
    })
    assert.ok(next)
    state = next
  }
  assert.equal(state.submissions.length, 4)
  const firstTask = state.tasks[0]!
  for (const updatedTask of [
    { ...firstTask, published: false },
    { ...firstTask, courseId: 'ielts-speaking' },
  ]) {
    const candidate = { ...createManagementState(), tasks: [updatedTask] }
    assert.equal(
      submitTask(candidate, {
        role: 'student',
        taskId: updatedTask.id,
        answer: 'Answer',
        expectedRevision: 0,
        now: firstTime,
      }),
      null,
    )
  }
})

test('role guards and review validation prevent wrong-role or empty feedback mutations', () => {
  const state = submit()
  const submission = state.submissions[0]!
  const common = {
    submissionId: submission.id,
    expectedRevision: 1,
    score: 6,
    feedback: 'Useful feedback',
    now: laterTime,
  }
  for (const role of ['student', 'assistant', 'admin'] as const) {
    assert.equal(reviewSubmission(state, { ...common, role }), null)
  }
  for (const score of [-1, 10, Number.NaN, Infinity]) {
    assert.equal(reviewSubmission(state, { ...common, role: 'teacher', score }), null)
  }
  assert.equal(reviewSubmission(state, { ...common, role: 'teacher', feedback: '  ' }), null)
  assert.equal(
    reviewSubmission(state, { ...common, role: 'teacher', feedback: 'x'.repeat(4001) }),
    null,
  )
  for (const role of ['teacher', 'assistant', 'admin'] as const) {
    assert.equal(
      submitTask(state, {
        role,
        taskId: 'writing-01',
        answer: 'Answer',
        expectedRevision: 1,
        now: firstTime,
      }),
      null,
    )
  }
})

test('duplicate task/learner submissions, mismatched reviews and oversized answers are invalid', () => {
  const state = review(submit())
  const submission = state.submissions[0]!
  assert.equal(
    isManagementState({
      ...state,
      submissions: [submission, { ...submission, id: 'different-id' }],
    }),
    false,
  )
  assert.equal(
    isManagementState({
      ...state,
      submissions: [{ ...submission, review: { ...submission.review!, revision: 2 } }],
    }),
    false,
  )
  assert.equal(
    isManagementState({
      ...state,
      submissions: [{ ...submission, answer: 'x'.repeat(20_001) }],
    }),
    false,
  )
  assert.equal(
    isManagementState({
      ...state,
      notifications: [{ ...state.notifications[0]!, readBy: ['student', 'student'] }],
    }),
    false,
  )
})

test('valid old v1 data gains workflow defaults without losing edited records', () => {
  const old = createManagementState()
  old.courses[0]!.title = 'Previously edited course'
  const legacy: Record<string, unknown> = { ...old }
  delete legacy.submissions
  legacy.tasks = old.tasks.map((task) => {
    const legacyTask = { ...task }
    delete legacyTask.instructions
    return legacyTask
  })
  const migrated = parseManagementState(JSON.stringify(legacy))
  assert.ok(migrated)
  assert.equal(migrated.courses[0]?.title, 'Previously edited course')
  assert.deepEqual(migrated.submissions, [])
  assert.ok(migrated.tasks[0]?.instructions?.vi)
  assert.deepEqual(migrated.grades, old.grades)
})

test('stores sharing a preview scope refresh and rebase writes from other roles', () => {
  const db = memoryStorage()
  const student = createManagementStore(db, 'shared-preview')
  const teacher = createManagementStore(db, 'shared-preview')
  assert.equal(
    student.commit((state) => submit(state)),
    true,
  )
  assert.equal(
    teacher.commit((state) => ({
      ...state,
      attendance: state.attendance.map((entry, index) =>
        index === 0 ? { ...entry, status: 'present' } : entry,
      ),
    })),
    true,
  )
  assert.equal(teacher.getSnapshot().state.submissions.length, 1)
  assert.equal(student.refresh(), true)
  assert.equal(student.getSnapshot().state.attendance[0]?.status, 'present')
  assert.equal(teacher.commit(review), true)
  assert.equal(student.refresh(), true)
  assert.equal(student.getSnapshot().state.submissions[0]?.review?.score, 6.5)
  assert.equal(
    createManagementStore(db, 'authenticated-account').getSnapshot().state.submissions.length,
    0,
  )
})

test('corrupted storage is retained until explicit reset and failed review saves keep the last state', () => {
  const db = memoryStorage()
  const key = managementStorageKey('demo')!
  const store = createManagementStore(db, 'demo')
  assert.equal(
    store.commit((state) => submit(state)),
    true,
  )
  const before = store.getSnapshot().state
  db.values.set(key, '{corrupt')
  assert.equal(store.refresh(), false)
  assert.deepEqual(store.getSnapshot().state, before)
  assert.equal(store.commit(review), false)
  assert.equal(db.values.get(key), '{corrupt')
  assert.equal(store.reset(), true)
  assert.equal(store.getSnapshot().state.submissions.length, 0)

  const saved = JSON.stringify(submit())
  const failed = createManagementStore(
    {
      getItem: () => saved,
      setItem: () => {
        throw new Error('Quota')
      },
    },
    'demo',
  )
  assert.equal(failed.commit(review), false)
  assert.equal(failed.getSnapshot().state.submissions[0]?.review, null)
})
