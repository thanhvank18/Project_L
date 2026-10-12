import {
  apiPath,
  authenticatedSession,
  parseAccessToken,
  parseProfile,
  parseStoredToken,
  SESSION_EVENT,
  SESSION_KEY,
} from '@/features/auth/session'
import type { PortalSession } from '@/features/auth/types'

export type PortalApiErrorCode =
  | 'credentials'
  | 'expired'
  | 'forbidden'
  | 'network'
  | 'service'
  | 'invalid-response'
  | 'unsupported'
  | 'storage'
  | 'login-busy'
  | 'rate-limited'

export class PortalApiError extends Error {
  readonly code: PortalApiErrorCode
  readonly status: number
  constructor(code: PortalApiErrorCode, status = 0) {
    super(code)
    this.name = 'PortalApiError'
    this.code = code
    this.status = status
  }
}

export function readSessionToken(): string | null {
  try {
    return parseStoredToken(sessionStorage.getItem(SESSION_KEY))
  } catch {
    return null
  }
}

export function clearPortalSession(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY)
  } catch {
    /* The in-memory session still ends. */
  }
  window.dispatchEvent(new Event(SESSION_EVENT))
}

export async function signOutSession(): Promise<void> {
  const token = readSessionToken()
  clearPortalSession()
  if (token) await request('auth/logout', { method: 'POST', keepalive: true }, token)
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  token: string | null = null,
): Promise<T> {
  const headers = new Headers(options.headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)
  else headers.delete('Authorization')
  headers.set('Accept', 'application/json')
  let response: Response
  try {
    response = await fetch(apiPath(path), {
      ...options,
      headers,
      credentials: path === 'portal/drive/connect' ? 'same-origin' : 'omit',
      redirect: 'error',
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new PortalApiError('network')
  }
  if (!response.ok) {
    if (response.status === 401) {
      if (token && token === readSessionToken()) clearPortalSession()
      throw new PortalApiError(token ? 'expired' : 'credentials', 401)
    }
    if (response.status === 403) throw new PortalApiError('forbidden', 403)
    if (path === 'auth/login' && response.status === 429) {
      const detail: unknown = await response.json().catch(() => null)
      const busy =
        detail !== null &&
        typeof detail === 'object' &&
        'error' in detail &&
        detail.error === 'LOGIN_BUSY'
      throw new PortalApiError(busy ? 'login-busy' : 'rate-limited', 429)
    }
    throw new PortalApiError('service', response.status)
  }
  if (response.status === 204) return undefined as T
  try {
    return (await response.json()) as T
  } catch {
    throw new PortalApiError('invalid-response', response.status)
  }
}

export function apiRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const token = readSessionToken()
  if (!token) return Promise.reject(new PortalApiError('expired', 401))
  return request<T>(path, options, token)
}

export async function verifySession(token: string, signal?: AbortSignal): Promise<PortalSession> {
  const profile = parseProfile(await request<unknown>('users/me', { signal }, token))
  if (!profile) throw new PortalApiError('invalid-response')
  const session = authenticatedSession(profile)
  if (!session) throw new PortalApiError('unsupported')
  return session
}

export async function signIn(
  email: string,
  password: string,
  signal?: AbortSignal,
): Promise<PortalSession> {
  const result = await request<unknown>('auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim(), password }),
    signal,
  })
  const token = parseAccessToken(
    result && typeof result === 'object' && 'accessToken' in result ? result.accessToken : null,
  )
  if (!token) throw new PortalApiError('invalid-response')
  const session = await verifySession(token, signal)
  signal?.throwIfAborted()
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ version: 1, accessToken: token }))
  } catch {
    throw new PortalApiError('storage')
  }
  window.dispatchEvent(new Event(SESSION_EVENT))
  return session
}
