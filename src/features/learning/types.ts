import type { Language } from '@/i18n/messages'

export type PortalLocale = Language
export type LocalizedText = { vi: string; en: string }
export type PortalRole = 'student' | 'teacher' | 'assistant' | 'admin'
export type Skill = 'reading' | 'listening' | 'writing' | 'speaking'
export type PortalSection =
  'overview' | 'courses' | 'assignments' | 'schedule' | 'notebook' | 'classroom'

export interface LearningCourse {
  id: string
  title: LocalizedText
  subtitle: LocalizedText
  level: string
  topic: LocalizedText
  description: LocalizedText
  weeks: number
  currentWeek: number
}

export interface LearningAssignment {
  id: string
  courseId: string
  title: LocalizedText
  description: LocalizedText
  skill: Skill
  minutes: number
  due: string
  required: boolean
  responseMode?: 'text'
}

export interface LearningSession {
  id: string
  courseId: string
  title: LocalizedText
  start: string
  end: string
  type: 'class' | 'consultation'
}

export interface ConsultationSlot {
  id: string
  start: string
  end: string
  host: LocalizedText
}

export interface VocabularyWord {
  id: string
  word: string
  meaning: LocalizedText
  example: string
  topic: LocalizedText
}

export interface DemoLearner {
  id: string
  name: LocalizedText
  status: 'ready' | 'missing' | 'review'
  submitted: number
}

export interface PortalData {
  courses: LearningCourse[]
  assignments: LearningAssignment[]
  sessions: LearningSession[]
  slots: ConsultationSlot[]
  learners: DemoLearner[]
}

export interface PortalState {
  version: 1
  drafts: Record<string, string>
  draftTaskIds?: string[]
  submittedIds: string[]
  bookingSlotId: string | null
  words: VocabularyWord[]
}

export interface LearningActions {
  saveDraft: (assignmentId: string, text: string) => boolean
  submitAssignment: (assignmentId: string) => boolean
  bookSlot: (slotId: string) => boolean
  cancelBooking: () => boolean
  addWord: (word: VocabularyWord) => boolean
  removeWord: (id: string) => boolean
  reset: () => boolean
}
