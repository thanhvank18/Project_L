export const speakingCriteria = [
  'fluency_coherence',
  'lexical_resource',
  'grammatical_range_accuracy',
  'pronunciation',
] as const
export type SpeakingCriterion = (typeof speakingCriteria)[number]
export type SpeakingProviderName = 'openai' | 'gemini'
export type SpeakingAudioMime = 'audio/mpeg' | 'audio/wav'
export interface SpeakingCriterionFeedback {
  score: number | null
  feedback: string
  evidence: string[]
  improvements: string[]
}
export interface SpeakingAssessment {
  criteria: Record<SpeakingCriterion, SpeakingCriterionFeedback>
  overall: number | null
  summary: string
  limitations: string[]
  audioEvaluated: true
  advisory: true
}
export type SpeakingStatus =
  | 'queued'
  | 'synthesizing'
  | 'transcribing'
  | 'assessing'
  | 'completed'
  | 'needs_review'
  | 'failed'
  | 'cancelled'
export interface SpeakingJob {
  id: string
  assignmentId: string
  assignmentVersion: number
  title: { vi: string; en: string }
  prompt: string
  kind: 'question' | 'assessment'
  locale: 'vi' | 'en'
  fileId?: string
  status: SpeakingStatus
  transcript?: string
  assessment?: SpeakingAssessment
  durationSeconds?: number
  errorCode?: string
  hasAudio: boolean
  provider: SpeakingProviderName
  voice?: string
  audioMime?: SpeakingAudioMime
  models: { speech: string; transcription: string; assessment: string }
  rubricVersion: string
  createdAt: string
  updatedAt: string
  version: number
}
export interface SpeakingConfigurationSummary {
  enabled: boolean
  provider: SpeakingProviderName
  reason: 'ready' | 'disabled' | 'missing_key' | 'expired'
  expiresAt?: string
  limits: { minSeconds: number; maxSeconds: number; maxBytes: number; dailyJobs: number }
}
export interface SpeakingHistory {
  configuration: SpeakingConfigurationSummary
  jobs: SpeakingJob[]
}
export const speakingLimits = {
  minSeconds: 3,
  maxSeconds: 240,
  maxBytes: 8 * 1024 * 1024,
  promptCharacters: 4000,
  transcriptCharacters: 24000,
  sampleRate: 16000,
} as const
