import { createManagementState } from './data.ts'
import type { ManagementCommit, ManagementState } from './types.ts'
import type { PortalRole } from '../learning/types.ts'

export interface ManagementStorage {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
}
const MAX_BYTES = 750_000
const roles = ['student', 'teacher', 'assistant', 'admin']
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const text = (value: unknown, max = 200, empty = false): value is string =>
  typeof value === 'string' && value.length <= max && (empty || value.trim().length > 0)
const id = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$/.test(value)
const localized = (value: unknown) => record(value) && text(value.vi) && text(value.en)
const instructions = (value: unknown) =>
  record(value) && text(value.vi, 6000) && text(value.en, 6000)
const timestamp = (value: unknown) =>
  typeof value === 'string' && value.length <= 40 && Number.isFinite(Date.parse(value))
const revision = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0 && value <= 10_000
const review = (value: unknown, expectedRevision: number) =>
  record(value) &&
  value.revision === expectedRevision &&
  typeof value.score === 'number' &&
  Number.isFinite(value.score) &&
  value.score >= 0 &&
  value.score <= 9 &&
  text(value.feedback, 4000) &&
  timestamp(value.reviewedAt)
const submissionRevision = (value: unknown): value is Record<string, unknown> =>
  record(value) &&
  revision(value.revision) &&
  text(value.answer, 20_000) &&
  timestamp(value.submittedAt) &&
  (value.review === null || review(value.review, value.revision))
const date = (value: unknown) =>
  typeof value === 'string' &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(Date.parse(value)) &&
  new Date(value).toISOString().slice(0, 10) === value
const choice = (value: unknown, choices: string[]) =>
  typeof value === 'string' && choices.includes(value)
const email = (value: unknown) => text(value, 254) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)

export function managementStorageKey(scope: string): string | null {
  try {
    return typeof scope === 'string' && scope.trim().length > 0 && scope.length <= 200
      ? `project-l.management-demo.v1.${encodeURIComponent(scope)}`
      : null
  } catch {
    return null
  }
}

export function isManagementState(value: unknown): value is ManagementState {
  if (!record(value) || value.version !== 1) return false
  const validations: Record<string, (item: Record<string, unknown>) => boolean> = {
    courses: (v) =>
      text(v.title) &&
      text(v.level, 50) &&
      text(v.teacher) &&
      choice(v.status, ['active', 'draft']),
    learners: (v) =>
      text(v.name) && email(v.email) && id(v.courseId) && choice(v.status, ['active', 'paused']),
    attendance: (v) =>
      id(v.learnerId) &&
      id(v.courseId) &&
      date(v.date) &&
      choice(v.status, ['present', 'absent', 'late', 'unmarked']),
    tasks: (v) =>
      localized(v.title) &&
      (v.instructions === undefined || instructions(v.instructions)) &&
      id(v.courseId) &&
      choice(v.skill, ['reading', 'listening', 'writing', 'speaking']) &&
      date(v.due) &&
      typeof v.published === 'boolean',
    grades: (v) =>
      id(v.taskId) &&
      id(v.learnerId) &&
      (v.score === null ||
        (typeof v.score === 'number' &&
          Number.isFinite(v.score) &&
          v.score >= 0 &&
          v.score <= 9)) &&
      text(v.feedback, 4000, true) &&
      typeof v.reviewed === 'boolean',
    materials: (v) =>
      text(v.title) && id(v.courseId) && text(v.content, 20000) && typeof v.published === 'boolean',
    units: (v) => id(v.courseId) && localized(v.title) && typeof v.done === 'boolean',
    users: (v) =>
      text(v.name) && email(v.email) && choice(v.role, roles) && typeof v.active === 'boolean',
    notifications: (v) =>
      text(v.title) &&
      text(v.body, 4000) &&
      date(v.date) &&
      choice(v.recipient, [...roles, 'all']) &&
      typeof v.read === 'boolean' &&
      (v.readBy === undefined ||
        (Array.isArray(v.readBy) &&
          v.readBy.every((role) => choice(role, roles)) &&
          new Set(v.readBy).size === v.readBy.length)),
    submissions: (v) => {
      if (
        !id(v.taskId) ||
        !id(v.learnerId) ||
        !submissionRevision(v) ||
        !revision(v.revision) ||
        !choice(v.status, ['submitted', 'returned']) ||
        !Array.isArray(v.history) ||
        v.history.length > 10 ||
        (v.status === 'submitted' ? v.review !== null : !review(v.review, v.revision))
      )
        return false
      let previousRevision = 0
      for (const previous of v.history) {
        if (
          !submissionRevision(previous) ||
          !revision(previous.revision) ||
          previous.revision <= previousRevision ||
          previous.revision >= v.revision
        )
          return false
        previousRevision = previous.revision
      }
      return true
    },
  }
  for (const [key, validate] of Object.entries(validations)) {
    const items = value[key]
    if (!Array.isArray(items) || items.length > 500) return false
    const ids = new Set<string>()
    for (const item of items) {
      if (!record(item) || !id(item.id) || ids.has(item.id) || !validate(item)) return false
      ids.add(item.id)
    }
  }
  const state = value as unknown as ManagementState
  for (const people of [state.learners, state.users]) {
    const emails = people.map((person) => person.email.trim().toLowerCase())
    if (new Set(emails).size !== emails.length) return false
  }
  const courses = new Set(state.courses.map((v) => v.id))
  const learners = new Map(state.learners.map((v) => [v.id, v]))
  const tasks = new Map(state.tasks.map((v) => [v.id, v]))
  if (
    [...state.learners, ...state.tasks, ...state.materials, ...state.units].some(
      (v) => !courses.has(v.courseId),
    )
  )
    return false
  if (
    state.attendance.some(
      (v) => !learners.has(v.learnerId) || learners.get(v.learnerId)?.courseId !== v.courseId,
    )
  )
    return false
  if (
    [...state.grades, ...state.submissions].some(
      (v) =>
        !learners.has(v.learnerId) ||
        !tasks.has(v.taskId) ||
        learners.get(v.learnerId)?.courseId !== tasks.get(v.taskId)?.courseId,
    )
  )
    return false
  const submissionPairs = state.submissions.map((v) => `${v.taskId}\u0000${v.learnerId}`)
  if (new Set(submissionPairs).size !== submissionPairs.length) return false
  return true
}

