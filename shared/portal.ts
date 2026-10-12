import type { StudyWorkspace } from './study.ts'
import type { ReadingDefinition, ReadingResponse } from './reading.ts'
export type { StudyAnnotation, StudyMapNode, StudyStroke, StudyWorkspace } from './study.ts'
export type {
  ReadingDefinition,
  ReadingGroup,
  ReadingOption,
  ReadingQuestion,
  ReadingResponse,
} from './reading.ts'

export type Role = 'admin' | 'teacher' | 'assistant' | 'student'
export type Locale = 'vi' | 'en'
export type Text = { vi: string; en: string }
export type Skill = 'reading' | 'writing' | 'listening' | 'speaking'
export type MeetingSource = 'class' | 'lesson' | 'none'
export type VocabularyRating = 'again' | 'hard' | 'good' | 'easy'
export interface VocabularyPractice {
  box: number
  reviewCount: number
  dueAt: string | null
  lastReviewedAt: string | null
  lastRating: VocabularyRating | null
}
export interface Account {
  id: string
  name: string
  email: string
  role: Role
  active: boolean
  version: number
  createdAt: string
}
export interface Classroom {
  id: string
  title: string
  level: string
  description: string
  teacherIds: string[]
  assistantIds: string[]
  studentIds: string[]
  active: boolean
  listed: boolean
  enrollmentOpen: boolean
  version: number
}
export type PublicCourse = Pick<
  Classroom,
  'id' | 'title' | 'level' | 'description' | 'enrollmentOpen'
>
export interface EnrollmentRequest {
  id: string
  classId: string
  classTitle: string
  studentId: string
  status: 'pending' | 'approved' | 'rejected' | 'cancelled'
  note: string
  version: number
  createdAt: string
  updatedAt: string
  reviewedBy?: string
}
export interface Assignment {
  id: string
  classId: string
  title: Text
  instructions: Text
  skill: Skill
  dueAt: string
  published: boolean
  required: boolean
  attachmentIds: string[]
  /** Structured questions for Reading or Listening; the wire name remains compatible. */
  reading?: ReadingDefinition
  /** Optional Writing editor restriction, not a server-side authorship guarantee. */
  pasteRestricted?: boolean
  version: number
  createdAt: string
  updatedAt: string
}
export interface Draft {
  id: string
  assignmentId: string
  assignmentVersion: number
  studentId: string
  answer: string
  reading?: ReadingDefinition
  readingAnswers?: ReadingResponse
  notes: string
  attachmentIds: string[]
  version: number
  updatedAt: string
}
export interface Review {
  score: number
  feedback: string
  teacherId: string
  reviewedAt: string
}
export interface Submission {
  id: string
  assignmentId: string
  classId: string
  studentId: string
  revision: number
  assignmentVersion: number
  title: Text
  instructions: Text
  skill: Skill
  answer: string
  reading?: ReadingDefinition
  readingAnswers?: ReadingResponse
  promptAttachmentIds?: string[]
  pasteRestricted?: boolean
  attachmentIds: string[]
  submittedAt: string
  review: Review | null
  version: number
}
export interface Material {
  id: string
  classId: string
  title: string
  content: string
  attachmentIds: string[]
  published: boolean
  version: number
}
export interface Unit {
  id: string
  classId: string
  title: Text
  completed: boolean
  version: number
}
export interface Attendance {
  id: string
  classId: string
  studentId: string
  date: string
  status: 'present' | 'absent' | 'late' | 'unmarked'
  version: number
}
export interface Lesson {
  id: string
  classId: string
  title: string
  startsAt: string
  endsAt: string
  kind: 'class' | 'consultation'
  /** A consultation reviews the preceding main lesson before this upcoming main lesson. */
  reviewForLessonId?: string
  hostId: string
  capacity: number
  reservedCount: number
  cancelled: boolean
  meetingSource: MeetingSource
  hasMeeting: boolean
  version: number
}
export interface ClassMeeting {
  classId: string
  hasMeeting: boolean
  version: number
}
export interface Booking {
  id: string
  lessonId: string
  studentId: string
  status: 'booked' | 'cancelled'
  version: number
  createdAt: string
}
export interface ConsultationOutcome {
  id: string
  bookingId: string
  lessonId: string
  studentId: string
  classId: string
  status: 'completed' | 'no_show'
  feedback: string
  teacherId: string
  completedAt: string
  updatedAt: string
  version: number
  /** Immutable lesson relationship at the time of confirmation. */
  reviewForLessonId?: string
  reviewedLessonId?: string
}
export interface MainReviewPreparation {
  lessonId: string
  classId: string
  studentId: string
  previousLessonId?: string
  consultationId?: string
  bookingId?: string
  status: 'exempt' | 'required' | 'booked' | 'awaiting_confirmation' | 'completed' | 'no_show'
}
export interface VocabularySource {
  assignmentId: string
  assignmentVersion: number
  classId: string
  skill: Skill
  title: Text
  context: string
}
export interface Word {
  id: string
  word: string
  meaning: string
  example: string
  topic: string
  version: number
  practice: VocabularyPractice
  source?: VocabularySource
}
export interface Notification {
  id: string
  title: string
  body: string
  createdAt: string
  read: boolean
}
export interface FileRecord {
  id: string
  name: string
  mime: string
  size: number
  classId: string
  ownerId: string
  purpose: 'material' | 'submission'
  createdAt: string
}
export interface AuditEntry {
  id: string
  actorId: string
  action: string
  targetId: string
  createdAt: string
}
export interface LiveState {
  user: Account
  users: Account[]
  classes: Classroom[]
  classMeetings: ClassMeeting[]
  openClasses: PublicCourse[]
  enrollmentRequests: EnrollmentRequest[]
  assignments: Assignment[]
  drafts: Draft[]
  studyWorkspaces: StudyWorkspace[]
  submissions: Submission[]
  materials: Material[]
  units: Unit[]
  attendance: Attendance[]
  lessons: Lesson[]
  bookings: Booking[]
  consultationOutcomes: ConsultationOutcome[]
  /** Sanitized current gate status; legacy clients may omit this collection. */
  mainReviewPreparation?: MainReviewPreparation[]
  words: Word[]
  notifications: Notification[]
  files: FileRecord[]
  audit: AuditEntry[]
  integrations: { email: boolean; zoom: boolean; ai: boolean }
  fetchedAt: string
}
export interface ActionInput {
  type: string
  payload: Record<string, unknown>
}
export interface ActionResult {
  state: LiveState
  result?: Record<string, unknown>
}
