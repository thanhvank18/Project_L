import { useEffect, useMemo, useSyncExternalStore } from 'react'
import { portalDemoData } from '@/features/learning/data'
import { createLearningStore } from '@/features/learning/model'
import type { PortalData } from '@/features/learning/types'

function getLocalStorage(scope?: string) {
  try {
    const storage = window.localStorage
    if (!scope) return storage
    const scopedKey = (key: string) => `${key}.${encodeURIComponent(scope)}`
    return {
      getItem: (key: string) => storage.getItem(scopedKey(key)),
      setItem: (key: string, value: string) => storage.setItem(scopedKey(key), value),
    }
  } catch {
    return null
  }
}

export function useLearningDemo(scope?: string, data: PortalData = portalDemoData) {
  const store = useMemo(() => createLearningStore(getLocalStorage(scope)), [scope])
  useEffect(() => {
    store.updateData(data)
  }, [data, store])
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot)
  return { ...snapshot, actions: store.actions }
}