/** Add optional workflow fields to valid v1 data without replacing existing records. */
export function parseManagementState(raw: string): ManagementState | null {
  if (raw.length > MAX_BYTES) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!record(parsed) || parsed.version !== 1) return null
    if (parsed.submissions === undefined) parsed.submissions = []
    if (Array.isArray(parsed.tasks)) {
      const defaults = createManagementState().tasks
      parsed.tasks = parsed.tasks.map((task: unknown) => {
        if (!record(task) || task.instructions !== undefined) return task
        const existing = defaults.find((item) => item.id === task.id)?.instructions
        return {
          ...task,
          instructions: existing ?? {
            vi: 'Đọc yêu cầu của bài tập và viết câu trả lời bằng văn bản. Đây là nội dung dùng thử.',
            en: 'Read the assignment requirements and write a text response. This is preview content.',
          },
        }
      })
    }
    return isManagementState(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function visibleCourseIds(state: ManagementState, role: PortalRole): string[] {
  if (role === 'admin') return state.courses.map((v) => v.id)
  if (role === 'student')
    return state.learners.filter((v) => v.id === 'learner-01').map((v) => v.courseId)
  return state.courses.filter((v) => v.id === 'ielts-foundation').map((v) => v.id)
}

export function visibleLearners(state: ManagementState, role: PortalRole) {
  const courses = visibleCourseIds(state, role)
  return state.learners.filter(
    (v) => courses.includes(v.courseId) && (role !== 'student' || v.id === 'learner-01'),
  )
}

export function createManagementStore(storage: ManagementStorage | null, scope: string) {
  const key = managementStorageKey(scope)
  let snapshot = { state: createManagementState(), storageError: !storage || !key }
  if (storage && key) {
    try {
      const raw = storage.getItem(key)
      if (raw !== null) {
        const parsed = parseManagementState(raw)
        if (!parsed) throw new Error('Invalid preview data')
        snapshot = { state: parsed, storageError: false }
      }
    } catch {
      snapshot = { ...snapshot, storageError: true }
    }
  }
  const listeners = new Set<() => void>()
  const notify = () => listeners.forEach((listener) => listener())
  const persist = (update: Parameters<ManagementCommit>[0], recover = false) => {
    try {
      if (!storage || !key) throw new Error('Storage unavailable')
      // Rebase each operation onto the latest saved state so tabs and role
      // previews do not overwrite one another's unrelated changes.
      for (let attempt = 0; attempt < 3; attempt++) {
        const raw = storage.getItem(key)
        const base = raw === null || recover ? createManagementState() : parseManagementState(raw)
        if (!base) throw new Error('Stored preview is invalid; explicit reset is required')
        const next = update(structuredClone(base))
        if (!isManagementState(next)) throw new Error('Invalid change')
        const serialized = JSON.stringify(next)
        if (serialized.length > MAX_BYTES) throw new Error('Preview exceeds limit')
        if (storage.getItem(key) !== raw) continue
        storage.setItem(key, serialized)
        snapshot = { state: structuredClone(next), storageError: false }
        notify()
        return true
      }
      throw new Error('Preview changed during save; try again')
    } catch {
      snapshot = { ...snapshot, storageError: true }
      notify()
      return false
    }
  }
  const refresh = () => {
    try {
      if (!storage || !key) throw new Error('Storage unavailable')
      const raw = storage.getItem(key)
      const state = raw === null ? createManagementState() : parseManagementState(raw)
      if (!state) throw new Error('Invalid preview data')
      if (snapshot.storageError || JSON.stringify(state) !== JSON.stringify(snapshot.state)) {
        snapshot = { state, storageError: false }
        notify()
      }
      return true
    } catch {
      if (!snapshot.storageError) {
        snapshot = { ...snapshot, storageError: true }
        notify()
      }
      return false
    }
  }
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    key,
    refresh,
    commit: persist as ManagementCommit,
    reset: () => persist(createManagementState, true),
  }
}
