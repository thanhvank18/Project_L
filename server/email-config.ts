export interface EmailConfiguration {
  enabled: boolean
  provider: 'disabled' | 'resend'
  apiKey: string
  from: string
  portalOrigin: string
  locale: 'vi' | 'en'
  timeZone: string
  assignmentLeadHours: number
  lessonLeadHours: number
}

export const validEmailAddress = (value: string): boolean =>
  value.length <= 254 && /^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/.test(value)

export function emailConfigurationFromEnvironment(
  env: Record<string, string | undefined> = process.env,
): EmailConfiguration {
  const flag = env.PORTAL_EMAIL_ENABLED ?? 'false'
  if (flag !== 'true' && flag !== 'false')
    throw new Error('PORTAL_EMAIL_ENABLED must be true or false.')
  const provider = env.PORTAL_EMAIL_PROVIDER ?? 'disabled'
  if (provider !== 'disabled' && provider !== 'resend')
    throw new Error('PORTAL_EMAIL_PROVIDER must be disabled or resend.')
  const locale = env.PORTAL_EMAIL_LOCALE ?? 'vi'
  if (locale !== 'vi' && locale !== 'en') throw new Error('PORTAL_EMAIL_LOCALE must be vi or en.')
  const timeZone = env.PORTAL_EMAIL_TIME_ZONE ?? 'Asia/Ho_Chi_Minh'
  try {
    new Intl.DateTimeFormat(locale, { timeZone }).format(new Date(0))
  } catch {
    throw new Error('PORTAL_EMAIL_TIME_ZONE must be an IANA time zone.')
  }
  const hours = (key: string, fallback: number): number => {
    const value = Number(env[key] ?? fallback)
    if (!Number.isInteger(value) || value < 1 || value > 168)
      throw new Error(`${key} must be a whole number from 1 to 168.`)
    return value
  }
  const enabled = flag === 'true'
  const rawOrigin = env.PORTAL_EMAIL_PORTAL_ORIGIN ?? 'http://127.0.0.1:5173'
  let origin: URL
  try {
    origin = new URL(rawOrigin)
  } catch {
    throw new Error('PORTAL_EMAIL_PORTAL_ORIGIN must be an absolute portal origin.')
  }
  if (
    !['https:', 'http:'].includes(origin.protocol) ||
    origin.username ||
    origin.password ||
    origin.pathname !== '/' ||
    origin.search ||
    origin.hash ||
    (enabled && origin.protocol !== 'https:')
  )
    throw new Error(
      'PORTAL_EMAIL_PORTAL_ORIGIN must be an origin only; enabled email requires HTTPS.',
    )
  const from = env.PORTAL_EMAIL_FROM ?? ''
  const apiKey = env.PORTAL_EMAIL_API_KEY ?? ''
  if (from && !validEmailAddress(from))
    throw new Error('PORTAL_EMAIL_FROM must be a single bare email address.')
  if (apiKey && (apiKey.length > 512 || /\s/.test(apiKey)))
    throw new Error('PORTAL_EMAIL_API_KEY has an invalid shape.')
  if (enabled && (provider !== 'resend' || !from || !apiKey))
    throw new Error('Enabled email requires the resend provider, sender and private API key.')
  return {
    enabled,
    provider,
    apiKey,
    from,
    portalOrigin: origin.origin,
    locale,
    timeZone,
    assignmentLeadHours: hours('PORTAL_EMAIL_ASSIGNMENT_LEAD_HOURS', 24),
    lessonLeadHours: hours('PORTAL_EMAIL_LESSON_LEAD_HOURS', 1),
  }
}

export function emailConfigurationReady(config: EmailConfiguration): boolean {
  return (
    config.provider === 'resend' &&
    Boolean(config.apiKey) &&
    validEmailAddress(config.from) &&
    config.portalOrigin.startsWith('https://')
  )
}
