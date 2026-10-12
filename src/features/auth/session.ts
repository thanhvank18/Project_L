import type { PortalRole, PortalSession, PortalUser } from './types.ts'

export const SESSION_KEY = 'project-l.auth.session.v2'
export const SESSION_EVENT = 'project-l:session-change'

export function mapBackendRole(role: string): PortalRole | null {
  if (role === 'student' || role === 'teacher' || role === 'assistant' || role === 'admin')
    return role
  if (role === 'STUDENT') return 'student'
  if (['CLASS_TEACHER', 'SUBJECT_TEACHER', 'ACADEMIC_COORDINATOR'].includes(role)) return 'teacher'
  if (['SUPER_ADMIN', 'IT_ADMIN', 'DIRECTOR'].includes(role)) return 'admin'
  return null
}

export function parseAccessToken(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 8192) return null
  if (/^[A-Za-z0-9_-]{43}$/.test(value)) return value
  return /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value) ? value : null
}

export function parseStoredToken(value: string | null): string | null {
  if (!value || value.length > 8400) return null
  try {
    const parsed: unknown = JSON.parse(value)
    if (!parsed || typeof parsed !== 'object' || !('version' in parsed) || parsed.version !== 1)
      return null
    return 'accessToken' in parsed ? parseAccessToken(parsed.accessToken) : null
  } catch {
    return null
  }
}

export function parseProfile(value: unknown): PortalUser | null {
  if (!value || typeof value !== 'object') return null
  const data = value as Record<string, unknown>
  if (
    typeof data.id !== 'string' ||
    !data.id.trim() ||
    data.id.length > 200 ||
    typeof data.email !== 'string' ||
    !data.email.includes('@') ||
    data.email.length > 320 ||
    typeof data.role !== 'string' ||
    !data.role.trim() ||
    data.role.length > 80 ||
    data.isActive === false
  )
    return null
  const names = [data.firstName, data.lastName].filter(
    (part): part is string => typeof part === 'string',
  )
  return {
    id: data.id,
    email: data.email,
    backendRole: data.role,
    name: names.join(' ').trim().slice(0, 200) || data.email,
  }
}

export function authenticatedSession(profile: PortalUser): PortalSession | null {
  const role = mapBackendRole(profile.backendRole)
  return role ? { mode: 'authenticated', user: profile, role } : null
}

export function previewSession(search: string): PortalSession | null {
  const role = new URLSearchParams(search).get('preview')
  if (role !== 'student' && role !== 'teacher' && role !== 'assistant' && role !== 'admin')
    return null
  return {
    mode: 'preview',
    role,
    user: { id: `preview-${role}`, name: 'Demo', email: '', backendRole: 'PREVIEW' },
  }
}

export function apiPath(path: string): string {
  const clean = path.replace(/^\//, '')
  if (!/^[a-zA-Z0-9][a-zA-Z0-9/_-]*(?:\?[^#\\]*)?$/.test(clean)) throw new Error('Invalid API path')
  return `/api/v1/${clean}`
}
