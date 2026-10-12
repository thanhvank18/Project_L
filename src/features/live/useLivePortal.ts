import { useCallback, useEffect, useRef, useState } from 'react'
import { apiRequest, PortalApiError, readSessionToken } from '@/features/auth/client'
import type { ActionResult, LiveState } from '../../../shared/portal'
import { createMutationQueue } from '@/features/live/mutation-queue'

export function useLivePortal() {
  const [state, setState] = useState<LiveState | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [loading, setLoading] = useState(true)
  const generation = useRef(0)
  const mutations = useRef(0)
  const alive = useRef(true)
  const [enqueue] = useState(createMutationQueue)
  const refresh = useCallback(async () => {
    if (mutations.current) return
    const token = readSessionToken()
    const request = ++generation.current
    try {
      const next = await apiRequest<LiveState>('portal/state')
      if (alive.current && token === readSessionToken() && request === generation.current) {
        setState(next)
        setError(null)
      }
    } catch (failure) {
      if (alive.current && token === readSessionToken() && request === generation.current)
        setError(failure)
      throw failure
    } finally {
      if (alive.current) setLoading(false)
    }
  }, [])
  const run = useCallback(
    (type: string, payload: Record<string, unknown>) => {
      // Bind queued work to the account and input that enqueued it, even after sign-out.
      const token = readSessionToken()
      const body = JSON.stringify({ type, payload })
      ++mutations.current
      return enqueue(async () => {
        const assertSession = () => {
          if (!alive.current || !token || token !== readSessionToken())
            throw new PortalApiError('expired', 401)
        }
        assertSession()
        const request = ++generation.current
        const result = await apiRequest<ActionResult>('portal/actions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
        })
        assertSession()
        if (request === generation.current) {
          setState(result.state)
          setError(null)
        }
        return result
      }).finally(() => {
        --mutations.current
      })
    },
    [enqueue],
  )
  useEffect(() => {
    alive.current = true
    void refresh().catch(() => undefined)
    const onFocus = () => {
      void refresh().catch(() => undefined)
    }
    window.addEventListener('focus', onFocus)
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') onFocus()
    }, 30000)
    return () => {
      alive.current = false
      // This ref is a request counter, not a DOM node; invalidate the latest request on cleanup.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      ++generation.current
      window.removeEventListener('focus', onFocus)
      window.clearInterval(interval)
    }
  }, [refresh])
  return { state, error, loading, refresh, run }
}
