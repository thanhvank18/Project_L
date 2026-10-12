import type { PortalRole } from '../learning/types.ts'
import { visibleCourseIds } from './model.ts'
import type { ManagementState, ManagementSubmission, SubmissionRevision } from './types.ts'

export const DEMO_LEARNER_ID = 'learner-01'
export const MAX_SUBMISSION_LENGTH = 20_000
export const MAX_REVIEW_LENGTH = 4_000
export const MAX_SUBMISSION_HISTORY = 10

function validTime(value: string) {
  return value.length <= 40 && Number.isFinite(Date.parse(value))
}

export function visibleSubmissions(state: ManagementState, role: PortalRole) {
  const courseIds = new Set(visibleCourseIds(state, role))
  const taskIds = new Set(
    state.tasks.filter((task) => courseIds.has(task.courseId)).map((task) => task.id),
  )
  return state.submissions.filter(
    (submission) =>
      taskIds.has(submission.taskId) &&
      (role !== 'student' || submission.learnerId === DEMO_LEARNER_ID),
  )
}

export interface SubmitTaskInput {
  role: PortalRole
  taskId: string
  answer: string
  expectedRevision: number
  now: string
}

/** A local preview transition, not a substitute for server authorization. */
export function submitTask(state: ManagementState, input: SubmitTaskInput): ManagementState | null {
  const { role, taskId, answer, expectedRevision, now } = input
  if (
    role !== 'student' ||
    !answer.trim() ||
    answer.length > MAX_SUBMISSION_LENGTH ||
    !validTime(now)
  )
    return null
  const learner = state.learners.find((item) => item.id === DEMO_LEARNER_ID)
  const task = state.tasks.find((item) => item.id === taskId)
  if (
    !learner ||
    learner.status !== 'active' ||
    !task?.published ||
    learner.courseId !== task.courseId ||
    !state.courses.some((course) => course.id === task.courseId && course.status === 'active')
  )
    return null
  const existing = state.submissions.find(
    (item) => item.taskId === taskId && item.learnerId === learner.id,
  )
  if ((existing?.revision ?? 0) !== expectedRevision) return null
  if (existing?.answer === answer && existing.status === 'submitted') return state

  let sequence = state.submissions.length + 1
  while (state.submissions.some((item) => item.id === `submission-${sequence}`)) sequence++
  const history: SubmissionRevision[] = existing
    ? [
        ...existing.history,
        {
          revision: existing.revision,
          answer: existing.answer,
          submittedAt: existing.submittedAt,
          review: existing.review ? { ...existing.review } : null,
        },
      ].slice(-MAX_SUBMISSION_HISTORY)
    : []
  const submission: ManagementSubmission = {
    id: existing?.id ?? `submission-${sequence}`,
    taskId,
    learnerId: learner.id,
    answer,
    revision: expectedRevision + 1,
    status: 'submitted',
    submittedAt: now,
    review: null,
    history,
  }
  return {
    ...state,
    submissions: existing
      ? state.submissions.map((item) => (item.id === existing.id ? submission : item))
      : [...state.submissions, submission],
  }
}

export interface ReviewSubmissionInput {
  role: PortalRole
  submissionId: string
  expectedRevision: number
  score: number
  feedback: string
  now: string
}

export function reviewSubmission(
  state: ManagementState,
  input: ReviewSubmissionInput,
): ManagementState | null {
  const { role, submissionId, expectedRevision, score, feedback, now } = input
  if (
    role !== 'teacher' ||
    !Number.isFinite(score) ||
    score < 0 ||
    score > 9 ||
    !feedback.trim() ||
    feedback.length > MAX_REVIEW_LENGTH ||
    !validTime(now)
  )
    return null
  const submission = visibleSubmissions(state, role).find((item) => item.id === submissionId)
  if (!submission || submission.status !== 'submitted' || submission.revision !== expectedRevision)
    return null
  return {
    ...state,
    submissions: state.submissions.map((item) =>
      item.id === submission.id
        ? {
            ...item,
            status: 'returned',
            review: {
              revision: item.revision,
              score,
              feedback: feedback.trim(),
              reviewedAt: now,
            },
          }
        : item,
    ),
  }
}
