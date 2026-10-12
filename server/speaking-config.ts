import type { SpeakingConfigurationSummary, SpeakingProviderName } from '../shared/speaking.ts'
import { speakingLimits } from '../shared/speaking.ts'

export interface SpeakingConfiguration {
  provider: SpeakingProviderName
  enabled: boolean
  apiKey: string
  expiresAt?: string
  speechModel: string
  transcriptionModel: string
  assessmentModel: string
  voice: string
  dailyJobs: number
  dailyGlobalJobs: number
}
export function speakingConfigurationFromEnvironment(
  env: NodeJS.ProcessEnv = process.env,
): SpeakingConfiguration {
  const provider = env.PORTAL_AI_PROVIDER?.trim() || 'openai'
  if (provider !== 'openai' && provider !== 'gemini') throw new Error('Invalid PORTAL_AI_PROVIDER.')
  const gemini = provider === 'gemini'
  const prefix = gemini ? 'PORTAL_GEMINI_' : 'PORTAL_AI_'
  const model = (name: string, fallback: string) => {
    const value = env[name]?.trim() || fallback
    if (!/^[a-zA-Z0-9._-]{1,100}$/.test(value)) throw new Error(`Invalid ${name}.`)
    return value
  }
  const bounded = (name: string, fallback: number, max: number) => {
    const value = env[name] === undefined ? fallback : Number(env[name])
    if (!Number.isInteger(value) || value < 1 || value > max) throw new Error(`Invalid ${name}.`)
    return value
  }
  const expiry = env.PORTAL_AI_EXPIRES_AT?.trim()
  let expiresAt: string | undefined
  if (expiry) {
    const milliseconds = Date.parse(expiry)
    if (
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(expiry) ||
      !Number.isFinite(milliseconds) ||
      new Date(milliseconds).toISOString() !==
        (expiry.includes('.') ? expiry : expiry.replace('Z', '.000Z'))
    )
      throw new Error('Invalid PORTAL_AI_EXPIRES_AT. Use a UTC ISO timestamp.')
    expiresAt = new Date(milliseconds).toISOString()
  }
  return {
    provider,
    enabled: env.PORTAL_AI_ENABLED === 'true',
    apiKey: env[gemini ? 'PORTAL_GEMINI_API_KEY' : 'PORTAL_AI_API_KEY']?.trim() ?? '',
    expiresAt,
    speechModel: model(
      `${prefix}SPEECH_MODEL`,
      gemini ? 'gemini-3.8-flash-tts' : 'gpt-4o-mini-tts',
    ),
    transcriptionModel: model(
      `${prefix}TRANSCRIBE_MODEL`,
      gemini ? 'gemini-3.8-flash' : 'gpt-transcribe',
    ),
    assessmentModel: model(
      `${prefix}ASSESSMENT_MODEL`,
      gemini ? 'gemini-3.8-flash' : 'gpt-audio-1.5',
    ),
    voice: model(`${prefix}VOICE`, gemini ? 'Kore' : 'coral'),
    dailyJobs: bounded('PORTAL_AI_DAILY_JOBS', 20, 100),
    dailyGlobalJobs: bounded('PORTAL_AI_DAILY_GLOBAL_JOBS', 100, 1000),
  }
}
export function speakingConfigurationSummary(
  config: SpeakingConfiguration,
  currentTime: number = Date.now(),
): SpeakingConfigurationSummary {
  const expiresAt = config.expiresAt === undefined ? undefined : Date.parse(config.expiresAt)
  const expired =
    expiresAt !== undefined && (!Number.isFinite(expiresAt) || currentTime >= expiresAt)
  const reason = !config.enabled
    ? 'disabled'
    : !config.apiKey
      ? 'missing_key'
      : expired
        ? 'expired'
        : 'ready'
  return {
    enabled: reason === 'ready',
    reason,
    provider: config.provider,
    ...(expiresAt !== undefined && Number.isFinite(expiresAt)
      ? { expiresAt: new Date(expiresAt).toISOString() }
      : {}),
    limits: {
      minSeconds: speakingLimits.minSeconds,
      maxSeconds: speakingLimits.maxSeconds,
      maxBytes: speakingLimits.maxBytes,
      dailyJobs: config.dailyJobs,
    },
  }
}
