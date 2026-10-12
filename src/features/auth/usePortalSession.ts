import { useCallback, useEffect, useState } from 'react'
import {
  clearPortalSession,
  PortalApiError,
  readSessionToken,
  signOutSession,
  verifySession,
} from '@/features/auth/client'
import { SESSION_EVENT } from '@/features/auth/session'
import type { PortalSession, PortalSessionStatus } from '@/features/auth/types'

interface SessionState {
  status: PortalSessionStatus
  session: PortalSession | null
  error: string | null
}

export function usePortalSession() {
  const [revision, setRevision] = useState(0)
  const [state, setState] = useState<SessionState>({
    status: 'loading',
    session: null,
    error: null,
  })
  const retry = useCallback(() => {
    setState({ status: 'loading', session: null, error: null })
    setRevision((value) => value + 1)
  }, [])
  const signOut = useCallback(() => {
    void signOutSession().catch(() => clearPortalSession())
    setState({ status: 'signed-out', session: null, error: null })
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    const token = readSessionToken()
    Promise.resolve()
      .then(async () => {
        if (!token) return { status: 'signed-out', session: null, error: null } as SessionState
        try {
          const session = await verifySession(token, controller.signal)
          return { status: 'ready', session, error: null } as SessionState
        } catch (error) {
          if (controller.signal.aborted) return null
          const code = error instanceof PortalApiError ? error.code : 'network'
          const status =
            code === 'expired' ? 'signed-out' : code === 'unsupported' ? 'unsupported' : 'error'
          return { status, session: null, error: code } as SessionState
        }
      })
      .then((next) => {
        if (next && !controller.signal.aborted) setState(next)
      })
    const onSessionChange = () => {
      controller.abort()
      if (!readSessionToken()) setState({ status: 'signed-out', session: null, error: null })
      else setRevision((value) => value + 1)
    }
    window.addEventListener(SESSION_EVENT, onSessionChange)
    return () => {
      controller.abort()
      window.removeEventListener(SESSION_EVENT, onSessionChange)
    }
  }, [revision])

  return { ...state, retry, signOut }
}
