export interface StudyAnnotation {
  id: string
  locale: 'vi' | 'en'
  /** UTF-16 offsets into the exact assignment version's instructions for this locale. */
  start: number
  end: number
  quote: string
  note: string
}

export interface StudyMapNode {
  id: string
  parentId: string | null
  text: string
}

export interface StudyStroke {
  id: string
  points: { x: number; y: number }[]
}

export interface StudyWorkspace {
  id: string
  assignmentId: string
  assignmentVersion: number
  studentId: string
  version: number
  annotations: StudyAnnotation[]
  mindMap: { nodes: StudyMapNode[]; strokes: StudyStroke[] }
  /** Private review markers for this assignment version; never submitted as answers. */
  readingReview?: { flaggedQuestionIds: string[] }
  updatedAt: string
}

export const studyLimits = {
  idLength: 80,
  annotations: 80,
  annotationQuote: 2000,
  annotationNote: 1000,
  nodes: 80,
  nodeText: 300,
  strokes: 100,
  pointsPerStroke: 500,
  totalPoints: 10000,
  payloadBytes: 512 * 1024,
} as const
