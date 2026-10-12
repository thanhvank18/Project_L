import type { ReadingResponse, Text } from './portal.ts'

/** Safe catalogue metadata; answer keys and transcripts stay on the server. */
export interface StarterCurriculumStatus {
  id: string
  title: Text
  description: Text
  unitCount: number
  assignmentCount: number
  audioCount: number
  imported: { classId: string; importedAt: string } | null
}

export interface StarterCurriculumImportResult {
  classId: string
  created: boolean
  assignmentCount: number
  unitCount: number
  audioCount: number
}

export interface StarterTeacherGuide {
  title: Text
  notice: Text
  units: Omit<StarterTeacherGuideSource['units'][number], 'assignmentIds'>[]
  /** Original bilingual file for an explicit staff download, not HTML rendering. */
  markdown: string
}

/** Internal structure is type-only; no teacher answers are bundled in the browser. */
export interface StarterTeacherGuideSource {
  classId: string
  title: Text
  notice: Text
  units: {
    title: Text
    assignmentIds: Record<'reading' | 'listening' | 'writing' | 'speaking', string>
    readingAnswers: ReadingResponse
    readingRationale: Text
    listeningTranscript: string
    listeningAnswers: ReadingResponse
    listeningRationale: Text
    writingReview: Text
    speakingReview: Text
    consultationReview: Text
  }[]
}
