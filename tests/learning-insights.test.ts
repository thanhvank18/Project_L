import assert from 'node:assert/strict'
import test from 'node:test'
import type { Assignment, Lesson, LiveState, Submission, Word } from '../shared/portal.ts'
import { learningInsights, vocabularyDueCount } from '../src/features/live/learning-insights.ts'

const now = '2026-10-10T04:00:00Z'
function state(): LiveState {
  const user = {
    id: 'student',
    name: 'Student',
    email: 'student@example.test',
    role: 'student' as const,
    active: true,
    version: 1,
    createdAt: now,
  }
  return {
    user,
    users: [user, { ...user, id: 'other', name: 'Other student' }],
    classes: [
      {
        id: 'class',
        title: 'English',
        level: 'B1',
        description: '',
        teacherIds: ['teacher'],
        assistantIds: ['assistant'],
        studentIds: ['student', 'other'],
        active: true,
        listed: false,
        enrollmentOpen: false,
        version: 1,
      },
    ],
    classMeetings: [],
    openClasses: [],
    enrollmentRequests: [],
    assignments: [],
    drafts: [],
    studyWorkspaces: [],
    submissions: [],
    materials: [],
    units: [],
    attendance: [],
    lessons: [],
    bookings: [],
    consultationOutcomes: [],
    words: [],
    notifications: [],
    files: [],
    audit: [],
    integrations: { ai: false, email: false, zoom: false },
    fetchedAt: now,
  }
}
function assignment(id: string, overrides: Partial<Assignment> = {}): Assignment {
  return {
    id,
    classId: 'class',
    title: { vi: id, en: id },
    instructions: { vi: '', en: '' },
    skill: 'writing',
    dueAt: '',
    published: true,
    required: true,
    attachmentIds: [],
    version: 1,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}
function submission(id: string, overrides: Partial<Submission> = {}): Submission {
  return {
    id,
    assignmentId: 'writing',
    classId: 'class',
    studentId: 'student',
    revision: 1,
    assignmentVersion: 1,
    title: { vi: id, en: id },
    instructions: { vi: '', en: '' },
    skill: 'writing',
    answer: '',
    attachmentIds: [],
    submittedAt: now,
    review: null,
    version: 1,
    ...overrides,
  }
}
function lesson(id: string, overrides: Partial<Lesson> = {}): Lesson {
  return {
    id,
    classId: 'class',
    title: id,
    startsAt: '2026-10-11T04:00:00Z',
    endsAt: '2026-10-11T05:00:00Z',
    kind: 'class',
    hostId: 'teacher',
    capacity: 1,
    reservedCount: 0,
    cancelled: false,
    meetingSource: 'none',
    hasMeeting: false,
    version: 1,
    ...overrides,
  }
}
const review = (score: number) => ({
  score,
  feedback: 'Feedback',
  teacherId: 'teacher',
  reviewedAt: now,
})

test('student next steps prioritize deadlines and require own current-version submissions', () => {
  const model = state()
  model.assignments = [
    assignment('no-deadline'),
    assignment('soon', { dueAt: '2026-10-11T04:00:00Z' }),
    assignment('overdue', { dueAt: '2026-10-09T04:00:00Z', version: 2 }),
    assignment('finished'),
    assignment('draft-only', { published: false }),
    assignment('unrelated', { classId: 'not-enrolled' }),
  ]
  model.submissions = [
    submission('old-version', { assignmentId: 'overdue' }),
    submission('another-student', { assignmentId: 'soon', studentId: 'other' }),
    submission('done', { assignmentId: 'finished' }),
  ]
  model.drafts = [
    {
      id: 'draft',
      assignmentId: 'soon',
      assignmentVersion: 1,
      studentId: 'student',
      answer: 'Draft',
      notes: '',
      attachmentIds: [],
      version: 1,
      updatedAt: now,
    },
  ]
  const result = learningInsights(model)
  assert.deepEqual(
    result.pending.map((item) => [item.assignment.id, item.urgency]),
    [
      ['overdue', 'overdue'],
      ['soon', 'soon'],
      ['no-deadline', 'later'],
    ],
  )
  assert.equal(result.pending[0]?.changed, true)
  assert.equal(result.pending[1]?.hasDraft, true)
  assert.equal(result.assignments.length, 4)
})

test('skill results count each current assignment once using its latest reviewed revision', () => {
  const model = state()
  model.assignments = [
    assignment('writing'),
    assignment('writing-two'),
    assignment('reading', { skill: 'reading', version: 2 }),
  ]
  model.submissions = [
    submission('first', { review: review(3) }),
    submission('second', { revision: 2, review: review(9) }),
    submission('third-pending', { revision: 3 }),
    submission('another-task', { assignmentId: 'writing-two', review: review(7) }),
    submission('other-student', { studentId: 'other', review: review(0) }),
    submission('obsolete', { assignmentId: 'reading', skill: 'reading', review: review(8) }),
  ]
  const result = learningInsights(model)
  assert.deepEqual(
    result.progress.find((item) => item.skill === 'writing'),
    { skill: 'writing', assigned: 2, submitted: 2, reviewed: 2, average: 8 },
  )
  assert.deepEqual(
    result.progress.find((item) => item.skill === 'reading'),
    { skill: 'reading', assigned: 1, submitted: 0, reviewed: 0, average: null },
  )
  assert.deepEqual(
    result.pendingReviews.map((item) => item.id),
    ['third-pending'],
  )
  assert.equal(result.progress.length, 4)
})

test('student timetable excludes unreserved, cancelled, past and other-student review slots', () => {
  const model = state()
  model.lessons = [
    lesson('main'),
    lesson('booked', { kind: 'consultation' }),
    lesson('unreserved', { kind: 'consultation' }),
    lesson('other-booking', { kind: 'consultation' }),
    lesson('cancelled-booking', { kind: 'consultation' }),
    lesson('cancelled', { cancelled: true }),
    lesson('past', { endsAt: '2026-10-09T04:00:00Z' }),
    lesson('different-class', { classId: 'not-enrolled' }),
  ]
  model.bookings = [
    {
      id: 'one',
      lessonId: 'booked',
      studentId: 'student',
      status: 'booked',
      version: 1,
      createdAt: now,
    },
    {
      id: 'two',
      lessonId: 'other-booking',
      studentId: 'other',
      status: 'booked',
      version: 1,
      createdAt: now,
    },
    {
      id: 'three',
      lessonId: 'cancelled-booking',
      studentId: 'student',
      status: 'cancelled',
      version: 1,
      createdAt: now,
    },
  ]
  assert.deepEqual(
    learningInsights(model).upcoming.map((item) => item.id),
    ['main', 'booked'],
  )
})

test('teacher queue keeps only latest current revision per learner and preparation excludes unpublished work', () => {
  const model = state()
  model.user = { ...model.user, id: 'teacher', role: 'teacher' }
  model.assignments = [
    assignment('writing'),
    assignment('optional', { required: false }),
    assignment('draft', { published: false }),
  ]
  model.submissions = [
    submission('superseded'),
    submission('latest-reviewed', { revision: 2, review: review(7) }),
    submission('other-latest', { studentId: 'other', revision: 2 }),
    submission('other-old', { studentId: 'other' }),
    submission('old-prompt', { assignmentId: 'optional', assignmentVersion: 0 }),
  ]
  const result = learningInsights(model)
  assert.deepEqual(
    result.pendingReviews.map((item) => item.id),
    ['other-latest'],
  )
  assert.equal(result.preparation[0]?.missing, 0)
  assert.equal(result.preparation[0]?.ready, 2)
  assert.equal(result.followUpStudents, 0)
  assert.deepEqual(result.progress, [])
})

test('assistant preparation uses metadata without interpreting redacted review fields', () => {
  const model = state()
  model.user = { ...model.user, id: 'assistant', role: 'assistant' }
  model.assignments = [assignment('writing', { version: 2 })]
  model.submissions = [
    submission('old', { revision: 1 }),
    submission('current', { revision: 2, assignmentVersion: 2 }),
  ]
  model.lessons = [
    lesson('reserved-review', { kind: 'consultation' }),
    lesson('unreserved-review', { kind: 'consultation' }),
  ]
  model.bookings = [
    {
      id: 'reservation',
      lessonId: 'reserved-review',
      studentId: 'other',
      status: 'booked',
      version: 1,
      createdAt: now,
    },
  ]
  for (const item of model.submissions)
    Object.defineProperty(item, 'review', {
      get() {
        throw new Error('Assistant must not interpret review data')
      },
    })
  const result = learningInsights(model)
  assert.equal(result.submitted, 1)
  assert.equal(result.followUpStudents, 1)
  assert.equal(result.preparation[0]?.missing, 1)
  assert.deepEqual(result.pendingReviews, [])
  assert.deepEqual(result.progress, [])
  assert.deepEqual(result.preparation[0]?.followUps, [
    {
      studentId: 'other',
      tasks: [{ id: 'writing', title: { vi: 'writing', en: 'writing' } }],
      nextReview: {
        id: 'reserved-review',
        title: 'reserved-review',
        startsAt: '2026-10-11T04:00:00Z',
      },
    },
  ])
})

test('class scope and inactive classes do not leak into current actionable totals', () => {
  const model = state()
  model.classes.push({ ...model.classes[0]!, id: 'inactive', active: false })
  model.assignments = [assignment('writing'), assignment('archived', { classId: 'inactive' })]
  assert.equal(learningInsights(model).pending.length, 1)
  assert.equal(learningInsights(model, 'missing').pending.length, 0)
  model.user = { ...model.user, role: 'admin', id: 'admin' }
  model.enrollmentRequests = [
    {
      id: 'request',
      classId: 'class',
      classTitle: 'English',
      studentId: 'other',
      status: 'pending',
      note: '',
      version: 1,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'reviewed',
      classId: 'class',
      classTitle: 'English',
      studentId: 'student',
      status: 'approved',
      note: '',
      version: 2,
      createdAt: now,
      updatedAt: now,
    },
  ]
  assert.equal(learningInsights(model).enrollmentPending, 1)
  assert.equal(learningInsights(model, 'missing').enrollmentPending, 0)
})

test('vocabulary due includes new and due words but excludes future review dates', () => {
  const word = { id: 'new', word: 'learn', meaning: 'học', example: '', topic: '', version: 1 }
  const words = [
    word,
    { ...word, id: 'due', practice: { dueAt: now } },
    { ...word, id: 'new-normalized', practice: { dueAt: null } },
    { ...word, id: 'future', practice: { dueAt: '2026-10-11T04:00:00Z' } },
  ] as Word[]
  assert.equal(vocabularyDueCount(words, Date.parse(now)), 3)
})
