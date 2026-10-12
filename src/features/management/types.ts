import type { LocalizedText, PortalLocale, PortalRole, Skill } from '@/features/learning/types'

export type ManagementSection =
  | 'overview'
  | 'students'
  | 'courses'
  | 'attendance'
  | 'syllabus'
  | 'schedule'
  | 'materials'
  | 'assignments'
  | 'grading'
  | 'reports'
  | 'notebook'
  | 'notifications'
  | 'users'
  | 'settings'
export interface ManagementCourse {
  id: string
  title: string
  level: string
  teacher: string
  status: 'active' | 'draft'
}
export interface ManagementLearner {
  id: string
  name: string
  email: string
  courseId: string
  status: 'active' | 'paused'
}
export interface ManagementAttendance {
  id: string
  learnerId: string
  courseId: string
  date: string
  status: 'present' | 'absent' | 'late' | 'unmarked'
}
export interface ManagementTask {
  id: string
  title: LocalizedText
  instructions?: LocalizedText
  courseId: string
  skill: Skill
  due: string
  published: boolean
}
export interface ManagementGrade {
  id: string
  taskId: string
  learnerId: string
  score: number | null
  feedback: string
  reviewed: boolean
}
export interface ManagementMaterial {
  id: string
  title: string
  courseId: string
  content: string
  published: boolean
}
export interface ManagementUnit {
  id: string
  courseId: string
  title: LocalizedText
  done: boolean
}
export interface ManagementUser {
  id: string
  name: string
  email: string
  role: PortalRole
  active: boolean
}
export interface ManagementNotification {
  id: string
  title: string
  body: string
  date: string
  recipient: PortalRole | 'all'
  read: boolean
  readBy?: PortalRole[]
}
export interface SubmissionReview {
  revision: number
  score: number
  feedback: string
  reviewedAt: string
}
export interface SubmissionRevision {
  revision: number
  answer: string
  submittedAt: string
  review: SubmissionReview | null
}
export interface ManagementSubmission extends SubmissionRevision {
  id: string
  taskId: string
  learnerId: string
  status: 'submitted' | 'returned'
  history: SubmissionRevision[]
}
export interface ManagementState {
  version: 1
  courses: ManagementCourse[]
  learners: ManagementLearner[]
  attendance: ManagementAttendance[]
  tasks: ManagementTask[]
  grades: ManagementGrade[]
  materials: ManagementMaterial[]
  units: ManagementUnit[]
  users: ManagementUser[]
  notifications: ManagementNotification[]
  submissions: ManagementSubmission[]
}
export type ManagementCommit = (update: (current: ManagementState) => ManagementState) => boolean
export interface ManagementViewProps {
  state: ManagementState
  commit: ManagementCommit
  locale: PortalLocale
  role: PortalRole
}
